use clap::{Args, Parser, Subcommand};

#[derive(Parser)]
#[command(
    name = "launchwhitely",
    about = "Own your feature flags — self-hostable, zero infra",
    version,
    propagate_version = true
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Subcommand)]
pub enum Command {
    /// Start the LaunchWhitely server
    Serve(ServeArgs),
    /// Run database migrations
    Migrate(DbArgs),
    /// Manage API keys
    Key {
        #[command(subcommand)]
        sub: KeyCommand,
    },
    /// Manage environments
    Env {
        #[command(subcommand)]
        sub: EnvCommand,
    },
    /// Manage feature flags
    Flag {
        #[command(subcommand)]
        sub: FlagCommand,
    },
}

#[derive(Args)]
pub struct ServeArgs {
    /// SQLite database file path
    #[arg(long, env = "LAUNCHWHITELY_DB", default_value = "./launchwhitely.db")]
    pub db: String,

    /// Port to listen on
    #[arg(long, env = "LAUNCHWHITELY_PORT", default_value = "8080")]
    pub port: u16,

    /// Host to bind to
    #[arg(long, env = "LAUNCHWHITELY_HOST", default_value = "0.0.0.0")]
    pub host: String,

    /// Log level (trace, debug, info, warn, error)
    #[arg(long, env = "LAUNCHWHITELY_LOG", default_value = "info")]
    pub log: String,
}

#[derive(Args)]
pub struct DbArgs {
    #[arg(long, env = "LAUNCHWHITELY_DB", default_value = "./launchwhitely.db")]
    pub db: String,
}

// ── Key subcommands ─────────────────────────────────────────────────────────

#[derive(Subcommand)]
pub enum KeyCommand {
    /// Create a new API key
    Create {
        /// Role: admin or sdk
        #[arg(long, value_parser = ["admin", "sdk"])]
        role: String,
        /// Environment key (required for sdk role)
        #[arg(long)]
        env: Option<String>,
        /// Human-readable name for this key
        #[arg(long, default_value = "")]
        name: String,
        #[arg(long, env = "LAUNCHWHITELY_DB", default_value = "./launchwhitely.db")]
        db: String,
    },
    /// List API keys
    List {
        #[arg(long, env = "LAUNCHWHITELY_DB", default_value = "./launchwhitely.db")]
        db: String,
    },
    /// Revoke an API key by ID
    Revoke {
        id: String,
        #[arg(long, env = "LAUNCHWHITELY_DB", default_value = "./launchwhitely.db")]
        db: String,
    },
}

// ── Env subcommands ─────────────────────────────────────────────────────────

#[derive(Subcommand)]
pub enum EnvCommand {
    /// Create an environment
    Create {
        key: String,
        #[arg(long)]
        name: String,
        #[arg(long, env = "LAUNCHWHITELY_DB", default_value = "./launchwhitely.db")]
        db: String,
    },
    /// List environments
    List {
        #[arg(long, env = "LAUNCHWHITELY_DB", default_value = "./launchwhitely.db")]
        db: String,
    },
}

// ── Flag subcommands ─────────────────────────────────────────────────────────

#[derive(Subcommand)]
pub enum FlagCommand {
    /// Create a boolean flag (simplest case)
    Create {
        key: String,
        #[arg(long, value_parser = ["bool", "string", "number", "json"], default_value = "bool")]
        kind: String,
        #[arg(long, default_value = "")]
        description: String,
        #[arg(long, env = "LAUNCHWHITELY_DB", default_value = "./launchwhitely.db")]
        db: String,
    },
    /// List flags
    List {
        #[arg(long, env = "LAUNCHWHITELY_DB", default_value = "./launchwhitely.db")]
        db: String,
    },
    /// Get a specific flag
    Get {
        key: String,
        #[arg(long, env = "LAUNCHWHITELY_DB", default_value = "./launchwhitely.db")]
        db: String,
    },
    /// Toggle a flag on or off in an environment
    Toggle {
        key: String,
        #[arg(long)]
        env: String,
        #[arg(long, default_value = "true", value_parser = ["true", "false", "on", "off"])]
        enabled: String,
        #[arg(long, env = "LAUNCHWHITELY_DB", default_value = "./launchwhitely.db")]
        db: String,
    },
}
