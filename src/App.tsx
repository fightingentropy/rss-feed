import { useState, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { Rss, Loader2, ExternalLink, Terminal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Chatbot } from '@/components/Chatbot'
import { POPULAR_FEEDS } from '@/data/feeds'
import { fetchFeed, type ParsedFeed, type FeedItem } from '@/lib/feed'
import { cn } from '@/lib/utils'

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'a', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'img', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'data-caption'],
  })
}

function formatDate(pubDate?: string) {
  if (!pubDate) return ''
  const d = new Date(pubDate)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { dateStyle: 'short' })
}

function App() {
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null)
  const [feed, setFeed] = useState<ParsedFeed | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null)
  const [loadedFeeds, setLoadedFeeds] = useState<Map<string, ParsedFeed>>(new Map())

  const loadFeed = useCallback(async (feedId: string) => {
    const meta = POPULAR_FEEDS.find((f) => f.id === feedId)
    if (!meta) return
    setSelectedFeedId(feedId)
    setSelectedItem(null)
    setLoading(true)
    setError(null)
    try {
      const data = await fetchFeed(meta.url)
      setFeed(data)
      setLoadedFeeds((prev) => new Map(prev).set(feedId, data))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed')
      setFeed(null)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="flex h-screen flex-col bg-terminal-bg font-mono text-terminal-text">
      {/* Terminal title bar */}
      <header className="flex shrink-0 items-center gap-2 border-b border-terminal-border bg-terminal-dim px-4 py-2">
        <Terminal className="h-4 w-4 text-terminal-accent" />
        <span className="text-sm font-medium text-terminal-accent">rss-reader</span>
        <span className="text-terminal-muted">— minimal terminal ui</span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar: feed list */}
        <aside className="w-56 shrink-0 border-r border-terminal-border bg-terminal-bg">
          <div className="border-b border-terminal-border px-3 py-2">
            <span className="text-xs uppercase tracking-wider text-terminal-muted">Feeds</span>
          </div>
          <ScrollArea className="h-[calc(100vh-3.5rem)]">
            <nav className="p-2">
              {POPULAR_FEEDS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => loadFeed(f.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm transition-colors',
                    selectedFeedId === f.id
                      ? 'border-terminal-accent bg-terminal-dim text-terminal-accent'
                      : 'border-transparent text-terminal-muted hover:bg-terminal-dim hover:text-terminal-text'
                  )}
                >
                  <Rss className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{f.title}</span>
                </button>
              ))}
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
                <CardContent>
                  {selectedItem.content ? (
                    <div
                      className="article-body max-w-none text-terminal-muted [&_a]:text-terminal-accent [&_a]:underline [&_figure]:my-3 [&_figcaption]:hidden [&_img]:max-h-80 [&_img]:w-auto [&_img]:rounded [&_img]:border [&_img]:border-terminal-border [&_p]:mb-2 [&_p]:leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(selectedItem.content),
                      }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-terminal-muted">
                      {selectedItem.contentSnippet || 'No content.'}
                    </p>
                  )}
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

      {/* Chatbot widget */}
      <Chatbot feeds={loadedFeeds} />
    </div>
  )
}

export default App
