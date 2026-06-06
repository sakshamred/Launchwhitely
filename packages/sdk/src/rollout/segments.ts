import type { EvalContext, SegmentDef } from './types'
import { evaluateRule } from './targeting'

export function matchesSegment(segment: SegmentDef, context: EvalContext): boolean {
  if (segment.rules.length === 0) return false
  return segment.rules.some((rule) => evaluateRule(rule, context))
}
