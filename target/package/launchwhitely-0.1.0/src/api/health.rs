use crate::db::Pool;
use axum::{extract::State, Json};
use serde_json::{json, Value};
use std::sync::Arc;

pub async fn health(State(pool): State<Arc<Pool>>) -> Json<Value> {
    let db_ok = sqlx::query("SELECT 1")
        .fetch_one(pool.as_ref())
        .await
        .is_ok();
    Json(json!({
        "status": if db_ok { "ok" } else { "degraded" },
        "db": if db_ok { "ok" } else { "error" },
        "version": env!("CARGO_PKG_VERSION"),
    }))
}
