use crate::bucketing::bucket;
use crate::models::{
    Clause, ClauseOp, Context, EvalResult, Flag, FlagConfig, Reason, Rule, Segment, ServeTarget,
    VariationValue, WeightedVariation,
};
use std::collections::HashMap;

const BUCKET_TOTAL: u64 = 100_000;

/// Evaluate a single flag for a given context.
///
/// This function is pure — no IO, no async. All inputs come from the in-memory
/// ruleset. The evaluation order is:
///   1. Off (kill switch) → off_variation
///   2. Explicit targets → pinned variation
///   3. Rules in order (first match) → rule's serve target
///   4. Fallthrough
pub fn evaluate(
    flag: &Flag,
    config: &FlagConfig,
    segments: &HashMap<String, Segment>,
    ctx: &Context,
) -> EvalResult {
    // ── 1. Kill switch ─────────────────────────────────────────────────────
    if !config.enabled {
        return make_result(flag, config, config.off_variation, Reason::Off);
    }

    // ── 2. Explicit targets ────────────────────────────────────────────────
    if let Some(&vi) = config.targets.get(&ctx.key) {
        if vi < flag.variations.len() {
            return make_result(flag, config, vi, Reason::TargetMatch);
        }
        return error_result(flag, config, "target variation index out of range");
    }

    // ── 3. Rules ───────────────────────────────────────────────────────────
    for (idx, rule) in config.rules.iter().enumerate() {
        if rule_matches(rule, ctx, segments) {
            return serve(
                flag,
                config,
                &rule.serve,
                Reason::RuleMatch { rule_index: idx },
                ctx,
            );
        }
    }

    // ── 4. Fallthrough ─────────────────────────────────────────────────────
    let ft = config.fallthrough.clone();
    serve(flag, config, &ft, Reason::Fallthrough, ctx)
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn make_result(flag: &Flag, config: &FlagConfig, vi: usize, reason: Reason) -> EvalResult {
    let value = flag
        .variations
        .get(vi)
        .cloned()
        .unwrap_or(VariationValue::Bool(false));
    EvalResult {
        flag_key: config.flag_key.clone(),
        value,
        variation_index: vi,
        reason,
    }
}

fn error_result(flag: &Flag, config: &FlagConfig, msg: &str) -> EvalResult {
    let off = config
        .off_variation
        .min(flag.variations.len().saturating_sub(1));
    let value = flag
        .variations
        .get(off)
        .cloned()
        .unwrap_or(VariationValue::Bool(false));
    EvalResult {
        flag_key: config.flag_key.clone(),
        value,
        variation_index: off,
        reason: Reason::Error {
            message: msg.to_string(),
        },
    }
}

fn serve(
    flag: &Flag,
    config: &FlagConfig,
    target: &ServeTarget,
    reason: Reason,
    ctx: &Context,
) -> EvalResult {
    match target {
        ServeTarget::Variation(vi) => {
            if *vi < flag.variations.len() {
                make_result(flag, config, *vi, reason)
            } else {
                error_result(flag, config, "variation index out of range")
            }
        }
        ServeTarget::Rollout(weights) => {
            match resolve_rollout(weights, &config.flag_key, &config.salt, &ctx.key) {
                Ok(vi) => make_result(flag, config, vi, reason),
                Err(e) => error_result(flag, config, &e),
            }
        }
    }
}

/// Deterministically pick a variation index from a weighted rollout.
fn resolve_rollout(
    weights: &[WeightedVariation],
    flag_key: &str,
    salt: &str,
    context_key: &str,
) -> Result<usize, String> {
    if weights.is_empty() {
        return Err("rollout has no variations".into());
    }
    let total: u32 = weights.iter().map(|w| w.weight).sum();
    if total == 0 {
        return Err("rollout weights sum to zero".into());
    }

    let b = bucket(flag_key, salt, context_key);
    // Normalize bucket into [0, total)
    let b_scaled = (b * total as u64) / BUCKET_TOTAL;

    let mut cumulative: u32 = 0;
    for wv in weights {
        cumulative += wv.weight;
        if b_scaled < cumulative as u64 {
            return Ok(wv.variation);
        }
    }
    // Rounding edge: return last
    Ok(weights.last().unwrap().variation)
}

// ── Rule / clause matching ─────────────────────────────────────────────────

fn rule_matches(rule: &Rule, ctx: &Context, segments: &HashMap<String, Segment>) -> bool {
    rule.clauses
        .iter()
        .all(|c| clause_matches(c, ctx, segments))
}

fn clause_matches(clause: &Clause, ctx: &Context, segments: &HashMap<String, Segment>) -> bool {
    let result = match clause.op {
        ClauseOp::SegmentMatch => match_segment(clause, ctx, segments),
        _ => {
            let attr_val = if clause.attribute == "key" {
                Some(serde_json::Value::String(ctx.key.clone()))
            } else {
                ctx.attributes.get(&clause.attribute).cloned()
            };
            match attr_val {
                None => false,
                Some(val) => match_attribute(clause, &val),
            }
        }
    };
    if clause.negate {
        !result
    } else {
        result
    }
}

fn match_attribute(clause: &Clause, val: &serde_json::Value) -> bool {
    match clause.op {
        ClauseOp::In => clause.values.iter().any(|cv| cv == val),
        ClauseOp::Equals => clause.values.first() == Some(val),
        ClauseOp::Contains => {
            let s = json_to_str(val);
            clause
                .values
                .iter()
                .any(|cv| json_to_str(cv).is_some_and(|sub| s.is_some_and(|v| v.contains(sub))))
        }
        ClauseOp::StartsWith => {
            let s = json_to_str(val);
            clause
                .values
                .iter()
                .any(|cv| json_to_str(cv).is_some_and(|pre| s.is_some_and(|v| v.starts_with(pre))))
        }
        ClauseOp::EndsWith => {
            let s = json_to_str(val);
            clause
                .values
                .iter()
                .any(|cv| json_to_str(cv).is_some_and(|suf| s.is_some_and(|v| v.ends_with(suf))))
        }
        ClauseOp::Greater => {
            let n = json_to_f64(val);
            clause
                .values
                .iter()
                .any(|cv| json_to_f64(cv).is_some_and(|threshold| n.is_some_and(|v| v > threshold)))
        }
        ClauseOp::Less => {
            let n = json_to_f64(val);
            clause
                .values
                .iter()
                .any(|cv| json_to_f64(cv).is_some_and(|threshold| n.is_some_and(|v| v < threshold)))
        }
        ClauseOp::Regex => {
            let s = json_to_str(val);
            clause.values.iter().any(|cv| {
                json_to_str(cv)
                    .and_then(|pattern| regex::Regex::new(pattern).ok())
                    .is_some_and(|re| s.is_some_and(|v| re.is_match(v)))
            })
        }
        ClauseOp::SemverGreater => {
            let v = json_to_semver(val);
            clause.values.iter().any(|cv| {
                json_to_semver(cv)
                    .is_some_and(|threshold| v.as_ref().is_some_and(|vv| vv > &threshold))
            })
        }
        ClauseOp::SemverLess => {
            let v = json_to_semver(val);
            clause.values.iter().any(|cv| {
                json_to_semver(cv)
                    .is_some_and(|threshold| v.as_ref().is_some_and(|vv| vv < &threshold))
            })
        }
        ClauseOp::SegmentMatch => false, // handled separately
    }
}

fn match_segment(clause: &Clause, ctx: &Context, segments: &HashMap<String, Segment>) -> bool {
    clause.values.iter().any(|sv| {
        let seg_key = match sv.as_str() {
            Some(s) => s,
            None => return false,
        };
        let seg = match segments.get(seg_key) {
            Some(s) => s,
            None => return false,
        };
        // Explicit excludes win over includes
        if seg.excluded.iter().any(|k| k == &ctx.key) {
            return false;
        }
        if seg.included.iter().any(|k| k == &ctx.key) {
            return true;
        }
        // Segment clauses (no nested segment match to prevent cycles).
        // An empty clause list matches nobody (unless explicitly included above).
        if seg.clauses.is_empty() {
            return false;
        }
        seg.clauses.iter().all(|c| {
            if c.op == ClauseOp::SegmentMatch {
                return false; // v1.1: nested segments
            }
            clause_matches(c, ctx, segments)
        })
    })
}

// ── JSON coercions ─────────────────────────────────────────────────────────

fn json_to_str(v: &serde_json::Value) -> Option<&str> {
    v.as_str()
}

fn json_to_f64(v: &serde_json::Value) -> Option<f64> {
    v.as_f64()
}

fn json_to_semver(v: &serde_json::Value) -> Option<semver::Version> {
    v.as_str()?.parse().ok()
}

// ── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::*;
    use std::collections::HashMap;
    use time::OffsetDateTime;

    fn ts() -> OffsetDateTime {
        OffsetDateTime::now_utc()
    }

    fn bool_flag(key: &str) -> Flag {
        Flag {
            key: key.to_string(),
            kind: FlagKind::Bool,
            variations: vec![VariationValue::Bool(false), VariationValue::Bool(true)],
            description: String::new(),
            created_at: ts(),
            updated_at: ts(),
        }
    }

    fn default_config(flag_key: &str) -> FlagConfig {
        FlagConfig {
            flag_key: flag_key.to_string(),
            env_key: "test".to_string(),
            enabled: true,
            targets: HashMap::new(),
            rules: vec![],
            fallthrough: ServeTarget::Variation(0),
            off_variation: 0,
            salt: "testsalt".to_string(),
            updated_at: ts(),
        }
    }

    fn ctx(key: &str) -> Context {
        Context {
            key: key.to_string(),
            attributes: HashMap::new(),
        }
    }

    fn ctx_attr(key: &str, attrs: Vec<(&str, serde_json::Value)>) -> Context {
        Context {
            key: key.to_string(),
            attributes: attrs.into_iter().map(|(k, v)| (k.to_string(), v)).collect(),
        }
    }

    // ── Off behavior ────────────────────────────────────────────────────────

    #[test]
    fn off_serves_off_variation() {
        let flag = bool_flag("my-flag");
        let mut config = default_config("my-flag");
        config.enabled = false;
        config.off_variation = 0;
        let r = evaluate(&flag, &config, &HashMap::new(), &ctx("user-1"));
        assert_eq!(r.reason, Reason::Off);
        assert_eq!(r.variation_index, 0);
        assert_eq!(r.value, VariationValue::Bool(false));
    }

    // ── Target match ────────────────────────────────────────────────────────

    #[test]
    fn target_match_wins_over_rules() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.targets.insert("vip-user".to_string(), 1);
        config.fallthrough = ServeTarget::Variation(0);
        let r = evaluate(&flag, &config, &HashMap::new(), &ctx("vip-user"));
        assert_eq!(r.reason, Reason::TargetMatch);
        assert_eq!(r.variation_index, 1);
    }

    #[test]
    fn non_targeted_user_falls_through() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.targets.insert("vip-user".to_string(), 1);
        config.fallthrough = ServeTarget::Variation(0);
        let r = evaluate(&flag, &config, &HashMap::new(), &ctx("other"));
        assert_eq!(r.reason, Reason::Fallthrough);
        assert_eq!(r.variation_index, 0);
    }

    // ── Rule ordering ────────────────────────────────────────────────────────

    #[test]
    fn first_matching_rule_wins() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.rules = vec![
            Rule {
                id: "r1".to_string(),
                clauses: vec![Clause {
                    attribute: "key".to_string(),
                    op: ClauseOp::In,
                    values: vec![serde_json::json!("match-me")],
                    negate: false,
                }],
                serve: ServeTarget::Variation(1),
            },
            Rule {
                id: "r2".to_string(),
                clauses: vec![Clause {
                    attribute: "key".to_string(),
                    op: ClauseOp::In,
                    values: vec![serde_json::json!("match-me")],
                    negate: false,
                }],
                serve: ServeTarget::Variation(0),
            },
        ];
        let r = evaluate(&flag, &config, &HashMap::new(), &ctx("match-me"));
        assert_eq!(r.reason, Reason::RuleMatch { rule_index: 0 });
        assert_eq!(r.variation_index, 1);
    }

    // ── Clause operators ─────────────────────────────────────────────────────

    #[test]
    fn clause_contains() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.rules = vec![Rule {
            id: "r".to_string(),
            clauses: vec![Clause {
                attribute: "email".to_string(),
                op: ClauseOp::Contains,
                values: vec![serde_json::json!("@acme.com")],
                negate: false,
            }],
            serve: ServeTarget::Variation(1),
        }];
        let r = evaluate(
            &flag,
            &config,
            &HashMap::new(),
            &ctx_attr("u", vec![("email", serde_json::json!("alice@acme.com"))]),
        );
        assert_eq!(r.reason, Reason::RuleMatch { rule_index: 0 });
    }

    #[test]
    fn clause_starts_with() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.rules = vec![Rule {
            id: "r".to_string(),
            clauses: vec![Clause {
                attribute: "plan".to_string(),
                op: ClauseOp::StartsWith,
                values: vec![serde_json::json!("ent")],
                negate: false,
            }],
            serve: ServeTarget::Variation(1),
        }];
        let r = evaluate(
            &flag,
            &config,
            &HashMap::new(),
            &ctx_attr("u", vec![("plan", serde_json::json!("enterprise"))]),
        );
        assert_eq!(r.reason, Reason::RuleMatch { rule_index: 0 });
    }

    #[test]
    fn clause_ends_with() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.rules = vec![Rule {
            id: "r".to_string(),
            clauses: vec![Clause {
                attribute: "email".to_string(),
                op: ClauseOp::EndsWith,
                values: vec![serde_json::json!("@internal.io")],
                negate: false,
            }],
            serve: ServeTarget::Variation(1),
        }];
        let r = evaluate(
            &flag,
            &config,
            &HashMap::new(),
            &ctx_attr("u", vec![("email", serde_json::json!("bob@internal.io"))]),
        );
        assert_eq!(r.reason, Reason::RuleMatch { rule_index: 0 });
    }

    #[test]
    fn clause_greater() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.rules = vec![Rule {
            id: "r".to_string(),
            clauses: vec![Clause {
                attribute: "age".to_string(),
                op: ClauseOp::Greater,
                values: vec![serde_json::json!(18)],
                negate: false,
            }],
            serve: ServeTarget::Variation(1),
        }];
        let adult = evaluate(
            &flag,
            &config,
            &HashMap::new(),
            &ctx_attr("u", vec![("age", serde_json::json!(25))]),
        );
        assert_eq!(adult.reason, Reason::RuleMatch { rule_index: 0 });
        let minor = evaluate(
            &flag,
            &config,
            &HashMap::new(),
            &ctx_attr("u", vec![("age", serde_json::json!(16))]),
        );
        assert_eq!(minor.reason, Reason::Fallthrough);
    }

    #[test]
    fn clause_negate() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.rules = vec![Rule {
            id: "r".to_string(),
            clauses: vec![Clause {
                attribute: "plan".to_string(),
                op: ClauseOp::In,
                values: vec![serde_json::json!("free")],
                negate: true,
            }],
            serve: ServeTarget::Variation(1),
        }];
        // Paid user → not free → rule matches (negated)
        let paid = evaluate(
            &flag,
            &config,
            &HashMap::new(),
            &ctx_attr("u", vec![("plan", serde_json::json!("paid"))]),
        );
        assert_eq!(paid.reason, Reason::RuleMatch { rule_index: 0 });
        // Free user → is free → negate → no match
        let free = evaluate(
            &flag,
            &config,
            &HashMap::new(),
            &ctx_attr("u", vec![("plan", serde_json::json!("free"))]),
        );
        assert_eq!(free.reason, Reason::Fallthrough);
    }

    #[test]
    fn clause_regex() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.rules = vec![Rule {
            id: "r".to_string(),
            clauses: vec![Clause {
                attribute: "email".to_string(),
                op: ClauseOp::Regex,
                values: vec![serde_json::json!(r"^admin@")],
                negate: false,
            }],
            serve: ServeTarget::Variation(1),
        }];
        let admin = evaluate(
            &flag,
            &config,
            &HashMap::new(),
            &ctx_attr("u", vec![("email", serde_json::json!("admin@acme.com"))]),
        );
        assert_eq!(admin.reason, Reason::RuleMatch { rule_index: 0 });
    }

    #[test]
    fn clause_semver() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.rules = vec![Rule {
            id: "r".to_string(),
            clauses: vec![Clause {
                attribute: "app_version".to_string(),
                op: ClauseOp::SemverGreater,
                values: vec![serde_json::json!("2.0.0")],
                negate: false,
            }],
            serve: ServeTarget::Variation(1),
        }];
        let new_app = evaluate(
            &flag,
            &config,
            &HashMap::new(),
            &ctx_attr("u", vec![("app_version", serde_json::json!("2.1.0"))]),
        );
        assert_eq!(new_app.reason, Reason::RuleMatch { rule_index: 0 });
        let old_app = evaluate(
            &flag,
            &config,
            &HashMap::new(),
            &ctx_attr("u", vec![("app_version", serde_json::json!("1.9.0"))]),
        );
        assert_eq!(old_app.reason, Reason::Fallthrough);
    }

    // ── Multivariate flags ───────────────────────────────────────────────────

    #[test]
    fn string_flag_evaluation() {
        let flag = Flag {
            key: "theme".to_string(),
            kind: FlagKind::String,
            variations: vec![
                VariationValue::String("light".to_string()),
                VariationValue::String("dark".to_string()),
            ],
            description: String::new(),
            created_at: ts(),
            updated_at: ts(),
        };
        let mut config = default_config("theme");
        config.fallthrough = ServeTarget::Variation(1);
        let r = evaluate(&flag, &config, &HashMap::new(), &ctx("u"));
        assert_eq!(r.value, VariationValue::String("dark".to_string()));
        assert_eq!(r.reason, Reason::Fallthrough);
    }

    #[test]
    fn number_flag_evaluation() {
        let flag = Flag {
            key: "rate-limit".to_string(),
            kind: FlagKind::Number,
            variations: vec![
                VariationValue::Number(100.0),
                VariationValue::Number(1000.0),
            ],
            description: String::new(),
            created_at: ts(),
            updated_at: ts(),
        };
        let mut config = default_config("rate-limit");
        config.fallthrough = ServeTarget::Variation(0);
        let r = evaluate(&flag, &config, &HashMap::new(), &ctx("u"));
        assert_eq!(r.value, VariationValue::Number(100.0));
    }

    // ── Rollout distribution ─────────────────────────────────────────────────

    #[test]
    fn rollout_50_50_distribution() {
        let flag = bool_flag("rollout-flag");
        let mut config = default_config("rollout-flag");
        config.fallthrough = ServeTarget::Rollout(vec![
            WeightedVariation {
                variation: 0,
                weight: 50_000,
            },
            WeightedVariation {
                variation: 1,
                weight: 50_000,
            },
        ]);

        let n = 10_000;
        let mut counts = [0u32; 2];
        for i in 0..n {
            let r = evaluate(&flag, &config, &HashMap::new(), &ctx(&format!("user-{i}")));
            counts[r.variation_index] += 1;
        }
        let split = counts[1] as f64 / n as f64;
        assert!(
            (0.45..=0.55).contains(&split),
            "50/50 rollout got {:.1}% true (expected ~50%)",
            split * 100.0
        );
    }

    #[test]
    fn rollout_sticky() {
        let flag = bool_flag("sticky-flag");
        let mut config = default_config("sticky-flag");
        config.fallthrough = ServeTarget::Rollout(vec![
            WeightedVariation {
                variation: 0,
                weight: 50_000,
            },
            WeightedVariation {
                variation: 1,
                weight: 50_000,
            },
        ]);

        for i in 0..100 {
            let key = format!("sticky-user-{i}");
            let first = evaluate(&flag, &config, &HashMap::new(), &ctx(&key));
            for _ in 0..5 {
                let again = evaluate(&flag, &config, &HashMap::new(), &ctx(&key));
                assert_eq!(
                    first.variation_index, again.variation_index,
                    "sticky user {key} re-bucketed"
                );
            }
        }
    }

    // ── Segment matching ─────────────────────────────────────────────────────

    #[test]
    fn segment_included_key() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.rules = vec![Rule {
            id: "r".to_string(),
            clauses: vec![Clause {
                attribute: "key".to_string(),
                op: ClauseOp::SegmentMatch,
                values: vec![serde_json::json!("beta")],
                negate: false,
            }],
            serve: ServeTarget::Variation(1),
        }];
        let seg = Segment {
            key: "beta".to_string(),
            env_key: "test".to_string(),
            name: "Beta".to_string(),
            included: vec!["beta-user".to_string()],
            excluded: vec![],
            clauses: vec![],
            created_at: ts(),
            updated_at: ts(),
        };
        let mut segs = HashMap::new();
        segs.insert("beta".to_string(), seg);

        let r = evaluate(&flag, &config, &segs, &ctx("beta-user"));
        assert_eq!(r.reason, Reason::RuleMatch { rule_index: 0 });

        let r2 = evaluate(&flag, &config, &segs, &ctx("other"));
        assert_eq!(r2.reason, Reason::Fallthrough);
    }

    #[test]
    fn segment_excluded_beats_included() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.rules = vec![Rule {
            id: "r".to_string(),
            clauses: vec![Clause {
                attribute: "key".to_string(),
                op: ClauseOp::SegmentMatch,
                values: vec![serde_json::json!("vip")],
                negate: false,
            }],
            serve: ServeTarget::Variation(1),
        }];
        let seg = Segment {
            key: "vip".to_string(),
            env_key: "test".to_string(),
            name: "VIP".to_string(),
            included: vec!["demoted".to_string()],
            excluded: vec!["demoted".to_string()],
            clauses: vec![],
            created_at: ts(),
            updated_at: ts(),
        };
        let mut segs = HashMap::new();
        segs.insert("vip".to_string(), seg);
        let r = evaluate(&flag, &config, &segs, &ctx("demoted"));
        assert_eq!(r.reason, Reason::Fallthrough);
    }

    // ── All reason codes ─────────────────────────────────────────────────────

    #[test]
    fn all_reason_codes_reachable() {
        let flag = bool_flag("f");
        let mut config = default_config("f");
        config.enabled = false;
        let r = evaluate(&flag, &config, &HashMap::new(), &ctx("u"));
        assert_eq!(r.reason, Reason::Off);

        config.enabled = true;
        config.targets.insert("u".to_string(), 1);
        let r = evaluate(&flag, &config, &HashMap::new(), &ctx("u"));
        assert_eq!(r.reason, Reason::TargetMatch);

        config.targets.clear();
        config.rules = vec![Rule {
            id: "r".to_string(),
            clauses: vec![Clause {
                attribute: "key".to_string(),
                op: ClauseOp::In,
                values: vec![serde_json::json!("u")],
                negate: false,
            }],
            serve: ServeTarget::Variation(1),
        }];
        let r = evaluate(&flag, &config, &HashMap::new(), &ctx("u"));
        assert_eq!(r.reason, Reason::RuleMatch { rule_index: 0 });

        config.rules.clear();
        let r = evaluate(&flag, &config, &HashMap::new(), &ctx("u"));
        assert_eq!(r.reason, Reason::Fallthrough);
    }
}
