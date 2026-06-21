use crate::db::envs::parse_ts;
use crate::error::{AppError, Result};
use launchwhitely_core::Segment;
use sqlx::{Row, SqlitePool};
use time::OffsetDateTime;

pub async fn list(pool: &SqlitePool, env_key: &str) -> Result<Vec<Segment>> {
    let rows = sqlx::query(
        "SELECT key, env_key, name, included, excluded, clauses, created_at, updated_at \
         FROM segments WHERE env_key = ? ORDER BY key",
    )
    .bind(env_key)
    .fetch_all(pool)
    .await?;
    rows.iter().map(row_to_segment).collect()
}

pub async fn get(pool: &SqlitePool, key: &str, env_key: &str) -> Result<Segment> {
    let row = sqlx::query(
        "SELECT key, env_key, name, included, excluded, clauses, created_at, updated_at \
         FROM segments WHERE key = ? AND env_key = ?",
    )
    .bind(key)
    .bind(env_key)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("segment '{key}' not found in env '{env_key}'")))?;
    row_to_segment(&row)
}

pub async fn create(
    pool: &SqlitePool,
    key: &str,
    env_key: &str,
    name: &str,
    included: &[String],
    excluded: &[String],
    clauses: &[launchwhitely_core::Clause],
) -> Result<Segment> {
    let existing = sqlx::query("SELECT key FROM segments WHERE key = ? AND env_key = ?")
        .bind(key)
        .bind(env_key)
        .fetch_optional(pool)
        .await?;
    if existing.is_some() {
        return Err(AppError::Conflict(format!(
            "segment '{key}' already exists in env '{env_key}'"
        )));
    }
    let inc = serde_json::to_string(included).map_err(|e| AppError::Internal(e.to_string()))?;
    let exc = serde_json::to_string(excluded).map_err(|e| AppError::Internal(e.to_string()))?;
    let cls = serde_json::to_string(clauses).map_err(|e| AppError::Internal(e.to_string()))?;

    sqlx::query(
        "INSERT INTO segments (key, env_key, name, included, excluded, clauses) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(key)
    .bind(env_key)
    .bind(name)
    .bind(&inc)
    .bind(&exc)
    .bind(&cls)
    .execute(pool)
    .await?;

    get(pool, key, env_key).await
}

pub async fn update(
    pool: &SqlitePool,
    key: &str,
    env_key: &str,
    name: Option<&str>,
    included: Option<&[String]>,
    excluded: Option<&[String]>,
    clauses: Option<&[launchwhitely_core::Clause]>,
) -> Result<Segment> {
    let now = now_str();
    if let Some(n) = name {
        sqlx::query("UPDATE segments SET name = ?, updated_at = ? WHERE key = ? AND env_key = ?")
            .bind(n)
            .bind(&now)
            .bind(key)
            .bind(env_key)
            .execute(pool)
            .await?;
    }
    if let Some(inc) = included {
        let j = serde_json::to_string(inc).map_err(|e| AppError::Internal(e.to_string()))?;
        sqlx::query(
            "UPDATE segments SET included = ?, updated_at = ? WHERE key = ? AND env_key = ?",
        )
        .bind(&j)
        .bind(&now)
        .bind(key)
        .bind(env_key)
        .execute(pool)
        .await?;
    }
    if let Some(exc) = excluded {
        let j = serde_json::to_string(exc).map_err(|e| AppError::Internal(e.to_string()))?;
        sqlx::query(
            "UPDATE segments SET excluded = ?, updated_at = ? WHERE key = ? AND env_key = ?",
        )
        .bind(&j)
        .bind(&now)
        .bind(key)
        .bind(env_key)
        .execute(pool)
        .await?;
    }
    if let Some(cls) = clauses {
        let j = serde_json::to_string(cls).map_err(|e| AppError::Internal(e.to_string()))?;
        sqlx::query(
            "UPDATE segments SET clauses = ?, updated_at = ? WHERE key = ? AND env_key = ?",
        )
        .bind(&j)
        .bind(&now)
        .bind(key)
        .bind(env_key)
        .execute(pool)
        .await?;
    }
    get(pool, key, env_key).await
}

pub async fn delete(pool: &SqlitePool, key: &str, env_key: &str) -> Result<()> {
    let n = sqlx::query("DELETE FROM segments WHERE key = ? AND env_key = ?")
        .bind(key)
        .bind(env_key)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound(format!(
            "segment '{key}' not found in env '{env_key}'"
        )));
    }
    Ok(())
}

fn row_to_segment(row: &sqlx::sqlite::SqliteRow) -> Result<Segment> {
    let included_str: String = row
        .try_get("included")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let excluded_str: String = row
        .try_get("excluded")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let clauses_str: String = row
        .try_get("clauses")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let created_at_str: String = row
        .try_get("created_at")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let updated_at_str: String = row
        .try_get("updated_at")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(Segment {
        key: row
            .try_get("key")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        env_key: row
            .try_get("env_key")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        name: row
            .try_get("name")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        included: serde_json::from_str(&included_str)
            .map_err(|e| AppError::Internal(format!("parse included: {e}")))?,
        excluded: serde_json::from_str(&excluded_str)
            .map_err(|e| AppError::Internal(format!("parse excluded: {e}")))?,
        clauses: serde_json::from_str(&clauses_str)
            .map_err(|e| AppError::Internal(format!("parse clauses: {e}")))?,
        created_at: parse_ts(&created_at_str)?,
        updated_at: parse_ts(&updated_at_str)?,
    })
}

fn now_str() -> String {
    OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}
