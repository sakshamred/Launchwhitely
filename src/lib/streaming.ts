import type { FlagCache } from '@/lib/rollout'
import { buildFlagCache } from '@/lib/sdk'

type Listener = (cache: FlagCache) => void

type EnvironmentChannel = {
  listeners: Set<Listener>
  timer: ReturnType<typeof setInterval>
  cache?: FlagCache
  polling: boolean
}

declare global {
  var launchwhitlyChannels: Map<string, EnvironmentChannel> | undefined
}

const channels = global.launchwhitlyChannels ?? new Map<string, EnvironmentChannel>()
global.launchwhitlyChannels = channels

function runPoll(environmentId: string, channel: EnvironmentChannel) {
  void poll(environmentId, channel).catch((error) => {
    console.error(`[launchwhitly] stream poll failed for ${environmentId}`, error)
  })
}

async function poll(environmentId: string, channel: EnvironmentChannel) {
  if (channel.polling) return
  channel.polling = true

  try {
    const cache = await buildFlagCache(environmentId)
    if (!cache || cache.version <= (channel.cache?.version ?? 0)) return

    channel.cache = cache
    channel.listeners.forEach((listener) => listener(cache))
  } finally {
    channel.polling = false
  }
}

export function subscribeToFlagCache(environmentId: string, listener: Listener) {
  let channel = channels.get(environmentId)

  if (!channel) {
    const newChannel: EnvironmentChannel = {
      listeners: new Set(),
      polling: false,
      timer: setInterval(() => runPoll(environmentId, newChannel), 2_000),
    }
    channel = newChannel
    channels.set(environmentId, channel)
    runPoll(environmentId, channel)
  }

  channel.listeners.add(listener)
  if (channel.cache) listener(channel.cache)

  return () => {
    channel?.listeners.delete(listener)
    if (channel && channel.listeners.size === 0) {
      clearInterval(channel.timer)
      channels.delete(environmentId)
    }
  }
}
