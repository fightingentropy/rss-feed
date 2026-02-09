const FEED_API = '/api/feed'

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

function text(el: Element | null): string {
  return el?.textContent?.trim() ?? ''
}

function html(el: Element | null): string {
  return el?.innerHTML?.trim() ?? ''
}

function attr(el: Element | null, name: string): string {
  return el?.getAttribute(name)?.trim() ?? ''
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

export async function fetchFeed(feedUrl: string): Promise<ParsedFeed> {
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
  if (isAtom) return parseAtom(doc)
  return parseRss(doc)
}

function parseRss(doc: Document): ParsedFeed {
  const channel = doc.querySelector('channel')
  const title = text(channel?.querySelector('title')) || 'Untitled'
  const link = text(channel?.querySelector('link')) || attr(channel?.querySelector('link'), 'href') || ''
  const items: FeedItem[] = []
  doc.querySelectorAll('item').forEach((item) => {
    const itemLink =
      text(item.querySelector('link')) ||
      attr(item.querySelector('link'), 'href') ||
      text(item.querySelector('guid')) ||
      ''
    const descEl = item.querySelector('description')
    const encodedEl = Array.from(item.children).find((el) => el.localName === 'encoded')
    const contentHtml = html(encodedEl) || html(descEl) || ''
    const contentPlain = text(descEl) || text(encodedEl) || ''
    items.push({
      title: text(item.querySelector('title')) || 'Untitled',
      link: itemLink,
      pubDate: text(item.querySelector('pubDate')) || undefined,
      contentSnippet: contentPlain.slice(0, 500),
      content: contentHtml || undefined,
    })
  })
  return { title, link, items }
}

function parseAtom(doc: Document): ParsedFeed {
  const feed = doc.documentElement
  const titleEl = feed.querySelector('title')
  const title = titleEl ? (titleEl.childNodes[0]?.nodeValue?.trim() ?? text(titleEl)) : 'Untitled'
  const linkEl = feed.querySelector('link[rel="alternate"], link[type="text/html"]')
  const link = attr(linkEl, 'href') || text(linkEl) || ''
  const items: FeedItem[] = []
  doc.querySelectorAll('entry').forEach((entry) => {
    const linkEl = entry.querySelector('link[rel="alternate"], link[type="text/html"], link')
    const itemLink = attr(linkEl, 'href') || text(linkEl) || ''
    const contentEl = entry.querySelector('content')
    const summaryEl = entry.querySelector('summary')
    const type = contentEl?.getAttribute('type') ?? ''
    const contentHtml =
      type === 'html' || type === 'xhtml' ? html(contentEl) || html(summaryEl) || '' : text(contentEl) || text(summaryEl) || ''
    const contentPlain = text(contentEl) || text(summaryEl) || ''
    items.push({
      title: text(entry.querySelector('title')) || 'Untitled',
      link: itemLink,
      pubDate:
        text(entry.querySelector('updated')) || text(entry.querySelector('published')) || undefined,
      contentSnippet: contentPlain.slice(0, 500),
      content: contentHtml || undefined,
    })
  })
  return { title, link, items }
}
