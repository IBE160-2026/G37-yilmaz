import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { resolve } from 'node:path'
import { preview } from 'vite'

// Isolated built-app server, fresh browser contexts and an OS-assigned port.
// Never reuse a user's server, browser profile or stored plan.
mkdirSync(resolve('test-results'), { recursive: true })
const output = mkdtempSync(resolve('test-results', 'cross-browser-'))
let server, tests
try {
  server = await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  const port = server.httpServer.address().port
  tests = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', '--config', 'tests/playwright.cross-browser.config.js', ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, AJOUR_BUILT_URL: `http://127.0.0.1:${port}`, AJOUR_BUILT_RESULTS: output },
  })
  const [code] = await once(tests, 'exit')
  process.exitCode = code ?? 1
} finally {
  if (tests?.exitCode === null) {
    tests.kill('SIGTERM')
    await Promise.race([once(tests, 'exit'), new Promise(done => setTimeout(done, 5000))])
    if (tests.exitCode === null) tests.kill('SIGKILL')
  }
  if (server) {
    server.httpServer.closeAllConnections()
    await new Promise((done, reject) => server.httpServer.close(error => error ? reject(error) : done()))
  }
}
