import type { EvalContext, EvalResult, FlagState, SegmentDef, Variant } from './types'
import { getBucket } from './bucketing'
import { evaluateRule } from './targeting'

function disabledResult(defaultValue: unknown, reason: EvalResult['reason']): EvalResult {
  return { enabled: false, value: defaultValue, reason }
}

function variantResult(variant: Variant): EvalResult {
  return {
    enabled: true,
    value: variant.value,
    reason: 'targeting_match',
    variant: variant.key,
  }
}

function pickVariant(variants: Variant[], bucket: number): Variant | undefined {
  if (variants.length === 0) return undefined

  const totalWeight = variants.reduce((sum, variant) => sum + (variant.weight ?? 0), 0)
  if (totalWeight <= 0) return undefined

  const scaledBucket = (bucket / 100) * totalWeight
  let cursor = 0

  for (const variant of variants) {
    cursor += variant.weight ?? 0
    if (scaledBucket < cursor) return variant
  }

  return [...variants].reverse().find((variant) => (variant.weight ?? 0) > 0)
}

export function evaluate(
  flag: FlagState,
  context: EvalContext,
  segments: Record<string, SegmentDef> = {},
): EvalResult {
  if (!flag.enabled) return disabledResult(flag.defaultValue, 'flag_disabled')

  const bucket = getBucket(context.userId, flag.flagKey)
  void segments

  let forceGlobalRollout = false

  for (const rule of flag.rules) {
    if (!evaluateRule(rule, context)) continue

    if (rule.rolloutPct !== undefined && rule.rolloutPct !== null && bucket >= rule.rolloutPct) {
      continue
    }

    if (rule.serve === 'off') {
      return disabledResult(flag.defaultValue, 'targeting_match')
    }

    if (rule.serve === 'on') {
      forceGlobalRollout = true
      break
    }

    const matchedVariant = flag.variants.find((variant) => variant.key === rule.serve)
    if (matchedVariant) return variantResult(matchedVariant)

    return {
      enabled: true,
      value: flag.defaultValue,
      reason: 'targeting_match',
      variant: rule.serve,
    }
  }

  if (!forceGlobalRollout && bucket >= flag.rolloutPct) {
    return disabledResult(flag.defaultValue, 'rollout')
  }

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

    return disabledResult(flag.defaultValue, 'default')
  }

  return { enabled: true, value: true, reason: 'default' }
}

export function evaluateAll(
  flags: Record<string, FlagState>,
  context: EvalContext,
  segments: Record<string, SegmentDef> = {},
): Record<string, EvalResult> {
  const results: Record<string, EvalResult> = {}

  for (const [key, flag] of Object.entries(flags)) {
    try {
      results[key] = evaluate(flag, context, segments)
    } catch {
      results[key] = {
        enabled: false,
        value: flag?.defaultValue ?? null,
        reason: 'error',
      }
    }
  }

  return results
}
