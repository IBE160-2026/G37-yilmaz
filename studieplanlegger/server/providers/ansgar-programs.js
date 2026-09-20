import { load, clean, fail, cachedText, restrictedUrl, periodLabel } from './program-source.js'
import { studentCohort, sourceEdition, coursesFromLinks, textWithSpaces } from './current-program-source.js'

const origin = 'https://www.ansgarhoyskole.no', sourceUrl = `${origin}/student/kalender`
export function ansgarProgramUrl(input) {
  const url = new URL(input.href || input)
  if (url.origin === 'https://ansgarhoyskole.no') url.hostname = 'www.ansgarhoyskole.no'
  return restrictedUrl(url, { origin, paths: [/^\/student\/kalender\/?$/, /^\/[a-z]{2,}\d{3,4}(?:[-a-z\d]+)*\/?$/i] })
}
const courseUrl = input => { const url = ansgarProgramUrl(input); if (url.pathname.startsWith('/student/')) fail('source-changed', 'Kilden er ikke en emnelenke.'); return url }
const term = text => { const match = clean(text).match(/^(Høst|Vår)semester\s+(20\d{2})$/i); return match ? { year: +match[2], semester: /^vår/i.test(match[1]) ? 'spring' : 'autumn' } : null }

export function parseAnsgarCalendar(html) {
  const $ = load(html), entries = [], edition = sourceEdition(html)
  $('main table').each((_, table) => {
    let terms = null
    $(table).find('tr').filter((_, row) => $(row).closest('table')[0] === table).each((_, row) => {
      const cells = $(row).children('td,th'), autumn = term(textWithSpaces($, cells[1])), spring = term(textWithSpaces($, cells[2]))
      if (autumn && spring) { terms = [autumn, spring]; return }
      if (!terms || cells.length !== 3 || !cells.slice(1).find('a[href]').length) return
      const paragraphs = cells.first().children('p'), names = paragraphs.length ? paragraphs.map((_, p) => textWithSpaces($, p)).get().filter(Boolean) : [textWithSpaces($, cells[0])]
      for (const name of names) {
        const annual = /^Årss?tudium\b/i.test(name), studyYear = name.match(/\b(\d{1,2})\.\s*år\b/i)?.[1] || (annual ? '1' : null)
        if (!studyYear || +studyYear > 20) continue
        const code = `kalender-${sourceEdition(name.toLocaleLowerCase('nb')).replace('side-', '')}`, periods = []
        for (const [column, calendar] of terms.entries()) {
          const number = +studyYear * 2 - (calendar.semester === 'autumn' ? 1 : 0), period = { id: String(number), studySemester: number, ...calendar, label: periodLabel(number, calendar), courses: [], requirements: [] }, cell = cells[column + 1], visited = new Set()
          $(cell).find('a[href]').each((_, link) => {
            let url; try { url = courseUrl(new URL($(link).attr('href'), sourceUrl)) } catch { return }
            if (visited.has(url.href)) return; visited.add(url.href)
            const leaf = $(link).closest('li,p'), node = leaf.length ? leaf : $(link).parent(), list = leaf.closest('ul'), explicitChoice = /valgfri|valgemne/i.test(textWithSpaces($, node)) || list.length && /valgfri|valgemne/i.test(textWithSpaces($, list.prev('p')))
            const parsed = coursesFromLinks($, node, { sourceUrl, courseUrl, institution: 'ansgar', university: 'Ansgar høyskole', scope: code, number })
            const course = parsed.courses.find(item => item.sourceUrl === url.href)
            if (!course) return
            const label = textWithSpaces($, link)
            course.name = clean(course.code ? label.slice(course.code.length) : label) || course.code || course.name
            course.choice = explicitChoice ? 'V' : ''
            course.id = `ansgar:${code}:${number}:${course.sourceRecordId}`; course.sourceVersion = `${calendar.year}:${calendar.semester}`
            course.year = calendar.year; course.semester = calendar.semester
            course.notes = `${course.notes} Publisert rad: ${name}. ${period.label}. Emner merket ABS eller med praksisvariant må kontrolleres mot egen undervisningsgruppe; ingen gruppetilhørighet er valgt.`
            period.courses.push(course)
          })
          const requirements = textWithSpaces($, cell)
          if (/valgfri|valgemne|praksis|ABS/i.test(requirements)) period.requirements.push(requirements)
          periods.push(period)
        }
        if (periods.some(period => period.courses.length)) entries.push({ code, name, sourceUrl, campuses: [], periods, edition })
      }
    })
  })
  const unique = [...new Map(entries.map(entry => [entry.code, entry])).values()]
  if (!unique.length) fail('source-changed', 'Ansgars publiserte program- og semestertabell kunne ikke leses. Ingen kalenderår eller emneplassering er gjettet.')
  return unique
}
export async function ansgarPrograms(institution, action, query, { fetchText }) {
  if (query.sourceUrl && ansgarProgramUrl(query.sourceUrl).href !== sourceUrl) fail('invalid-selection', 'Velg en programrad fra Ansgars publiserte emneoversikt.')
  const entries = parseAnsgarCalendar(await cachedText(fetchText, sourceUrl, ansgarProgramUrl))
  if (action === 'programs') {
    const q = clean(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', results: entries.filter(entry => !q || entry.name.toLocaleLowerCase('nb').includes(q)).map(({ code, name, sourceUrl, campuses }) => ({ code, name, sourceUrl, campuses })), warnings: ['Velg den publiserte programraden med ditt studieår og eventuell fordypning. Listen dekker kalenderens emneoversikt, ikke hele Ansgars studiekatalog.', 'Programradens studiesemestre og kalendersemestre kommer fra forskjellige kolonner i kilden. Ditt opptakskull må oppgis separat.'], completeness: { complete: false, pages: 1, returned: entries.length, scope: 'Alle gjenkjennelige program- og studieårsrader i den publiserte semestertabellen. Andre tilbud, inkludert masterens separate tempoplan, inngår ikke.' } }
  }
  const selected = entries.find(entry => entry.code === query.program)
  if (!selected) fail('invalid-selection', 'Programraden finnes ikke lenger i den publiserte kalenderoversikten. Velg fra den oppdaterte listen.')
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: 'current', label: 'Publisert emneoversikt · oppgi eget opptakskull', sourceUrl, requiresStudentCohort: true }], warnings: ['Kilden oppgir kalendersemester og studieår, men bekrefter ikke hvilket opptakskull studenten tilhører.'], completeness: { complete: false, pages: 1, returned: 1, scope: 'Gjeldende kalenderutgave; opptakskull oppgis av studenten.' } }
  if (action !== 'program-plan') fail('not-supported', 'Handlingen støttes ikke av Ansgars programkilde.')
  const cohort = studentCohort(query)
  return { status: 'ok', program: { code: selected.code, name: selected.name, cohort, cohortFromStudent: true, sourceEdition: selected.edition, sourceUrl, campuses: [] }, models: [{ id: 'published-calendar-row', name: selected.name, periods: selected.periods }], warnings: ['Emner, kalendersemester og studieår er hentet fra den valgte programraden. Opptakskullet er oppgitt av studenten. Programidentifikatoren er laget fra den publiserte radteksten; den er ikke en offisiell programkode.', 'Emnetabellen oppgir ikke studiepoeng. Obligatorisk status, campus og grupper er beholdt som ukjent; eksplisitte valgemner er merket.', 'Dette er en oversikt over hvilke emner som går i semesteret. Konkrete undervisningshendelser, rom, klokkeslett og personlig timeplan er ikke importert. Generelle kalenderfrister er ikke gjort om til undervisning.'], completeness: { complete: true, pages: 1, returned: selected.periods.reduce((total, period) => total + period.courses.length, 0), scope: 'Alle lenkede emner i den valgte publiserte program-/studieårsraden; ikke komplett programhistorikk eller undervisningskalender.' } }
}
