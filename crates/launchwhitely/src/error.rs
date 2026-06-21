use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("not found: {0}")]
    NotFound(String),

    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error("forbidden: {0}")]
    Forbidden(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, "NOT_FOUND", m.clone()),
            AppError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", m.clone()),
            AppError::Forbidden(m) => (StatusCode::FORBIDDEN, "FORBIDDEN", m.clone()),
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, "BAD_REQUEST", m.clone()),
            AppError::Conflict(m) => (StatusCode::CONFLICT, "CONFLICT", m.clone()),
            AppError::Database(e) => {
                tracing::error!("database error: {e}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    "A database error occurred".to_string(),
                )
            }
            AppError::Internal(m) => {
                tracing::error!("internal error: {m}");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INTERNAL_ERROR",
                    m.clone(),
                )
            }
        };
        (status, Json(json!({ "error": code, "message": message }))).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
