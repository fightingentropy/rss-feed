import { useState, useCallback, useEffect } from 'react'
import DOMPurify from 'dompurify'
import {
  Rss,
  Loader2,
  ExternalLink,
  Terminal,
  Settings as SettingsIcon,
  ArrowLeft,
  Plus,
  Trash2,
  RotateCcw,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Chatbot } from '@/components/Chatbot'
import { POPULAR_FEEDS, type FeedMeta } from '@/data/feeds'
import { fetchFeed, type ParsedFeed, type FeedItem } from '@/lib/feed'
import { cn } from '@/lib/utils'

const FEED_SOURCES_STORAGE_KEY = 'rss-reader.feed-sources.v1'

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'a', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'img', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'data-caption'],
  })
}

function formatDate(pubDate?: string) {
  if (!pubDate) return ''
  const d = new Date(pubDate)
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function normalizePreviewText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeForComparison(value: string): string {
  return normalizePreviewText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isDuplicateText(a: string, b: string): boolean {
  if (!a || !b) return false
  return normalizeForComparison(a) === normalizeForComparison(b)
}

function decodeHtmlEntities(value: string): string {
  if (!value) return ''

  if (typeof window === 'undefined') {
    return value
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
  }

  const doc = new DOMParser().parseFromString(value, 'text/html')
  return doc.documentElement.textContent ?? ''
}

function maybeDecodeEncodedHtml(value: string): string {
  let current = value

  for (let i = 0; i < 3; i += 1) {
    const looksEncodedHtml =
      /&lt;\s*\/?\s*[a-z]/i.test(current) ||
      /&#x?0*3c;\s*\/?\s*[a-z]/i.test(current)

    if (!looksEncodedHtml) break

    const decoded = decodeHtmlEntities(current)
    if (!decoded || decoded === current) break
    current = decoded
  }

  return current
}

function stripHtmlToText(value: string): string {
  if (!value) return ''

  const normalizedValue = maybeDecodeEncodedHtml(value)

  if (typeof window === 'undefined') {
    return normalizePreviewText(normalizedValue.replace(/<[^>]*>/g, ' '))
  }

  const doc = new DOMParser().parseFromString(normalizedValue, 'text/html')
  return normalizePreviewText(doc.body?.textContent ?? '')
}

function getArticlePreview(item: FeedItem): string {
  const preview = stripHtmlToText(item.contentSnippet ?? '')
  if (preview) return preview

  const contentPreview = stripHtmlToText(item.content ?? '')
  return contentPreview ? contentPreview.slice(0, 500) : ''
}

function hasHtmlMarkup(value: string): boolean {
  return /<[^>]+>/.test(value)
}

function cloneDefaultFeeds(): FeedMeta[] {
  return POPULAR_FEEDS.map((feed) => ({ ...feed }))
}

function getInitialFeedSources(): FeedMeta[] {
  if (typeof window === 'undefined') return cloneDefaultFeeds()

  try {
    const raw = window.localStorage.getItem(FEED_SOURCES_STORAGE_KEY)
    if (!raw) return cloneDefaultFeeds()

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return cloneDefaultFeeds()

    const valid = parsed
      .filter(
        (item): item is FeedMeta =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as FeedMeta).id === 'string' &&
          typeof (item as FeedMeta).title === 'string' &&
          typeof (item as FeedMeta).url === 'string'
      )
      .map((item) => ({
        id: item.id.trim(),
        title: item.title,
        url: item.url,
      }))
      .filter((item) => item.id.length > 0)

    if (valid.length === 0) return cloneDefaultFeeds()

    const defaultById = new Map(POPULAR_FEEDS.map((f) => [f.id, { title: f.title, url: f.url }]))
    const savedIds = new Set(valid.map((s) => s.id))
    const repaired = valid.map((s) => {
      const d = defaultById.get(s.id)
      return d ? { id: s.id, title: d.title, url: d.url } : s
    })
    const missingDefaults = POPULAR_FEEDS.filter((feed) => !savedIds.has(feed.id)).map((feed) => ({ ...feed }))
    return [...repaired, ...missingDefaults]
  } catch {
    return cloneDefaultFeeds()
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createUniqueFeedId(title: string, existingIds: Set<string>): string {
  const base = slugify(title) || 'custom-feed'
  let candidate = base
  let suffix = 2
  while (existingIds.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}

function App() {
  const [view, setView] = useState<'reader' | 'settings'>('reader')
  const [feedSources, setFeedSources] = useState<FeedMeta[]>(() => getInitialFeedSources())
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null)
  const [feed, setFeed] = useState<ParsedFeed | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null)
  const [loadedFeeds, setLoadedFeeds] = useState<Map<string, ParsedFeed>>(new Map())

  const selectedItemPreview = selectedItem ? getArticlePreview(selectedItem) : ''
  const selectedItemDecodedContent = selectedItem?.content
    ? maybeDecodeEncodedHtml(selectedItem.content).trim()
    : ''
  const selectedItemSanitizedContent = selectedItemDecodedContent
    ? sanitizeHtml(selectedItemDecodedContent).trim()
    : ''
  const selectedItemHasHtmlBody =
    selectedItemSanitizedContent.length > 0 && hasHtmlMarkup(selectedItemSanitizedContent)
  const selectedItemPlainBody = selectedItemHasHtmlBody
    ? ''
    : stripHtmlToText(selectedItemSanitizedContent)
  const selectedItemBodyText = selectedItemSanitizedContent
    ? stripHtmlToText(selectedItemSanitizedContent)
    : ''
  const selectedItemUniquePreview =
    isDuplicateText(selectedItemPreview, selectedItem?.title ?? '')
      ? ''
      : selectedItemPreview
  const selectedItemHasUniqueBody =
    !!selectedItemBodyText &&
    !isDuplicateText(selectedItemBodyText, selectedItem?.title ?? '') &&
    !isDuplicateText(selectedItemBodyText, selectedItemUniquePreview)

  useEffect(() => {
    try {
      window.localStorage.setItem(FEED_SOURCES_STORAGE_KEY, JSON.stringify(feedSources))
    } catch {
      // Ignore localStorage write errors in private mode / quota issues.
    }
  }, [feedSources])

  useEffect(() => {
    const validIds = new Set(feedSources.map((source) => source.id))

    if (selectedFeedId && !validIds.has(selectedFeedId)) {
      setSelectedFeedId(null)
      setFeed(null)
      setSelectedItem(null)
      setError(null)
      setLoading(false)
    }

    setLoadedFeeds((prev) => {
      let changed = false
      const next = new Map<string, ParsedFeed>()
      for (const [id, parsed] of prev) {
        if (validIds.has(id)) {
          next.set(id, parsed)
        } else {
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [feedSources, selectedFeedId])

  const loadFeed = useCallback(async (feedId: string) => {
    const meta = feedSources.find((f) => f.id === feedId)
    if (!meta) return
    const url = meta.url.trim()
    if (!url) {
      setSelectedFeedId(feedId)
      setSelectedItem(null)
      setError('This source has no URL configured. Update it in Settings.')
      setFeed(null)
      return
    }
    setSelectedFeedId(feedId)
    setSelectedItem(null)
    setLoading(true)
    setError(null)
    try {
      const data = await fetchFeed(url)
      setFeed(data)
      setLoadedFeeds((prev) => new Map(prev).set(feedId, data))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed')
      setFeed(null)
    } finally {
      setLoading(false)
    }
  }, [feedSources])

  const addFeedSource = useCallback(() => {
    setFeedSources((prev) => {
      const existingIds = new Set(prev.map((source) => source.id))
      const nextIndex = prev.filter((source) => source.id.startsWith('custom-feed')).length + 1
      const title = `Custom Feed ${nextIndex}`
      const id = createUniqueFeedId(title, existingIds)
      return [...prev, { id, title, url: 'https://' }]
    })
  }, [])

  const updateFeedSource = useCallback(
    (id: string, patch: Partial<Pick<FeedMeta, 'title' | 'url'>>) => {
      setFeedSources((prev) =>
        prev.map((source) => (source.id === id ? { ...source, ...patch } : source))
      )

      if (patch.url !== undefined) {
        setLoadedFeeds((prev) => {
          if (!prev.has(id)) return prev
          const next = new Map(prev)
          next.delete(id)
          return next
        })

        if (selectedFeedId === id) {
          setFeed(null)
          setSelectedItem(null)
          setError(null)
        }
      }
    },
    [selectedFeedId]
  )

  const removeFeedSource = useCallback((id: string) => {
    setFeedSources((prev) => prev.filter((source) => source.id !== id))
  }, [])

  const resetFeedSources = useCallback(() => {
    setFeedSources(cloneDefaultFeeds())
  }, [])

  const moveFeedSource = useCallback((sourceId: string, direction: 'up' | 'down') => {
    setFeedSources((prev) => {
      const i = prev.findIndex((s) => s.id === sourceId)
      if (i === -1) return prev
      const j = direction === 'up' ? i - 1 : i + 1
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }, [])

  return (
    <div className="flex h-screen flex-col bg-terminal-bg font-mono text-terminal-text">
      {/* Terminal title bar */}
      <header className="flex shrink-0 items-center gap-2 border-b border-terminal-border bg-terminal-dim px-4 py-2">
        <Terminal className="h-4 w-4 text-terminal-accent" />
        <span className="text-sm font-medium text-terminal-accent">rss-reader</span>
        <span className="text-terminal-muted">— minimal terminal ui</span>
        <div className="ml-auto">
          {view === 'reader' ? (
            <Button variant="ghost" onClick={() => setView('settings')} className="h-8 px-2.5 text-xs">
              <SettingsIcon className="h-3.5 w-3.5" />
              Settings
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setView('reader')} className="h-8 px-2.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Reader
            </Button>
          )}
        </div>
      </header>

      {view === 'reader' ? (
        <div className="flex min-h-0 flex-1">
          {/* Sidebar: feed list */}
          <aside className="w-56 shrink-0 border-r border-terminal-border bg-terminal-bg">
            <div className="border-b border-terminal-border px-3 py-2">
              <span className="text-xs uppercase tracking-wider text-terminal-muted">Feeds</span>
            </div>
            <ScrollArea className="h-[calc(100vh-3.5rem)]">
              <nav className="p-2">
                {feedSources.length === 0 && (
                  <div className="rounded border border-dashed border-terminal-border px-3 py-3 text-xs text-terminal-muted">
                    No sources configured. Open Settings to add one.
                  </div>
                )}
                {feedSources.map((f) => {
                  const hasUrl = f.url.trim().length > 0
                  return (
                    <button
                      key={f.id}
                      onClick={() => loadFeed(f.id)}
                      disabled={!hasUrl}
                      className={cn(
                        'flex w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                        selectedFeedId === f.id
                          ? 'border-terminal-accent bg-terminal-dim text-terminal-accent'
                          : 'border-transparent text-terminal-muted hover:bg-terminal-dim hover:text-terminal-text'
                      )}
                    >
                      <Rss className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{f.title.trim() || '(Untitled source)'}</span>
                    </button>
                  )
                })}
              </nav>
            </ScrollArea>
          </aside>

          {/* Main: article list + detail */}
          <main className="flex min-w-0 flex-1">
            {/* Article list panel */}
            <div className="flex w-80 shrink-0 flex-col border-r border-terminal-border">
              <div className="flex shrink-0 items-center justify-between border-b border-terminal-border px-3 py-2">
                <span className="text-xs uppercase tracking-wider text-terminal-muted">
                  {feed ? feed.title : 'Select a feed'}
                </span>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-terminal-accent" />}
              </div>
              <ScrollArea className="flex-1">
                {error && (
                  <div className="p-3 text-sm text-red-400">{error}</div>
                )}
                {feed?.items?.length ? (
                  <ul className="p-2">
                    {feed.items.map((item, i) => (
                      <li key={item.link || i}>
                        <button
                          onClick={() => setSelectedItem(item)}
                          className={cn(
                            'w-full rounded border px-3 py-2 text-left text-sm transition-colors',
                            selectedItem?.link === item.link
                              ? 'border-terminal-accent bg-terminal-dim text-terminal-accent'
                              : 'border-transparent text-terminal-muted hover:bg-terminal-dim hover:text-terminal-text'
                          )}
                        >
                          <div className="line-clamp-2 font-medium">{item.title}</div>
                          <div className="mt-1 text-xs text-terminal-dim">
                            {formatDate(item.pubDate)}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : !loading && !error && selectedFeedId && (
                  <div className="p-3 text-sm text-terminal-muted">No items</div>
                )}
              </ScrollArea>
            </div>

            {/* Article detail panel */}
            <div className="min-w-0 flex-1 overflow-auto">
              {selectedItem ? (
                <Card className="m-4 border-terminal-border">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-base leading-snug">
                      {selectedItem.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-terminal-muted">
                      {selectedItem.pubDate && (
                        <span>{formatDate(selectedItem.pubDate)}</span>
                      )}
                      {selectedItem.link && (
                        <a
                          href={selectedItem.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-terminal-accent hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedItemUniquePreview && (
                      <div className="rounded border border-terminal-border/70 bg-terminal-dim/30 px-3 py-2">
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-terminal-muted">
                          Preview
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed text-terminal-text">
                          {selectedItemUniquePreview}
                        </p>
                      </div>
                    )}

                    {selectedItemHasHtmlBody && selectedItemHasUniqueBody ? (
                      <div
                        className="article-body max-w-none text-terminal-muted [&_a]:text-terminal-accent [&_a]:underline [&_figure]:my-3 [&_figcaption]:hidden [&_img]:max-h-80 [&_img]:w-auto [&_img]:rounded [&_img]:border [&_img]:border-terminal-border [&_p]:mb-2 [&_p]:leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: selectedItemSanitizedContent,
                        }}
                      />
                    ) : !selectedItemHasHtmlBody && selectedItemPlainBody && selectedItemHasUniqueBody ? (
                      <p className="whitespace-pre-wrap text-terminal-muted">
                        {selectedItemPlainBody}
                      </p>
                    ) : !selectedItemUniquePreview ? (
                      <p className="whitespace-pre-wrap text-terminal-muted">
                        No excerpt available from this feed item.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-terminal-muted">
                  {selectedFeedId && !loading ? (
                    <span>Select an article</span>
                  ) : !selectedFeedId ? (
                    <span>Select a feed</span>
                  ) : null}
                </div>
              )}
            </div>
          </main>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-3.5rem)]">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
              <Card>
                <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                  <div>
                    <CardTitle className="text-sm">Feed Source Settings</CardTitle>
                    <div className="text-xs text-terminal-muted">
                      Add, remove, and edit feed names + URLs. Changes are saved locally in your browser.
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={addFeedSource} className="h-8 px-2.5 text-xs">
                      <Plus className="h-3.5 w-3.5" />
                      Add Source
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={resetFeedSources}
                      className="h-8 px-2.5 text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset Defaults
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              <div className="grid gap-3">
                {feedSources.map((source, index) => (
                  <Card key={source.id} className="p-3">
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-xs text-terminal-muted">
                          id: <span className="text-terminal-accent">{source.id}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            className="h-7 w-7 shrink-0 p-0 text-terminal-muted hover:text-terminal-accent"
                            onClick={() => moveFeedSource(source.id, 'up')}
                            disabled={index === 0}
                            title="Move up"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-7 w-7 shrink-0 p-0 text-terminal-muted hover:text-terminal-accent"
                            onClick={() => moveFeedSource(source.id, 'down')}
                            disabled={index === feedSources.length - 1}
                            title="Move down"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => removeFeedSource(source.id)}
                            className="h-7 px-2 text-xs text-red-300 hover:text-red-200"
                            title={`Remove ${source.title || source.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                        <label className="flex min-w-0 flex-col gap-1 text-xs uppercase tracking-wider text-terminal-muted">
                          Source Name
                          <input
                            value={source.title}
                            onChange={(e) =>
                              updateFeedSource(source.id, { title: e.target.value })
                            }
                            placeholder="Source name"
                            className="h-9 rounded border border-terminal-border bg-terminal-bg px-2 text-sm text-terminal-text outline-none focus:border-terminal-accent"
                          />
                        </label>

                        <label className="flex min-w-0 flex-col gap-1 text-xs uppercase tracking-wider text-terminal-muted">
                          RSS / Atom URL
                          <div className="flex gap-2">
                            <input
                              value={source.url}
                              onChange={(e) =>
                                updateFeedSource(source.id, { url: e.target.value })
                              }
                              placeholder="https://example.com/feed.xml"
                              className="h-9 min-w-0 flex-1 rounded border border-terminal-border bg-terminal-bg px-2 text-sm text-terminal-text outline-none focus:border-terminal-accent"
                            />
                            {source.url.trim() && (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-9 items-center justify-center rounded border border-terminal-border px-2 text-xs text-terminal-muted hover:text-terminal-accent"
                                title="Open source URL"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </label>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {feedSources.length === 0 && (
                  <Card>
                    <CardContent className="text-sm">
                      No feed sources configured. Add a source to start reading.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Chatbot widget */}
      <Chatbot feeds={loadedFeeds} />
    </div>
  )
}

export default App
