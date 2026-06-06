import { apiError } from '@/lib/api'
import { authenticateSdkRequest } from '@/lib/sdk'
import { subscribeToFlagCache } from '@/lib/streaming'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const encoder = new TextEncoder()

function event(name: string, id: number, data: unknown) {
  return encoder.encode(`id: ${id}\nevent: ${name}\ndata: ${JSON.stringify(data)}\n\n`)
}

export async function GET(request: Request) {
  const apiKey = await authenticateSdkRequest(request)
  if (!apiKey) return apiError('Invalid or revoked API key', 401)

  let lastVersion = Number(request.headers.get('last-event-id') ?? 0)
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let unsubscribe: (() => void) | undefined
  let closed = false

  const stream = new ReadableStream({
    start(controller) {
      unsubscribe = subscribeToFlagCache(apiKey.environmentId, (cache) => {
        if (!closed && cache.version > lastVersion) {
          lastVersion = cache.version
          controller.enqueue(event('config', cache.version, cache))
        }
      })

      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }, 15_000)

      request.signal.addEventListener('abort', () => {
        closed = true
        if (heartbeat) clearInterval(heartbeat)
        unsubscribe?.()
        controller.close()
      })
    },
    cancel() {
      closed = true
      if (heartbeat) clearInterval(heartbeat)
      unsubscribe?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
