mod api;
mod auth;
mod cli;
mod db;
mod error;
mod store;

use anyhow::Result;
use clap::Parser;
use cli::{Cli, Command, EnvCommand, FlagCommand, KeyCommand};
use launchwhitely_core::{FlagKind, KeyRole, VariationValue};
use std::sync::Arc;
use store::{load_from_db, MemStore};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};
use ulid::Ulid;

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Command::Serve(args) => cmd_serve(args).await,
        Command::Migrate(args) => cmd_migrate(args).await,
        Command::Key { sub } => cmd_key(sub).await,
        Command::Env { sub } => cmd_env(sub).await,
        Command::Flag { sub } => cmd_flag(sub).await,
    }
}

// ── serve ──────────────────────────────────────────────────────────────────

async fn cmd_serve(args: cli::ServeArgs) -> Result<()> {
    init_logging(&args.log);

    tracing::info!("LaunchWhitely v{} starting", env!("CARGO_PKG_VERSION"));
    tracing::info!("database: {}", args.db);

    let db_url = sqlite_url(&args.db);
    let pool = db::connect(&db_url).await?;
    let pool = Arc::new(pool);

    db::run_migrations(&pool).await?;
    tracing::info!("migrations applied");

    // First-run: if no keys exist, generate an initial admin key
    let key_count = db::keys::count(&pool).await?;
    if key_count == 0 {
        let id = Ulid::new().to_string();
        let raw = generate_initial_key(&id);
        db::keys::create(&pool, &id, &raw, &KeyRole::Admin, None, "initial-admin").await?;

        println!();
        println!("╔══════════════════════════════════════════════════════════════╗");
        println!("║          LaunchWhitely — Initial Admin Key Created           ║");
        println!("╠══════════════════════════════════════════════════════════════╣");
        println!("║  Save this key — it will NOT be shown again.                ║");
        println!("║                                                              ║");
        println!("║  Key ID:  {:<50} ║", id);
        println!("║  Raw Key: {:<50} ║", raw);
        println!("╚══════════════════════════════════════════════════════════════╝");
        println!();
        println!("Use this key as:  Authorization: Bearer {raw}");
        println!();
    }

    // Load full ruleset into memory
    let store = Arc::new(MemStore::new());
    load_from_db(&pool, &store).await?;
    tracing::info!("in-memory ruleset loaded");

    // Build router
    let app = build_app(Arc::clone(&pool), Arc::clone(&store));

    // Spawn periodic SSE keepalive pings
    {
        let store = Arc::clone(&store);
        let pool2 = Arc::clone(&pool);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(15));
            loop {
                interval.tick().await;
                if let Ok(envs) = db::envs::list(&pool2).await {
                    for env in envs {
                        store.broadcast(&env.key, store::SseEvent::Ping).await;
                    }
                }
            }
        });
    }

    let addr = format!("{}:{}", args.host, args.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("listening on http://{addr}");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("server shut down");
    Ok(())
}

fn build_app(pool: Arc<db::Pool>, store: Arc<MemStore>) -> axum::Router {
    use tower_http::{
        compression::CompressionLayer,
        cors::{Any, CorsLayer},
        trace::TraceLayer,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_headers(Any)
        .allow_methods(Any);

    api::router(pool, store)
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(cors)
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c().await.ok();
    };
    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received");
}

// ── migrate ────────────────────────────────────────────────────────────────

async fn cmd_migrate(args: cli::DbArgs) -> Result<()> {
    init_logging("info");
    let pool = db::connect(&sqlite_url(&args.db)).await?;
    db::run_migrations(&pool).await?;
    println!("Migrations applied successfully.");
    Ok(())
}

// ── key ────────────────────────────────────────────────────────────────────

async fn cmd_key(sub: KeyCommand) -> Result<()> {
    init_logging("warn");
    match sub {
        KeyCommand::Create {
            role,
            env,
            name,
            db,
        } => {
            let pool = db::connect(&sqlite_url(&db)).await?;
            db::run_migrations(&pool).await?;
            let key_role = parse_role(&role)?;
            if key_role == KeyRole::Sdk && env.is_none() {
                anyhow::bail!("sdk keys require --env <env_key>");
            }
            let id = Ulid::new().to_string();
            let raw = generate_initial_key(&id);
            db::keys::create(&pool, &id, &raw, &key_role, env.as_deref(), &name).await?;
            println!("Key ID:  {id}");
            println!("Raw Key: {raw}");
            println!("Role:    {role}");
            if let Some(e) = &env {
                println!("Env:     {e}");
            }
            println!("Save this key — it will NOT be shown again.");
        }
        KeyCommand::List { db } => {
            let pool = db::connect(&sqlite_url(&db)).await?;
            db::run_migrations(&pool).await?;
            let keys = db::keys::list(&pool).await?;
            println!("{:<26} {:<8} {:<16} NAME", "ID", "ROLE", "ENV");
            println!("{}", "─".repeat(70usize));
            for k in keys {
                println!(
                    "{:<26} {:<8} {:<16} {}",
                    k.id,
                    format!("{:?}", k.role).to_lowercase(),
                    k.env_key.as_deref().unwrap_or("(all)"),
                    k.name
                );
            }
        }
        KeyCommand::Revoke { id, db } => {
            let pool = db::connect(&sqlite_url(&db)).await?;
            db::run_migrations(&pool).await?;
            db::keys::delete(&pool, &id).await?;
            println!("Key {id} revoked.");
        }
    }
    Ok(())
}

// ── env ────────────────────────────────────────────────────────────────────

async fn cmd_env(sub: EnvCommand) -> Result<()> {
    init_logging("warn");
    match sub {
        EnvCommand::Create { key, name, db } => {
            let pool = db::connect(&sqlite_url(&db)).await?;
            db::run_migrations(&pool).await?;
            let env = db::envs::create(&pool, &key, &name).await?;
            println!("Created environment: {} ({})", env.name, env.key);
        }
        EnvCommand::List { db } => {
            let pool = db::connect(&sqlite_url(&db)).await?;
            db::run_migrations(&pool).await?;
            let envs = db::envs::list(&pool).await?;
            println!("{:<24} NAME", "KEY");
            println!("{}", "─".repeat(50));
            for e in envs {
                println!("{:<24} {}", e.key, e.name);
            }
        }
    }
    Ok(())
}

// ── flag ───────────────────────────────────────────────────────────────────

async fn cmd_flag(sub: FlagCommand) -> Result<()> {
    init_logging("warn");
    match sub {
        FlagCommand::Create {
            key,
            kind,
            description,
            db,
        } => {
            let pool = db::connect(&sqlite_url(&db)).await?;
            db::run_migrations(&pool).await?;
            let fk = parse_kind(&kind)?;
            let variations = default_variations_for(&fk);
            let flag = db::flags::create_flag(&pool, &key, &fk, &variations, &description).await?;
            // Create default configs for all envs
            let envs = db::envs::list(&pool).await?;
            for env in &envs {
                db::flags::ensure_default_config(&pool, &flag.key, &env.key).await?;
            }
            println!("Created flag: {}", flag.key);
            println!("Kind:         {:?}", flag.kind);
            println!(
                "Variations:   {}",
                serde_json::to_string(&flag.variations).unwrap_or_default()
            );
        }
        FlagCommand::List { db } => {
            let pool = db::connect(&sqlite_url(&db)).await?;
            db::run_migrations(&pool).await?;
            let flags = db::flags::list_flags(&pool).await?;
            println!("{:<32} {:<8} DESCRIPTION", "KEY", "KIND");
            println!("{}", "─".repeat(70));
            for f in flags {
                println!(
                    "{:<32} {:<8} {}",
                    f.key,
                    format!("{:?}", f.kind).to_lowercase(),
                    f.description
                );
            }
        }
        FlagCommand::Get { key, db } => {
            let pool = db::connect(&sqlite_url(&db)).await?;
            db::run_migrations(&pool).await?;
            let f = db::flags::get_flag(&pool, &key).await?;
            println!("{}", serde_json::to_string_pretty(&f)?);
        }
        FlagCommand::Toggle {
            key,
            env,
            enabled,
            db,
        } => {
            let pool = db::connect(&sqlite_url(&db)).await?;
            db::run_migrations(&pool).await?;
            let on = matches!(enabled.as_str(), "true" | "on");
            let config = db::flags::toggle_flag(&pool, &key, &env, on).await?;
            println!(
                "Flag '{}' in env '{}' is now {}.",
                key,
                env,
                if config.enabled {
                    "ENABLED"
                } else {
                    "DISABLED"
                }
            );
        }
    }
    Ok(())
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn sqlite_url(path: &str) -> String {
    if path.starts_with("sqlite:") {
        path.to_string()
    } else {
        format!("sqlite:{path}")
    }
}

fn init_logging(level: &str) {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(level));
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(filter)
        .init();
}

fn generate_initial_key(id: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(id.as_bytes());
    h.update(rand::random::<[u8; 32]>());
    format!("lw_{}", hex::encode(h.finalize()))
}

fn parse_role(s: &str) -> Result<KeyRole> {
    match s {
        "admin" => Ok(KeyRole::Admin),
        "sdk" => Ok(KeyRole::Sdk),
        other => anyhow::bail!("unknown role: {other}"),
    }
}

fn parse_kind(s: &str) -> Result<FlagKind> {
    match s {
        "bool" => Ok(FlagKind::Bool),
        "string" => Ok(FlagKind::String),
        "number" => Ok(FlagKind::Number),
        "json" => Ok(FlagKind::Json),
        other => anyhow::bail!("unknown kind: {other}"),
    }
}

fn default_variations_for(kind: &FlagKind) -> Vec<VariationValue> {
    match kind {
        FlagKind::Bool => vec![VariationValue::Bool(false), VariationValue::Bool(true)],
        FlagKind::String => vec![
            VariationValue::String("control".into()),
            VariationValue::String("treatment".into()),
        ],
        FlagKind::Number => vec![VariationValue::Number(0.0), VariationValue::Number(1.0)],
        FlagKind::Json => vec![
            VariationValue::Json(serde_json::json!({})),
            VariationValue::Json(serde_json::json!({"enabled": true})),
        ],
    }
}

#[cfg(test)]
mod tests;
