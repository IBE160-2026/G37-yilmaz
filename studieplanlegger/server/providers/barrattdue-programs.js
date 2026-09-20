import { load, clean, fail, cachedText, restrictedUrl, collectPages, asCredits } from './program-source.js'
import { sourceEdition, studentCohort, textWithSpaces } from './current-program-source.js'

const origin = 'https://barrattdue.no', catalogue = `${origin}/studier/hoyere-utdanning/`
export const barrattdueProgramUrl = input => restrictedUrl(input, { origin, paths: [/^\/studier(?:\/[a-z\d_-]+)+\/?$/], keys: ['page'] })
const planPath = /\/(studieplan(?:-[a-z\d-]+)?)\/?$/
function programRef(input) {
  const url = barrattdueProgramUrl(input)
  if (!planPath.test(url.pathname) || url.search) fail('invalid-selection', 'Velg en publisert Barratt Due-studieplan fra listen.')
  return { url, code: url.pathname.replace(/^\/studier\//, '').replace(/\/$/, '') }
}
function courseUrl(input) {
  const url = new URL(input.href || input)
  if (url.origin === 'https://student.nmh.no') return restrictedUrl(url, { origin: url.origin, paths: [/^\/studiehandboker\/startkull-\d{4}\/emner\/[^/]+\/?$/] })
  return barrattdueProgramUrl(url)
}
const creditsFromCard = text => { const match = clean(text).match(/^(\d+(?:[.,]\d+)?)\.?\s*stp\.?$/i); return match ? asCredits(match[1]) : null }
function sourceCourse({ program, year, code, name, credits, url, edition, notes, choice = '' }) {
  const recordId = `${url.hostname}${decodeURIComponent(url.pathname).replace(/\/$/, '')}`
  return { id: `barrattdue:${program}:${year}:${recordId}`, code, name, credits, choice, sourceProvider: 'barrattdue', sourceRecordId: recordId, sourceVersion: edition, sourceUrl: url.href, university: 'Barratt Due musikkinstitutt', description: '', notes, year: null, semester: null, campus: '', requiresSemesterChoice: true }
}
export function parseBarrattduePlan(html, query) {
  const source = programRef(query.sourceUrl), cohort = studentCohort(query), $ = load(html), name = clean($('main h1').first().text()), edition = sourceEdition(html), periods = [], warnings = [], electiveUrls = new Set()
  if (!name || source.code !== query.program) fail('invalid-selection', 'Programvalget stemmer ikke med Barratt Due-kilden.')
  const prior = clean($('main').text()).match(/For studenter som startet[^.]*?før\s+(20\d{2})/i)?.[1]
  if (prior && +cohort < +prior) fail('not-supported', `Kilden henviser studenter med oppstart før ${prior} til tidligere studieplaner. Velg riktig eldre plan i dokumentimport; gjeldende plan er ikke bekreftet for kullet ditt.`)
  $('main details').each((_, detail) => {
    const heading = clean($(detail).children('summary').find('h4').first().text()), match = heading.match(/^(\d{1,2})\.\s*studieår$/i)
    if (!match) return
    const studyYear = +match[1]
    if (!studyYear || studyYear > 20) fail('source-changed', 'Årsgruppen overskrider importgrensen.')
    const period = { id: `year-${studyYear}`, studySemester: null, requiresStudentStudySemester: true, allowedStudySemesters: [studyYear * 2 - 1, studyYear * 2], year: null, semester: null, label: `${heading} · velg studiesemester og kalendersemester`, courses: [], requirements: [`Kilden oppgir ${heading}, uten semesterfordeling. Velg ${studyYear * 2 - 1}. eller ${studyYear * 2}. studiesemester og bare emnene du faktisk følger da. Studiepoengene gjelder hele emnet.`], electiveUrls: [] }
    $(detail).find('.topic-item').filter((_, item) => $(item).closest('details')[0] === detail).each((_, item) => {
      const title = clean($(item).find('h5').first().text()), href = $(item).find('h5 a[href]').first().attr('href'), code = clean($(item).find('.topic-code').text()), credits = creditsFromCard($(item).find('.topic-points').text())
      if (!title || !href) fail('source-changed', 'Et publisert emnekort mangler navn eller kildehenvisning.')
      const url = courseUrl(new URL(href, source.url)), excerpt = `${title}${code ? ` · ${code}` : ''}${credits !== null ? ` · ${credits} studiepoeng` : ' · studiepoeng ikke oppgitt'}`
      if (/^valg(?:emne|fag)(?:\s|$)/i.test(title)) { period.requirements.push(`Velg faktiske emner til denne plassen: ${excerpt}.`); electiveUrls.add(url.href); period.electiveUrls.push(url.href); return }
      if (code && !/^[\p{L}\d._-]+$/u.test(code)) fail('source-changed', 'Emnekodefeltet har et ukjent format.')
      const linkedCohort = url.pathname.match(/\/startkull-(\d{4})\//)?.[1]
      const notes = `Kildeutdrag fra ${heading}: ${excerpt}.${linkedCohort ? ` Emnelenken hos NMH viser startkull ${linkedCohort}; kontroller at emneutgaven gjelder din plan.` : ''} Semesterplassering, undervisning og instrumentgruppe er ikke bestemt av årsoversikten.`
      const course = sourceCourse({ program: source.code, year: studyYear, code, name: title, credits, url, edition: 'current', notes, choice: $(item).find('.indicator').length ? 'V' : '' })
      if (!period.courses.some(existing => existing.sourceRecordId === course.sourceRecordId)) period.courses.push(course)
    })
    if (period.courses.length || period.electiveUrls.length) periods.push(period)
  })
  if (!periods.length) {
    const revision = clean($('main').text()).match(/Studieprogrammet er under revisjon[^.]*\./i)?.[0]
    fail('not-supported', revision ? `${revision} Ingen emnetabell er publisert i denne planen. Bruk dokumentimport når en oppdatert plan foreligger.` : 'Ingen støttet offentlig års- og emnetabell ble funnet. Bruk dokumentimport for eldre eller annerledes organiserte studieplaner.')
  }
  warnings.push('Emnekode, navn og studiepoeng kommer fra den publiserte årsoversikten. Opptakskull, studiesemester og kalenderperiode avklares av studenten; årsoversikten bekrefter ikke disse koblingene.', 'Valgfrie plassholdere blir kravtekst. Bare konkrete valgemner fra en publisert tilbudsliste kan velges, med egen årgang og instrumentgruppe. Ingen valgemner, instrumentgruppe eller undervisning forhåndsvelges.')
  return { status: 'ok', program: { code: source.code, name, cohort, cohortFromStudent: true, sourceEdition: edition, sourceUrl: source.url.href, campuses: [] }, models: [{ id: 'published-annual', name: 'Publisert årsoversikt · semester avklares av studenten', periods }], warnings, completeness: { complete: true, pages: 1, returned: periods.reduce((count, period) => count + period.courses.length, 0), scope: 'Publiserte emnekort per studieår; semesterfordeling, undervisning og kullarkiv inngår ikke.' }, electiveUrls: [...electiveUrls] }
}
export function parseBarrattdueElectives(html, sourceUrl) {
  const $ = load(html), offerings = new Map()
  $('main h3').each((_, heading) => {
    const match = clean($(heading).text()).match(/^(?:Valgemner\s+)?(20\d{2})\s*[–—-]\s*(20\d{2})$/i)
    if (!match || +match[2] !== +match[1] + 1) return
    const edition = `${match[1]}-${match[2]}`, historical = !/^Valgemner/i.test(clean($(heading).text())), container = historical ? $(heading).next('.accordion-content').find('.inner').first() : $(heading).parent()
    if (!container.length) return
    let group = historical ? `Tidligere valgemneportefølje ${edition} · studieretning må kontrolleres` : 'Publiserte valgemner'
    container.children().each((_, block) => {
      if (block.tagName === 'h4') { group = clean($(block).text()); return }
      if (block.tagName !== 'ul') return
      $(block).find('a[href]').each((_, anchor) => {
        const label = textWithSpaces($, anchor), parts = label.match(/^([A-ZÆØÅ\d._-]+)\s*[–—-]\s*(.+)$/)
        if (!parts) fail('source-changed', 'Valgemnelisten har en lenke uten lesbar emnekode og navn.')
        const url = courseUrl(new URL($(anchor).attr('href'), sourceUrl)), credits = parts[2].match(/\((\d+(?:[.,]\d+)?)\s*stp\.?\)/i), name = clean(parts[2].replace(/\(\d+(?:[.,]\d+)?\s*stp\.?\)/i, ''))
        const course = sourceCourse({ program: 'valgemner', year: edition, code: parts[1], name, credits: credits ? asCredits(credits[1]) : null, url, edition, choice: 'V', notes: `Kildeutdrag fra tilbud ${edition}: ${group}. ${label}. Tilbudet gjelder studieåret ${edition}; kontroller tildeling, instrument og eventuell søknad før du velger emnet.`, }), key = `${edition}:${course.sourceRecordId}`
        course.allowedCalendarPeriods = [{ year: +match[1], semester: 'autumn' }, { year: +match[2], semester: 'spring' }]; course.courseGroup = `${group} · ${edition}`
        const previous = offerings.get(key)
        if (previous) { previous.courseGroup += ` / ${group}`; previous.notes += ` Også oppført under ${group}.` }
        else offerings.set(key, course)
      })
    })
  })
  if (!offerings.size) fail('source-changed', 'Ingen lesbar, datert valgemneportefølje ble funnet.')
  return [...offerings.values()]
}
export async function barrattduePrograms(institution, action, query, { fetchText }) {
  if (action === 'programs') {
    const pending = [catalogue], visited = new Set(), results = new Map(), warnings = []; let complete = true
    while (pending.length) {
      const current = pending.shift(); if (visited.has(current)) continue
      if (visited.size >= 40) { complete = false; warnings.push('Katalogen har over 40 lenkede kategorisider. Resten er ikke hentet.'); break }
      visited.add(current)
      try {
        const page = await collectPages(current, fetchText, barrattdueProgramUrl, ($, source) => ({ results: $('main a.button-medium[href]').map((_, anchor) => {
          let url; try { url = barrattdueProgramUrl(new URL($(anchor).attr('href'), source)) } catch { return null }
          const label = clean($(anchor).text()), name = /^Studieplan$/i.test(label) ? `Studieplan · ${clean($('main h1').first().text())}` : label
          return name ? { sourceUrl: url.href, name } : null
        }).get().filter(Boolean) }))
        complete &&= page.completeness.complete; warnings.push(...page.warnings)
        for (const link of page.results) {
          if (planPath.test(new URL(link.sourceUrl).pathname)) { const ref = programRef(link.sourceUrl); results.set(ref.code, { code: ref.code, name: link.name, sourceUrl: ref.url.href, campuses: [] }) }
          else if (!visited.has(link.sourceUrl)) pending.push(link.sourceUrl)
        }
      } catch (error) { if (error.name === 'AbortError') throw error; complete = false; warnings.push(`Katalogdelen ${current} kunne ikke hentes: ${error.message}`) }
    }
    if (!results.size) fail('source-changed', 'Ingen publiserte studieplanlenker ble funnet i Barratt Due-katalogen.')
    const q = clean(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', results: [...results.values()].filter(item => !q || `${item.code} ${item.name}`.toLocaleLowerCase('nb').includes(q)), warnings: [...warnings, 'Listen følger de publiserte studietilbuds- og studieplanlenkene. En plan under revisjon kan mangle importbare emner.'], completeness: { complete, pages: visited.size, returned: results.size, scope: 'Alle studieplanlenker i katalogens publiserte tilbudsknapper og eventuell paginering.' } }
  }
  const source = programRef(query.sourceUrl), html = await cachedText(fetchText, source.url.href, barrattdueProgramUrl)
  if (source.code !== query.program) fail('invalid-selection', 'Programlenken stemmer ikke med valgt studieplan.')
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: 'current', label: 'Gjeldende årsoversikt · oppgi eget opptakskull', sourceUrl: source.url.href, requiresStudentCohort: true }], warnings: ['Kilden har årsoversikter og henviser eldre studenter til egne tidligere studieplaner. Kontroller at denne versjonen gjelder deg.'], completeness: { complete: false, pages: 1, returned: 1, scope: 'Gjeldende årsoversikt; ikke et komplett kullarkiv.' } }
  if (action !== 'program-plan') fail('not-supported', 'Handlingen støttes ikke av Barratt Due-programkilden.')
  const plan = parseBarrattduePlan(html, query)
  for (const url of plan.electiveUrls) {
    try {
      const offerings = parseBarrattdueElectives(await cachedText(fetchText, url, barrattdueProgramUrl), url)
      for (const period of plan.models[0].periods.filter(period => period.electiveUrls.includes(url))) period.courses.push(...offerings.map(course => ({ ...course, id: `barrattdue:${source.code}:${period.id}:${course.id}` })))
      plan.completeness.pages++; plan.completeness.returned += offerings.length
    } catch (error) { if (error.name === 'AbortError') throw error; plan.completeness.complete = false; plan.warnings.push(`Den lenkede valgemneporteføljen kunne ikke hentes eller tolkes (${error.message}). Årsoversiktens øvrige emner er bevart; valgemneplassene må avklares separat.`) }
  }
  delete plan.electiveUrls
  for (const period of plan.models[0].periods) delete period.electiveUrls
  plan.completeness.returned = plan.models[0].periods.reduce((count, period) => count + period.courses.length, 0)
  return plan
}
