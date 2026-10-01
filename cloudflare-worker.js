export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, service: 'dalseshop', platform: 'cloudflare-workers' })
    }

    const response = await env.ASSETS.fetch(request)
    if (response.status === 200 && /^\/(?:optimized-images\/[a-f0-9]{16}-\d+\.webp|fonts\/inter-[a-f0-9]{16}\.woff2)$/.test(url.pathname)
      && !response.headers.get('content-type')?.includes('text/html')) {
      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
    }
    return response
  },
}
