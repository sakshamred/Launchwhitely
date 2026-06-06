/**
 * @module evaluator
 * Main evaluation orchestrator for the Launchwhitly rollout engine.
 *
 * The `evaluate` function is the single entry-point used by the SDK to resolve
 * a flag for a given user context. It is:
 * - Synchronous (no async/await, no network)
 * - Deterministic (same inputs → same output, every time)
 * - Side-effect free
 *
 * Evaluation order
 * ----------------
 * 1. Kill-switch: if `flag.enabled === false` → disabled, return defaultValue.
 * 2. Targeting rules (in order, first match wins):
 *    a. Check rule conditions (AND within rule).
 *    b. If `rule.rolloutPct` is set, also check the per-rule bucket.
 *    c. Matched `serve`:
 *       - `'off'`  → return disabled result immediately.
 *       - `'on'`   → skip remaining rules, continue to global rollout step.
 *       - variant  → return that variant's value immediately.
 * 3. Global rollout: if `bucket >= flag.rolloutPct` → not in rollout, return defaultValue.
 * 4. Variant assignment: distribute the 0-99 bucket space across variant weights.
 * 5. Fallback: enabled = true, value = true (plain boolean flag).
 */

import type {
  EvalContext,
  EvalResult,
  FlagState,
  SegmentDef,
  Variant,
} from './types'
import { getBucket } from './bucketing'
import { evaluateRule } from './targeting'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a "disabled" result carrying the flag's default value.
 */
function disabledResult(
  defaultValue: unknown,
  reason: EvalResult['reason'],
): EvalResult {
  return { enabled: false, value: defaultValue, reason }
}

/**
 * Build an "enabled" result for a specific variant.
 */
function variantResult(variant: Variant): EvalResult {
  return {
    enabled: true,
    value: variant.value,
    reason: 'targeting_match',
    variant: variant.key,
  }
}

/**
 * Select a variant by distributing the bucket (0–99) across cumulative
 * weight buckets.
 *
 * Example with weights [control=50, treatment=50]:
 *   bucket  0–49 → control
 *   bucket 50–99 → treatment
 *
 * The function gracefully handles:
 * - Weights that don't sum to exactly 100 (uses whatever total they do sum to)
 * - Zero-weight variants (never selected)
 * - Empty variants array (returns undefined)
 *
 * @param variants - Ordered list of variants with weights.
 * @param bucket   - User's deterministic bucket (0–99).
 * @returns The matched {@link Variant}, or `undefined` if none match.
 */
function pickVariant(
  variants: Variant[],
  bucket: number,
): Variant | undefined {
  if (variants.length === 0) return undefined

  const totalWeight = variants.reduce((sum, v) => sum + (v.weight ?? 0), 0)
  if (totalWeight <= 0) return undefined

  // Normalise the bucket to the actual total weight so the selection is fair
  // even when weights don't sum to exactly 100.
  const scaledBucket = (bucket / 100) * totalWeight

  let cursor = 0
  for (const variant of variants) {
    cursor += variant.weight ?? 0
    if (scaledBucket < cursor) {
      return variant
    }
  }

  // Floating-point edge case: hand the last variant the remaining rounding
  // error (< 1 ULP). Return the last non-zero-weight variant.
  return [...variants].reverse().find((v) => (v.weight ?? 0) > 0)
}

// ---------------------------------------------------------------------------
// evaluate
// ---------------------------------------------------------------------------

/**
 * Evaluate a single feature flag for the given evaluation context.
 *
 * @param flag     - The full flag state from the local cache.
 * @param context  - Attributes describing the current user / request.
 * @param segments - Optional map of reusable segment definitions (keyed by
 *                   segment key). Passed through for future rule extensions
 *                   that reference segments; unused by core conditions today.
 * @returns An {@link EvalResult} describing whether the flag is on, the value
 *          to use, and the reason for the decision.
 *
 * @example
 * ```ts
 * const result = evaluate(myFlag, { userId: 'user-123', plan: 'pro' })
 * if (result.enabled) {
 *   console.log('variant:', result.variant, 'value:', result.value)
 * }
 * ```
 */
export function evaluate(
  flag: FlagState,
  context: EvalContext,
  segments: Record<string, SegmentDef> = {},
): EvalResult {
  // ── Step 1: Kill-switch ──────────────────────────────────────────────────
  if (!flag.enabled) {
    return disabledResult(flag.defaultValue, 'flag_disabled')
  }

  // The bucket is computed once and reused for both rule-level and global
  // rollout checks so behaviour is consistent throughout evaluation.
  const bucket = getBucket(context.userId, flag.flagKey)

  // ── Step 2: Targeting rules ──────────────────────────────────────────────
  // `segments` is intentionally accepted so that future condition types (e.g.
  // `segment_match`) can call `matchesSegment` here without a breaking change.
  void segments // mark as used; consumed by future condition evaluators

  let forceGlobalRollout = false

  for (const rule of flag.rules) {
    // 2a. Check conditions (AND within rule).
    if (!evaluateRule(rule, context)) continue

    // 2b. Per-rule rollout check.
    if (
      rule.rolloutPct !== undefined &&
      rule.rolloutPct !== null &&
      bucket >= rule.rolloutPct
    ) {
      // User is outside this rule's rollout percentage – skip rule but
      // continue evaluating subsequent rules.
      continue
    }

    // 2c. Rule matched – honour the `serve` directive.
    const serve = rule.serve

    if (serve === 'off') {
      return disabledResult(flag.defaultValue, 'targeting_match')
    }

    if (serve === 'on') {
      // Bypass remaining rules and jump to global rollout / variant logic.
      forceGlobalRollout = true
      break
    }

    // `serve` is a variant key.
    const matchedVariant = flag.variants.find((v) => v.key === serve)
    if (matchedVariant) {
      return variantResult(matchedVariant)
    }

    // Variant key doesn't exist in the flag definition – treat as enabled
    // with no specific variant (safe fallback, avoids silent failures).
    return {
      enabled: true,
      value: flag.defaultValue,
      reason: 'targeting_match',
      variant: serve,
    }
  }

  // ── Step 3: Global rollout ───────────────────────────────────────────────
  // Skip rollout exclusion if a targeting rule with `serve: 'on'` already
  // decided the user should be in (forceGlobalRollout = true).
  if (!forceGlobalRollout && bucket >= flag.rolloutPct) {
    return disabledResult(flag.defaultValue, 'rollout')
  }

  // ── Step 4: Variant assignment ───────────────────────────────────────────
  if (flag.variants.length > 0) {
    const variant = pickVariant(flag.variants, bucket)
    if (variant) {
      return {
        enabled: true,
        value: variant.value,
        reason: 'rollout',
        variant: variant.key,
      }
    }
    // All variants have zero weight or weights don't cover the bucket.
    return disabledResult(flag.defaultValue, 'default')
  }

  // ── Step 5: Fallback (plain boolean flag) ────────────────────────────────
  return { enabled: true, value: true, reason: 'default' }
}

// ---------------------------------------------------------------------------
// evaluateAll
// ---------------------------------------------------------------------------

/**
 * Evaluate every flag in a cache payload for a single evaluation context.
 *
 * Returns a `Record<flagKey, EvalResult>` that mirrors the shape of
 * {@link FlagCache.flags}. Evaluation errors on individual flags are caught and
 * represented as an `'error'` reason so one bad flag never blocks the rest.
 *
 * @param flags    - All flags from the local cache, keyed by `flagKey`.
 * @param context  - Attributes describing the current user / request.
 * @param segments - Segment definitions from the local cache.
 * @returns A map of flag key → evaluation result.
 *
 * @example
 * ```ts
 * const results = evaluateAll(cache.flags, { userId: 'user-123', plan: 'pro' }, cache.segments)
 * const darkMode = results['dark-mode']
 * ```
 */
export function evaluateAll(
  flags: Record<string, FlagState>,
  context: EvalContext,
  segments: Record<string, SegmentDef> = {},
): Record<string, EvalResult> {
  const results: Record<string, EvalResult> = {}

  for (const [key, flag] of Object.entries(flags)) {
    try {
      results[key] = evaluate(flag, context, segments)
    } catch (err) {
      // Surface as a typed error result rather than propagating the exception.
      results[key] = {
        enabled: false,
        value: flag?.defaultValue ?? null,
        reason: 'error',
      }
      // Re-throw in development so engineers see the stack trace immediately.
      if (
        typeof process !== 'undefined' &&
        process.env?.NODE_ENV === 'development'
      ) {
        console.error(`[launchwhitly] Error evaluating flag "${key}":`, err)
      }
    }
  }

  return results
}
