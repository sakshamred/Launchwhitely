pub mod audit;
pub mod envs;
pub mod flags;
pub mod health;
pub mod keys;
pub mod sdk;
pub mod segments;

use crate::auth::auth_middleware;
use crate::db::Pool;
use crate::store::MemStore;
use axum::{
    middleware,
    routing::{delete, get, patch, post, put},
    Router,
};
use std::sync::Arc;

pub fn router(pool: Arc<Pool>, store: Arc<MemStore>) -> Router {
    let protected = Router::new()
        // Flags
        .route("/api/flags", get(flags::list).post(flags::create))
        .route(
            "/api/flags/:key",
            get(flags::get_one).put(flags::update).delete(flags::delete),
        )
        // Flag configs
        .route("/api/envs/:env/flags/:key/config", put(flags::put_config))
        .route("/api/envs/:env/flags/:key/toggle", patch(flags::toggle))
        // Environments
        .route("/api/envs", get(envs::list).post(envs::create))
        .route("/api/envs/:key", get(envs::get_one).delete(envs::delete))
        // Segments
        .route(
            "/api/envs/:env/segments",
            get(segments::list).post(segments::create),
        )
        .route(
            "/api/envs/:env/segments/:key",
            get(segments::get_one)
                .put(segments::update)
                .delete(segments::delete),
        )
        // API Keys
        .route("/api/keys", get(keys::list).post(keys::create))
        .route("/api/keys/:id", delete(keys::revoke))
        // Audit
        .route("/api/audit", get(audit::list))
        // SDK routes (also protected — sdk keys are limited role)
        .route("/api/sdk/flags", get(sdk::get_flags))
        .route("/api/sdk/stream", get(sdk::stream))
        .route("/api/eval", post(sdk::eval))
        .layer(middleware::from_fn_with_state(
            Arc::clone(&pool),
            auth_middleware,
        ))
        .with_state((Arc::clone(&pool), Arc::clone(&store)));

    let public = Router::new()
        .route("/health", get(health::health))
        .with_state(Arc::clone(&pool));

    public.merge(protected)
}
