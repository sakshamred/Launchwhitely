/**
 * @module segments
 * Segment membership evaluation for the Launchwhitly rollout engine.
 *
 * A "segment" is a reusable, named group of users defined by a set of
 * targeting rules. Segments let you define audiences once and reference them
 * from many flags without duplicating conditions.
 *
 * Membership semantics
 * --------------------
 * - Rules inside a segment are combined with **OR** logic: a user belongs to
 *   the segment if they match **any** of the segment's rules.
 * - Conditions inside a single rule are combined with **AND** logic (this is
 *   handled by {@link evaluateRule} in targeting.ts).
 * - An empty `rules` array → nobody matches (exclusive / empty segment).
 */

import type { EvalContext, SegmentDef } from './types'
import { evaluateRule } from './targeting'

/**
 * Determine whether a user context belongs to a segment.
 *
 * The user matches the segment if they satisfy **at least one** of the
 * segment's {@link SegmentDef.rules} (OR between rules, AND within a rule).
 *
 * Edge cases:
 * - Empty `segment.rules` → returns `false` (no one matches an empty segment).
 * - A rule with empty `conditions` → always matches (unconditional catch-all).
 *
 * @param segment - The segment definition to test against.
 * @param context - The current user / request context.
 * @returns `true` if the context matches at least one rule in the segment.
 *
 * @example
 * ```ts
 * const betaUsers: SegmentDef = {
 *   key: 'beta-users',
 *   rules: [
 *     {
 *       id: 'r1',
 *       conditions: [{ attribute: 'plan', operator: 'equals', value: 'beta' }],
 *       serve: 'on',
 *     },
 *     {
 *       id: 'r2',
 *       conditions: [{ attribute: 'email', operator: 'ends_with', value: '@acme.com' }],
 *       serve: 'on',
 *     },
 *   ],
 * }
 *
 * matchesSegment(betaUsers, { userId: 'u1', plan: 'beta' })          // true  (rule r1)
 * matchesSegment(betaUsers, { userId: 'u2', email: 'bob@acme.com' }) // true  (rule r2)
 * matchesSegment(betaUsers, { userId: 'u3', plan: 'free' })          // false
 * ```
 */
export function matchesSegment(
  segment: SegmentDef,
  context: EvalContext,
): boolean {
  if (segment.rules.length === 0) {
    return false
  }

  // OR across rules: stop at first match.
  return segment.rules.some((rule) => evaluateRule(rule, context))
}
