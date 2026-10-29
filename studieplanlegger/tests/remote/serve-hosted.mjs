import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import hostedImport from '../../server/hosted-import.js'

// Test-only local harness. It uses a fresh loopback port and the real built
// client/handler, no SQLite and no user's profiles. It is not Vercel evidence.
// HTTPS Host/Origin are translated only after verifying the loopback origin;
// real edge forwarding and TLS must still be checked on the deployed URL.
const dist = fileURLToPath(new URL('../../dist/', import.meta.url))
await stat(resolve(dist, 'index.html'))
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' }
const server = createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'")
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  try {
    const origin = `http://127.0.0.1:${server.address().port}`
    const path = new URL(req.url, origin).pathname
    if (path === '/api' || path.startsWith('/api/')) {
      if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) {
        res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Isolated harness origin rejected.' })); return
      }
      req.headers.host = 'ajour-harness.example.test'
      if (req.headers.origin) req.headers.origin = 'https://ajour-harness.example.test'
      await hostedImport(req, res)
      return
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return }
    let file = resolve(dist, `.${decodeURIComponent(path === '/' ? '/index.html' : path)}`)
    if (!file.startsWith(`${resolve(dist)}${sep}`)) { res.writeHead(403); res.end(); return }
    let entry = await stat(file).catch(() => null)
    if (!entry?.isFile() && !extname(path)) { file = resolve(dist, 'index.html'); entry = await stat(file) }
    if (!entry?.isFile()) { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': entry.size })
    if (req.method === 'HEAD') res.end()
    else createReadStream(file).pipe(res)
  } catch { if (!res.headersSent) res.writeHead(500); res.end('Local harness failure.') }
})
server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`AJOUR_REMOTE_URL=http://127.0.0.1:${server.address().port}\nLocal hosted-handler harness only; not Vercel evidence.\n`)
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))
