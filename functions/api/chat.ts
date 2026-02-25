type PagesContext = {
  request: Request
}

export const onRequestPost = async (_context: PagesContext): Promise<Response> => {
  return new Response(
    'Chat is not configured on this Cloudflare Pages deployment yet. Add a /functions/api/chat.ts implementation and required secrets to enable it.',
    {
      status: 501,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  )
}

