import { execFileSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function verifyDeployedCommit(origin, expected, fetchImpl = fetch) {
  let marker
  try {
    const response = await fetchImpl(new URL('/release.json', origin), {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error()
    const body = await response.text()
    if (body.length > 1024) throw new Error()
    marker = JSON.parse(body)
  } catch { throw new Error('Deployment release marker is unavailable or invalid.') }
  if (!/^[a-f0-9]{40}$/.test(expected) || marker?.commit !== expected) {
    throw new Error('Deployed build does not match the expected Git commit.')
  }
}

// No credentials or local profiles are accepted. Every Playwright test receives
// a fresh isolated context; only synthetic state is created on this origin.
async function main() {
  let origin
  try { origin = new URL(process.env.AJOUR_REMOTE_URL || 'invalid:') }
  catch { throw new Error('AJOUR_REMOTE_URL must be a valid deployment origin.') }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port ||
      origin.pathname !== '/' || origin.search || origin.hash ||
      !/^ajour-[a-z0-9-]+\.vercel\.app$/.test(origin.hostname)) {
    throw new Error('AJOUR_REMOTE_URL must be an exact HTTPS Ajour Vercel origin without credentials, port, path, query or fragment.')
  }
  const expected = process.env.AJOUR_DEPLOYMENT_SHA || ''
  if (!/^[a-f0-9]{40}$/.test(expected)) throw new Error('AJOUR_DEPLOYMENT_SHA must be the full deployed Git commit SHA.')
  const directory = fileURLToPath(new URL('../', import.meta.url))
  const actual = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim()
  if (actual !== expected) throw new Error('Checked-out tests do not match the declared deployment commit.')
  await verifyDeployedCommit(origin, expected)
  console.log(`Ajour deployment smoke: ${origin.origin}, commit ${actual}`)
  const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url))
  for (const [phase, projects] of [
    ['deployment-contracts', ['remote-core', 'remote-failures']],
    ['bounded-live-sources', ['remote-live']],
  ]) {
    console.log(JSON.stringify({ phase, status: 'running' }))
    const result = spawnSync(process.execPath, [cli, 'test', '--config', 'tests/playwright.remote.config.js', ...projects.flatMap(project => ['--project', project])], {
      cwd: directory, stdio: 'inherit', env: { ...process.env, AJOUR_REMOTE_URL: origin.origin, RUN_LIVE_TEACHING: '1' },
    })
    if (result.error) throw result.error
    console.log(JSON.stringify({ phase, status: result.status === 0 ? 'passed' : 'failed' }))
    if (result.status !== 0) {
      if (phase === 'bounded-live-sources') console.error('Bounded source checks failed; investigate upstream availability separately before attributing this to the deployment.')
      process.exitCode = result.status ?? 1
      return
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
