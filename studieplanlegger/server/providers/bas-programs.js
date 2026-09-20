import { load, clean, fail, restrictedUrl, cachedText } from './program-source.js'
import { studentCohort, sourceEdition } from './current-program-source.js'
import { readBasPdf } from './bas-pdf.js'

const origin = 'https://bas.org', sourceUrl = `${origin}/en/master-i-arkitektur/`, program = 'master-i-arkitektur'
export const basProgramUrl = input => restrictedUrl(input, { origin, paths: [/^\/en\/master-i-arkitektur\/?$/] })
export const basDocumentUrl = input => restrictedUrl(input, { origin, paths: [/^\/wp-content\/uploads\/\d{4}\/\d{2}\/[^/]+\.pdf$/i] })
function sourceCourse(name, url, scope, version, notes) {
  const recordId = `${scope}:${sourceEdition(name.toLocaleLowerCase('nb'))}`
  return { id: `bas:${recordId}`, code: '', name, credits: null, choice: '', sourceProvider: 'bas', sourceRecordId: recordId, sourceVersion: version, sourceUrl: url, university: 'Bergen Arkitekthøgskole', description: '', notes, year: null, semester: null, campus: '' }
}
export function parseBasCatalogue(html) {
  const $ = load(html), name = clean($('h1').first().text()), documents = [], archive = []
  if (!name || !/architecture|arkitektur/i.test(name)) fail('source-changed', 'BAS-siden mangler den publiserte programoverskriften.')
  $('a[href]').each((_, anchor) => {
    const text = clean($(anchor).text()), href = $(anchor).attr('href'); let url
    try { url = basDocumentUrl(new URL(href, sourceUrl)).href } catch { return }
    if (/^General course catalogue Year\s+1\s*[–—-]\s*3$/i.test(text)) documents.push(url)
    const term = text.match(/^(.*?)\s*[–—-]\s*(autumn|spring)\s+(20\d{2})$/i)
    if (term) archive.push({ name: clean(term[1]), year: +term[3], semester: /^spring$/i.test(term[2]) ? 'spring' : 'autumn', sourceUrl: url })
  })
  if (new Set(documents).size !== 1) fail('source-changed', 'BAS-siden har ingen entydig lenke til den generelle emnekatalogen for 1.–3. år.')
  return { name, documentUrl: documents[0], archive: [...new Map(archive.map(row => [`${row.year}:${row.semester}:${row.sourceUrl}`, row])).values()] }
}
export function parseBasGeneral(pages, documentUrl) {
  const lines = pages.flatMap(page => page.lines.map(line => ({ ...line, page: page.page }))), periods = new Map(), extras = [], requirements = []
  if (!lines.some(line => /^GENERAL\s+MAIN CATALOGUE$/i.test(line.text))) fail('source-changed', 'PDF-en er ikke den publiserte generelle BAS-emnekatalogen.')
  let active = null, thirdYear = false, mainCourses = false, additional = false, previousHeading = false, lastCourse = null
  const ensure = (number, semester) => {
    if (!periods.has(number)) periods.set(number, { id: String(number), studySemester: number, year: null, semester, label: `${number}. studiesemester · ${semester === 'autumn' ? 'Høst' : 'Vår'}, kalenderår avklares`, courses: [], requirements: [] })
    return periods.get(number)
  }
  for (const line of lines) {
    const term = line.text.match(/^(\d+)(?:st|nd|rd|th|\.)?\s*year\s*,\s*(autumn|spring) term$/i)
    if (term && line.size >= 14 && line.bold) { const year = +term[1]; if (year < 1 || year > 3) fail('source-changed', 'Katalogens studieår er utenfor den beskrevne 1.–3.-årsmodellen.'); active = ensure(year * 2 - (term[2].toLowerCase() === 'autumn' ? 1 : 0), term[2].toLowerCase()); previousHeading = false; continue }
    if (/^Synopsis\s+3rd year/i.test(line.text) && line.bold) { thirdYear = true; active = null; previousHeading = false; continue }
    if (thirdYear && /^The main courses are:$/i.test(line.text)) { mainCourses = true; continue }
    if (thirdYear && /^In addition, the 3\.\s*year will have the following:$/i.test(line.text)) { additional = true; mainCourses = false; continue }
    if (thirdYear && mainCourses) {
      const numbered = line.text.match(/^\d+\s+(.+?)\s*\([^)]*\b(autumn|spring) semester\)$/i)
      if (numbered && line.boldText && line.size >= 11.5 && line.size <= 12.5) {
        const semester = numbered[2].toLowerCase(), course = sourceCourse(clean(line.boldText), documentUrl, 'general', 'general-catalogue', `PDF-side ${line.page}: ${line.text}. Generell katalog, ikke en datert kullutgave.`)
        course.semester = semester; ensure(semester === 'autumn' ? 5 : 6, semester).courses.push(course)
      }
      continue
    }
    if (thirdYear && additional) {
      if (line.size >= 10.5 && line.size < 11.5 && line.boldText && Math.abs(line.x - 70.824) < 4) {
        const title = clean(line.boldText.replace(/\s*\($/, '').replace(/:$/, ''))
        if (title.length < 3) continue
        extras.push({ ...sourceCourse(title, documentUrl, 'general', 'general-catalogue', `PDF-side ${line.page}: ${line.text}. Tillegg i 3. studieår uten oppgitt semester; plasseringen må avklares.`), requiresSemesterChoice: true })
      }
      continue
    }
    if (!active || thirdYear) continue
    const duration = /^\d+(?:\s*[–—-]\s*\d+)?\s+(?:days?|weeks?)$/i.test(line.text)
    if (line.bold && line.size >= 9.5 && line.size <= 10.5 && !duration) {
      if (/^exam$/i.test(line.text)) { active.requirements.push(`PDF-side ${line.page}: ${line.text}. Eksamen er beskrevet uten dato; den opprettes ikke som et emne eller en presis frist.`); previousHeading = false; lastCourse = null; continue }
      if (previousHeading && lastCourse) {
        const index = active.courses.indexOf(lastCourse), name = `${lastCourse.name} / ${line.text}`
        lastCourse = sourceCourse(name, documentUrl, 'general', 'general-catalogue', `${lastCourse.notes} ${line.text}`); lastCourse.semester = active.semester; active.courses[index] = lastCourse
      } else { lastCourse = sourceCourse(line.text, documentUrl, 'general', 'general-catalogue', `PDF-side ${line.page}: ${line.text}. Generell katalog, ikke en datert kullutgave.`); lastCourse.semester = active.semester; active.courses.push(lastCourse) }
      previousHeading = true
    } else { if (duration && lastCourse) lastCourse.notes += ` Oppgitt kursperiode: ${line.text}; dette er ikke studiepoeng eller individuell arbeidstid.`; previousHeading = false }
  }
  if (![1, 2, 3, 4, 5, 6].every(number => periods.get(number)?.courses.length) || !extras.length) fail('source-changed', 'BAS-katalogens overskrifter eller semesterstruktur har endret seg. Bruk dokumentimport; ingen manglende emner eller semestre er gjettet.')
  if (extras.length) periods.set('year-3-unspecified', { id: 'year-3-unspecified', studySemester: null, requiresStudentStudySemester: true, allowedStudySemesters: [5, 6], year: null, semester: null, label: '3. studieår · tilleggsarbeid uten semester', courses: extras, requirements: ['Kilden plasserer disse kursene i 3. studieår, uten semester. Velg 5. eller 6. studiesemester og bare kursene du faktisk følger da.'] })
  return { id: 'general', name: 'Generell emnekatalog 1.–3. år · avklar egen kullplan', periods: [...periods.values()], requirements }
}
export function basArchiveModel(entries) {
  const periods = new Map()
  for (const entry of entries) {
    const id = `${entry.year}:${entry.semester}`
    if (!periods.has(id)) periods.set(id, { id, year: entry.year, semester: entry.semester, studySemester: null, requiresStudentStudySemester: true, allowedStudySemesters: [7, 8, 9, 10], label: `Publisert kursarkiv · ${entry.semester === 'spring' ? 'Vår' : 'Høst'} ${entry.year}`, courses: [], requirements: ['Dette er daterte kursvalg fra det publiserte masterkursarkivet. Velg bare et kurs du faktisk fulgte, og avklar ditt studiesemester. Arkivet dokumenterer ikke tilbud i senere år.'] })
    const course = sourceCourse(entry.name, entry.sourceUrl, 'master-archive', id, `Publisert kurstittel: ${entry.name} · ${entry.semester === 'spring' ? 'Spring' : 'Autumn'} ${entry.year}. Kalenderperioden kommer fra kildelenken, ikke PDF-ens opplastingsmappe. Studiesemester, studiepoeng, emnekode og gruppetilhørighet er ikke oppgitt.`)
    Object.assign(course, { choice: 'V', year: entry.year, semester: entry.semester, requiresSemesterChoice: true, allowedCalendarPeriods: [{ year: entry.year, semester: entry.semester }] }); periods.get(id).courses.push(course)
  }
  return { id: 'master-archive', name: 'Publiserte masterkurs · datert arkiv', periods: [...periods.values()].sort((a, b) => b.year - a.year || a.semester.localeCompare(b.semester)) }
}
export async function basPrograms(institution, action, query, { fetchText, fetchBytes }) {
  if (institution !== 'bas' || query.program && query.program !== program || query.sourceUrl && basProgramUrl(query.sourceUrl).href !== sourceUrl) fail('invalid-selection', 'Velg arkitekturprogrammet fra den offentlige BAS-kilden.')
  const html = await cachedText(fetchText, sourceUrl, basProgramUrl), catalogue = parseBasCatalogue(html)
  if (action === 'programs') return { status: 'ok', results: !query.q || catalogue.name.toLocaleLowerCase('nb').includes(clean(query.q).toLocaleLowerCase('nb')) ? [{ code: program, name: catalogue.name, sourceUrl, campuses: [] }] : [], completeness: { complete: true, pages: 1, returned: 1 }, warnings: ['BAS-siden beskriver det femårige arkitekturprogrammet. Generell 1.–3.-årskatalog og daterte masterkurs vises som separate valg.'] }
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: 'current', requiresStudentCohort: true, label: 'Generell katalog og datert kursarkiv · oppgi ditt kull', sourceUrl }], warnings: ['Generalkatalogen er ikke en kullutgave. Kursarkivets kalenderperioder er separate fra studentens opptakskull.'] }
  if (action !== 'program-plan') fail('not-supported', 'Handlingen støttes ikke av BAS-programkilden.')
  const cohort = studentCohort(query), models = [], warnings = ['Generalkatalogen viser kursnavn og delvis semesterplassering, uten studiepoeng eller emnekoder. APP, DAV og TRIP er fagområder, ikke emnekoder. Kontroller at den generelle modellen gjelder ditt kull.', 'Kalenderår, campus, grupper og undervisningshendelser er ikke hentet fra generalkatalogen. Ingen dato er avledet fra PDF-ens opplastingsmappe.']; let pages = 1, sourceError = false
  try { const pdf = await readBasPdf(fetchBytes, catalogue.documentUrl, basDocumentUrl); pages += pdf.length; models.push(parseBasGeneral(pdf, catalogue.documentUrl)) } catch (error) { if (error.name === 'AbortError') throw error; sourceError = true; warnings.push(`Generalkatalogen kunne ikke importeres: ${error.message}. Kursarkivet kan fortsatt kontrolleres separat.`) }
  if (catalogue.archive.length) { models.push(basArchiveModel(catalogue.archive)); const first = Math.min(...catalogue.archive.map(row => row.year)), latest = Math.max(...catalogue.archive.map(row => row.year)); warnings.push(`Den publiserte masterkurslisten inneholder ${catalogue.archive.length} daterte kurstitler fra ${first} til ${latest}. Dette er arkivdekning, ikke bekreftelse på tilbud utenfor de viste kalendersemestrene.`) }
  if (!models.length) fail('source-changed', warnings.join(' '))
  return { status: 'ok', program: { code: program, name: catalogue.name, sourceUrl, cohort, cohortFromStudent: true, campuses: [], sourceEdition: sourceEdition(html) }, models, warnings, completeness: { complete: false, pages, returned: models.reduce((count, model) => count + model.periods.reduce((total, period) => total + period.courses.length, 0), 0), reason: sourceError ? 'Midlertidig feil eller endret format i generalkatalogen; separat kursarkiv er beholdt.' : 'Generell kursmodell og historiske masterkurstitler; ingen fullstendig datert kullplan, emnekoder, studiepoeng eller undervisningskalender.' } }
}
