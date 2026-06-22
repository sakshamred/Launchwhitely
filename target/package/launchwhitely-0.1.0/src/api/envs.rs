use crate::auth::Caller;
use crate::db::{self, Pool};
use crate::error::Result;
use crate::store::MemStore;
use axum::{
    extract::{Extension, Path, State},
    Json,
};
use launchwhitely_core::Environment;
use serde::Deserialize;
use std::sync::Arc;

type AppState = (Arc<Pool>, Arc<MemStore>);

#[derive(Deserialize)]
pub struct CreateEnvBody {
    pub key: String,
    pub name: String,
}

pub async fn list(
    State((pool, _)): State<AppState>,
    Extension(caller): Extension<Caller>,
) -> Result<Json<Vec<Environment>>> {
    caller.require_admin()?;
    Ok(Json(db::envs::list(&pool).await?))
}

pub async fn get_one(
    State((pool, _)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path(key): Path<String>,
) -> Result<Json<Environment>> {
    caller.require_admin()?;
    Ok(Json(db::envs::get(&pool, &key).await?))
}

pub async fn create(
    State((pool, store)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Json(body): Json<CreateEnvBody>,
) -> Result<Json<Environment>> {
    caller.require_admin()?;
    validate_key(&body.key)?;
    let env = db::envs::create(&pool, &body.key, &body.name).await?;
    // Initialize in-memory state for the new env
    store.ensure_channel(&env.key).await;
    Ok(Json(env))
}

pub async fn delete(
    State((pool, _)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path(key): Path<String>,
) -> Result<Json<serde_json::Value>> {
    caller.require_admin()?;
    db::envs::delete(&pool, &key).await?;
    Ok(Json(serde_json::json!({ "deleted": key })))
}

fn validate_key(key: &str) -> Result<()> {
    use crate::error::AppError;
    if key.is_empty() || key.len() > 64 {
        return Err(AppError::BadRequest("key must be 1–64 characters".into()));
    }
    if !key
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AppError::BadRequest(
            "key may only contain alphanumeric characters, hyphens, and underscores".into(),
        ));
    }
    Ok(())
}
