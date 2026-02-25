import path from 'path'
import fs from 'fs'
import os from 'os'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function getCodexToken(env: Record<string, string>): string {
  const authFile =
    env.CODEX_AUTH_FILE || path.join(os.homedir(), '.codex', 'auth.json')
  if (!fs.existsSync(authFile)) {
    throw new Error(
      `Codex auth file not found at ${authFile}. Run "codex" once to authenticate.`
    )
  }
  const auth = JSON.parse(fs.readFileSync(authFile, 'utf8'))
  const token = auth.access_token || auth.tokens?.access_token
  if (!token) {
    throw new Error('No access_token found in Codex auth file.')
  }
  return token
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-proxy',
        configureServer(server) {
          // --- /api/chat endpoint (Codex API) ---
          server.middlewares.use(async (req, res, next) => {
            if (req.method === 'POST' && req.url === '/api/chat') {
              const chunks: Buffer[] = []
              req.on('data', (chunk: Buffer) => chunks.push(chunk))
              req.on('end', async () => {
                try {
                  const body = JSON.parse(Buffer.concat(chunks).toString())
                  const { message, feedContext, history } = body

                  if (!message) {
                    res.statusCode = 400
                    res.end('Missing message')
                    return
                  }

                  let token: string
                  try {
                    token = getCodexToken(env)
                  } catch (e) {
                    res.statusCode = 500
                    res.end(e instanceof Error ? e.message : 'Auth error')
                    return
                  }

                  const codexUrl =
                    env.CODEX_URL ||
                    'https://chatgpt.com/backend-api/codex/responses'
                  const model = env.CODEX_MODEL || 'gpt-5.3-codex'

                  const instructions = `You are a helpful RSS feed assistant embedded in a terminal-style RSS reader. You have access to the user's loaded RSS feed data below.

Your capabilities:
- Summarize articles and feeds
- Answer questions about article content
- Analyze sentiment (positive, negative, neutral) of articles or topics
- Identify trends across feeds
- Compare coverage between different sources
- Provide insights and interpretations of the news
- Highlight key points from articles

Be concise but insightful. Use a slightly technical, terminal-friendly tone. When analyzing sentiment, provide a clear rating and brief justification.

--- LOADED FEED DATA ---
${feedContext || 'No feeds loaded yet.'}
--- END FEED DATA ---`

                  // Build input array with conversation history + new message
                  const input: Array<{
                    type: string
                    role: string
                    content: Array<{ type: string; text: string }>
                  }> = []

                  if (history && Array.isArray(history)) {
                    for (const msg of history) {
                      input.push({
                        type: 'message',
                        role: msg.role,
                        content: [
                          {
                            type:
                              msg.role === 'user'
                                ? 'input_text'
                                : 'output_text',
                            text: msg.content,
                          },
                        ],
                      })
                    }
                  }

                  input.push({
                    type: 'message',
                    role: 'user',
                    content: [{ type: 'input_text', text: message }],
                  })

                  const apiRes = await fetch(codexUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      model,
                      instructions,
                      stream: true,
                      store: false,
                      input,
                    }),
                  })

                  if (!apiRes.ok) {
                    const errBody = await apiRes.text()
                    res.statusCode = apiRes.status
                    res.setHeader('Content-Type', 'text/plain')
                    res.end(`Codex API error (${apiRes.status}): ${errBody}`)
                    return
                  }

                  // Collect streamed SSE response and extract text deltas
                  const streamText = await apiRes.text()
                  let reply = ''

                  for (const line of streamText.split('\n')) {
                    if (!line.startsWith('data: ')) continue
                    const payload = line.slice(6).trim()
                    if (payload === '[DONE]') break
                    try {
                      const event = JSON.parse(payload)
                      // output_text.delta events carry the text chunks
                      if (
                        event.type === 'response.output_text.delta' &&
                        event.delta
                      ) {
                        reply += event.delta
                      }
                    } catch {
                      // skip unparseable lines
                    }
                  }

                  if (!reply) reply = 'No response.'

                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ reply }))
                } catch (e) {
                  res.statusCode = 500
                  res.end(
                    `Server error: ${e instanceof Error ? e.message : 'Unknown'}`
                  )
                }
              })
              return
            }

            // --- /api/feed endpoint ---
            if (req.url?.startsWith('/api/feed?')) {
              const url = new URL(req.url, 'http://localhost')
              const feedUrl = url.searchParams.get('url')
              if (!feedUrl) {
                res.statusCode = 400
                res.end('Missing url')
                return
              }
              try {
                const response = await fetch(feedUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    Accept: 'application/rss+xml, application/xml, text/xml, */*',
                  },
                  redirect: 'follow',
                })
                const xml = await response.text()
                if (!response.ok) {
                  res.statusCode = 502
                  res.end(`Feed returned ${response.status}`)
                  return
                }
                res.setHeader('Content-Type', 'application/xml; charset=utf-8')
                res.end(xml)
              } catch (e) {
                res.statusCode = 502
                res.end('Failed to fetch feed')
              }
              return
            }
            next()
          })
        },
      },
    ],
    server: {
      port: 3000,
      strictPort: true,
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
  }
})
