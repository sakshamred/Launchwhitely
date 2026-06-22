use crate::auth::Caller;
use crate::db::{self, audit::AuditInsert, Pool};
use crate::error::{AppError, Result};
use crate::store::MemStore;
use axum::{
    extract::{Extension, Path, State},
    Json,
};
use launchwhitely_core::{ApiKey, KeyRole};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use ulid::Ulid;

type AppState = (Arc<Pool>, Arc<MemStore>);

#[derive(Deserialize)]
pub struct CreateKeyBody {
    pub role: KeyRole,
    pub env_key: Option<String>,
    pub name: String,
}

/// Response that includes the raw key exactly once.
#[derive(Serialize)]
pub struct CreateKeyResponse {
    #[serde(flatten)]
    pub key: ApiKey,
    /// The raw key is returned ONLY on creation and never stored.
    pub raw_key: String,
}

pub async fn list(
    State((pool, _)): State<AppState>,
    Extension(caller): Extension<Caller>,
) -> Result<Json<Vec<ApiKey>>> {
    caller.require_admin()?;
    Ok(Json(db::keys::list(&pool).await?))
}

pub async fn create(
    State((pool, _)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Json(body): Json<CreateKeyBody>,
) -> Result<Json<CreateKeyResponse>> {
    caller.require_admin()?;

    // SDK keys must be scoped to an environment
    if body.role == KeyRole::Sdk {
        match &body.env_key {
            None => return Err(AppError::BadRequest("sdk keys require an env_key".into())),
            Some(ek) => {
                db::envs::get(&pool, ek).await?;
            }
        }
    }
    // Admin keys must NOT be scoped
    if body.role == KeyRole::Admin && body.env_key.is_some() {
        return Err(AppError::BadRequest(
            "admin keys cannot be scoped to an environment".into(),
        ));
    }

    let id = Ulid::new().to_string();
    let raw_key = generate_raw_key(&id);

    let key = db::keys::create(
        &pool,
        &id,
        &raw_key,
        &body.role,
        body.env_key.as_deref(),
        &body.name,
    )
    .await?;

    let actor = caller.key.id.clone();
    let _ = db::audit::insert(
        &pool,
        AuditInsert {
            id: &Ulid::new().to_string(),
            actor_key_id: &actor,
            action: "key.create",
            flag_key: None,
            env_key: body.env_key.as_deref(),
            before: None,
            after: None,
        },
    )
    .await;

    Ok(Json(CreateKeyResponse { key, raw_key }))
}

pub async fn revoke(
    State((pool, _)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    caller.require_admin()?;
    // Prevent self-revoke
    if caller.key.id == id {
        return Err(AppError::BadRequest(
            "cannot revoke the key you are currently using".into(),
        ));
    }
    db::keys::delete(&pool, &id).await?;

    let actor = caller.key.id.clone();
    let _ = db::audit::insert(
        &pool,
        AuditInsert {
            id: &Ulid::new().to_string(),
            actor_key_id: &actor,
            action: "key.revoke",
            flag_key: None,
            env_key: None,
            before: None,
            after: None,
        },
    )
    .await;

    Ok(Json(serde_json::json!({ "revoked": id })))
}

fn generate_raw_key(id: &str) -> String {
    use sha2::{Digest, Sha256};
    use std::time::SystemTime;
    let mut h = Sha256::new();
    h.update(id.as_bytes());
    h.update(
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_nanos()
            .to_le_bytes(),
    );
    // Add some randomness
    h.update(rand::random::<[u8; 16]>());
    format!("lw_{}", hex::encode(h.finalize()))
}
