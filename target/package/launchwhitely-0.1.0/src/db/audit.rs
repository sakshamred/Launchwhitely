use crate::db::envs::parse_ts;
use crate::error::{AppError, Result};
use launchwhitely_core::AuditEntry;
use serde_json::Value;
use sqlx::{Row, SqlitePool};

pub struct AuditInsert<'a> {
    pub id: &'a str,
    pub actor_key_id: &'a str,
    pub action: &'a str,
    pub flag_key: Option<&'a str>,
    pub env_key: Option<&'a str>,
    pub before: Option<&'a Value>,
    pub after: Option<&'a Value>,
}

pub async fn insert(pool: &SqlitePool, ins: AuditInsert<'_>) -> Result<()> {
    let before_str = ins.before.map(|v| v.to_string());
    let after_str = ins.after.map(|v| v.to_string());

    sqlx::query(
        "INSERT INTO audit_log (id, actor_key_id, action, flag_key, env_key, before_val, after_val) \
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(ins.id)
    .bind(ins.actor_key_id)
    .bind(ins.action)
    .bind(ins.flag_key)
    .bind(ins.env_key)
    .bind(before_str.as_deref())
    .bind(after_str.as_deref())
    .execute(pool)
    .await?;

    Ok(())
}

pub struct AuditFilter<'a> {
    pub flag_key: Option<&'a str>,
    pub env_key: Option<&'a str>,
    pub limit: i64,
    pub offset: i64,
}

pub async fn list(pool: &SqlitePool, filter: AuditFilter<'_>) -> Result<Vec<AuditEntry>> {
    let mut conditions = Vec::new();
    if filter.flag_key.is_some() {
        conditions.push("flag_key = ?");
    }
    if filter.env_key.is_some() {
        conditions.push("env_key = ?");
    }
    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };
    let sql = format!(
        "SELECT id, ts, actor_key_id, action, flag_key, env_key, before_val, after_val \
         FROM audit_log {where_clause} ORDER BY ts DESC LIMIT ? OFFSET ?"
    );

    let mut q = sqlx::query(&sql);
    if let Some(fk) = filter.flag_key {
        q = q.bind(fk);
    }
    if let Some(ek) = filter.env_key {
        q = q.bind(ek);
    }
    q = q.bind(filter.limit).bind(filter.offset);

    let rows = q.fetch_all(pool).await?;
    rows.iter().map(row_to_entry).collect()
}

fn row_to_entry(row: &sqlx::sqlite::SqliteRow) -> Result<AuditEntry> {
    let ts_str: String = row
        .try_get("ts")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let before_str: Option<String> = row
        .try_get("before_val")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let after_str: Option<String> = row
        .try_get("after_val")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(AuditEntry {
        id: row
            .try_get("id")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        ts: parse_ts(&ts_str)?,
        actor_key_id: row
            .try_get("actor_key_id")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        action: row
            .try_get("action")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        flag_key: row
            .try_get("flag_key")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        env_key: row
            .try_get("env_key")
            .map_err(|e| AppError::Internal(e.to_string()))?,
        before: before_str
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok()),
        after: after_str
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok()),
    })
}
