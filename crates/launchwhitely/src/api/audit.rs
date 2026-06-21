use crate::auth::Caller;
use crate::db::{self, audit::AuditFilter, Pool};
use crate::error::Result;
use crate::store::MemStore;
use axum::{
    extract::{Extension, Query, State},
    Json,
};
use launchwhitely_core::AuditEntry;
use serde::Deserialize;
use std::sync::Arc;

type AppState = (Arc<Pool>, Arc<MemStore>);

#[derive(Deserialize)]
pub struct AuditQuery {
    pub flag_key: Option<String>,
    pub env_key: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 {
    50
}

pub async fn list(
    State((pool, _)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Query(q): Query<AuditQuery>,
) -> Result<Json<Vec<AuditEntry>>> {
    caller.require_admin()?;
    let entries = db::audit::list(
        &pool,
        AuditFilter {
            flag_key: q.flag_key.as_deref(),
            env_key: q.env_key.as_deref(),
            limit: q.limit.clamp(1, 500),
            offset: q.offset.max(0),
        },
    )
    .await?;
    Ok(Json(entries))
}
