import { defineConfig } from 'vite'
import { importMiddleware } from './server/import-api.js'

export default defineConfig({
  worker: { format: 'es' },
  // Playwright traces contain HTML snapshots. They must never trigger a page
  // reload in another test or in the user's open development session.
  server: { host: '127.0.0.1', watch: { ignored: ['**/artifacts/**', '**/test-results/**', '**/playwright-report/**'] } },
  preview: { host: '127.0.0.1' },
  plugins: [{ name: 'study-import', configureServer(server) { server.middlewares.use(importMiddleware) }, configurePreviewServer(server) { server.middlewares.use(importMiddleware) } }],
})
