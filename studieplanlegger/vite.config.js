import { defineConfig } from 'vite'
import { importMiddleware } from './server/import-api.js'

export function releaseMarker(env = process.env) {
  const commit = env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA || env.AJOUR_BUILD_SHA || null
  if (commit !== null && !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Build commit must be a full Git SHA.')
  return {
    name: 'release-commit',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'release.json', source: JSON.stringify({ commit }) })
    },
  }
}

export default defineConfig({
  worker: { format: 'es' },
  // Playwright traces contain HTML snapshots. They must never trigger a page
  // reload in another test or in the user's open development session.
  server: { host: '127.0.0.1', watch: { ignored: ['**/artifacts/**', '**/test-results/**', '**/playwright-report/**'] } },
  preview: { host: '127.0.0.1' },
  plugins: [releaseMarker(), { name: 'study-import', configureServer(server) { server.middlewares.use(importMiddleware) }, configurePreviewServer(server) { server.middlewares.use(importMiddleware) } }],
})
