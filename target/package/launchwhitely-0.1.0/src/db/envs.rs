use crate::error::{AppError, Result};
use launchwhitely_core::Environment;
use sqlx::{Row, SqlitePool};
use time::OffsetDateTime;

pub async fn list(pool: &SqlitePool) -> Result<Vec<Environment>> {
    let rows = sqlx::query("SELECT key, name, created_at FROM environments ORDER BY created_at")
        .fetch_all(pool)
        .await?;
    rows.iter().map(row_to_env).collect()
}

pub async fn get(pool: &SqlitePool, key: &str) -> Result<Environment> {
    let row = sqlx::query("SELECT key, name, created_at FROM environments WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("environment '{key}' not found")))?;
    row_to_env(&row)
}

pub async fn create(pool: &SqlitePool, key: &str, name: &str) -> Result<Environment> {
    let existing = sqlx::query("SELECT key FROM environments WHERE key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await?;
    if existing.is_some() {
        return Err(AppError::Conflict(format!(
            "environment '{key}' already exists"
        )));
    }
    sqlx::query("INSERT INTO environments (key, name) VALUES (?, ?)")
        .bind(key)
        .bind(name)
        .execute(pool)
        .await?;
    get(pool, key).await
}

pub async fn delete(pool: &SqlitePool, key: &str) -> Result<()> {
    let n = sqlx::query("DELETE FROM environments WHERE key = ?")
        .bind(key)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound(format!("environment '{key}' not found")));
    }
    Ok(())
}

fn row_to_env(row: &sqlx::sqlite::SqliteRow) -> Result<Environment> {
    Ok(Environment {
        key: row
            .try_get("key")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        name: row
            .try_get("name")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        created_at: parse_ts(
            &row.try_get::<String, _>("created_at")
                .map_err(|e| AppError::Internal(e.to_string()))?,
        )?,
    })
}

pub fn parse_ts(s: &str) -> Result<OffsetDateTime> {
    if let Ok(t) = OffsetDateTime::parse(s, &time::format_description::well_known::Rfc3339) {
        return Ok(t);
    }
    // Sqlite default format (without timezone suffix)
    let desc = time::format_description::parse_borrowed::<2>(
        "[year]-[month]-[day]T[hour]:[minute]:[second]Z",
    )
    .map_err(|e| AppError::Internal(format!("timestamp format error: {e}")))?;
    OffsetDateTime::parse(s, &desc)
        .map_err(|e| AppError::Internal(format!("cannot parse timestamp '{s}': {e}")))
}
