use arc_swap::ArcSwap;
use launchwhitely_core::{EnvRuleset, Flag, FlagConfig, Segment};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use time::OffsetDateTime;
use tokio::sync::broadcast;

/// SSE event payload sent to connected SDK clients.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum SseEvent {
    /// Full ruleset snapshot on connect.
    Put { data: EnvRuleset },
    /// A single flag's config changed.
    Patch {
        flag_key: String,
        data: serde_json::Value,
    },
    /// A flag was deleted.
    Delete { flag_key: String },
    /// Keepalive (sent as SSE comment).
    Ping,
}

/// Per-environment broadcast channel capacity.
const CHANNEL_CAPACITY: usize = 128;

/// The live ruleset for one environment.
#[derive(Clone, Default)]
pub struct EnvState {
    pub flags: HashMap<String, Flag>,
    pub configs: HashMap<String, FlagConfig>,
    pub segments: HashMap<String, Segment>,
}

impl EnvState {
    pub fn to_ruleset(&self, env_key: &str) -> EnvRuleset {
        EnvRuleset {
            env_key: env_key.to_string(),
            flags: self.flags.values().cloned().collect(),
            configs: self.configs.values().cloned().collect(),
            segments: self.segments.values().cloned().collect(),
            generated_at: OffsetDateTime::now_utc(),
        }
    }
}

/// Global in-memory store. Evaluations read from this; mutations update it.
pub struct MemStore {
    /// env_key → ArcSwap<EnvState>
    envs: ArcSwap<HashMap<String, Arc<ArcSwap<EnvState>>>>,
    /// env_key → broadcast sender
    channels: tokio::sync::RwLock<HashMap<String, broadcast::Sender<SseEvent>>>,
}

impl MemStore {
    pub fn new() -> Self {
        Self {
            envs: ArcSwap::from_pointee(HashMap::new()),
            channels: tokio::sync::RwLock::new(HashMap::new()),
        }
    }

    /// Get or initialize per-env state.
    pub fn env_state(&self, env_key: &str) -> Arc<ArcSwap<EnvState>> {
        let map = self.envs.load();
        if let Some(s) = map.get(env_key) {
            return Arc::clone(s);
        }
        // Insert a new empty state atomically
        let new_state = Arc::new(ArcSwap::from_pointee(EnvState::default()));
        let mut new_map = (**map).clone();
        new_map.insert(env_key.to_string(), Arc::clone(&new_state));
        self.envs.store(Arc::new(new_map));
        new_state
    }

    /// Snapshot the full ruleset for an environment (for SSE put + SDK endpoint).
    pub fn snapshot(&self, env_key: &str) -> EnvRuleset {
        let state = self.env_state(env_key);
        state.load().to_ruleset(env_key)
    }

    /// Replace the entire state for an env (used on startup load).
    pub fn replace_env(&self, env_key: &str, state: EnvState) {
        self.env_state(env_key).store(Arc::new(state));
    }

    /// Update a flag definition across all envs (flag defs are env-independent).
    pub fn upsert_flag(&self, flag: Flag) {
        let map = self.envs.load();
        for (_, env_arc) in map.iter() {
            let mut s = (**env_arc.load()).clone();
            s.flags.insert(flag.key.clone(), flag.clone());
            env_arc.store(Arc::new(s));
        }
    }

    /// Remove a flag from all envs.
    pub fn remove_flag(&self, flag_key: &str) {
        let map = self.envs.load();
        for (_, env_arc) in map.iter() {
            let mut s = (**env_arc.load()).clone();
            s.flags.remove(flag_key);
            s.configs.remove(flag_key);
            env_arc.store(Arc::new(s));
        }
    }

    /// Update a flag's config in one env.
    pub fn upsert_config(&self, env_key: &str, config: FlagConfig) {
        let arc = self.env_state(env_key);
        let mut s = (**arc.load()).clone();
        s.configs.insert(config.flag_key.clone(), config);
        arc.store(Arc::new(s));
    }

    /// Update a segment in one env.
    pub fn upsert_segment(&self, env_key: &str, seg: Segment) {
        let arc = self.env_state(env_key);
        let mut s = (**arc.load()).clone();
        s.segments.insert(seg.key.clone(), seg);
        arc.store(Arc::new(s));
    }

    pub fn remove_segment(&self, env_key: &str, seg_key: &str) {
        let arc = self.env_state(env_key);
        let mut s = (**arc.load()).clone();
        s.segments.remove(seg_key);
        arc.store(Arc::new(s));
    }

    // ── SSE channels ───────────────────────────────────────────────────────

    pub async fn subscribe(&self, env_key: &str) -> broadcast::Receiver<SseEvent> {
        let mut chs = self.channels.write().await;
        chs.entry(env_key.to_string())
            .or_insert_with(|| broadcast::channel(CHANNEL_CAPACITY).0)
            .subscribe()
    }

    pub async fn broadcast(&self, env_key: &str, event: SseEvent) {
        let chs = self.channels.read().await;
        if let Some(tx) = chs.get(env_key) {
            // Ignore send errors (no subscribers is OK)
            let _ = tx.send(event);
        }
    }

    /// Ensure the SSE channel exists for an env (idempotent).
    pub async fn ensure_channel(&self, env_key: &str) {
        let mut chs = self.channels.write().await;
        chs.entry(env_key.to_string())
            .or_insert_with(|| broadcast::channel(CHANNEL_CAPACITY).0);
    }
}

/// Load the full ruleset for every environment from the DB into the store.
pub async fn load_from_db(pool: &crate::db::Pool, store: &Arc<MemStore>) -> anyhow::Result<()> {
    use crate::db::{envs as db_envs, flags as db_flags, segments as db_segments};

    let envs = db_envs::list(pool).await?;
    let all_flags = db_flags::list_flags(pool).await?;

    for env in &envs {
        let configs = db_flags::list_configs_for_env(pool, &env.key).await?;
        let segments = db_segments::list(pool, &env.key).await?;

        let mut state = EnvState::default();
        for flag in &all_flags {
            state.flags.insert(flag.key.clone(), flag.clone());
        }
        for config in configs {
            state.configs.insert(config.flag_key.clone(), config);
        }
        for seg in segments {
            state.segments.insert(seg.key.clone(), seg);
        }
        store.replace_env(&env.key, state);
        store.ensure_channel(&env.key).await;
    }

    Ok(())
}
