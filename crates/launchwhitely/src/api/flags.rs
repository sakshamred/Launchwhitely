use crate::auth::Caller;
use crate::db::{self, audit::AuditInsert, Pool};
use crate::error::{AppError, Result};
use crate::store::{MemStore, SseEvent};
use axum::{
    extract::{Extension, Path, State},
    Json,
};
use launchwhitely_core::{Flag, FlagConfig, FlagKind, ServeTarget, VariationValue};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use ulid::Ulid;

type AppState = (Arc<Pool>, Arc<MemStore>);

// ── Request / Response shapes ──────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateFlagBody {
    pub key: String,
    pub kind: FlagKind,
    pub variations: Vec<VariationValue>,
    #[serde(default)]
    pub description: String,
}

#[derive(Deserialize)]
pub struct UpdateFlagBody {
    pub description: Option<String>,
    pub variations: Option<Vec<VariationValue>>,
}

#[derive(Deserialize)]
pub struct PutConfigBody {
    pub enabled: Option<bool>,
    #[serde(default)]
    pub targets: Option<HashMap<String, usize>>,
    pub rules: Option<Vec<launchwhitely_core::Rule>>,
    pub fallthrough: Option<ServeTarget>,
    pub off_variation: Option<usize>,
    pub salt: Option<String>,
}

#[derive(Deserialize)]
pub struct ToggleBody {
    pub enabled: bool,
}

// ── Handlers ───────────────────────────────────────────────────────────────

pub async fn list(
    State((pool, _)): State<AppState>,
    Extension(caller): Extension<Caller>,
) -> Result<Json<Vec<Flag>>> {
    caller.require_admin()?;
    Ok(Json(db::flags::list_flags(&pool).await?))
}

pub async fn get_one(
    State((pool, _)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path(key): Path<String>,
) -> Result<Json<Flag>> {
    caller.require_admin()?;
    Ok(Json(db::flags::get_flag(&pool, &key).await?))
}

pub async fn create(
    State((pool, store)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Json(body): Json<CreateFlagBody>,
) -> Result<Json<Flag>> {
    caller.require_admin()?;
    validate_flag_key(&body.key)?;
    validate_variations(&body.kind, &body.variations)?;

    let flag = db::flags::create_flag(
        &pool,
        &body.key,
        &body.kind,
        &body.variations,
        &body.description,
    )
    .await?;

    let envs = db::envs::list(&pool).await?;
    for env in &envs {
        let config = db::flags::ensure_default_config(&pool, &flag.key, &env.key).await?;
        store.upsert_config(&env.key, config);
    }

    store.upsert_flag(flag.clone());

    let actor = caller.key.id.clone();
    let after = serde_json::to_value(&flag).ok();
    let _ = db::audit::insert(
        &pool,
        AuditInsert {
            id: &Ulid::new().to_string(),
            actor_key_id: &actor,
            action: "flag.create",
            flag_key: Some(&flag.key),
            env_key: None,
            before: None,
            after: after.as_ref(),
        },
    )
    .await;

    Ok(Json(flag))
}

pub async fn update(
    State((pool, store)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path(key): Path<String>,
    Json(body): Json<UpdateFlagBody>,
) -> Result<Json<Flag>> {
    caller.require_admin()?;
    let before = db::flags::get_flag(&pool, &key).await?;
    let flag = db::flags::update_flag(
        &pool,
        &key,
        body.description.as_deref(),
        body.variations.as_deref(),
    )
    .await?;

    store.upsert_flag(flag.clone());

    let actor = caller.key.id.clone();
    let before_val = serde_json::to_value(&before).ok();
    let after_val = serde_json::to_value(&flag).ok();
    let _ = db::audit::insert(
        &pool,
        AuditInsert {
            id: &Ulid::new().to_string(),
            actor_key_id: &actor,
            action: "flag.update",
            flag_key: Some(&key),
            env_key: None,
            before: before_val.as_ref(),
            after: after_val.as_ref(),
        },
    )
    .await;

    Ok(Json(flag))
}

pub async fn delete(
    State((pool, store)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path(key): Path<String>,
) -> Result<Json<Value>> {
    caller.require_admin()?;
    let before = db::flags::get_flag(&pool, &key).await?;
    db::flags::delete_flag(&pool, &key).await?;
    store.remove_flag(&key);

    let envs = db::envs::list(&pool).await?;
    for env in &envs {
        store
            .broadcast(
                &env.key,
                SseEvent::Delete {
                    flag_key: key.clone(),
                },
            )
            .await;
    }

    let actor = caller.key.id.clone();
    let before_val = serde_json::to_value(&before).ok();
    let _ = db::audit::insert(
        &pool,
        AuditInsert {
            id: &Ulid::new().to_string(),
            actor_key_id: &actor,
            action: "flag.delete",
            flag_key: Some(&key),
            env_key: None,
            before: before_val.as_ref(),
            after: None,
        },
    )
    .await;

    Ok(Json(serde_json::json!({ "deleted": key })))
}

pub async fn put_config(
    State((pool, store)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path((env_key, flag_key)): Path<(String, String)>,
    Json(body): Json<PutConfigBody>,
) -> Result<Json<FlagConfig>> {
    caller.require_admin()?;

    let flag = db::flags::get_flag(&pool, &flag_key).await?;
    db::envs::get(&pool, &env_key).await?;

    let existing = db::flags::ensure_default_config(&pool, &flag_key, &env_key).await?;
    let before_val = serde_json::to_value(&existing).ok();

    let new_config = FlagConfig {
        flag_key: flag_key.clone(),
        env_key: env_key.clone(),
        enabled: body.enabled.unwrap_or(existing.enabled),
        targets: body.targets.unwrap_or(existing.targets),
        rules: body.rules.unwrap_or(existing.rules),
        fallthrough: body.fallthrough.unwrap_or(existing.fallthrough),
        off_variation: body.off_variation.unwrap_or(existing.off_variation),
        salt: body.salt.unwrap_or(existing.salt),
        updated_at: time::OffsetDateTime::now_utc(),
    };

    validate_config(&new_config, flag.variations.len())?;

    let config = db::flags::upsert_config(&pool, &new_config).await?;
    let after_val = serde_json::to_value(&config).ok();

    store.upsert_config(&env_key, config.clone());
    let patch = serde_json::to_value(&config).unwrap_or_default();
    store
        .broadcast(
            &env_key,
            SseEvent::Patch {
                flag_key: flag_key.clone(),
                data: patch,
            },
        )
        .await;

    let actor = caller.key.id.clone();
    let _ = db::audit::insert(
        &pool,
        AuditInsert {
            id: &Ulid::new().to_string(),
            actor_key_id: &actor,
            action: "config.update",
            flag_key: Some(&flag_key),
            env_key: Some(&env_key),
            before: before_val.as_ref(),
            after: after_val.as_ref(),
        },
    )
    .await;

    Ok(Json(config))
}

pub async fn toggle(
    State((pool, store)): State<AppState>,
    Extension(caller): Extension<Caller>,
    Path((env_key, flag_key)): Path<(String, String)>,
    Json(body): Json<ToggleBody>,
) -> Result<Json<FlagConfig>> {
    caller.require_admin()?;

    let before = db::flags::get_config(&pool, &flag_key, &env_key).await;
    let config = db::flags::toggle_flag(&pool, &flag_key, &env_key, body.enabled).await?;

    store.upsert_config(&env_key, config.clone());
    let patch = serde_json::to_value(&config).unwrap_or_default();
    store
        .broadcast(
            &env_key,
            SseEvent::Patch {
                flag_key: flag_key.clone(),
                data: patch,
            },
        )
        .await;

    let actor = caller.key.id.clone();
    let before_val = before.ok().and_then(|c| serde_json::to_value(c).ok());
    let after_val = serde_json::to_value(&config).ok();
    let action = if body.enabled {
        "flag.enable"
    } else {
        "flag.disable"
    };
    let _ = db::audit::insert(
        &pool,
        AuditInsert {
            id: &Ulid::new().to_string(),
            actor_key_id: &actor,
            action,
            flag_key: Some(&flag_key),
            env_key: Some(&env_key),
            before: before_val.as_ref(),
            after: after_val.as_ref(),
        },
    )
    .await;

    Ok(Json(config))
}

// ── Validation ─────────────────────────────────────────────────────────────

fn validate_flag_key(key: &str) -> Result<()> {
    if key.is_empty() || key.len() > 128 {
        return Err(AppError::BadRequest(
            "flag key must be 1–128 characters".into(),
        ));
    }
    if !key
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(AppError::BadRequest(
            "flag key may only contain alphanumeric characters, hyphens, underscores, and dots"
                .into(),
        ));
    }
    Ok(())
}

fn validate_variations(kind: &FlagKind, variations: &[VariationValue]) -> Result<()> {
    if variations.is_empty() {
        return Err(AppError::BadRequest(
            "flag must have at least one variation".into(),
        ));
    }
    for v in variations {
        let type_ok = matches!(
            (kind, v),
            (FlagKind::Bool, VariationValue::Bool(_))
                | (FlagKind::String, VariationValue::String(_))
                | (FlagKind::Number, VariationValue::Number(_))
                | (FlagKind::Json, VariationValue::Json(_))
        );
        if !type_ok {
            return Err(AppError::BadRequest(format!(
                "variation type mismatch: flag kind is {:?} but got {:?}",
                kind,
                v.type_name()
            )));
        }
    }
    Ok(())
}

fn validate_config(config: &FlagConfig, n_variations: usize) -> Result<()> {
    let check_idx = |idx: usize, ctx: &str| -> Result<()> {
        if idx >= n_variations {
            Err(AppError::BadRequest(format!(
                "{ctx}: variation index {idx} is out of range (flag has {n_variations} variations)"
            )))
        } else {
            Ok(())
        }
    };
    check_idx(config.off_variation, "off_variation")?;
    for (key, &vi) in &config.targets {
        check_idx(vi, &format!("target '{key}'"))?;
    }
    validate_serve(&config.fallthrough, n_variations, "fallthrough")?;
    for (i, rule) in config.rules.iter().enumerate() {
        validate_serve(&rule.serve, n_variations, &format!("rule[{i}]"))?;
    }
    Ok(())
}

fn validate_serve(serve: &ServeTarget, n: usize, ctx: &str) -> Result<()> {
    match serve {
        ServeTarget::Variation(vi) => {
            if *vi >= n {
                return Err(AppError::BadRequest(format!(
                    "{ctx}.serve: variation index {vi} out of range (flag has {n} variations)"
                )));
            }
        }
        ServeTarget::Rollout(weights) => {
            if weights.is_empty() {
                return Err(AppError::BadRequest(format!(
                    "{ctx}.serve: rollout has no weights"
                )));
            }
            let total: u32 = weights.iter().map(|w| w.weight).sum();
            if total != 100_000 {
                return Err(AppError::BadRequest(format!(
                    "{ctx}.serve: rollout weights must sum to 100000, got {total}"
                )));
            }
            for wv in weights {
                if wv.variation >= n {
                    return Err(AppError::BadRequest(format!(
                        "{ctx}.serve: rollout variation index {} out of range",
                        wv.variation
                    )));
                }
            }
        }
    }
    Ok(())
}
