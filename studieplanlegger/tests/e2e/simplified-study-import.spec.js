import { test, expect } from '@playwright/test'
import { instrumentWrites, key, navigate } from './helpers.js'

const sourceUrl = 'https://www.himolde.no/studier/programmer/it/studieplaner/2026.html'
const searchedCourseUrl = 'https://www.himolde.no/studier/emner/IBE999'
const course = (id, code, name, credits, choice = 'O') => ({
  id, code, name, credits, choice, university: 'Høgskolen i Molde', year: 2026,
  semester: 'autumn', sourceProvider: 'himolde', sourceRecordId: code,
  sourceVersion: '2026', sourceUrl, description: '', notes: `Kildeutdrag: Høst 2026; ${code} ${name}; ${credits} studiepoeng.`,
})

test('programme choice, missing course and partial teaching are committed once with an accurate receipt', async ({ page }, info) => {
  const ids = {
    ibe110: 'himolde:it:2026:1:IBE110', ibe430: 'himolde:it:2026:1:IBE430',
    ibe160: 'himolde:it:2026:1:IBE160', ibe102: 'himolde:it:2026:1:IBE102',
    ibe152: 'himolde:it:2026:1:IBE152',
  }
  let recoverFailures = false
  const teachingSearches = []
  const browserErrors = []
  await page.addInitScript(() => {
    const nativeTimeout = AbortSignal.timeout.bind(AbortSignal)
    AbortSignal.timeout = milliseconds => nativeTimeout(Math.min(milliseconds, 500))
  })
  page.on('pageerror', error => browserErrors.push(`page: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`) })
  await page.route('**/api/import/providers/himolde/**', async route => {
    const url = new URL(route.request().url()), action = url.pathname.split('/').at(-1), q = url.searchParams.get('q')
    let data
    if (action === 'programs') data = { results: [{ code: 'IT', name: 'Informasjonsteknologi', sourceUrl }], completeness: { complete: true } }
    else if (action === 'program-cohorts') data = { results: [{ cohort: '2026', sourceUrl }] }
    else if (action === 'program-plan') data = {
      program: { code: 'IT', name: 'Informasjonsteknologi', cohort: '2026', sourceUrl, campuses: [] },
      models: [{ id: 'common', name: 'Felles studieløp', periods: [{
        id: '1', label: '1. studiesemester · Høst 2026', studySemester: 1, year: 2026, semester: 'autumn',
        courses: [
          course(ids.ibe110, 'IBE110', 'Informasjonsteknologi', 7.5),
          course(ids.ibe430, 'IBE430', 'Databaser', 7.5),
          course(ids.ibe160, 'IBE160', 'Programmering', 15, 'V'),
          course(ids.ibe102, 'IBE102', 'Webutvikling', 7.5, 'V'),
          course(ids.ibe152, 'IBE152', 'Programmeringsgrunnlag', 7.5, 'V'),
        ],
        requiredCourseIds: [ids.ibe110, ids.ibe430],
        alternativeGroups: [{ id: '21-K2026-VALG', label: 'Programmeringsalternativ', sourceRequirement: 'Velg enten IBE160 eller IBE102 og IBE152.', options: [
          { id: '21-K2026-VV1', label: 'IBE160', courseIds: [ids.ibe160], credits: 15 },
          { id: '21-K2026-VV2', label: 'IBE102 og IBE152', courseIds: [ids.ibe102, ids.ibe152], credits: 15 },
        ] }],
      }] }], warnings: [],
    }
    else if (action === 'search') data = { results: [{ ...course('himolde:course-search:IBE999', 'IBE999', 'Studentavklart emne', 5, 'V'), sourceUrl: searchedCourseUrl }] }
    else if (action === 'teaching-search') {
      teachingSearches.push(q)
      if (q === 'IBE110') data = { results: [{ sourceObjectId: '110.1', label: 'IBE110 · Forelesning' }] }
      else if (!recoverFailures && q === 'IBE430') {
        await new Promise(resolve => setTimeout(resolve, 1_000))
        data = { results: [] }
      }
      else if (!recoverFailures && q === 'IBE999') data = { status: 'access-required', error: 'Krever tilgang' }
      else data = { results: [] }
    } else if (action === 'teaching-calendar') data = { calendarUrl: 'https://cloud.timeedit.net/himolde/web/publikk/test.ics', calendar: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:ibe110-1\r\nDTSTART:20260914T080000Z\r\nDTEND:20260914T100000Z\r\nSUMMARY:IBE110 Forelesning\r\nLOCATION:A-1\r\nEND:VEVENT\r\nEND:VCALENDAR', warnings: [] }
    else data = { status: 'not-supported', error: 'Uventet testkall' }
    await route.fulfill({ json: { status: 'ok', ...data } })
  })

  await page.goto('/')
  await instrumentWrites(page)
  await page.reload()
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  const host = page.locator('.program-import')
  await host.locator('[name=institution]').selectOption('himolde')
  await host.getByRole('button', { name: 'Hent studieprogram', exact: true }).click()
  await host.locator('[name=program]').selectOption('0')
  await host.locator('[name=cohort]').selectOption('0')
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await host.locator('[name=model]').selectOption('common')
  await host.locator('[name=studySemester]').selectOption('1')
  await host.locator('[name=calendarSemester]').selectOption('2026:autumn')
  await expect(host.locator('[name=programCampus]')).toBeHidden()

  await expect(host.getByRole('checkbox', { name: /IBE110.*Påkrevd/ })).toBeChecked()
  await expect(host.getByRole('checkbox', { name: /IBE430.*Påkrevd/ })).toBeChecked()
  await expect(host.getByRole('radio', { name: /IBE160/ })).not.toBeChecked()
  await expect(host.getByRole('checkbox', { name: /IBE160/ })).toHaveCount(0)
  await expect(host.getByRole('checkbox', { name: /IBE102/ })).toHaveCount(0)
  await host.getByRole('radio', { name: /IBE160/ }).check()
  await expect(host.getByText('Forbered og kontroller undervisning for 3 emner', { exact: true })).toBeVisible()
  await expect(host.getByRole('checkbox', { name: /IBE102|IBE152/ })).toHaveCount(0)
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await host.getByRole('button', { name: 'Avbryt henting', exact: true }).click()
  await expect(host.locator('.program-action-status')).toContainText('Hentingen er avbrutt. Valgene og lagrede data er beholdt.')
  await host.getByRole('button', { name: 'Tilbake til emnevalg', exact: true }).click()
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await expect(host.locator('.program-action-status')).toContainText('Undervisning er kontrollert', { timeout: 2_000 })
  await expect(host.locator('.import-preview article.course-card > h4')).toHaveText([
    'IBE110 Informasjonsteknologi', 'IBE430 Databaser', 'IBE160 Programmering',
  ])
  await expect(host.locator('.import-preview')).not.toContainText('IBE102 Webutvikling')
  await expect(host.locator('.import-preview')).not.toContainText('IBE152 Programmeringsgrunnlag')
  await host.getByRole('button', { name: 'Tilbake til emnevalg', exact: true }).click()
  const pairChoice = host.getByRole('radio', { name: /IBE102 og IBE152/ })
  await pairChoice.focus(); await pairChoice.press('Space')
  await expect(host.getByText('Forbered og kontroller undervisning for 4 emner', { exact: true })).toBeVisible()
  await expect(host.locator('.activity-choices .programme-source-excerpt')).toHaveCount(2)
  await expect(host.locator('.activity-choices .programme-source-excerpt').first()).not.toHaveAttribute('open', '')
  await page.setViewportSize({ width: 1440, height: 1000 })
  if (process.env.PW_CAPTURE_IMPORT_SCREENSHOTS === '1') await page.screenshot({ path: info.outputPath('study-import-choice-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  const largeChoiceText = await page.addStyleTag({ content: 'html { font-size: 150% !important; }' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (process.env.PW_CAPTURE_IMPORT_SCREENSHOTS === '1') await page.screenshot({ path: info.outputPath('study-import-choice-mobile-large-text.png'), fullPage: true })
  await largeChoiceText.evaluate(node => node.remove())
  await page.setViewportSize({ width: 1440, height: 1000 })

  const requiredCourse = host.getByRole('checkbox', { name: /IBE110.*Påkrevd/ })
  await requiredCourse.uncheck()
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await expect(host.locator('.program-action-status')).toContainText('Et emne som kilden oppgir som påkrevd, er valgt bort')
  expect(await page.evaluate(() => window.writeAttempts)).toEqual([])
  await requiredCourse.check()

  await host.getByText('Legg til et emne som mangler', { exact: true }).click()
  const manualCode = host.getByLabel('Emnekode', { exact: true }), manualName = host.getByLabel('Emnenavn', { exact: true }), manualCredits = host.getByLabel('Studiepoeng (valgfritt)', { exact: true })
  await manualCode.fill('IBE110'); await manualName.fill('Duplikat'); await manualCredits.fill('5')
  await host.getByRole('button', { name: 'Legg til uverifisert emne', exact: true }).click()
  await expect(host.locator(':scope > p[aria-live]').first()).toContainText('Emnekoden IBE110 finnes allerede i dette programutvalget')
  await manualCode.fill('IBE999'); await manualName.fill('Studentavklart emne'); await manualCredits.fill('-1')
  await host.getByRole('button', { name: 'Legg til uverifisert emne', exact: true }).click()
  await expect(host.locator(':scope > p[aria-live]').first()).toContainText('Studiepoeng må være et endelig tall som er null eller høyere')
  await host.getByLabel('Søk etter manglende emne', { exact: true }).fill('IBE999')
  await host.getByRole('button', { name: 'Søk i valgt periode', exact: true }).click()
  await host.getByRole('button', { name: /IBE999 Studentavklart emne/ }).click()
  await expect(host.getByRole('radio', { name: /IBE102 og IBE152/ })).toBeChecked()
  await expect(host.getByRole('checkbox', { name: /IBE999.*Lagt til fra emnesøk/ })).toBeChecked()
  await page.reload()
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  await expect(host.locator(':scope > p[aria-live]').first()).toContainText('påbegynte programvalget er gjenopprettet')
  await expect(host.getByRole('radio', { name: /IBE102 og IBE152/ })).toBeChecked()
  await expect(host.getByRole('checkbox', { name: /IBE999.*Lagt til fra emnesøk/ })).toBeChecked()
  await host.getByRole('button', { name: 'Forhåndsvis valgte emner', exact: true }).click()
  await expect(host.locator('.program-action-status')).toContainText(/Forbereder|Kontrollerer/)
  await expect(host.locator('.program-action-status')).toContainText('Undervisning er kontrollert', { timeout: 2_000 })
  await expect(host.getByText('Lagt til fra separat emnesøk. Ikke dokumentert av programkilden.')).toBeVisible()
  await expect(host.getByRole('link', { name: 'Kilde for emnet', exact: true })).toHaveAttribute('href', searchedCourseUrl)
  expect(await page.evaluate(() => window.writeAttempts)).toEqual([])
  await page.setViewportSize({ width: 1440, height: 1000 })
  if (process.env.PW_CAPTURE_IMPORT_SCREENSHOTS === '1') await page.screenshot({ path: info.outputPath('study-import-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addStyleTag({ content: 'html { font-size: 150% !important; }' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  if (process.env.PW_CAPTURE_IMPORT_SCREENSHOTS === '1') await page.screenshot({ path: info.outputPath('study-import-mobile-large-text.png'), fullPage: true })

  await expect(host.getByText(/IBE110/).locator('..')).toBeTruthy()
  await expect(host.getByText('Undervisning: Valg tilgjengelig – velg riktig timeplan', { exact: true })).toHaveCount(1)
  await expect(host.getByText(/Undervisning: Kunne ikke hentes/)).toHaveCount(1)
  await expect(host.getByText(/Undervisning: Krever tilgang/)).toHaveCount(1)
  await expect(host.getByText('Undervisning: Ingen samsvarende timeplan funnet', { exact: true })).toHaveCount(2)

  const beforeRetry = teachingSearches.length
  recoverFailures = true
  const retry = host.getByRole('button', { name: 'Prøv mislykkede undervisningskilder på nytt', exact: true })
  await retry.click()
  await expect(retry).toBeHidden()
  await expect(host.getByRole('button', { name: 'Bekreft programimport', exact: true })).toBeFocused()
  expect(teachingSearches.slice(beforeRetry).sort()).toEqual(['IBE430', 'IBE999'])
  await expect(host.locator('.import-preview')).not.toContainText('IBE430: undervisning kunne ikke hentes')
  await expect(host.locator('.import-preview')).not.toContainText('IBE999: undervisning kunne ikke hentes')
  await host.getByLabel('Timeplanobjekt for IBE110', { exact: true }).selectOption('0')
  await host.getByRole('button', { name: 'Hent valgt timeplan for IBE110', exact: true }).click()
  await host.locator('summary').filter({ hasText: /Undervisningsgrupper for IBE110/ }).click()
  await host.getByRole('group', { name: 'Undervisningsgrupper for IBE110', exact: true }).getByRole('checkbox').first().check()
  await page.evaluate(() => { window.failWrite = true })
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).click()
  await expect(host.locator('.program-action-status')).toContainText('Kunne ikke lagre. Tidligere data og utkast er beholdt.')
  await expect(host.getByRole('button', { name: 'Bekreft programimport', exact: true })).toBeVisible()
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key))?.planner?.courses?.length ?? 0, key)).toBe(0)
  await page.evaluate(() => { window.failWrite = false })
  await host.getByRole('button', { name: 'Bekreft programimport', exact: true }).evaluate(button => { button.click(); button.click() })

  await expect(host.locator('.program-action-status')).toContainText('5 emner er lagret samlet. 1 undervisningshendelse ble importert fra 1 emne; 4 emner har ingen importert undervisning.')
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key)
  expect(saved.planner.courses.map(item => item.code).sort()).toEqual(['IBE102', 'IBE110', 'IBE152', 'IBE430', 'IBE999'])
  expect(saved.planner.events).toHaveLength(1)
  expect(saved.planner.courses.find(item => item.code === 'IBE999')).toMatchObject({ programmeEvidence: 'course-search', sourceUrl: searchedCourseUrl, programBinding: { choice: 'student-added' } })
  expect(saved.planner.courses.find(item => item.code === 'IBE999').manualUnverified).toBe(false)
  expect(await page.evaluate(() => sessionStorage.getItem('studieplanlegger:program-import-draft:v1'))).toBeNull()
  expect(await page.evaluate(() => window.writeAttempts.length)).toBe(2)
  await page.locator('.contextual-undo').getByRole('button', { name: 'Angre siste endring', exact: true }).click()
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key))?.planner?.courses?.length ?? 0, key)).toBe(0)
  await page.reload()
  await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  await expect(host.locator(':scope > p[aria-live]').first()).not.toContainText('påbegynte programvalget er gjenopprettet')
  expect(browserErrors).toEqual([])
})
