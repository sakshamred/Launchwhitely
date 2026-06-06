export interface EvalContext {
  userId: string
  [attribute: string]: unknown
}

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

export interface Condition {
  attribute: string
  operator: Operator
  value: unknown
}

export interface TargetingRule {
  id: string
  conditions: Condition[]
  serve: 'on' | 'off' | string
  rolloutPct?: number
}

export interface Variant {
  key: string
  name: string
  weight: number
  value: unknown
}

export interface FlagState {
  flagKey: string
  enabled: boolean
  rolloutPct: number
  rules: TargetingRule[]
  variants: Variant[]
  defaultValue: unknown
}

export type EvalReason =
  | 'flag_disabled'
  | 'targeting_match'
  | 'rollout'
  | 'default'
  | 'error'

export interface EvalResult {
  enabled: boolean
  value: unknown
  reason: EvalReason
  variant?: string
}

export interface SegmentDef {
  key: string
  rules: TargetingRule[]
}

export interface FlagCache {
  environmentId: string
  version: number
  flags: Record<string, FlagState>
  segments: Record<string, SegmentDef>
}
