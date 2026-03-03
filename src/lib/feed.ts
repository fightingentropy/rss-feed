const FEED_API = '/api/feed'
const FEED_CACHE_PREFIX = 'rss-reader.feed-cache.v2:'
const FEED_CACHE_TTL_MS = 5 * 60 * 1000

type CachedFeedRecord = {
  cachedAt: number
  data: ParsedFeed
}

const memoryCache = new Map<string, CachedFeedRecord>()
const inFlightRequests = new Map<string, Promise<ParsedFeed>>()

export interface FeedItem {
  title: string
  link: string
  pubDate?: string
  contentSnippet?: string
  content?: string
}

export interface ParsedFeed {
  title: string
  link: string
  items: FeedItem[]
}

function text(el: Element | null | undefined): string {
  return el?.textContent?.trim() ?? ''
}

function html(el: Element | null | undefined): string {
  return el?.innerHTML?.trim() ?? ''
}

function attr(el: Element | null | undefined, name: string): string {
  return el?.getAttribute(name)?.trim() ?? ''
}

function localNameIs(el: Element | null | undefined, expected: string): boolean {
  return (el?.localName ?? '').toLowerCase() === expected.toLowerCase()
}

function directChildren(el: Element | null | undefined): Element[] {
  return el ? Array.from(el.children) : []
}

function findDirectChild(
  parent: Element | null | undefined,
  localNames: string | string[]
): Element | null {
  const names = new Set((Array.isArray(localNames) ? localNames : [localNames]).map((name) => name.toLowerCase()))
  return directChildren(parent).find((child) => names.has((child.localName ?? '').toLowerCase())) ?? null
}

function findDirectChildren(parent: Element | null | undefined, localName: string): Element[] {
  const expected = localName.toLowerCase()
  return directChildren(parent).filter((child) => (child.localName ?? '').toLowerCase() === expected)
}

function prepareXml(xml: string): string {
  return xml
    .replace(/^\uFEFF/, '') // strip BOM
    .trim()
}

function isLikelyHtml(xml: string): boolean {
  const start = xml.slice(0, 200).toLowerCase()
  return start.includes('<!doctype') || (start.startsWith('<html') && !start.includes('<rss') && !start.includes('<feed'))
}

function cacheKey(feedUrl: string): string {
  return `${FEED_CACHE_PREFIX}${feedUrl}`
}

function isValidParsedFeed(value: unknown): value is ParsedFeed {
  if (!value || typeof value !== 'object') return false

  const maybe = value as Partial<ParsedFeed>
  if (typeof maybe.title !== 'string') return false
  if (typeof maybe.link !== 'string') return false
  if (!Array.isArray(maybe.items)) return false

  return maybe.items.every((item) => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as Partial<FeedItem>
    return (
      typeof candidate.title === 'string' &&
      typeof candidate.link === 'string' &&
      (candidate.pubDate === undefined || typeof candidate.pubDate === 'string') &&
      (candidate.contentSnippet === undefined ||
        typeof candidate.contentSnippet === 'string') &&
      (candidate.content === undefined || typeof candidate.content === 'string')
    )
  })
}

function isFresh(record: CachedFeedRecord): boolean {
  return Date.now() - record.cachedAt < FEED_CACHE_TTL_MS
}

function sortFeedItemsByDate(feed: ParsedFeed): ParsedFeed {
  const timestamp = (value?: string): number => {
    if (!value) return 0
    const t = new Date(value).getTime()
    return Number.isFinite(t) ? t : 0
  }

  const sorted = [...feed.items].sort((a, b) => {
    const dateA = timestamp(a.pubDate)
    const dateB = timestamp(b.pubDate)
    return dateB - dateA
  })
  return { ...feed, items: sorted }
}

function readCachedFeed(feedUrl: string): ParsedFeed | null {
  const fromMemory = memoryCache.get(feedUrl)
  if (fromMemory) {
    if (isFresh(fromMemory)) return fromMemory.data
    memoryCache.delete(feedUrl)
  }

  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(cacheKey(feedUrl))
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<CachedFeedRecord>
    if (
      typeof parsed?.cachedAt !== 'number' ||
      !isValidParsedFeed(parsed.data)
    ) {
      window.localStorage.removeItem(cacheKey(feedUrl))
      return null
    }

    const record: CachedFeedRecord = {
      cachedAt: parsed.cachedAt,
      data: parsed.data,
    }

    if (!isFresh(record)) {
      window.localStorage.removeItem(cacheKey(feedUrl))
      return null
    }

    memoryCache.set(feedUrl, record)
    return record.data
  } catch {
    return null
  }
}

function writeCachedFeed(feedUrl: string, data: ParsedFeed): void {
  const record: CachedFeedRecord = {
    cachedAt: Date.now(),
    data,
  }

  memoryCache.set(feedUrl, record)

  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(cacheKey(feedUrl), JSON.stringify(record))
  } catch {
    // Ignore storage quota / private mode errors.
  }
}

export async function fetchFeed(feedUrl: string): Promise<ParsedFeed> {
  const cached = readCachedFeed(feedUrl)
  if (cached) return sortFeedItemsByDate(cached)

  const pending = inFlightRequests.get(feedUrl)
  if (pending) return pending

  const request = (async () => {
  const url = `${FEED_API}?url=${encodeURIComponent(feedUrl)}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch feed: ${response.statusText}`)
  let xml = await response.text()
  xml = prepareXml(xml)
  if (isLikelyHtml(xml)) throw new Error('Feed URL returned HTML instead of RSS (site may block automated requests)')
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Invalid XML — feed may be broken or not RSS')

  const isAtom = doc.documentElement.localName === 'feed'
    const parsedFeed = isAtom ? parseAtom(doc) : parseRss(doc)
    const sorted = sortFeedItemsByDate(parsedFeed)
    writeCachedFeed(feedUrl, sorted)
    return sorted
  })().finally(() => {
    inFlightRequests.delete(feedUrl)
  })

  inFlightRequests.set(feedUrl, request)
  return request
}

function parseRss(doc: Document): ParsedFeed {
  const channel = Array.from(doc.documentElement.children).find((el) => localNameIs(el, 'channel')) ?? null
  const channelTitleEl = findDirectChild(channel, 'title')
  const channelLinkEl = findDirectChild(channel, 'link')
  const title = text(channelTitleEl) || 'Untitled'
  const link = text(channelLinkEl) || attr(channelLinkEl, 'href') || ''
  const items: FeedItem[] = []
  findDirectChildren(channel, 'item').forEach((item) => {
    const itemTitleEl = findDirectChild(item, 'title')
    const itemLinkEl = findDirectChild(item, 'link')
    const itemGuidEl = findDirectChild(item, 'guid')
    const itemPubDateEl = findDirectChild(item, 'pubDate')
    const itemLink =
      text(itemLinkEl) ||
      attr(itemLinkEl, 'href') ||
      text(itemGuidEl) ||
      ''
    const descEl = findDirectChild(item, 'description')
    const encodedEl = findDirectChild(item, 'encoded')
    const contentHtml = html(encodedEl) || html(descEl) || ''
    const contentPlain = text(descEl) || text(encodedEl) || ''
    items.push({
      title: text(itemTitleEl) || 'Untitled',
      link: itemLink,
      pubDate: text(itemPubDateEl) || undefined,
      contentSnippet: contentPlain.slice(0, 500),
      content: contentHtml || undefined,
    })
  })
  return { title, link, items }
}

function parseAtom(doc: Document): ParsedFeed {
  const feed = doc.documentElement
  const titleEl = findDirectChild(feed, 'title')
  const title = titleEl ? (titleEl.childNodes[0]?.nodeValue?.trim() ?? text(titleEl)) : 'Untitled'
  const feedLinks = findDirectChildren(feed, 'link')
  const linkEl =
    feedLinks.find((el) => (attr(el, 'rel') || '').toLowerCase() === 'alternate') ||
    feedLinks.find((el) => (attr(el, 'type') || '').toLowerCase() === 'text/html') ||
    feedLinks[0] ||
    null
  const link = attr(linkEl, 'href') || text(linkEl) || ''
  const items: FeedItem[] = []
  findDirectChildren(feed, 'entry').forEach((entry) => {
    const entryLinks = findDirectChildren(entry, 'link')
    const linkEl =
      entryLinks.find((el) => (attr(el, 'rel') || '').toLowerCase() === 'alternate') ||
      entryLinks.find((el) => (attr(el, 'type') || '').toLowerCase() === 'text/html') ||
      entryLinks[0] ||
      null
    const itemLink = attr(linkEl, 'href') || text(linkEl) || ''
    const contentEl = findDirectChild(entry, 'content')
    const summaryEl = findDirectChild(entry, 'summary')
    const type = contentEl?.getAttribute('type') ?? ''
    const contentHtml =
      type === 'html' || type === 'xhtml' ? html(contentEl) || html(summaryEl) || '' : text(contentEl) || text(summaryEl) || ''
    const contentPlain = text(contentEl) || text(summaryEl) || ''
    const titleEl = findDirectChild(entry, 'title')
    const updatedEl = findDirectChild(entry, 'updated')
    const publishedEl = findDirectChild(entry, 'published')
    items.push({
      title: text(titleEl) || 'Untitled',
      link: itemLink,
      pubDate: text(updatedEl) || text(publishedEl) || undefined,
      contentSnippet: contentPlain.slice(0, 500),
      content: contentHtml || undefined,
    })
  })
  return { title, link, items }
}
