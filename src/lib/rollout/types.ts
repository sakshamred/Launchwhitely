/**
 * @module types
 * Core type definitions for the Launchwhitly rollout engine.
 * All types are pure data – no classes, no async, no side effects.
 */

// ---------------------------------------------------------------------------
// Evaluation context
// ---------------------------------------------------------------------------

/**
 * Attributes describing the current user / request being evaluated.
 * `userId` is the only required field; everything else is an arbitrary
 * attribute (plan, country, email, …) used by targeting rules.
 */
export interface EvalContext {
  /** Stable user identifier – drives deterministic bucketing. */
  userId: string
  /** Arbitrary attributes matched against targeting conditions. */
  [attribute: string]: unknown
}

// ---------------------------------------------------------------------------
// Targeting
// ---------------------------------------------------------------------------

/**
 * Every supported comparison operator for targeting conditions.
 *
 * String ops  : equals, not_equals, contains, not_contains, starts_with, ends_with
 * Set ops     : in, not_in
 * Numeric ops : gt, gte, lt, lte
 * Boolean ops : is_true, is_false
 * Existence   : exists, not_exists
 */
export type Operator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in'
  | 'not_in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'is_true'
  | 'is_false'
  | 'exists'
  | 'not_exists'

/**
 * A single predicate evaluated against an {@link EvalContext}.
 * e.g. `{ attribute: 'plan', operator: 'equals', value: 'pro' }`
 */
export interface Condition {
  /** The context attribute to inspect, e.g. `"plan"`, `"country"`, `"email"`. */
  attribute: string
  /** How to compare the attribute value against `value`. */
  operator: Operator
  /**
   * The right-hand side of the comparison.
   * For `in`/`not_in` this must be an array; for numeric operators a number;
   * for `exists`/`not_exists`/`is_true`/`is_false` this is ignored.
   */
  value: unknown
}

/**
 * A targeting rule that can force a specific serve value for matching users.
 * All `conditions` inside a rule are combined with AND.
 * Rules themselves are evaluated in order; first match wins.
 */
export interface TargetingRule {
  /** Stable, unique identifier for this rule. */
  id: string
  /** All conditions must match for the rule to fire (AND logic). */
  conditions: Condition[]
  /**
   * What to serve when the rule matches.
   * - `'on'`  → user enters the global rollout / variant logic
   * - `'off'` → user is excluded (flag evaluates as disabled)
   * - any other string → treated as a variant key
   */
  serve: 'on' | 'off' | string
  /**
   * Optional per-rule rollout percentage (0–100).
   * When present, the user must also fall within this bucket for the rule to
   * be considered matched.
   */
  rolloutPct?: number
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

/**
 * A single variant in an A/B or multivariate test.
 * All variant `weight` values in a flag should sum to 100.
 */
export interface Variant {
  /** Short machine-readable key, e.g. `"control"` or `"treatment"`. */
  key: string
  /** Human-readable display name. */
  name: string
  /**
   * Relative traffic weight (0–100).
   * The engine assigns variants by splitting the 0–99 bucket space
   * proportionally across weights.
   */
  weight: number
  /** The value returned to the SDK consumer for this variant. */
  value: unknown
}

// ---------------------------------------------------------------------------
// Flag state
// ---------------------------------------------------------------------------

/**
 * The complete state of a single feature flag as stored in the local cache.
 * This is the input to the evaluation engine.
 */
export interface FlagState {
  /** Unique flag identifier, e.g. `"dark-mode"` or `"checkout-v2"`. */
  flagKey: string
  /** Master kill-switch. When `false` everyone gets `defaultValue`. */
  enabled: boolean
  /**
   * Global rollout percentage (0–100).
   * Users whose bucket ≥ this value are excluded even if no rules match.
   */
  rolloutPct: number
  /**
   * Ordered list of targeting rules.
   * Evaluated top-to-bottom; first match wins.
   */
  rules: TargetingRule[]
  /**
   * Variants for A/B tests.
   * Empty array → boolean flag (returns `true` when enabled).
   */
  variants: Variant[]
  /**
   * Value returned when the flag is disabled, the user is outside the rollout,
   * or no variant can be selected.
   */
  defaultValue: unknown
}

// ---------------------------------------------------------------------------
// Evaluation result
// ---------------------------------------------------------------------------

/**
 * The reason a particular {@link EvalResult} was produced.
 *
 * - `flag_disabled`   → `flag.enabled` is `false`
 * - `targeting_match` → a targeting rule fired
 * - `rollout`         → the user is inside the global rollout
 * - `default`         → fallback when nothing else matched
 * - `error`           → something unexpected happened during evaluation
 */
export type EvalReason =
  | 'flag_disabled'
  | 'targeting_match'
  | 'rollout'
  | 'default'
  | 'error'

/**
 * The output of evaluating a flag for a specific context.
 */
export interface EvalResult {
  /** Whether the flag is considered "on" for this user. */
  enabled: boolean
  /**
   * The concrete value to use:
   * - `flag.defaultValue`  when disabled
   * - variant's `value`    for A/B tests
   * - `true`               for plain boolean flags that are on
   */
  value: unknown
  /** Machine-readable explanation for the decision. */
  reason: EvalReason
  /** Set to the variant `key` when a variant was selected. */
  variant?: string
}

// ---------------------------------------------------------------------------
// Cache / SDK payload
// ---------------------------------------------------------------------------

/**
 * The full payload the SDK keeps in its local cache.
 * Emitted by the streaming gateway on connect and on every state change.
 */
export interface FlagCache {
  /** The environment these flags belong to (e.g. `"prod"`, `"staging"`). */
  environmentId: string
  /**
   * Monotonically increasing cache version.
   * The SDK uses this to discard stale payloads.
   */
  version: number
  /** All flags in this environment, keyed by `flagKey`. */
  flags: Record<string, FlagState>
  /** Reusable user segment definitions, keyed by segment key. */
  segments: Record<string, SegmentDef>
}

/**
 * A reusable segment – a named set of targeting rules that can be referenced
 * from multiple flags.
 */
export interface SegmentDef {
  /** Unique segment identifier, e.g. `"beta-users"`. */
  key: string
  /**
   * Targeting rules for membership.
   * A user belongs to the segment if they match ANY rule (OR logic).
   */
  rules: TargetingRule[]
}
