pub mod audit;
pub mod envs;
pub mod flags;
pub mod keys;
pub mod segments;

use anyhow::Result;
use sqlx::{sqlite::SqliteConnectOptions, SqlitePool};
use std::str::FromStr;

pub type Pool = SqlitePool;

pub async fn connect(db_url: &str) -> Result<Pool> {
    let opts = SqliteConnectOptions::from_str(db_url)?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        .foreign_keys(true);

    let pool = SqlitePool::connect_with(opts).await?;
    Ok(pool)
}

/// Embedded migration SQL — run in order on startup.
const MIGRATIONS: &[(&str, &str)] = &[(
    "0001_initial",
    include_str!("../../../../migrations/0001_initial.sql"),
)];

/// Split a SQL script into individual statements, ignoring `;` inside
/// single-line comments (`-- ...`) and string literals (`'...'`).
fn split_sql(sql: &str) -> Vec<&str> {
    let bytes = sql.as_bytes();
    let mut stmts = Vec::new();
    let mut start = 0;
    let mut i = 0;

    while i < bytes.len() {
        match bytes[i] {
            // Single-line comment: skip to end of line
            b'-' if bytes.get(i + 1) == Some(&b'-') => {
                while i < bytes.len() && bytes[i] != b'\n' {
                    i += 1;
                }
            }
            // String literal: skip to matching closing quote (handle '' escape)
            b'\'' => {
                i += 1;
                while i < bytes.len() {
                    if bytes[i] == b'\'' {
                        i += 1;
                        if bytes.get(i) == Some(&b'\'') {
                            i += 1; // escaped quote, keep going
                        } else {
                            break;
                        }
                    } else {
                        i += 1;
                    }
                }
            }
            // Statement terminator
            b';' => {
                let stmt = sql[start..i].trim();
                if !stmt.is_empty() {
                    stmts.push(stmt);
                }
                i += 1;
                start = i;
            }
            _ => {
                i += 1;
            }
        }
    }
    // Trailing statement without semicolon
    let trailing = sql[start..].trim();
    if !trailing.is_empty() {
        stmts.push(trailing);
    }
    stmts
}

pub async fn run_migrations(pool: &Pool) -> Result<()> {
    // Create the migrations tracking table if needed
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS _migrations (
             name TEXT PRIMARY KEY NOT NULL,
             applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
         )",
    )
    .execute(pool)
    .await?;

    for (name, sql) in MIGRATIONS {
        // Skip already-applied migrations
        let row: Option<(String,)> = sqlx::query_as("SELECT name FROM _migrations WHERE name = ?")
            .bind(name)
            .fetch_optional(pool)
            .await?;
        if row.is_some() {
            continue;
        }
        // Run migration (may contain multiple statements)
        for stmt in split_sql(sql) {
            sqlx::query(stmt)
                .execute(pool)
                .await
                .map_err(|e| anyhow::anyhow!("migration stmt failed ({e}): <<{stmt}>>"))?;
        }
        sqlx::query("INSERT INTO _migrations (name) VALUES (?)")
            .bind(name)
            .execute(pool)
            .await?;
        tracing::info!("migration applied: {}", name);
    }
    Ok(())
}
