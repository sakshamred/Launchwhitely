use crate::auth::Caller;
use crate::db::Pool;
use crate::error::{AppError, Result};
use crate::store::{MemStore, SseEvent};
use axum::{
    extract::{Extension, State},
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use futures::stream::{self, Stream, StreamExt};
use launchwhitely_core::{Context, EnvRuleset, EvalResult, KeyRole};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;
use tokio_stream::wrappers::BroadcastStream;

type AppState = (Arc<Pool>, Arc<MemStore>);

// ── GET /api/sdk/flags ─────────────────────────────────────────────────────

/// Returns the full ruleset for the SDK key's environment.
/// Thin clients use this to bootstrap local evaluation.
pub async fn get_flags(
    State((_, store)): State<AppState>,
    Extension(caller): Extension<Caller>,
) -> Result<Json<EnvRuleset>> {
    let env_key = sdk_env(&caller)?;
    let ruleset = store.snapshot(&env_key);
    Ok(Json(ruleset))
}

// ── POST /api/eval ─────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct EvalRequest {
    /// Evaluation context (required).
    pub context: Context,
    /// If set, evaluate only this flag; otherwise evaluate all flags.
    pub flag_key: Option<String>,
}

#[derive(Serialize)]
pub struct EvalResponse {
    pub results: Vec<EvalResult>,
}

pub async fn eval(
    State((_, store)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Json(body): Json<EvalRequest>,
) -> Result<Json<EvalResponse>> {
    let env_key = sdk_env(&caller)?;
    let snapshot = store.snapshot(&env_key);

    let segments: HashMap<String, launchwhitely_core::Segment> = snapshot
        .segments
        .into_iter()
        .map(|s| (s.key.clone(), s))
        .collect();

    let configs: HashMap<String, launchwhitely_core::FlagConfig> = snapshot
        .configs
        .into_iter()
        .map(|c| (c.flag_key.clone(), c))
        .collect();

    let results: Vec<EvalResult> = snapshot
        .flags
        .iter()
        .filter(|f| body.flag_key.as_deref().is_none_or(|k| k == f.key))
        .filter_map(|flag| {
            let config = configs.get(&flag.key)?;
            Some(launchwhitely_core::evaluate(
                flag,
                config,
                &segments,
                &body.context,
            ))
        })
        .collect();

    if let Some(ref fk) = body.flag_key {
        if results.is_empty() {
            return Err(AppError::NotFound(format!("flag '{fk}' not found")));
        }
    }

    Ok(Json(EvalResponse { results }))
}

// ── GET /api/sdk/stream (SSE) ──────────────────────────────────────────────

pub async fn stream(
    State((_, store)): State<AppState>,
    Extension(caller): Extension<Caller>,
) -> Result<Sse<impl Stream<Item = std::result::Result<Event, Infallible>>>> {
    let env_key = sdk_env(&caller)?;

    // Subscribe before snapshot so we don't miss events between snapshot and subscribe
    let rx = store.subscribe(&env_key).await;
    let snapshot = store.snapshot(&env_key);

    // First event: full put with current ruleset
    let put_event = match serde_json::to_string(&SseEvent::Put { data: snapshot }) {
        Ok(json) => Event::default().event("put").data(json),
        Err(e) => Event::default().event("error").data(e.to_string()),
    };

    let initial = stream::once(async move { Ok::<Event, Infallible>(put_event) });

    // Subsequent events from broadcast channel
    let broadcast = BroadcastStream::new(rx).filter_map(|msg| async move {
        match msg {
            Ok(event) => {
                if matches!(event, SseEvent::Ping) {
                    return Some(Ok(Event::default().comment("ping")));
                }
                let json = serde_json::to_string(&event).ok()?;
                let event_type = match &event {
                    SseEvent::Patch { .. } => "patch",
                    SseEvent::Delete { .. } => "delete",
                    _ => "message",
                };
                Some(Ok(Event::default().event(event_type).data(json)))
            }
            // Lagged: client should reconnect and re-fetch /api/sdk/flags
            Err(_) => Some(Ok(Event::default()
                .event("reconnect")
                .data("{\"reason\":\"lagged\"}"))),
        }
    });

    let combined = initial.chain(broadcast);

    Ok(Sse::new(combined).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    ))
}

// ── Helpers ────────────────────────────────────────────────────────────────

/// Extract the scoped env from an SDK key, or error.
fn sdk_env(caller: &Caller) -> Result<String> {
    match caller.key.role {
        KeyRole::Sdk => caller
            .key
            .env_key
            .clone()
            .ok_or_else(|| AppError::Internal("sdk key has no env_key".into())),
        KeyRole::Admin => Err(AppError::Forbidden(
            "sdk endpoint requires an sdk key scoped to an environment".into(),
        )),
    }
}
