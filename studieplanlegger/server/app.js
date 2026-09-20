import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { StateDatabase } from './database.js'
import { stateMiddleware } from './state-api.js'
import { importMiddleware } from './import-api.js'

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)))
const port = Number(process.env.PORT || 8080)
const host = process.env.HOST || '127.0.0.1'
const database = new StateDatabase(process.env.STUDIEPLAN_DB || '/data/studieplan.sqlite', {
  seed: process.env.STUDIEPLAN_SEED === 'true',
  seedEnvelope: process.env.STUDIEPLAN_SEED_JSON ? JSON.parse(process.env.STUDIEPLAN_SEED_JSON) : undefined,
})
const state = stateMiddleware(database)
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8' }

async function staticFiles(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end() }
  let pathname
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname) }
  catch { res.writeHead(400); return res.end('Bad request') }
  const relative = pathname === '/' ? 'index.html' : normalize(pathname).replace(/^[/\\]+/, '')
  let filename = resolve(join(root, relative))
  if (filename !== root && !filename.startsWith(`${root}${sep}`)) { res.writeHead(403); return res.end() }
  try { if ((await stat(filename)).isDirectory()) filename = join(filename, 'index.html') } catch { filename = join(root, 'index.html') }
  try {
    let content = await readFile(filename)
    if (filename.endsWith('index.html')) content = Buffer.from(content.toString('utf8').replace('<head>', '<head><script>globalThis.__STUDIEPLAN_API__=true</script>'))
    const immutable = filename.startsWith(`${root}${sep}assets${sep}`)
    res.writeHead(200, {
      'Content-Type': mime[extname(filename)] || 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Security-Policy': "frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    })
    if (req.method === 'HEAD') return res.end()
    res.end(content)
  } catch { res.writeHead(404); res.end('Not found') }
}

const server = createServer((req, res) => state(req, res, () => importMiddleware(req, res, () => {
  staticFiles(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); if (!res.writableEnded) res.end('Server error') })
})))
server.listen(port, host, () => console.log(`Studieplan listening on ${host}:${port}`))
function shutdown() { server.close(() => { database.close(); process.exit(0) }) }
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
