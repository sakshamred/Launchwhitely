use crate::auth::Caller;
use crate::db::{self, audit::AuditInsert, Pool};
use crate::error::Result;
use crate::store::MemStore;
use axum::{
    extract::{Extension, Path, State},
    Json,
};
use launchwhitely_core::{Clause, Segment};
use serde::Deserialize;
use std::sync::Arc;
use ulid::Ulid;

type AppState = (Arc<Pool>, Arc<MemStore>);

#[derive(Deserialize)]
pub struct CreateSegmentBody {
    pub key: String,
    pub name: String,
    #[serde(default)]
    pub included: Vec<String>,
    #[serde(default)]
    pub excluded: Vec<String>,
    #[serde(default)]
    pub clauses: Vec<Clause>,
}

#[derive(Deserialize)]
pub struct UpdateSegmentBody {
    pub name: Option<String>,
    pub included: Option<Vec<String>>,
    pub excluded: Option<Vec<String>>,
    pub clauses: Option<Vec<Clause>>,
}

pub async fn list(
    State((pool, _)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path(env_key): Path<String>,
) -> Result<Json<Vec<Segment>>> {
    caller.require_env_access(&env_key)?;
    Ok(Json(db::segments::list(&pool, &env_key).await?))
}

pub async fn get_one(
    State((pool, _)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path((env_key, key)): Path<(String, String)>,
) -> Result<Json<Segment>> {
    caller.require_env_access(&env_key)?;
    Ok(Json(db::segments::get(&pool, &key, &env_key).await?))
}

pub async fn create(
    State((pool, store)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path(env_key): Path<String>,
    Json(body): Json<CreateSegmentBody>,
) -> Result<Json<Segment>> {
    caller.require_admin()?;
    db::envs::get(&pool, &env_key).await?;

    let seg = db::segments::create(
        &pool,
        &body.key,
        &env_key,
        &body.name,
        &body.included,
        &body.excluded,
        &body.clauses,
    )
    .await?;

    store.upsert_segment(&env_key, seg.clone());

    let actor = caller.key.id.clone();
    let after_val = serde_json::to_value(&seg).ok();
    let _ = db::audit::insert(
        &pool,
        AuditInsert {
            id: &Ulid::new().to_string(),
            actor_key_id: &actor,
            action: "segment.create",
            flag_key: None,
            env_key: Some(&env_key),
            before: None,
            after: after_val.as_ref(),
        },
    )
    .await;

    Ok(Json(seg))
}

pub async fn update(
    State((pool, store)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path((env_key, key)): Path<(String, String)>,
    Json(body): Json<UpdateSegmentBody>,
) -> Result<Json<Segment>> {
    caller.require_admin()?;
    let before = db::segments::get(&pool, &key, &env_key).await?;
    let seg = db::segments::update(
        &pool,
        &key,
        &env_key,
        body.name.as_deref(),
        body.included.as_deref(),
        body.excluded.as_deref(),
        body.clauses.as_deref(),
    )
    .await?;

    store.upsert_segment(&env_key, seg.clone());

    let actor = caller.key.id.clone();
    let before_val = serde_json::to_value(&before).ok();
    let after_val = serde_json::to_value(&seg).ok();
    let _ = db::audit::insert(
        &pool,
        AuditInsert {
            id: &Ulid::new().to_string(),
            actor_key_id: &actor,
            action: "segment.update",
            flag_key: None,
            env_key: Some(&env_key),
            before: before_val.as_ref(),
            after: after_val.as_ref(),
        },
    )
    .await;

    Ok(Json(seg))
}

pub async fn delete(
    State((pool, store)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path((env_key, key)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>> {
    caller.require_admin()?;
    let before = db::segments::get(&pool, &key, &env_key).await?;
    db::segments::delete(&pool, &key, &env_key).await?;
    store.remove_segment(&env_key, &key);

    let actor = caller.key.id.clone();
    let before_val = serde_json::to_value(&before).ok();
    let _ = db::audit::insert(
        &pool,
        AuditInsert {
            id: &Ulid::new().to_string(),
            actor_key_id: &actor,
            action: "segment.delete",
            flag_key: None,
            env_key: Some(&env_key),
            before: before_val.as_ref(),
            after: None,
        },
    )
    .await;

    Ok(Json(serde_json::json!({ "deleted": key })))
}
