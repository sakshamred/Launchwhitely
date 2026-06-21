use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use time::OffsetDateTime;

// ── Flag kind ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FlagKind {
    Bool,
    String,
    Number,
    Json,
}

// ── Variation value ────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum VariationValue {
    Bool(bool),
    String(String),
    Number(f64),
    Json(serde_json::Value),
}

impl VariationValue {
    pub fn type_name(&self) -> &'static str {
        match self {
            Self::Bool(_) => "bool",
            Self::String(_) => "string",
            Self::Number(_) => "number",
            Self::Json(_) => "json",
        }
    }
}

// ── Flag definition (env-independent) ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Flag {
    pub key: String,
    pub kind: FlagKind,
    pub variations: Vec<VariationValue>,
    pub description: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

// ── Rollout ────────────────────────────────────────────────────────────────

/// Weighted rollout entry. Weights are integers summing to 100_000.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeightedVariation {
    pub variation: usize,
    pub weight: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ServeTarget {
    Variation(usize),
    Rollout(Vec<WeightedVariation>),
}

// ── Clause operators ───────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ClauseOp {
    In,
    Equals,
    Contains,
    StartsWith,
    EndsWith,
    Greater,
    Less,
    Regex,
    SemverGreater,
    SemverLess,
    SegmentMatch,
}

// ── Clause ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Clause {
    /// Context attribute name (e.g. "email", "plan", "key").
    /// For segmentMatch this is typically "key" or ignored.
    pub attribute: String,
    pub op: ClauseOp,
    /// JSON values to match against.
    pub values: Vec<serde_json::Value>,
    #[serde(default)]
    pub negate: bool,
}

// ── Rule ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub clauses: Vec<Clause>,
    pub serve: ServeTarget,
}

// ── FlagConfig (per environment) ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlagConfig {
    pub flag_key: String,
    pub env_key: String,
    /// Kill switch: if false, serve off_variation immediately.
    pub enabled: bool,
    /// Explicit context-key → variation-index pins (highest priority).
    pub targets: HashMap<String, usize>,
    /// Ordered rules (first match wins).
    pub rules: Vec<Rule>,
    /// Fallthrough when no rule matches.
    pub fallthrough: ServeTarget,
    /// Served when enabled == false.
    pub off_variation: usize,
    /// Salt for deterministic bucketing — unique per flag+env.
    pub salt: String,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

// ── Segment ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Segment {
    pub key: String,
    pub env_key: String,
    pub name: String,
    pub included: Vec<String>,
    pub excluded: Vec<String>,
    pub clauses: Vec<Clause>,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

// ── Evaluation context ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Context {
    /// The unique identifier for this subject (user/device/entity).
    pub key: String,
    /// Arbitrary attributes for rule matching.
    #[serde(default)]
    pub attributes: HashMap<String, serde_json::Value>,
}

// ── Evaluation reason ──────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "detail", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Reason {
    Off,
    TargetMatch,
    RuleMatch { rule_index: usize },
    Fallthrough,
    Error { message: String },
}

// ── Evaluation result ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalResult {
    pub flag_key: String,
    pub value: VariationValue,
    pub variation_index: usize,
    pub reason: Reason,
}

// ── Environment ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Environment {
    pub key: String,
    pub name: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

// ── API Key ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KeyRole {
    Admin,
    Sdk,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKey {
    pub id: String,
    /// sha256(raw_key), hex-encoded — never the raw value.
    pub hash: String,
    pub role: KeyRole,
    /// SDK keys are scoped to one environment; admin keys have None.
    pub env_key: Option<String>,
    pub name: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

// ── Audit log entry ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: String,
    #[serde(with = "time::serde::rfc3339")]
    pub ts: OffsetDateTime,
    pub actor_key_id: String,
    pub action: String,
    pub flag_key: Option<String>,
    pub env_key: Option<String>,
    pub before: Option<serde_json::Value>,
    pub after: Option<serde_json::Value>,
}

// ── Ruleset snapshot (sent to SDK clients) ─────────────────────────────────

/// Everything an SDK needs to evaluate flags locally for one environment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvRuleset {
    pub env_key: String,
    pub flags: Vec<Flag>,
    pub configs: Vec<FlagConfig>,
    pub segments: Vec<Segment>,
    #[serde(with = "time::serde::rfc3339")]
    pub generated_at: OffsetDateTime,
}

impl Default for EnvRuleset {
    fn default() -> Self {
        Self {
            env_key: String::new(),
            flags: Vec::new(),
            configs: Vec::new(),
            segments: Vec::new(),
            generated_at: OffsetDateTime::now_utc(),
        }
    }
}
