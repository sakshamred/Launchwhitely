/**
 * @module targeting
 * Condition and rule evaluation for the Launchwhitly rollout engine.
 *
 * Rules:
 * - All functions are pure and synchronous.
 * - Missing / undefined attributes are handled gracefully (no throws).
 * - Numeric comparisons coerce strings to numbers; non-numeric strings
 *   compare as NaN → always false, which is the safe default.
 */

import type { Condition, EvalContext, Operator, TargetingRule } from './types'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Coerce an unknown value to a string for string-based operators.
 * Returns an empty string for null / undefined.
 */
function toStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

/**
 * Coerce an unknown value to a number for numeric operators.
 * Returns NaN for values that cannot be parsed.
 */
function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v)
  return NaN
}

/**
 * Loose equality check that works across string / number / boolean coercions
 * that are common in flag attribute payloads (e.g. `"true"` vs `true`).
 * Does NOT coerce across types – `"1"` !== `1`.
 */
function looseEqual(a: unknown, b: unknown): boolean {
  // Both null/undefined → equal
  if (a === null && b === null) return true
  if (a === undefined && b === undefined) return true
  // Exact same type & value
  return a === b
}

// ---------------------------------------------------------------------------
// evaluateCondition
// ---------------------------------------------------------------------------

/**
 * Evaluate a single {@link Condition} against an {@link EvalContext}.
 *
 * Returns `false` on any type mismatch or missing attribute unless the
 * operator itself is about existence (`exists` / `not_exists`).
 *
 * @param condition - The condition to evaluate.
 * @param context   - The current user / request context.
 * @returns `true` if the condition is satisfied, `false` otherwise.
 */
export function evaluateCondition(
  condition: Condition,
  context: EvalContext,
): boolean {
  const { attribute, operator, value } = condition
  const attrValue = context[attribute]

  try {
    return applyOperator(operator, attrValue, value)
  } catch {
    // Never let a single bad condition crash the evaluation pipeline.
    return false
  }
}

/**
 * Apply a single operator.
 * Extracted so it can be unit-tested independently.
 */
function applyOperator(
  operator: Operator,
  attrValue: unknown,
  conditionValue: unknown,
): boolean {
  switch (operator) {
    // -----------------------------------------------------------------------
    // Existence
    // -----------------------------------------------------------------------
    case 'exists':
      return attrValue !== undefined && attrValue !== null

    case 'not_exists':
      return attrValue === undefined || attrValue === null

    // -----------------------------------------------------------------------
    // Boolean checks
    // -----------------------------------------------------------------------
    case 'is_true':
      return attrValue === true

    case 'is_false':
      return attrValue === false

    // -----------------------------------------------------------------------
    // Equality
    // -----------------------------------------------------------------------
    case 'equals':
      return looseEqual(attrValue, conditionValue)

    case 'not_equals':
      return !looseEqual(attrValue, conditionValue)

    // -----------------------------------------------------------------------
    // String operations
    // -----------------------------------------------------------------------
    case 'contains': {
      const haystack = toStr(attrValue)
      const needle = toStr(conditionValue)
      // Also support arrays: check if the array contains the condition value.
      if (Array.isArray(attrValue)) {
        return attrValue.some((item) => looseEqual(item, conditionValue))
      }
      return needle.length > 0 && haystack.includes(needle)
    }

    case 'not_contains': {
      if (Array.isArray(attrValue)) {
        return !attrValue.some((item) => looseEqual(item, conditionValue))
      }
      const haystack = toStr(attrValue)
      const needle = toStr(conditionValue)
      return needle.length === 0 || !haystack.includes(needle)
    }

    case 'starts_with': {
      const str = toStr(attrValue)
      const prefix = toStr(conditionValue)
      return prefix.length > 0 && str.startsWith(prefix)
    }

    case 'ends_with': {
      const str = toStr(attrValue)
      const suffix = toStr(conditionValue)
      return suffix.length > 0 && str.endsWith(suffix)
    }

    // -----------------------------------------------------------------------
    // Set membership
    // -----------------------------------------------------------------------
    case 'in': {
      if (!Array.isArray(conditionValue)) return false
      return conditionValue.some((item) => looseEqual(attrValue, item))
    }

    case 'not_in': {
      if (!Array.isArray(conditionValue)) return true
      return !conditionValue.some((item) => looseEqual(attrValue, item))
    }

    // -----------------------------------------------------------------------
    // Numeric comparisons
    // -----------------------------------------------------------------------
    case 'gt': {
      const a = toNum(attrValue)
      const b = toNum(conditionValue)
      return !isNaN(a) && !isNaN(b) && a > b
    }

    case 'gte': {
      const a = toNum(attrValue)
      const b = toNum(conditionValue)
      return !isNaN(a) && !isNaN(b) && a >= b
    }

    case 'lt': {
      const a = toNum(attrValue)
      const b = toNum(conditionValue)
      return !isNaN(a) && !isNaN(b) && a < b
    }

    case 'lte': {
      const a = toNum(attrValue)
      const b = toNum(conditionValue)
      return !isNaN(a) && !isNaN(b) && a <= b
    }

    default:
      // Unknown operator – safe default is to not match.
      return false
  }
}

// ---------------------------------------------------------------------------
// evaluateRule
// ---------------------------------------------------------------------------

/**
 * Evaluate a {@link TargetingRule} against an {@link EvalContext}.
 *
 * A rule matches when **all** of its conditions are satisfied (AND logic).
 * An empty `conditions` array is treated as always-matching (unconditional
 * catch-all rule).
 *
 * @param rule    - The targeting rule to evaluate.
 * @param context - The current user / request context.
 * @returns `true` if all conditions in the rule pass.
 */
export function evaluateRule(
  rule: TargetingRule,
  context: EvalContext,
): boolean {
  if (rule.conditions.length === 0) {
    // An unconditional rule – serves as a catch-all / default override.
    return true
  }

  return rule.conditions.every((condition) =>
    evaluateCondition(condition, context),
  )
}
