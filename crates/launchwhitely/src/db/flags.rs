use crate::db::envs::parse_ts;
use crate::error::{AppError, Result};
use launchwhitely_core::{Flag, FlagConfig, FlagKind, VariationValue};
use sqlx::{Row, SqlitePool};
use time::OffsetDateTime;

// ── Flags ─────────────────────────────────────────────────────────────────

pub async fn list_flags(pool: &SqlitePool) -> Result<Vec<Flag>> {
    let rows = sqlx::query(
        "SELECT key, kind, variations, description, created_at, updated_at FROM flags ORDER BY key",
    )
    .fetch_all(pool)
    .await?;
    rows.iter().map(row_to_flag).collect()
}

pub async fn get_flag(pool: &SqlitePool, key: &str) -> Result<Flag> {
    let row = sqlx::query(
        "SELECT key, kind, variations, description, created_at, updated_at FROM flags WHERE key = ?",
    )
    .bind(key)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("flag '{key}' not found")))?;
    row_to_flag(&row)
}

pub async fn create_flag(
    pool: &SqlitePool,
    key: &str,
    kind: &FlagKind,
    variations: &[VariationValue],
    description: &str,
) -> Result<Flag> {
    if variations.is_empty() {
        return Err(AppError::BadRequest(
            "flag must have at least one variation".into(),
        ));
    }
    let existing = sqlx::query("SELECT key FROM flags WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await?;
    if existing.is_some() {
        return Err(AppError::Conflict(format!("flag '{key}' already exists")));
    }
    let kind_str = kind_to_str(kind);
    let variations_json =
        serde_json::to_string(variations).map_err(|e| AppError::Internal(e.to_string()))?;
    sqlx::query("INSERT INTO flags (key, kind, variations, description) VALUES (?, ?, ?, ?)")
        .bind(key)
        .bind(kind_str)
        .bind(&variations_json)
        .bind(description)
        .execute(pool)
        .await?;
    get_flag(pool, key).await
}

pub async fn update_flag(
    pool: &SqlitePool,
    key: &str,
    description: Option<&str>,
    variations: Option<&[VariationValue]>,
) -> Result<Flag> {
    let now = now_str();
    if let Some(d) = description {
        sqlx::query("UPDATE flags SET description = ?, updated_at = ? WHERE key = ?")
            .bind(d)
            .bind(&now)
            .bind(key)
            .execute(pool)
            .await?;
    }
    if let Some(v) = variations {
        if v.is_empty() {
            return Err(AppError::BadRequest(
                "flag must have at least one variation".into(),
            ));
        }
        let vj = serde_json::to_string(v).map_err(|e| AppError::Internal(e.to_string()))?;
        sqlx::query("UPDATE flags SET variations = ?, updated_at = ? WHERE key = ?")
            .bind(&vj)
            .bind(&now)
            .bind(key)
            .execute(pool)
            .await?;
    }
    get_flag(pool, key).await
}

pub async fn delete_flag(pool: &SqlitePool, key: &str) -> Result<()> {
    let n = sqlx::query("DELETE FROM flags WHERE key = ?")
        .bind(key)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound(format!("flag '{key}' not found")));
    }
    Ok(())
}

// ── FlagConfig ─────────────────────────────────────────────────────────────

pub async fn get_config(pool: &SqlitePool, flag_key: &str, env_key: &str) -> Result<FlagConfig> {
    let row = sqlx::query(
        "SELECT flag_key, env_key, enabled, targets, rules, fallthrough, off_variation, salt, updated_at \
         FROM flag_configs WHERE flag_key = ? AND env_key = ?",
    )
    .bind(flag_key)
    .bind(env_key)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| {
        AppError::NotFound(format!(
            "config for flag '{flag_key}' in env '{env_key}' not found"
        ))
    })?;
    row_to_config(&row)
}

pub async fn list_configs_for_env(pool: &SqlitePool, env_key: &str) -> Result<Vec<FlagConfig>> {
    let rows = sqlx::query(
        "SELECT flag_key, env_key, enabled, targets, rules, fallthrough, off_variation, salt, updated_at \
         FROM flag_configs WHERE env_key = ?",
    )
    .bind(env_key)
    .fetch_all(pool)
    .await?;
    rows.iter().map(row_to_config).collect()
}

pub async fn upsert_config(pool: &SqlitePool, config: &FlagConfig) -> Result<FlagConfig> {
    let enabled: i64 = if config.enabled { 1 } else { 0 };
    let targets =
        serde_json::to_string(&config.targets).map_err(|e| AppError::Internal(e.to_string()))?;
    let rules =
        serde_json::to_string(&config.rules).map_err(|e| AppError::Internal(e.to_string()))?;
    let fallthrough = serde_json::to_string(&config.fallthrough)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let off_var = config.off_variation as i64;
    let now = now_str();

    sqlx::query(
        r#"INSERT INTO flag_configs (flag_key, env_key, enabled, targets, rules, fallthrough, off_variation, salt, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(flag_key, env_key) DO UPDATE SET
             enabled = excluded.enabled,
             targets = excluded.targets,
             rules = excluded.rules,
             fallthrough = excluded.fallthrough,
             off_variation = excluded.off_variation,
             salt = excluded.salt,
             updated_at = excluded.updated_at"#,
    )
    .bind(&config.flag_key)
    .bind(&config.env_key)
    .bind(enabled)
    .bind(&targets)
    .bind(&rules)
    .bind(&fallthrough)
    .bind(off_var)
    .bind(&config.salt)
    .bind(&now)
    .execute(pool)
    .await?;

    get_config(pool, &config.flag_key, &config.env_key).await
}

pub async fn toggle_flag(
    pool: &SqlitePool,
    flag_key: &str,
    env_key: &str,
    enabled: bool,
) -> Result<FlagConfig> {
    let enabled_int: i64 = if enabled { 1 } else { 0 };
    let now = now_str();
    let n = sqlx::query(
        "UPDATE flag_configs SET enabled = ?, updated_at = ? WHERE flag_key = ? AND env_key = ?",
    )
    .bind(enabled_int)
    .bind(&now)
    .bind(flag_key)
    .bind(env_key)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound(format!(
            "config for flag '{flag_key}' in env '{env_key}' not found — create it first"
        )));
    }
    get_config(pool, flag_key, env_key).await
}

pub async fn ensure_default_config(
    pool: &SqlitePool,
    flag_key: &str,
    env_key: &str,
) -> Result<FlagConfig> {
    let existing =
        sqlx::query("SELECT flag_key FROM flag_configs WHERE flag_key = ? AND env_key = ?")
            .bind(flag_key)
            .bind(env_key)
            .fetch_optional(pool)
            .await?;

    if existing.is_some() {
        return get_config(pool, flag_key, env_key).await;
    }

    let salt = generate_salt();
    let now = now_str();
    sqlx::query(
        r#"INSERT INTO flag_configs (flag_key, env_key, enabled, targets, rules, fallthrough, off_variation, salt, updated_at)
           VALUES (?, ?, 0, '{}', '[]', '0', 0, ?, ?)"#,
    )
    .bind(flag_key)
    .bind(env_key)
    .bind(&salt)
    .bind(&now)
    .execute(pool)
    .await?;

    get_config(pool, flag_key, env_key).await
}

// ── Row converters ─────────────────────────────────────────────────────────

fn row_to_flag(row: &sqlx::sqlite::SqliteRow) -> Result<Flag> {
    let kind_str: String = row
        .try_get("kind")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let variations_str: String = row
        .try_get("variations")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let created_at_str: String = row
        .try_get("created_at")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let updated_at_str: String = row
        .try_get("updated_at")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(Flag {
        key: row
            .try_get("key")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        kind: str_to_kind(&kind_str)?,
        variations: serde_json::from_str(&variations_str)
            .map_err(|e| AppError::Internal(format!("parse variations: {e}")))?,
        description: row
            .try_get("description")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        created_at: parse_ts(&created_at_str)?,
        updated_at: parse_ts(&updated_at_str)?,
    })
}

fn row_to_config(row: &sqlx::sqlite::SqliteRow) -> Result<FlagConfig> {
    let enabled: i64 = row
        .try_get("enabled")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let targets_str: String = row
        .try_get("targets")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let rules_str: String = row
        .try_get("rules")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let fallthrough_str: String = row
        .try_get("fallthrough")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let off_var: i64 = row
        .try_get("off_variation")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let updated_at_str: String = row
        .try_get("updated_at")
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(FlagConfig {
        flag_key: row
            .try_get("flag_key")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        env_key: row
            .try_get("env_key")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        enabled: enabled != 0,
        targets: serde_json::from_str(&targets_str)
            .map_err(|e| AppError::Internal(format!("parse targets: {e}")))?,
        rules: serde_json::from_str(&rules_str)
            .map_err(|e| AppError::Internal(format!("parse rules: {e}")))?,
        fallthrough: serde_json::from_str(&fallthrough_str)
            .map_err(|e| AppError::Internal(format!("parse fallthrough: {e}")))?,
        off_variation: off_var as usize,
        salt: row
            .try_get("salt")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        updated_at: parse_ts(&updated_at_str)?,
    })
}

fn kind_to_str(kind: &FlagKind) -> &'static str {
    match kind {
        FlagKind::Bool => "bool",
        FlagKind::String => "string",
        FlagKind::Number => "number",
        FlagKind::Json => "json",
    }
}

fn str_to_kind(s: &str) -> Result<FlagKind> {
    match s {
        "bool" => Ok(FlagKind::Bool),
        "string" => Ok(FlagKind::String),
        "number" => Ok(FlagKind::Number),
        "json" => Ok(FlagKind::Json),
        other => Err(AppError::Internal(format!("unknown flag kind: {other}"))),
    }
}

fn now_str() -> String {
    OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}

fn generate_salt() -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use std::time::SystemTime;
    let mut h = DefaultHasher::new();
    SystemTime::now().hash(&mut h);
    std::thread::current().id().hash(&mut h);
    format!("{:016x}", h.finish())
}
