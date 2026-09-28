import { test, expect } from '@playwright/test'
import { navigate, key } from './helpers.js'

const codes = ['IBE110', 'IBE430', 'IBE160']
const sourceIds = Object.fromEntries(codes.map(code => [code, `${code}¤1`]))

async function choose(control, predicate) {
  await expect.poll(() => control.locator('option').count(), { timeout: 120_000 }).toBeGreaterThan(1)
  const options = await control.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, label: node.textContent.trim() })))
  const selected = options.find(option => option.value && predicate(option.label))
  expect(selected, JSON.stringify(options)).toBeTruthy()
  await control.selectOption(selected.value)
  return selected
}

test('live HiMolde IT 2026 programme hands IBE110, IBE430 and IBE160 to teaching import', async ({ page }, testInfo) => {
  test.skip(process.env.RUN_LIVE_TEACHING !== '1', 'Opt-in bounded programme and public teaching requests')
  test.setTimeout(180_000)
  page.setDefaultTimeout(30_000)
  const observed = { searches: [], calendars: [] }
  page.on('response', async response => {
    const url = new URL(response.url())
    if (!url.pathname.includes('/api/import/providers/himolde/teaching-')) return
    if (url.pathname.endsWith('/teaching-search')) observed.searches.push(url.searchParams.get('q'))
    if (url.pathname.endsWith('/teaching-calendar') && response.ok()) {
      const data = await response.json().catch(() => null)
      if (data?.selected) observed.calendars.push(data.selected.sourceObjectId)
    }
  })
  await page.goto('/')
  await page.evaluate(storageKey => localStorage.setItem(storageKey, JSON.stringify({ schemaVersion: 1, tasks: [], planner: { courses: [], events: [], sources: [] } })), key)
  await page.reload()
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption('himolde')
  await host.locator('[name=programQuery]').fill('it')
  await host.locator('[name=catalogueYear]').fill('2026')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await choose(host.locator('[name=program]'), label => /^it\s*·/i.test(label))
  await choose(host.locator('[name=cohort]'), label => /2026/.test(label))
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await choose(host.locator('[name=model]'), () => true)
  await choose(host.locator('[name=studySemester]'), label => /høst 2026/i.test(label))
  if (await host.locator('[name=clarifiedStudySemester]').isVisible()) {
    const allowed = await host.locator('[name=clarifiedStudySemester]').getAttribute('data-allowed')
    await host.locator('[name=clarifiedStudySemester]').fill(allowed?.split(',')[0] || '1')
  }
  if (await host.locator('[name=calendarSemester]').isVisible()) await choose(host.locator('[name=calendarSemester]'), label => /høst 2026/i.test(label))
  if (await host.locator('[name=programCampus]').isVisible()) await choose(host.locator('[name=programCampus]'), () => true)
  await expect(host.getByRole('checkbox', { name: /IBE110.*Påkrevd/ })).toBeChecked()
  await expect(host.getByRole('checkbox', { name: /IBE430.*Påkrevd/ })).toBeChecked()
  await host.getByRole('radio', { name: /IBE160/ }).check()
  await expect(host.getByText('Forbered og kontroller undervisning for 3 emner', { exact: true })).toBeVisible()
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await expect(host.getByRole('button', { name: 'Bekreft programimport', exact: true })).toBeVisible({ timeout: 120_000 })

  for (const code of codes) {
    const card = host.locator('.import-preview article.course-card').filter({ hasText: new RegExp(`^${code}\\b`) }).first()
    await expect(card).toBeVisible()
    const choice = card.getByLabel(`Timeplanobjekt for ${code}`, { exact: true })
    await expect(choice).toBeVisible({ timeout: 60_000 })
    const options = await choice.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, label: node.textContent })))
    const selected = options.find(option => option.value && option.label.includes(code))
    expect(selected, JSON.stringify(options)).toBeTruthy()
    await choice.selectOption(selected.value)
    await expect(card.getByRole('button', { name: `Hent valgt timeplan for ${code}`, exact: true })).toBeEnabled()
    await card.getByRole('button', { name: `Hent valgt timeplan for ${code}`, exact: true }).click()
    await card.locator('summary').filter({ hasText: new RegExp(`(Undervisningsgrupper|Aktivitetsutvalg) for ${code}`) }).click()
    const groups = card.getByRole('group', { name: new RegExp(`(Undervisningsgrupper|Aktivitetsutvalg) for ${code}`) })
    await expect(groups.getByRole('checkbox').first()).toBeVisible({ timeout: 60_000 })
    await card.getByRole('button', { name: 'Velg ingen aktiviteter', exact: true }).click()
    await groups.getByRole('checkbox').first().check()
  }

  expect(new Set(observed.searches.filter(Boolean))).toEqual(new Set(codes))
  expect(new Set(observed.calendars)).toEqual(new Set(Object.values(sourceIds)))
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  await expect(host.getByRole('status')).toContainText(/3 emner er lagret samlet/i)
  const first = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key)
  expect(first.planner.courses.map(course => course.code).sort()).toEqual([...codes].sort())
  expect(first.planner.courses.every(course => course.programBinding?.institution === 'himolde' && course.teachingCheck?.status === 'success')).toBe(true)
  expect(first.planner.sources).toHaveLength(3)
  expect(first.planner.events.length).toBeGreaterThanOrEqual(3)
  expect(first.planner.events.every(event => first.planner.courses.some(course => course.id === event.courseId))).toBe(true)
  for (const code of codes) {
    const course = first.planner.courses.find(item => item.code === code)
    const visibleEvents = first.planner.events.filter(event => event.courseId === course.id && !event.excluded)
    expect(visibleEvents.length).toBeGreaterThan(0)
  }
  await expect(page.locator('#event-list .event-card')).toHaveCount(first.planner.events.filter(event => !event.excluded).length)
  const calendarSamples=codes.map(code=>{const course=first.planner.courses.find(item=>item.code===code);return first.planner.events.find(event=>event.courseId===course.id&&!event.excluded)})
  await navigate(page,'calendar')
  await page.locator('[data-calendar-view=agenda]').click()
  await page.locator('#full-calendar-date').fill(calendarSamples.map(event=>event.start.slice(0,10)).sort()[0])
  for(const event of calendarSamples)await expect.poll(()=>page.locator('[data-calendar-key]').evaluateAll(nodes=>nodes.map(node=>node.dataset.calendarKey))).toContain(`event:${event.id}`)
  const identities = first.planner.events.map(event => event.id)
  await page.reload()
  const reloaded = await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)), key)
  expect(reloaded.planner.events.map(event => event.id)).toEqual(identities)
  expect(reloaded.planner.courses).toHaveLength(3)
  expect(reloaded.planner.sources).toHaveLength(3)
  await testInfo.attach('himolde-program-teaching-evidence', { contentType: 'application/json', body: JSON.stringify({ checkedAt: new Date().toISOString(), observed, courses: reloaded.planner.courses.map(course => ({ code: course.code, id: course.id, sourceRecordId: course.sourceRecordId, programBinding: course.programBinding, teachingCheck: course.teachingCheck })), sources: reloaded.planner.sources.map(source => ({ id: source.id, courseId: source.courseId, groups: source.groups })), eventIds: identities, scope: 'Actual IT 2026 programme selection and programme-to-teaching handoff for all three courses, one explicit activity choice per course, save and reload. Repeated teaching import identity is covered by the direct live HiMolde cases.' }, null, 2) })
})
