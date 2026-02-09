import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react'
import { MessageSquare, X, Send, Loader2, Bot, User, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ParsedFeed } from '@/lib/feed'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

interface ChatbotProps {
  feeds: Map<string, ParsedFeed>
}

function buildFeedContext(feeds: Map<string, ParsedFeed>): string {
  if (feeds.size === 0) return 'No feeds have been loaded yet.'

  const parts: string[] = []
  feeds.forEach((feed, _id) => {
    parts.push(`\n## Feed: ${feed.title}`)
    parts.push(`Link: ${feed.link}`)
    parts.push(`Articles (${feed.items.length}):`)
    feed.items.slice(0, 30).forEach((item, i) => {
      parts.push(`  ${i + 1}. "${item.title}"`)
      if (item.pubDate) parts.push(`     Published: ${item.pubDate}`)
      if (item.link) parts.push(`     Link: ${item.link}`)
      if (item.contentSnippet) {
        parts.push(`     Summary: ${item.contentSnippet.slice(0, 300)}`)
      }
    })
  })
  return parts.join('\n')
}

export function Chatbot({ feeds }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I\'m your RSS feed assistant. Load some feeds and ask me anything — I can summarize articles, analyze sentiment, spot trends, compare sources, and more.',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const sendMessage = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const text = input.trim()
      if (!text || isLoading) return

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMsg])
      setInput('')
      setIsLoading(true)

      try {
        const feedContext = buildFeedContext(feeds)
        const conversationHistory = messages
          .filter((m) => m.id !== 'welcome')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }))

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            feedContext,
            history: conversationHistory,
          }),
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(errText || `Error ${res.status}`)
        }

        const data = await res.json()

        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, assistantMsg])
      } catch (err) {
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMsg])
      } finally {
        setIsLoading(false)
      }
    },
    [input, isLoading, feeds, messages]
  )

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          'fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition-all duration-200',
          isOpen
            ? 'border-terminal-accent bg-terminal-dim text-terminal-accent'
            : 'border-terminal-border bg-terminal-bg text-terminal-text hover:border-terminal-accent hover:text-terminal-accent'
        )}
        title="RSS Feed Assistant"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          'fixed bottom-20 right-5 z-50 flex w-96 flex-col overflow-hidden rounded-lg border border-terminal-border bg-terminal-bg shadow-2xl transition-all duration-300',
          isOpen ? 'h-[32rem] scale-100 opacity-100' : 'pointer-events-none h-0 scale-95 opacity-0'
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-terminal-border bg-terminal-dim px-4 py-3">
          <Bot className="h-4 w-4 text-terminal-accent" />
          <span className="text-sm font-medium text-terminal-accent">Feed Assistant</span>
          <Sparkles className="h-3 w-3 text-terminal-accent opacity-60" />
          <span className="ml-auto text-xs text-terminal-muted">
            {feeds.size} feed{feeds.size !== 1 ? 's' : ''} loaded
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-terminal-border bg-terminal-dim">
                    <Bot className="h-3.5 w-3.5 text-terminal-accent" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-terminal-dim text-terminal-accent'
                      : 'border border-terminal-border/50 bg-terminal-bg text-terminal-muted'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-terminal-accent/30 bg-terminal-dim">
                    <User className="h-3.5 w-3.5 text-terminal-accent" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-terminal-border bg-terminal-dim">
                  <Bot className="h-3.5 w-3.5 text-terminal-accent" />
                </div>
                <div className="rounded-lg border border-terminal-border/50 bg-terminal-bg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-terminal-muted" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <form
          onSubmit={sendMessage}
          className="flex shrink-0 items-center gap-2 border-t border-terminal-border bg-terminal-dim px-3 py-2"
        >
          <span className="text-terminal-muted">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={feeds.size > 0 ? 'Ask about your feeds...' : 'Load a feed first...'}
            className="flex-1 bg-transparent text-sm text-terminal-text placeholder-terminal-dim outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-7 w-7 items-center justify-center rounded border border-terminal-border text-terminal-muted transition-colors hover:border-terminal-accent hover:text-terminal-accent disabled:opacity-30 disabled:hover:border-terminal-border disabled:hover:text-terminal-muted"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </>
  )
}
