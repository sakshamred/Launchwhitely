import type { EvalContext, EvalResult, FlagCache, FlagState } from './rollout'

export type BootstrapResponse = {
  project: {
    id: string
    name: string
    slug: string
    sdkKeyPrefix: string
  }
  environment: {
    id: string
    name: string
    slug: string
    color: string
    sdkKeyPrefix: string
  }
  cache: FlagCache
}

export type LaunchwhitlyClientOptions = {
  baseUrl: string
  projectKey: string
  environmentKey: string
  fetchImpl?: typeof fetch
  pollingIntervalMs?: number
  reconnectDelayMs?: number
}

export type SnapshotListener = (snapshot: BootstrapResponse) => void

export type EvaluateResult = EvalResult | null

export type { EvalContext, EvalResult, FlagCache, FlagState }
