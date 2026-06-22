use crate::db;
use crate::db::Pool;
use crate::error::AppError;
use axum::{
    extract::{Request, State},
    http::header::AUTHORIZATION,
    middleware::Next,
    response::Response,
};
use constant_time_eq::constant_time_eq;
use launchwhitely_core::{ApiKey, KeyRole};
use std::sync::Arc;

/// Authenticated caller — injected as axum Extension after middleware runs.
#[derive(Clone, Debug)]
pub struct Caller {
    pub key: ApiKey,
}

impl Caller {
    pub fn require_admin(&self) -> crate::error::Result<()> {
        if self.key.role != KeyRole::Admin {
            return Err(AppError::Forbidden("admin key required".into()));
        }
        Ok(())
    }

    pub fn require_env_access(&self, env_key: &str) -> crate::error::Result<()> {
        match &self.key.role {
            KeyRole::Admin => Ok(()),
            KeyRole::Sdk => {
                if self.key.env_key.as_deref() == Some(env_key) {
                    Ok(())
                } else {
                    Err(AppError::Forbidden(format!(
                        "sdk key is not scoped to environment '{env_key}'"
                    )))
                }
            }
        }
    }
}

/// Axum middleware that authenticates every request via Bearer token.
pub async fn auth_middleware(
    State(pool): State<Arc<Pool>>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.trim().to_string());

    let raw_key = match auth_header {
        Some(k) if !k.is_empty() => k,
        _ => return Err(AppError::Unauthorized("Bearer token required".into())),
    };

    // Hash the incoming key and look it up — never compare raw keys
    let hash = db::keys::hash_key(&raw_key);
    let maybe_key = db::keys::get_by_hash(&pool, &hash).await?;

    let api_key = match maybe_key {
        Some(k) => {
            // Constant-time verify that the stored hash matches (defence in depth)
            if !constant_time_eq(k.hash.as_bytes(), hash.as_bytes()) {
                return Err(AppError::Unauthorized("invalid API key".into()));
            }
            k
        }
        None => return Err(AppError::Unauthorized("invalid API key".into())),
    };

    req.extensions_mut().insert(Caller { key: api_key });
    Ok(next.run(req).await)
}
