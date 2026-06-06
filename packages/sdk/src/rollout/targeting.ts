import type { Condition, EvalContext, Operator, TargetingRule } from './types'

function toStr(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function toNum(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number.parseFloat(value)
  return Number.NaN
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === null && b === null) return true
  if (a === undefined && b === undefined) return true
  return a === b
}

function applyOperator(operator: Operator, attrValue: unknown, conditionValue: unknown): boolean {
  switch (operator) {
    case 'exists':
      return attrValue !== undefined && attrValue !== null
    case 'not_exists':
      return attrValue === undefined || attrValue === null
    case 'is_true':
      return attrValue === true
    case 'is_false':
      return attrValue === false
    case 'equals':
      return looseEqual(attrValue, conditionValue)
    case 'not_equals':
      return !looseEqual(attrValue, conditionValue)
    case 'contains':
      if (Array.isArray(attrValue)) return attrValue.some((item) => looseEqual(item, conditionValue))
      return toStr(conditionValue).length > 0 && toStr(attrValue).includes(toStr(conditionValue))
    case 'not_contains':
      if (Array.isArray(attrValue)) return !attrValue.some((item) => looseEqual(item, conditionValue))
      return toStr(conditionValue).length === 0 || !toStr(attrValue).includes(toStr(conditionValue))
    case 'starts_with':
      return toStr(conditionValue).length > 0 && toStr(attrValue).startsWith(toStr(conditionValue))
    case 'ends_with':
      return toStr(conditionValue).length > 0 && toStr(attrValue).endsWith(toStr(conditionValue))
    case 'in':
      return Array.isArray(conditionValue) && conditionValue.some((item) => looseEqual(attrValue, item))
    case 'not_in':
      return !Array.isArray(conditionValue) || !conditionValue.some((item) => looseEqual(attrValue, item))
    case 'gt':
      return !Number.isNaN(toNum(attrValue)) && !Number.isNaN(toNum(conditionValue)) && toNum(attrValue) > toNum(conditionValue)
    case 'gte':
      return !Number.isNaN(toNum(attrValue)) && !Number.isNaN(toNum(conditionValue)) && toNum(attrValue) >= toNum(conditionValue)
    case 'lt':
      return !Number.isNaN(toNum(attrValue)) && !Number.isNaN(toNum(conditionValue)) && toNum(attrValue) < toNum(conditionValue)
    case 'lte':
      return !Number.isNaN(toNum(attrValue)) && !Number.isNaN(toNum(conditionValue)) && toNum(attrValue) <= toNum(conditionValue)
    default:
      return false
  }
}

export function evaluateCondition(condition: Condition, context: EvalContext): boolean {
  try {
    return applyOperator(condition.operator, context[condition.attribute], condition.value)
  } catch {
    return false
  }
}

export function evaluateRule(rule: TargetingRule, context: EvalContext): boolean {
  if (rule.conditions.length === 0) return true
  return rule.conditions.every((condition) => evaluateCondition(condition, context))
}
