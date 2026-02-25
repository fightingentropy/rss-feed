const CACHE_TTL_SECONDS = 300

type PagesContext = {
  request: Request
  waitUntil: (promise: Promise<unknown>) => void
}

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local')
  ) {
    return true
  }

  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true

  return false
}

function validateFeedUrl(input: string | null): URL | null {
  if (!input) return null

  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }

  if (!['http:', 'https:'].includes(url.protocol)) return null
  if (isBlockedHost(url.hostname)) return null

  return url
}

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const requestUrl = new URL(context.request.url)
  const feedUrl = validateFeedUrl(requestUrl.searchParams.get('url'))

  if (!feedUrl) {
    return textResponse('Invalid or blocked feed URL', 400)
  }

  const cache = caches.default
  const cacheKey = new Request(requestUrl.toString(), { method: 'GET' })
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  let upstream: Response
  try {
    upstream = await fetch(feedUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
      },
      redirect: 'follow',
      cf: {
        cacheTtl: CACHE_TTL_SECONDS,
        cacheEverything: true,
      },
    })
  } catch {
    return textResponse('Failed to fetch feed', 502)
  }

  if (!upstream.ok) {
    return textResponse(`Feed returned ${upstream.status}`, 502)
  }

  const body = await upstream.text()
  const response = new Response(body, {
    status: 200,
    headers: {
      'Content-Type':
        upstream.headers.get('Content-Type') ?? 'application/xml; charset=utf-8',
      'Cache-Control': `public, max-age=60, s-maxage=${CACHE_TTL_SECONDS}`,
      'X-Feed-Proxy': 'cloudflare-pages',
    },
  })

  context.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}

