import { test, expect } from '@playwright/test'
import { freeze, key, navigate, saved } from './helpers.js'

// Synthetic source responses only. The attached stress report is evidence for
// F02, not a fixture, source contract or instruction to modify student data.
const source = 'https://example.test/synthetic-context'
const calendar = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Synthetic context test//NO\r\nBEGIN:VEVENT\r\nUID:synthetic\r\nSUMMARY:Synthetic teaching\r\nDTSTART:20261030T090000Z\r\nDTEND:20261030T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
function plan(institution, suffix = 'current', code = 'TEST101') {
  const program = { code: suffix, name: `Syntetisk ${institution} ${suffix}`, cohort: '2026', sourceUrl: source, campuses: ['Syntetisk campus'] }
  return { status: 'ok', program, models: [{ id: suffix, name: `Modell ${suffix}`, periods: [{ id: 'semester-1', label: '1. studiesemester', studySemester: 1, year: 2026, semester: 'autumn', requirements: [], courses: [{ id: `${institution}:${suffix}:${code}`, code, name: `Syntetisk ${code}`, university: institution.toUpperCase(), notes: '', choice: 'O', credits: 7.5, sourceUrl: source }] }] }], warnings: [] }
}
function response(institution, action, query, suffix = 'current') {
  const data = plan(institution, suffix, institution === 'hivolda' ? 'ANI161' : 'TEST101')
  if (action === 'programs') return { status: 'ok', results: [data.program], completeness: { complete: true } }
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: '2026', sourceUrl: source }] }
  if (action === 'program-plan') return data
  if (action === 'teaching-search') return { status: 'ok', results: [{ code: data.models[0].periods[0].courses[0].code, label: 'Syntetisk undervisning', sourceObjectId: 'synthetic' }] }
  return { status: 'ok', calendar, calendarUrl: 'https://example.test/synthetic.ics' }
}
async function mock(page, custom = () => null) {
  await page.route('**/api/import/providers/**', async route => {
    const url = new URL(route.request().url()), [, institution, action] = url.pathname.match(/providers\/([^/]+)\/([^/]+)/)
    if (await custom(route, institution, action, url.searchParams)) return
    await route.fulfill({ json: response(institution, action, url.searchParams) })
  })
}
async function start(page) {
  await freeze(page, '2026-10-29T18:00:00+01:00')
  await page.goto('/')
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'keep-task', title: 'Behold syntetisk oppgave', course: '', estimatedMinutes: 30, completed: false }], planner: { courses: [], events: [], sources: [] }, onboarding: { dismissed: true, completed: true } })), key)
  await page.reload(); await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Finn studieprogram', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  return page.locator('.program-import')
}
async function catalogue(host, institution) {
  await host.locator('[name=institution]').selectOption(institution)
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
}
async function choosePlan(host) {
  await host.locator('[name=program]').selectOption('0')
  await host.locator('[name=cohort]').selectOption('0')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
}
async function preview(host) {
  await host.locator('[name=model]').selectOption('current')
  await host.locator('[name=studySemester]').selectOption('semester-1')
  await host.locator('[name=calendarSemester]').selectOption('2026:autumn')
  await host.locator('[name=programCampus]').selectOption('Syntetisk campus')
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await expect(host).toHaveAttribute('aria-busy', 'false')
  await expect(host.getByRole('button', { name: 'Bekreft programimport', exact: true })).toBeEnabled()
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

for (const next of ['vid', 'nla']) test(`F02 clears UiA teaching status and selections before ${next} source errors`, async ({ page }) => {
  await mock(page, async (route, institution, action) => {
    if (institution === next && (next === 'vid' ? action === 'programs' : action === 'program-plan')) {
      await route.fulfill({ json: { status: 'source-changed', error: `Syntetisk gjeldende feil fra ${next}` } }); return true
    }
  })
  const host = await start(page), original = await saved(page)
  await catalogue(host, 'uia'); await choosePlan(host); await preview(host)
  await expect(host.locator('.program-action-status')).toContainText('Resultatet fra undervisningskilden')
  await host.getByRole('button', { name: 'Tilbake til emnevalg', exact: true }).click()
  await catalogue(host, next)
  await expect(host.locator('.program-action-status')).toBeHidden()
  await expect(host.locator('[name=model]')).toHaveValue('')
  await expect(host.locator('[name=programCampus]')).toHaveValue('')
  if (next === 'nla') await choosePlan(host)
  await expect(host).toContainText(`Syntetisk gjeldende feil fra ${next}`)
  await expect(host).not.toContainText('Resultatet fra undervisningskilden')
  expect(await saved(page)).toEqual(original)
})

test('F02 finishes the Volda teaching status and clears it before switching to Molde', async ({ page }) => {
  await mock(page)
  const host = await start(page), original = await saved(page)
  await catalogue(host, 'hivolda'); await choosePlan(host); await preview(host)
  await host.getByRole('button', { name: 'Hent valgt timeplan for ANI161', exact: true }).click()
  await expect(host).toHaveAttribute('aria-busy', 'false')
  await expect(host.getByRole('button', { name: 'Hent valgt timeplan for ANI161', exact: true })).toBeEnabled()
  await expect(host.locator('.program-action-status')).not.toContainText('Henter valgt timeplan')
  await host.getByRole('button', { name: 'Tilbake til emnevalg', exact: true }).click()
  await catalogue(host, 'himolde')
  await expect(host.locator('.program-action-status')).toBeHidden()
  await expect(host).not.toContainText('ANI161')
  await expect(host.locator('[name=program]')).toContainText('Syntetisk himolde current')
  expect(await saved(page)).toEqual(original)
})

for (const [stage, outcome] of [['programs', 'success'], ['program-cohorts', 'success'], ['program-plan', 'success'], ['teaching-calendar', 'success'], ['programs', 'failure'], ['teaching-calendar', 'failure']]) test(`F02 a cancelled late ${stage} ${outcome} cannot replace the current context`, async ({ page }) => {
  const reached = deferred(), release = deferred(), finished = deferred()
  let delayed = false
  await mock(page, async (route, institution, action, query) => {
    if (institution === 'hivolda' && action === stage && !delayed) {
      delayed = true; reached.resolve()
      await release.promise
      try { await route.fulfill({ json: outcome === 'failure' ? { status: 'source-changed', error: 'Syntetisk foreldet feil' } : response(institution, action, query, 'obsolete') }) } finally { finished.resolve() }
      return true
    }
  })
  try {
    const host = await start(page), original = await saved(page)
    await catalogue(host, 'hivolda')
    if (stage !== 'programs') {
      await host.locator('[name=program]').selectOption('0')
      if (stage !== 'program-cohorts') {
        await host.locator('[name=cohort]').selectOption('0')
        await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
        if (stage === 'teaching-calendar') {
          await host.locator('[name=model]').selectOption('current')
          await host.locator('[name=studySemester]').selectOption('semester-1')
          await host.locator('[name=calendarSemester]').selectOption('2026:autumn')
          await host.locator('[name=programCampus]').selectOption('Syntetisk campus')
          await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
        }
      }
    }
    await reached.promise
    await host.getByRole('button', { name: 'Avbryt henting', exact: true }).click()
    if (stage === 'teaching-calendar') await host.getByRole('button', { name: 'Tilbake til emnevalg', exact: true }).click()
    await catalogue(host, 'himolde'); await choosePlan(host)
    await expect(host.locator('[name=model]')).toContainText('Modell current')
    release.resolve(); await finished.promise
    await expect(host.locator('[name=institution]')).toHaveValue('himolde')
    await expect(host.locator('[name=program]')).toContainText('Syntetisk himolde current')
    await expect(host.locator('[name=model]')).toContainText('Modell current')
    await expect(host).not.toContainText('obsolete')
    await expect(host).not.toContainText('Syntetisk foreldet feil')
    await expect(host.locator('.program-action-status')).toBeHidden()
    expect(await saved(page)).toEqual(original)
  } finally { release.resolve() }
})

test('F02 changing programme at the same institution keeps the new cohort and plan when the old cohort arrives late', async ({ page }) => {
  const reached = deferred(), release = deferred(), finished = deferred()
  await mock(page, async (route, institution, action, query) => {
    if (action === 'programs') { await route.fulfill({ json: { status: 'ok', results: [plan(institution, 'a').program, plan(institution, 'b').program] } }); return true }
    if (action === 'program-cohorts') {
      const selected = query.get('program')
      if (selected === 'a') { reached.resolve(); await release.promise }
      try { await route.fulfill({ json: { status: 'ok', results: [{ cohort: '2026', label: `Kull for program ${selected}`, sourceUrl: source }] } }) } finally { if (selected === 'a') finished.resolve() }
      return true
    }
    if (action === 'program-plan') { await route.fulfill({ json: plan(institution, query.get('program')) }); return true }
  })
  try {
    const host = await start(page), original = await saved(page)
    await catalogue(host, 'uia')
    await host.locator('[name=program]').selectOption('0'); await reached.promise
    await host.getByRole('button', { name: 'Avbryt henting', exact: true }).click()
    await host.locator('[name=program]').selectOption('1')
    await host.locator('[name=cohort]').selectOption('0')
    await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
    await expect(host.locator('[name=model]')).toContainText('Modell b')
    release.resolve(); await finished.promise
    await expect(host.locator('[name=program]')).toHaveValue('1')
    await expect(host.locator('[name=cohort]')).toContainText('Kull for program b')
    await expect(host.locator('[name=cohort]')).not.toContainText('Kull for program a')
    await expect(host.locator('[name=model]')).toContainText('Modell b')
    expect(await saved(page)).toEqual(original)
  } finally { release.resolve() }
})
