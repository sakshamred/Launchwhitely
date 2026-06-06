/**
 * @module rollout
 * Public API surface of the Launchwhitly rollout engine.
 *
 * Import everything you need from this single entry-point:
 *
 * ```ts
 * import { evaluate, evaluateAll, getBucket, matchesSegment } from '@/lib/rollout'
 * import type { FlagState, EvalContext, EvalResult } from '@/lib/rollout'
 * ```
 *
 * Module layout
 * -------------
 * - types.ts     → all shared TypeScript interfaces and type aliases
 * - bucketing.ts → deterministic FNV-1a hash → bucket 0-99
 * - targeting.ts → condition & rule evaluation
 * - segments.ts  → segment membership checks
 * - evaluator.ts → main `evaluate` / `evaluateAll` orchestrator
 */

export * from './types'
export * from './bucketing'
export * from './targeting'
export * from './segments'
export * from './evaluator'
