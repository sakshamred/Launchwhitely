use crate::db::envs::parse_ts;
use crate::error::{AppError, Result};
use launchwhitely_core::{ApiKey, KeyRole};
use sha2::{Digest, Sha256};
use sqlx::{Row, SqlitePool};

pub fn hash_key(raw: &str) -> String {
    let mut h = Sha256::new();
    h.update(raw.as_bytes());
    hex::encode(h.finalize())
}

pub async fn create(
    pool: &SqlitePool,
    id: &str,
    raw_key: &str,
    role: &KeyRole,
    env_key: Option<&str>,
    name: &str,
) -> Result<ApiKey> {
    let hash = hash_key(raw_key);
    let role_str = role_to_str(role);
    sqlx::query("INSERT INTO api_keys (id, hash, role, env_key, name) VALUES (?, ?, ?, ?, ?)")
        .bind(id)
        .bind(&hash)
        .bind(role_str)
        .bind(env_key)
        .bind(name)
        .execute(pool)
        .await?;
    get_by_id(pool, id).await
}

pub async fn get_by_id(pool: &SqlitePool, id: &str) -> Result<ApiKey> {
    let row =
        sqlx::query("SELECT id, hash, role, env_key, name, created_at FROM api_keys WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("api key '{id}' not found")))?;
    row_to_key(&row)
}

pub async fn get_by_hash(pool: &SqlitePool, hash: &str) -> Result<Option<ApiKey>> {
    let row = sqlx::query(
        "SELECT id, hash, role, env_key, name, created_at FROM api_keys WHERE hash = ?",
    )
    .bind(hash)
    .fetch_optional(pool)
    .await?;
    match row {
        None => Ok(None),
        Some(r) => Ok(Some(row_to_key(&r)?)),
    }
}

pub async fn list(pool: &SqlitePool) -> Result<Vec<ApiKey>> {
    let rows = sqlx::query(
        "SELECT id, hash, role, env_key, name, created_at FROM api_keys ORDER BY created_at",
    )
    .fetch_all(pool)
    .await?;
    rows.iter().map(row_to_key).collect()
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<()> {
    let n = sqlx::query("DELETE FROM api_keys WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound(format!("api key '{id}' not found")));
    }
    Ok(())
}

pub async fn count(pool: &SqlitePool) -> Result<i64> {
    let row = sqlx::query("SELECT COUNT(*) as n FROM api_keys")
        .fetch_one(pool)
        .await?;
    let n: i64 = row
        .try_get("n")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(n)
}

fn row_to_key(row: &sqlx::sqlite::SqliteRow) -> Result<ApiKey> {
    let role_str: String = row
        .try_get("role")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let created_at_str: String = row
        .try_get("created_at")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(ApiKey {
        id: row
            .try_get("id")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        hash: row
            .try_get("hash")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        role: str_to_role(&role_str)?,
        env_key: row
            .try_get("env_key")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        name: row
            .try_get("name")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        created_at: parse_ts(&created_at_str)?,
    })
}

fn role_to_str(role: &KeyRole) -> &'static str {
    match role {
        KeyRole::Admin => "admin",
        KeyRole::Sdk => "sdk",
    }
}

fn str_to_role(s: &str) -> Result<KeyRole> {
    match s {
        "admin" => Ok(KeyRole::Admin),
        "sdk" => Ok(KeyRole::Sdk),
        other => Err(AppError::Internal(format!("unknown key role: {other}"))),
    }
}
