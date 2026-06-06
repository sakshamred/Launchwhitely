function ensureTrailingSlash(baseUrl: string) {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

export function buildUrl(baseUrl: string, path: string, searchParams?: Record<string, string>) {
  const url = new URL(path, ensureTrailingSlash(baseUrl))

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) url.searchParams.set(key, value)
    }
  }

  return url
}

export async function requestJson<T>(
  fetchImpl: typeof fetch,
  url: URL,
  init: RequestInit,
): Promise<T> {
  const response = await fetchImpl(url, init)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

type StreamEvent = {
  id: string
  event: string
  data: string
}

async function readEventStream(
  response: Response,
  onEvent: (event: StreamEvent) => void,
) {
  if (!response.body) {
    throw new Error('Streaming response does not expose a body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = 'message'
  let eventId = ''
  let dataLines: string[] = []

  const flushEvent = () => {
    if (dataLines.length === 0 && eventName === 'message' && eventId.length === 0) {
      return
    }

    onEvent({
      id: eventId,
      event: eventName,
      data: dataLines.join('\n'),
    })

    eventName = 'message'
    eventId = ''
    dataLines = []
  }

  const consumeLine = (line: string) => {
    if (line.length === 0) {
      flushEvent()
      return
    }

    if (line.startsWith(':')) return

    const separatorIndex = line.indexOf(':')
    const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex)
    const value =
      separatorIndex === -1
        ? ''
        : line.slice(separatorIndex + 1).replace(/^ /, '')

    if (field === 'event') {
      eventName = value || 'message'
      return
    }

    if (field === 'id') {
      eventId = value
      return
    }

    if (field === 'data') {
      dataLines.push(value)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    let boundary = buffer.indexOf('\n')

    while (boundary !== -1) {
      const line = buffer.slice(0, boundary).replace(/\r$/, '')
      buffer = buffer.slice(boundary + 1)
      consumeLine(line)
      boundary = buffer.indexOf('\n')
    }
  }

  if (buffer.length > 0) {
    consumeLine(buffer.replace(/\r$/, ''))
  }

  flushEvent()
}

export async function openEventStream(
  fetchImpl: typeof fetch,
  url: URL,
  init: RequestInit,
  onEvent: (event: StreamEvent) => void,
) {
  const response = await fetchImpl(url, init)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || `Request failed with status ${response.status}`)
  }

  await readEventStream(response, onEvent)
}
