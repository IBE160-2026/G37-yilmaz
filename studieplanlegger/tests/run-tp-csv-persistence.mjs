// Synthetic data and uniquely owned resources only. Never uses compose, an
// existing database, a supplied service URL, or the production container.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { chromium } from '@playwright/test'

const mode = process.argv[2] || 'node'
assert.ok(['node', 'docker', 'both'].includes(mode), 'Expected node, docker or both')
const journeys = {
  main: ['TP CSV main journey', 'TP CSV persisted context'],
  exceptions: ['TP CSV time exceptions:.*desktop$', 'TP CSV persisted exceptions'],
  mixed: ['Import clarity mixed institutions:', 'Import clarity persisted mixed:'],
  points: ['Import clarity user points:', 'Import clarity persisted points:'],
  'corrections-deletion': ['Calendar corrections deletion: provisional', 'Calendar corrections persisted deletion:'],
  'corrections-time-export': ['Calendar corrections times and export:', 'Calendar corrections persisted time-export:'],
  'correction-ui': ['correction institutions:', 'correction persisted institutions:'],
  'corrections-ics': ['Calendar corrections ICS:', 'Calendar corrections persisted ICS:'],
  'closure-courses': ['Closure courses:', 'Closure persisted courses:'],
  'closure-ics': ['Import closure ICS:', 'Import closure persisted ICS:'],
  'closure-export': ['Closure export:', 'Closure persisted export:'],
  'closure-term': ['import-calendar-closure-term\\.spec\\.js.*Closure term:', 'import-calendar-closure-term\\.spec\\.js.*Closure persisted term:'],
  'closure-term-second': ['Import closure term:', 'Import closure persisted term:'],
  'closure-term-legacy': ['Closure legacy term:', 'Closure persisted legacy term:'],
  'closure-personal-csv': ['Closure personal CSV:', 'Closure persisted personal CSV:'],
  'closure-fresh-courses': ['Closure fresh courses:', 'Closure persisted fresh courses:'],
  'closure-csv-term': ['Closure CSV term:', 'Closure persisted CSV term:'],
}
// Optional second argument selects fresh scenarios; it never resumes a database.
assert.ok(process.argv.length <= 4, 'Expected node|docker|both [scenario,scenario]')
const scenarioArgument = process.argv[3]
assert.ok(scenarioArgument === undefined || /^[a-z0-9-]+(?:,[a-z0-9-]+)*$/.test(scenarioArgument), 'Expected a nonempty comma-separated scenario list')
const scenarios = scenarioArgument === undefined ? Object.keys(journeys) : scenarioArgument.split(',')
assert.equal(new Set(scenarios).size, scenarios.length, 'Duplicate scenarios are not allowed')
for (const scenario of scenarios) assert.ok(Object.hasOwn(journeys, scenario), `Unknown scenario: ${scenario}`)
const stamp = `tp-csv-${Date.now()}-${randomBytes(4).toString('hex')}`
const root = resolve('artifacts/tp-csv-persistence', stamp)
await mkdir(root, { recursive: true })
const image = `studieplan-${stamp}:test`
const result = { root, mode, scenarios, checks: [], cleanup: [] }
const run = (cmd, args, { stream = false } = {}) => {
  const child = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 8000000, ...(stream ? { stdio: 'inherit' } : {}) })
  if (child.status !== 0) throw new Error(`${cmd} ${args[0]} exited ${child.status}: ${child.stderr || child.stdout || child.error}`)
  return child.stdout?.trim() || ''
}
const availablePort = () => new Promise((done, reject) => {
  const server = createServer(); server.once('error', reject)
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(error => error ? reject(error) : done(port)) })
})
const waitHealth = async address => {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    try { if ((await fetch(`${address}/api/health`, { signal: AbortSignal.timeout(remaining) })).ok) return } catch {}
    await new Promise(done => setTimeout(done, 150))
  }
  throw new Error('Owned server health timeout')
}
const ui = async (grep, address, output, scenario, snapshot = '') => {
  const reportFile = resolve(output, `playwright-${Date.now()}-${randomBytes(3).toString('hex')}.json`)
  const env = { ...process.env, TP_CSV_RUNTIME_URL: address, TP_CSV_EVIDENCE_DIR: output, TP_CSV_RUNTIME_SCENARIO: scenario, TP_CSV_VERIFY_SNAPSHOT: snapshot, TP_CSV_REPORT_FILE: reportFile }
  const child = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', '--config=tests/tp-csv-runtime.config.mjs', '--grep', grep], { env, stdio: 'inherit' })
  const [code, signal] = await once(child, 'exit')
  let stats
  try { stats = JSON.parse(await readFile(reportFile, 'utf8')).stats } catch { /* Report absence fails below, even with exit zero. */ }
  result.checks.push({ grep, address, scenario, code, signal, reportFile, stats })
  assert.equal(code, 0, `UI exit ${code}, signal ${signal}`)
  assert.ok(stats?.expected > 0, 'The acceptance invocation must execute and pass a test')
  assert.equal(stats.skipped, 0, 'Skipped acceptance coverage is not a passing check')
  assert.equal(stats.unexpected, 0)
  assert.equal(stats.flaky, 0)
}
// Include every shipped source and generated build file. Hashing only index.html
// would not establish that the browser and server exercised the same final code.
const filesUnder = async directory => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? filesUnder(`${directory}/${entry.name}`) : entry.isFile() ? [`${directory}/${entry.name}`] : []))
  return nested.flat()
}
// Public assets are shipped inside dist; the runtime image intentionally has
// no /app/public directory. Their served bytes are also checked below against
// the local public originals, before and after recreation.
const sourcePaths = [...(await Promise.all(['src', 'server', 'dist'].map(filesUnder))).flat(), 'package.json', 'package-lock.json'].sort()
result.hashes = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])))
const assertLocalHashes = async () => {
  for (const path of sourcePaths) assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), result.hashes[path], `Runtime code changed during verification: ${path}`)
}
const assertBrandAssets = async (address, runtime, scenario, phase) => {
  const response = await fetch(address)
  assert.ok(response.ok, 'Owned runtime must serve the client')
  const html = await response.text()
  assert.match(html, /<title>Ajour – Kom ajour\.<\/title>/)
  const themeScript = html.indexOf('/theme-init.js')
  assert.ok(themeScript > 0 && themeScript < html.indexOf('rel="stylesheet"'), 'Theme bootstrap precedes stylesheets')
  const paths = ['brand/wordmark.svg', 'brand/notebook.svg', 'brand/companion.svg', 'brand/wordmark-dark.svg', 'brand/notebook-dark.svg', 'brand/companion-dark.svg', 'favicon.svg']
  for (const path of paths) {
    const asset = await fetch(`${address}/${path}`)
    assert.ok(asset.ok, `Missing local brand asset: ${path}`)
    assert.match(asset.headers.get('content-type') || '', /^image\/svg\+xml\b/)
    assert.deepEqual(Buffer.from(await asset.arrayBuffer()), await readFile(`public/${path}`), `Runtime asset bytes: ${path}`)
  }
  const theme = await fetch(`${address}/theme-init.js`)
  assert.ok(theme.ok, 'Missing local theme bootstrap')
  assert.match(theme.headers.get('content-type') || '', /^(?:text|application)\/javascript\b/)
  assert.deepEqual(Buffer.from(await theme.arrayBuffer()), await readFile('public/theme-init.js'), 'Runtime theme bootstrap bytes')
  const before = await (await fetch(`${address}/api/state`)).json()
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await page.goto(address)
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' && document.querySelector('#theme-toggle')?.getAttribute('aria-label') === 'Bytt til lyst tema')
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'dark')
    await page.getByRole('button', { name: 'Bytt til lyst tema', exact: true }).click()
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light')
    await page.reload()
    await page.getByRole('button', { name: 'Bytt til mørkt tema', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light', 'Explicit theme survives reload against dark system')
    await page.getByRole('button', { name: 'Bytt til mørkt tema', exact: true }).click()
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
    assert.deepEqual(await (await fetch(`${address}/api/state`)).json(), before, 'Theme controls must not write SQLite state or revision')
  } finally { await browser.close() }
  result.checks.push({ runtime, scenario, phase, title: 'Ajour – Kom ajour.', brandAssetsVerified: paths.length, themeAssetsVerified: 1, themeTogglesVerified: 2, themeReloadVerified: true, domainStateUnchanged: true })
}
// The path is supplied only by the owned-resource branches below. Never open an
// existing application database or use its constructor/migrations for evidence.
const sqliteReadSource = `
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(process.argv[1], { readOnly: true });
try {
  const tables = ['courses', 'tasks', 'planner_events', 'planner_sources', 'import_sources'];
  const rows = Object.fromEntries(tables.map(table => [table, db.prepare('SELECT * FROM ' + table + ' ORDER BY position').all()]));
  rows.import_entries = db.prepare('SELECT * FROM import_entries ORDER BY source_id, position').all();
  rows.revision = db.prepare('SELECT revision FROM state_meta WHERE singleton=1').get().revision;
  rows.integrity = db.prepare('PRAGMA integrity_check').all();
  rows.foreignKeys = db.prepare('PRAGMA foreign_key_check').all();
  console.log(JSON.stringify(rows));
} finally { db.close(); }
`
const assertSqlite = (actual, expected, runtime, scenario, phase) => {
  const { envelope, revision } = expected
  assert.equal(actual.revision, revision)
  assert.deepEqual(actual.integrity, [{ integrity_check: 'ok' }])
  assert.deepEqual(actual.foreignKeys, [])
  const collections = { courses: envelope.planner?.courses || [], tasks: envelope.tasks || [], planner_events: envelope.planner?.events || [], planner_sources: envelope.planner?.sources || [], import_sources: envelope.importSources || [] }
  for (const [table, values] of Object.entries(collections)) {
    const payloads = table === 'import_sources' ? values.map(({ entries, ...source }) => source) : values
    assert.deepEqual(actual[table].map(row => JSON.parse(row.payload_json)), payloads, `${table}: exact stored payloads`)
    for (const [position, row] of actual[table].entries()) {
      const value = values[position]
      assert.equal(row.id, value.id)
      assert.equal(row.position, position)
      if ('course_id' in row) assert.equal(row.course_id, value.courseId || null)
      if ('source_id' in row) assert.equal(row.source_id, value.sourceId ?? null)
      if ('start_at' in row) assert.equal(row.start_at, value.start ?? null)
    }
  }
  assert.equal(actual.import_entries.length, collections.import_sources.reduce((sum, source) => sum + source.entries.length, 0))
  for (const source of collections.import_sources) {
    const entries = actual.import_entries.filter(row => row.source_id === source.id)
    assert.deepEqual(entries.map(row => JSON.parse(row.payload_json)), source.entries)
    for (const [position, row] of entries.entries()) {
      assert.equal(row.entry_key, source.entries[position].key)
      assert.equal(row.target_id, source.entries[position].targetId ?? null)
      assert.equal(row.kind, source.entries[position].kind ?? null)
    }
  }
  result.checks.push({ runtime, scenario, phase, directSqliteExact: true, integrity: 'ok', foreignKeyViolations: 0, courses: actual.courses.length, events: actual.planner_events.length })
}
let application, activeContainer, imageCreated = false
const volumes = new Set()
const stopNode = async () => {
  if (application && application.exitCode === null && application.signalCode === null) {
    const finished = once(application, 'exit')
    assert.ok(application.kill('SIGTERM'), 'Could not stop the owned Node process')
    let timer
    try { await Promise.race([finished, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Owned Node shutdown timeout')), 5000) })]) }
    finally { clearTimeout(timer) }
  }
  application = undefined
}
const exercise = async (runtime, scenario, address, output, start, stop, readSqlite) => {
  await assertLocalHashes()
  console.log(JSON.stringify({ event: 'scenario-start', runtime, scenario, address }))
  await start()
  await assertBrandAssets(address, runtime, scenario, 'initial-client')
  const state = async () => { const response = await fetch(`${address}/api/state`); assert.ok(response.ok); return response.json() }
  const initial = await state(); assert.equal(initial.revision, 0)
  assert.equal(initial.envelope.planner?.events?.length || 0, 0)
  const [journey, verifier] = journeys[scenario]
  await ui(journey, address, output, scenario)
  const before = await state(), snapshot = resolve(output, 'expected.json')
  assertSqlite(readSqlite(), before, runtime, scenario, 'after-visible-journey')
  await writeFile(snapshot, JSON.stringify(before.envelope, null, 2))
  if (['mixed', 'correction-ui'].includes(scenario) || scenario.startsWith('closure-')) {
    await ui('Calendar corrections backup:', address, output, scenario, snapshot)
    assert.deepEqual((await state()).envelope, before.envelope)
    assertSqlite(readSqlite(), await state(), runtime, scenario, 'after-visible-backup-restore')
  }
  await ui(verifier, address, output, scenario, snapshot)
  const persisted = await state()
  await writeFile(snapshot, JSON.stringify(persisted.envelope, null, 2))
  await stop(); await start()
  await assertBrandAssets(address, runtime, scenario, 'recreated-client')
  assert.deepEqual(await state(), persisted)
  assertSqlite(readSqlite(), persisted, runtime, scenario, 'after-recreation')
  const envelope = persisted.envelope
  const counts = {
    courses: envelope.planner?.courses?.length || 0,
    events: envelope.planner?.events?.length || 0,
    userPoints: envelope.planner?.events?.filter(event => event.point && event.pointProvenance === 'user').length || 0,
    sources: envelope.importSources?.length || 0,
    sourceEntries: envelope.importSources?.reduce((sum, source) => sum + source.entries.length, 0) || 0,
    exclusions: envelope.importSources?.reduce((sum, source) => sum + (source.excludedKeys?.length || 0), 0) || 0,
  }
  result.checks.push({ runtime, scenario, exactEnvelopeAfterRecreation: true, address, counts })
  await ui(verifier, address, output, scenario, snapshot)
  assertSqlite(readSqlite(), await state(), runtime, scenario, 'after-fresh-browser-reimport')
  await stop()
  await assertLocalHashes()
  console.log(JSON.stringify({ event: 'scenario-complete', runtime, scenario, counts }))
}
try {
  for (const runtime of mode === 'both' ? ['node', 'docker'] : [mode]) for (const scenario of scenarios) {
    if (runtime === 'docker' && !imageCreated) {
      run('docker', ['info', '--format', '{{.ServerVersion}}'])
      // Own the unique tag before building: a cancelled client may leave a
      // completed image. Stream slow layers so the run remains observable.
      imageCreated = true
      run('docker', ['build', '--progress=plain', '-t', image, '.'], { stream: true })
    }
    const port = await availablePort(), address = `http://127.0.0.1:${port}`, output = resolve(root, runtime, scenario)
    await mkdir(output, { recursive: true })
    if (runtime === 'node') {
      const start = async () => {
        application = spawn(process.execPath, [resolve('server/app.js')], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), STUDIEPLAN_DB: resolve(output, 'synthetic.sqlite'), STUDIEPLAN_SEED: 'false', STUDIEPLAN_SEED_JSON: '' }, stdio: 'inherit' })
        await waitHealth(address)
      }
      const readSqlite = () => JSON.parse(run(process.execPath, ['--input-type=module', '-e', sqliteReadSource, resolve(output, 'synthetic.sqlite')]))
      await exercise(runtime, scenario, address, output, start, stopNode, readSqlite)
    } else {
      const name = `studieplan-${stamp}-${scenario}`, volume = `${name}-data`
      run('docker', ['volume', 'create', volume]); volumes.add(volume)
      let previousId
      const start = async () => {
        activeContainer = name
        run('docker', ['run', '-d', '--name', name, '-p', `127.0.0.1:${port}:8080`, '-v', `${volume}:/data`, '-e', 'STUDIEPLAN_SEED=false', image])
        await waitHealth(address)
        const id = run('docker', ['inspect', '--format', '{{.Id}}', name])
        if (previousId) assert.notEqual(id, previousId)
        previousId = id
        const hashes = run('docker', ['exec', name, 'sha256sum', ...sourcePaths.map(path => `/app/${path}`)])
        const actual = Object.fromEntries(hashes.split('\n').map(line => { const [hash, path] = line.trim().split(/\s+/); return [path.replace('/app/', ''), hash] }))
        assert.deepEqual(actual, result.hashes, 'Every source and build file must match the verified local code')
      }
      const stop = async () => { run('docker', ['rm', '-f', name]); activeContainer = undefined }
      const readSqlite = () => JSON.parse(run('docker', ['exec', name, 'node', '--input-type=module', '-e', sqliteReadSource, '/data/studieplan.sqlite']))
      await exercise(runtime, scenario, address, output, start, stop, readSqlite)
      result.checks.push({ scenario, matchingDockerHashes: sourcePaths.length })
    }
  }
  result.passed = true
} catch (error) { result.error = error.stack; process.exitCode = 1 }
finally {
  try { await stopNode() }
  catch (error) { result.cleanup.push({ resource: 'owned Node process', error: error.message }); process.exitCode = 1 }
  for (const args of [...(activeContainer ? [['rm', '-f', activeContainer]] : []), ...[...volumes].map(volume => ['volume', 'rm', volume]), ...(imageCreated ? [['image', 'rm', image]] : [])]) {
    try { run('docker', args); result.cleanup.push({ resource: args.at(-1), removed: true }) }
    catch (error) { result.cleanup.push({ resource: args.at(-1), error: error.message }); process.exitCode = 1 }
  }
  result.passed = Boolean(result.passed && !process.exitCode)
  await writeFile(resolve(root, 'result.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ root, passed: result.passed || false, error: result.error, checks: result.checks, cleanup: result.cleanup }))
}
