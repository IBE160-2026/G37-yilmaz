import { load, clean, fail, cachedText, restrictedUrl, asCredits } from './program-source.js'

const origin = 'https://www.bi.no'
const catalogue = `${origin}/api/study-search/?lang=no`
const programmePath = /^\/(?:studier-og-kurs|en\/programmes-and-individual-courses)\/(?:[a-zA-Z0-9-]+\/){1,5}$/
const programmeUrl = input => restrictedUrl(input, { origin, paths: [programmePath] })
const catalogueUrl = input => {
  const url = restrictedUrl(input, { origin, paths: [/^\/api\/study-search\/$/], keys: ['lang'] })
  if (url.searchParams.get('lang') !== 'no') fail('invalid-selection', 'Velg BIs publiserte norske programkatalog.')
  return url
}
const text = value => clean(value).replace(/\(-\)/g, '')
const levels = new Set(['Bachelor', 'Master', 'OneYearProgrammes', 'PhD'])
const levelNames = { Bachelor: 'Bachelor', Master: 'Master', OneYearProgrammes: 'Årsstudium', PhD: 'Ph.d.' }

// The public study-search client requests this endpoint without pagination. Its
// count can exceed the returned rows; that discrepancy must remain visible.
export function parseBiCatalogue(body) {
  let data
  try { data = JSON.parse(body) } catch { fail('source-changed', 'BIs programkatalog returnerte ikke lesbare programdata.') }
  if (!Array.isArray(data.results) || data.results.length > 5000 || !Number.isInteger(data.count) || data.count < 0) fail('source-changed', 'BIs programkatalog har endret format.')
  const results = new Map(), warnings = []
  for (const row of data.results) {
    if (!row.programmeData?.levels?.some(level => levels.has(level))) continue
    if (!/^\d+$/.test(String(row.contentId)) || !text(row.title)) fail('source-changed', 'Et BI-program mangler navn eller stabil kilde-ID.')
    const sourceUrl = programmeUrl(row.url).href
    results.set(sourceUrl, { code: String(row.contentId), name: text(row.title), level: row.programmeData.levels.filter(level => levels.has(level)).map(level => levelNames[level]).join(' / '), sourceUrl, campuses: Array.isArray(row.programmeData.campuses) ? row.programmeData.campuses.filter(value => typeof value === 'string').map(text) : [] })
  }
  const complete = data.count === data.results.length
  if (!complete) warnings.push(`BI oppgir ${data.count} program- og kurstreff, men returnerer ${data.results.length}. Den publiserte søkeklienten tilbyr ikke flere sider for dette endepunktet; listen er derfor ikke bekreftet fullstendig.`)
  warnings.push('Listen viser kildens programnivåer, inkludert retninger og årsstudier. En oppføring bekrefter ikke at programmet har en lesbar semesterplan. Enkeltkurs uten programnivå er utelatt.')
  return { status: 'ok', results: [...results.values()], warnings, completeness: { complete, pages: 1, returned: results.size, sourceReturned: data.results.length, sourceTotal: data.count, ...(!complete ? { reason: 'Kildens totalantall avviker fra det returnerte utvalget.' } : {}) } }
}

export function parseBiProgram(html, query, program) {
  if (query.cohortFromStudent !== 'true' || !/^\d{4}$/.test(String(query.cohort)) || +query.cohort < 1900 || +query.cohort > 2200) fail('invalid-selection', 'Oppgi ditt opptakskull. BIs gjeldende oppbygging bekrefter ikke historiske kull.')
  const $ = load(html), models = [], sourceEdition = 'current-public'
  $('.cm_course-model').each((modelIndex, node) => {
    const block = $(node), periods = [], lead = clean(block.find('.cm_lead-text').text())
    block.find('.cm_yearHeader').each((_i, header) => {
      const match = clean($(header).text()).match(/^(\d+)\.?\s*(?:År|Year)$/i)
      if (!match || +match[1] < 1 || +match[1] > 20) fail('source-changed', 'BIs plan har et studieår som ikke kan tolkes sikkert.')
      const terms = $(header).parent().find('.cm_termHeader')
      if (!terms.length || terms.length > 2) fail('source-changed', 'BIs studieår har ingen entydig semesterinndeling.')
      terms.each((termIndex, heading) => {
        const label = clean($(heading).text()), semester = /^(Høst|Autumn|Fall)$/i.test(label) ? 'autumn' : /^(Vår|Spring)$/i.test(label) ? 'spring' : null
        if (!semester) fail('source-changed', 'BIs plan har et semester som krever en annen tolkning enn den publiserte modellen.')
        const studySemester = (+match[1] - 1) * 2 + termIndex + 1
        if (periods.some(period => period.studySemester === studySemester)) fail('source-changed', 'BIs plan gjentar samme studiesemester.')
        const period = { id: String(studySemester), studySemester, label: `${studySemester}. studiesemester · ${label} · avklar kalenderår`, year: null, semester, courses: [], requirements: lead ? [lead] : [] }
        $(heading).parent().find('.cm_course > li').each((_i, row) => {
          const item = $(row), links = item.find('a.cm_course-link[href]'), notes = [clean(item.text()), ...item.find('[data-tooltip]').map((_i, node) => clean($(node).attr('data-tooltip'))).get()].filter(Boolean).join(' ')
          if (!links.length) { if (notes) period.requirements.push(notes); return }
          for (const node of links.toArray()) {
            const link = $(node), url = restrictedUrl(new URL(link.attr('href'), program.sourceUrl), { origin, paths: [/^\/(?:studier-og-kurs\/kursbeskrivelser|en\/programmes-and-individual-courses\/course-descriptions)\/$/], keys: ['subjectCode', 'courseNumber'] })
            const subject = url.searchParams.get('subjectCode'), number = url.searchParams.get('courseNumber')
            if (!/^[A-ZÆØÅ]{2,10}$/.test(subject || '') || !/^\d{3,6}[A-Z]?$/.test(number || '') || !clean(link.text())) fail('source-changed', 'Et BI-emne mangler entydig emnekode eller navn.')
            const code = `${subject}${number}`, credits = clean(item.find('.cm_credits').first().text()).match(/^(\d+(?:[.,]\d+)?)\s*(?:stp|ECTS|credits)\b/i)
            const candidate = { id: `bi-program:${program.code}:${query.cohort}:${studySemester}:${code}`, code, name: clean(link.text()), credits: credits ? asCredits(credits[1]) : null, choice: '', sourceProvider: 'bi-program', sourceRecordId: code, sourceVersion: sourceEdition, sourceUrl: url.href, university: 'BI', description: '', notes: `Gjeldende publisert oppbygging, ikke en bekreftet kullversjon. ${notes}`, year: null, semester, campus: '' }
            const duplicate = period.courses.find(course => course.code === code)
            if (duplicate) {
              if (['name', 'credits', 'sourceUrl'].some(key => duplicate[key] !== candidate[key])) fail('source-changed', 'BIs plan har motstridende opplysninger for samme emnekode i ett semester.')
              continue
            }
            period.courses.push(candidate)
          }
        })
        periods.push(period)
      })
    })
    if (periods.some(period => period.courses.length)) models.push({ id: `current-${modelIndex + 1}`, name: `Gjeldende oppbygging${modelIndex ? ` ${modelIndex + 1}` : ''} · kontroller mot ditt kull`, periods })
  })
  if (!models.length) fail('not-supported', 'BI-programmet har ingen lesbar semesterplan i den publiserte modellen. Programoppføringen alene er ikke programimport; bruk den lenkede studieplanen eller dokumentimport.')
  const warnings = ['BIs plan er gjeldende publisert oppbygging. Ditt opptakskull er oppgitt av deg og ikke verifisert som planversjon. Kontroller at oppbyggingen gjelder deg.', 'Velg kalenderår uttrykkelig. Deltid, semesteralternativer og valgkurs må avklares fra din egen studieplan; ingen valgemner eller campus velges automatisk.', 'Emner som går over flere semestre beholdes med hver publiserte plassering. Et gjentatt emne eller null studiepoeng betyr ikke at emnet er fullført.', 'Undervisningskalender og personlige grupper er ikke hentet fra denne programkilden.']
  return { status: 'ok', program: { ...program, cohort: String(query.cohort), cohortFromStudent: true, sourceEdition }, models, warnings, completeness: { complete: false, pages: 1, returned: models.reduce((count, model) => count + model.periods.reduce((n, period) => n + period.courses.length, 0), 0), reason: 'Gjeldende semesteroppbygging publiserer ikke en bekreftet kullversjon eller alle valgkurs.' } }
}

export async function biPrograms(institution, action, query, { fetchText }) {
  const data = parseBiCatalogue(await cachedText(fetchText, catalogue, catalogueUrl))
  if (action === 'programs') {
    const q = clean(query.q).toLocaleLowerCase('nb')
    return { ...data, results: data.results.filter(program => !q || `${program.code} ${program.name}`.toLocaleLowerCase('nb').includes(q)) }
  }
  const selectedUrl = programmeUrl(query.sourceUrl).href, selected = data.results.find(program => program.code === query.program && program.sourceUrl === selectedUrl)
  if (!selected) fail('invalid-selection', 'Det valgte BI-programmet finnes ikke med samme ID og lenke i den publiserte katalogen.')
  const guard = input => { const url = programmeUrl(input); if (url.href !== selectedUrl) fail('invalid-selection', 'BI videresendte til en annen programkilde.'); return url }
  const html = await cachedText(fetchText, selectedUrl, guard)
  if (action === 'program-cohorts') {
    if (!load(html)('.cm_course-model .cm_termHeader').length) fail('not-supported', 'Dette BI-programmet har ingen støttet publisert semesterplan. Åpne programkilden eller bruk dokumentimport.')
    return { status: 'ok', results: [{ cohort: 'student', requiresStudentCohort: true, label: 'Gjeldende oppbygging – oppgi ditt opptakskull', sourceUrl: selectedUrl }], warnings: ['BI oppgir ikke en kulliste for denne oppbyggingen. Opptaksterminer er ikke bevis på at studieplanen er versjonert for samme kull.'], completeness: { complete: false, pages: 1, returned: 0, reason: 'Kull må oppgis av studenten.' } }
  }
  if (action !== 'program-plan') fail('not-supported', 'Denne BI-handlingen er ikke støttet.')
  return parseBiProgram(html, query, selected)
}
