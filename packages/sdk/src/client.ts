import { evaluate, evaluateAll } from './rollout'
import type { EvalContext, EvaluateResult, FlagCache, FlagState } from './types'
import type {
  BootstrapResponse,
  LaunchwhitlyClientOptions,
  SnapshotListener,
} from './types'
import { buildUrl, openEventStream, requestJson } from './transport'

type ClientSnapshot = BootstrapResponse

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => resolve(), ms)

    if (!signal) return

    const abortHandler = () => {
      clearTimeout(timeout)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    if (signal.aborted) {
      abortHandler()
      return
    }

    signal.addEventListener('abort', abortHandler, { once: true })
  })
}

function makeHeaders(
  projectKey: string,
  environmentKey: string,
  lastEventId?: number,
) {
  const headers = new Headers({
    accept: 'application/json',
    'x-launchwhitly-project-key': projectKey,
    'x-launchwhitly-environment-key': environmentKey,
  })

  if (lastEventId !== undefined) {
    headers.set('last-event-id', String(lastEventId))
  }

  return headers
}

export class LaunchwhitlyClient {
  private readonly baseUrl: string
  private readonly projectKey: string
  private readonly environmentKey: string
  private readonly fetchImpl: typeof fetch
  private readonly pollingIntervalMs: number
  private readonly reconnectDelayMs: number
  private snapshot: ClientSnapshot | null = null
  private listeners = new Set<SnapshotListener>()
  private closed = false
  private started = false
  private initPromise: Promise<ClientSnapshot> | null = null
  private streamAbortController: AbortController | null = null
  private pollAbortController: AbortController | null = null

  constructor(options: LaunchwhitlyClientOptions) {
    this.baseUrl = options.baseUrl
    this.projectKey = options.projectKey
    this.environmentKey = options.environmentKey
    this.fetchImpl = options.fetchImpl ?? fetch
    this.pollingIntervalMs = options.pollingIntervalMs ?? 30_000
    this.reconnectDelayMs = options.reconnectDelayMs ?? 2_000
  }

  async init(): Promise<ClientSnapshot> {
    if (this.started && this.snapshot) return this.snapshot
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      const snapshot = await this.refresh()
      this.started = true
      if (!this.closed) {
        void this.runStreamLoop()
        void this.runPollLoop()
      }
      return snapshot
    })()

    try {
      return await this.initPromise
    } finally {
      this.initPromise = null
    }
  }

  getSnapshot(): ClientSnapshot | null {
    return this.snapshot
  }

  getFlag(flagKey: string): FlagState | undefined {
    return this.snapshot?.cache.flags[flagKey]
  }

  evaluate(flagKey: string, context: EvalContext): EvaluateResult {
    const flag = this.getFlag(flagKey)
    if (!flag || !this.snapshot) return null
    return evaluate(flag, context, this.snapshot.cache.segments)
  }

  evaluateAll(context: EvalContext): Record<string, ReturnType<typeof evaluate>> {
    if (!this.snapshot) return {}
    return evaluateAll(this.snapshot.cache.flags, context, this.snapshot.cache.segments)
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener)
    if (this.snapshot) listener(this.snapshot)
    void this.init().catch(() => undefined)

    return () => {
      this.listeners.delete(listener)
    }
  }

  async refresh(): Promise<ClientSnapshot> {
    const url = buildUrl(this.baseUrl, '/api/v1/sdk/config')
    const snapshot = await requestJson<ClientSnapshot>(this.fetchImpl, url, {
      method: 'GET',
      headers: makeHeaders(this.projectKey, this.environmentKey),
    })

    this.setSnapshot(snapshot)
    return snapshot
  }

  close() {
    this.closed = true
    this.streamAbortController?.abort()
    this.pollAbortController?.abort()
    this.listeners.clear()
  }

  private setSnapshot(snapshot: ClientSnapshot) {
    const previousVersion = this.snapshot?.cache.version ?? 0
    this.snapshot = snapshot

    if (snapshot.cache.version <= previousVersion) return

    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }

  private async runStreamLoop() {
    while (!this.closed) {
      this.streamAbortController?.abort()
      this.streamAbortController = new AbortController()

      try {
        await openEventStream(
          this.fetchImpl,
          buildUrl(this.baseUrl, '/api/v1/sdk/stream'),
          {
            method: 'GET',
            signal: this.streamAbortController.signal,
            headers: makeHeaders(
              this.projectKey,
              this.environmentKey,
              this.snapshot?.cache.version,
            ),
          },
          (event) => {
            if (event.event !== 'config' || !event.data) return

            const cache = JSON.parse(event.data) as FlagCache
            this.setSnapshot({
              project: this.snapshot?.project ?? {
                id: '',
                name: '',
                slug: '',
                sdkKeyPrefix: '',
              },
              environment: this.snapshot?.environment ?? {
                id: cache.environmentId,
                name: '',
                slug: '',
                color: '',
                sdkKeyPrefix: '',
              },
              cache,
            })
          },
        )
      } catch {
        if (this.closed) return
      }

      if (this.closed) return
      await sleep(this.reconnectDelayMs, this.streamAbortController.signal).catch(() => undefined)
    }
  }

  private async runPollLoop() {
    this.pollAbortController = new AbortController()

    while (!this.closed) {
      try {
        await sleep(this.pollingIntervalMs, this.pollAbortController.signal)
      } catch {
        return
      }

      if (this.closed) return

      try {
        await this.refresh()
      } catch {
        continue
      }
    }
  }
}

export function createClient(options: LaunchwhitlyClientOptions) {
  return new LaunchwhitlyClient(options)
}
