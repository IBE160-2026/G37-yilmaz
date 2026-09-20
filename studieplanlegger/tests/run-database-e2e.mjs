import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const temporary = mkdtempSync(join(tmpdir(), 'studieplan-database-e2e-'))
const executable = process.execPath
let application
const run = (script, args, env = process.env) => {
  const result = spawnSync(executable, [resolve(script), ...args], { stdio: 'inherit', env })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${script} exited with ${result.status}`)
}
const availablePort = () => new Promise((resolvePort, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address()
    server.close(error => error ? reject(error) : resolvePort(String(port)))
  })
})
const waitForHealth = async url => {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (application.exitCode !== null) throw new Error(`Production server exited with ${application.exitCode}`)
    try { if ((await fetch(url)).ok) return } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 100))
  }
  throw new Error('Production server did not become healthy.')
}

try {
  run('node_modules/vite/bin/vite.js', ['build'])
  const port = await availablePort()
  const env = { ...process.env, HOST: '127.0.0.1', PORT: port, PLAYWRIGHT_DATABASE_PORT: port, STUDIEPLAN_DB: join(temporary, 'state.sqlite') }
  application = spawn(executable, [resolve('server/app.js')], { stdio: 'inherit', env })
  await waitForHealth(`http://127.0.0.1:${port}/api/health`)
  run('node_modules/@playwright/test/cli.js', ['test', '--config=playwright.database.config.js'], env)
} finally {
  if (application?.exitCode === null) {
    application.kill('SIGTERM')
    await Promise.race([once(application, 'exit'), new Promise(resolveWait => setTimeout(resolveWait, 5_000))])
    if (application.exitCode === null) application.kill('SIGKILL')
  }
  rmSync(temporary, { recursive: true, force: true })
}
