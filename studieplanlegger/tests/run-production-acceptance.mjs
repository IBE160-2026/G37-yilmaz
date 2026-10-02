// Sequential production acceptance against an owned synthetic Node/SQLite server.
// Build first. Docker callers use the same config with explicit create/restore
// phases, snapshot path, external loopback port, and recreation between phases.
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const directory = await mkdtemp(join(tmpdir(), 'studieplan-final-production-'))
const databasePath = join(directory, 'synthetic.sqlite')
const snapshot = join(directory, 'before-recreation.json')
let application
let port
const freePort = () => new Promise((accept, reject) => {
  const server = createServer(); server.once('error', reject)
  server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(error => error ? reject(error) : accept(value)) })
})
async function stop() {
  if (application?.exitCode === null && application.signalCode === null) {
    const exited = once(application, 'exit')
    application.kill('SIGTERM')
    await Promise.race([exited, new Promise(accept => setTimeout(accept, 5000))])
    if (application.exitCode === null && application.signalCode === null) { application.kill('SIGKILL'); await exited }
  }
}
async function start() {
  application = spawn(process.execPath, [resolve('server/app.js')], { stdio: 'inherit', env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), STUDIEPLAN_DB: databasePath } })
  const until = Date.now() + 20000
  while (Date.now() < until) {
    if (application.exitCode !== null || application.signalCode !== null) throw Error(`Owned server exited ${application.exitCode ?? application.signalCode}`)
    try { const response = await fetch(`http://127.0.0.1:${port}/api/health`); if (response.ok) return } catch {}
    await new Promise(accept => setTimeout(accept, 100))
  }
  throw Error('Owned production server failed health check')
}
async function suite(phase) {
  const output = join(directory, phase); await mkdir(output)
  const selected = process.env.STUDIEPLAN_ACCEPTANCE_TEST_FILE ? [process.env.STUDIEPLAN_ACCEPTANCE_TEST_FILE] : ['tests/production/acceptance.spec.js']
  const child = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', '--config=tests/playwright.production.config.js', ...selected], { stdio: 'inherit', env: { ...process.env, STUDIEPLAN_ACCEPTANCE_PORT: String(port), STUDIEPLAN_ACCEPTANCE_PHASE: phase, STUDIEPLAN_ACCEPTANCE_SNAPSHOT: snapshot, STUDIEPLAN_ACCEPTANCE_OUTPUT: output } })
  const [code] = await once(child, 'exit'); if (code !== 0) throw Error(`Acceptance ${phase} failed (${code}); evidence ${directory}`)
}
try {
  await readFile(resolve('dist/index.html'))
  port = await freePort()
  console.log(`Synthetic production acceptance: ${directory}; loopback port ${port}`)
  await start(); await suite('create'); await stop(); await start(); await suite('restore'); await stop()
  const database = new DatabaseSync(databasePath, { readOnly: true })
  try {
    const integrity = database.prepare('PRAGMA integrity_check').all()
    const foreignKeys = database.prepare('PRAGMA foreign_key_check').all()
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' || foreignKeys.length) throw Error('SQLite integrity/foreign-key verification failed')
    console.log(JSON.stringify({ integrity, foreignKeyViolations: foreignKeys.length, evidenceDirectory: directory }))
  } finally { database.close() }
} finally { await stop() }
