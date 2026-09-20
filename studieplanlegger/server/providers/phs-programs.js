import { load, clean, fail, cachedText, restrictedUrl, collectPages, asCredits } from './program-source.js'
import { studentCohort } from './current-program-source.js'
import { readLdhPdf } from './ldh-pdf.js'
const origin = 'https://www.politihogskolen.no', bachelor = `${origin}/studier/politiutdanning/`, catalogue = `${origin}/studier/master-etter-og-videreutdanninger/`
const programmeUrl = input => restrictedUrl(input, { origin, paths: [/^\/studier\/politiutdanning\/(?:studieplaner\/(?:\d{4}(?:h|v|host|var)\.html)?)?$/, /^\/studier\/master-etter-og-videreutdanninger\/(?:[a-z\d-]+\/(?:index\.html|studieplaner\/(?:\d{4}(?:h|v|host|var)\.html)?))?$/, /^\/english\/studies\/continuing-courses\/[a-z\d-]+\/index\.html$/i], keys: ['page'] })
const courseUrl = input => restrictedUrl(input, { origin, paths: [/^\/studier\/emner\/\d{4}\/(?:host|var)\/[a-z\d-]+\.html$/] })
const pdfUrl = input => restrictedUrl(input, { origin, paths: [/^\/studier\/(?:politiutdanning|master-etter-og-videreutdanninger\/[a-z\d-]+)\/studieplaner\/[a-z\d%_.()-]+\.pdf$/i] })
const identifier = url => (url.pathname.startsWith('/studier/politiutdanning/') ? 'politiutdanning' : url.pathname.split('/')[url.pathname.startsWith('/english/') ? 4 : 3]).toUpperCase()
const rootUrl = url => url.pathname.startsWith('/studier/politiutdanning/') ? bachelor : url.pathname.startsWith('/english/') ? url.href : `${catalogue}${url.pathname.split('/')[3]}/index.html`
const metadata = ($, label) => clean($('main dt').filter((_i, node) => clean($(node).text()).replace(/:$/, '') === label).first().next('dd').text())
async function page(fetchText, input, validate = programmeUrl) {
  const expected = validate(input)
  return cachedText(fetchText, expected, next => { const url = validate(next); if (url.href !== expected.href) fail('source-changed', 'PHS videresendte til en annen kildeutgave.'); return url })
}
export function parsePhsCatalogue($, current) {
  const results = [], seen = new Set()
  $('main a[href]').each((_i, node) => {
    const row = $(node), name = clean(row.find('h3').text())
    if (!name || !row.find('.facet-line-1').length) return
    const url = programmeUrl(new URL(row.attr('href'), current))
    if (!url.pathname.endsWith('/index.html') || seen.has(url.href)) return
    seen.add(url.href); results.push({ code: identifier(url), name, sourceUrl: url.href, campuses: [], sourceKind: clean(row.find('.facet-line-1 .facet').first().text()), notes: clean(row.find('.no-applicants').text()) })
  })
  if (!results.length) fail('source-changed', 'PHS-katalogen har ingen gjenkjennelige studiekort.')
  return { results }
}
export function parsePhsCohorts($, current) {
  const results = [], seen = new Set(), program = identifier(programmeUrl(current))
  $('main a[href]').each((_i, node) => {
    const raw = new URL($(node).attr('href'), current), match = raw.pathname.match(/\/studieplaner\/(\d{4})(h|v|host|var)\.html$/)
    if (/\/studieplaner\/[^/]+\.pdf$/i.test(raw.pathname) && !seen.has(raw.href) && identifier(raw) === program) {
      const url = pdfUrl(raw), label = clean($(node).text()) || decodeURIComponent(url.pathname.split('/').at(-1))
      seen.add(url.href); results.push({ cohort: 'student', requiresStudentCohort: true, label: `PDF: ${label} · oppgi ditt kull`, sourceUrl: url.href }); return
    }
    if (!match || seen.has(raw.href)) return
    const url = programmeUrl(raw)
    if (identifier(url) !== program) return
    seen.add(url.href); const cohort = `${match[1]}${/^(v|var)$/.test(match[2]) ? 'V' : 'H'}`
    results.push({ cohort, label: `Startkull ${match[1]} ${cohort.endsWith('V') ? 'vår' : 'høst'}`, sourceUrl: url.href })
  })
  return { results }
}
function directionModels($) {
  const edges = new Map(), labels = new Map(), children = new Set()
  $('.vrtx-fs-education-plan input[name=education-plan-choices]').each((_i, node) => {
    const [parent, child, extra] = ($(node).attr('value') || '').split('->'), label = clean($(`label[for="${$(node).attr('id')}"]`).text())
    if (!parent || !child || extra || !/^[A-Z\d-]+$/.test(parent + child) || !label) fail('source-changed', 'PHS-studieretningene kan ikke leses entydig.')
    const list = edges.get(parent) || []; if (!list.includes(child)) list.push(child); edges.set(parent, list); children.add(child); labels.set(child, label)
  })
  if (!edges.size) return [{ id: 'published', name: 'Publisert studieløp', selections: [] }]
  function branches(id, seen = []) { if (seen.includes(id)) fail('source-changed', 'PHS-studieretningene danner en sirkel.'); return edges.has(id) ? edges.get(id).flatMap(child => branches(child, [...seen, id]).map(path => [id, ...path])) : [[id]] }
  const roots = [...edges.keys()].filter(id => !children.has(id)); let models = [[]]
  if (!roots.length) fail('source-changed', 'PHS-studieretningene mangler et startvalg.')
  for (const root of roots) { const paths = branches(root); models = models.flatMap(model => paths.map(path => [...model, ...path])); if (models.length > 40) fail('not-supported', 'PHS-planen har over 40 kombinasjoner av studieretning. Velg en avgrenset kilde i dokumentimport.') }
  return models.map(selections => ({ id: selections.join(':'), name: selections.filter(id => labels.has(id)).map(id => labels.get(id)).join(' · '), selections }))
}
export function parsePhsPlan(html, query, source) {
  const url = programmeUrl(source), match = url.pathname.match(/\/studieplaner\/(\d{4})(h|v|host|var)\.html$/), $ = load(html), title = clean($('main h1').first().text())
  if (!match || identifier(url) !== query.program || `${match[1]}${/^(v|var)$/.test(match[2]) ? 'V' : 'H'}` !== query.cohort || !title.includes(match[1])) fail('invalid-selection', 'PHS-planens program og startkull stemmer ikke med valget.')
  const root = $('.vrtx-fs-education-plan'), terms = root.children('.term'), start = +match[1] * 2 + (/^(v|var)$/.test(match[2]) ? 0 : 1), models = directionModels($), warnings = []
  if (!terms.length) fail('not-supported', 'PHS-planen mangler en publisert emnestruktur. Bruk den tilknyttede planen i dokumentimport.')
  for (const model of models) {
    model.periods = []
    terms.each((_i, node) => {
      const term = $(node), match = clean(term.children('h3').text()).match(/^(Høst|Vår)\s+(\d{4})$/), semester = match?.[1] === 'Vår' ? 'spring' : 'autumn', year = +(match?.[2] || 0), number = year * 2 + (semester === 'autumn' ? 1 : 0) - start + 1
      if (!match || number < 1 || number > 40) fail('source-changed', 'PHS-planens kalendersemestre stemmer ikke med startkullet.')
      const period = { id: `${year}-${semester}`, studySemester: number, year, semester, label: `${number}. studiesemester · ${match[1]} ${year}`, courses: [], requirements: [] }
      term.find('.combination').each((_j, groupNode) => {
        const group = $(groupNode), required = (group.attr('class') || '').split(/\s+/).filter(name => /^direction-(?!parent-|ancestor-)/.test(name)).map(name => name.replace(/^direction-/, ''))
        if (required.some(id => !model.selections.includes(id))) return
        const groupName = clean(group.children('h4').text())
        group.children('.course-list').children('li').each((_k, courseNode) => {
          const row = $(courseNode), code = clean(row.find('.course-code').text()), name = clean(row.find('.course-name').text()), credits = asCredits(clean(row.find('.course-study-points span').first().text())), parts = clean(row.find('.course-terms').text()), raw = row.find('a.course-link').attr('href')
          if (!/^[A-ZÆØÅ\d-]{2,30}$/.test(code) || !name) fail('source-changed', 'PHS-planen inneholder en emnerad uten entydig kode eller navn.')
          if (/^Valg(?:bart|fritt|emne|frie)/i.test(name)) { period.requirements.push(`${code}: ${name}${credits === null ? '' : `, ${credits} studiepoeng`}. Velg faktiske emner; denne samleposten blir ikke opprettet som emne.`); return }
          const sourceUrl = raw ? courseUrl(new URL(raw, url)).href : url.href
          if (raw && new URL(sourceUrl).pathname.split('/').at(-1).replace(/\.html$/, '').toUpperCase() !== code) fail('source-changed', 'PHS-emnekoden stemmer ikke med emnelenken.')
          const choice = row.hasClass('mandatory') ? 'O' : row.hasClass('optional') || row.hasClass('elective') ? 'V' : ''
          period.courses.push({ id: `phs-program:${query.program}:${query.cohort}:${year}:${semester}:${code}`, code, name, credits, choice, courseGroup: groupName, year, semester, campus: '', university: 'Politihøgskolen', description: '', notes: [parts ? `${parts}. Studiepoengene oppgis av kilden når hele emnet avsluttes; en tom verdi er ukjent.` : '', !raw ? 'Kilden mangler egen emneside. Opplysningene er hentet fra programplanen.' : 'Programplanens kalendersemester er beholdt selv om lenken til emnebeskrivelsen gjelder en eldre kildeutgave.'].filter(Boolean).join(' '), sourceProvider: 'phs-program', sourceRecordId: code, sourceVersion: query.cohort, sourceUrl })
        })
      })
      if (period.courses.length || period.requirements.length) model.periods.push(period)
    })
    delete model.selections
  }
  if (!models.some(model => model.periods.some(period => period.courses.length))) fail('not-supported', 'PHS-planens HTML viser ingen faktiske emner, bare eventuelle valgemnekrav. Bruk den publiserte PDF-planen; en samlepost er ikke en komplett programimport.')
  // Repeated course parts keep whole-course credits where the source declares them.
  for (const model of models) for (const period of model.periods) for (const course of period.courses) if (course.credits === null) {
    const siblings = model.periods.flatMap(period => period.courses).filter(row => row.code === course.code && row.credits !== null), values = [...new Set(siblings.map(row => row.credits))]
    if (values.length === 1) { course.credits = values[0]; course.notes += ' Hele emnets studiepoeng er hentet fra en senere del av samme kildeplan.' }
  }
  const campuses = clean(metadata($, 'Studiesteder') || metadata($, 'Studiested')).split(/Politihøgskolen\s+studiested\s*/i).map(clean).filter(Boolean)
  warnings.push('Velg studieretning og campus selv. Programplanen oppgir kalendersemestre; den inneholder ikke undervisningsdatoer eller personlige grupper.', 'Emnebeskrivelser kan være lenket til en eldre publisert versjon. Disse lenkene endrer ikke kalendersemesteret i programplanen.', 'Planlagte fremtidige semestre er kildeopplysninger og kan bli revidert. Valgemnekrav må avklares før import.')
  return { status: 'ok', program: { code: query.program, name: title.replace(/^Studieplan for /, '').replace(/\s*\([^)]*\)$/, ''), cohort: query.cohort, sourceUrl: url.href, sourceEdition: query.cohort, campuses }, models, warnings, completeness: { complete: true, pages: 1, returned: new Set(models.flatMap(model => model.periods.flatMap(period => period.courses.map(course => course.code)))).size, scope: 'Alle publiserte HTML-semestre og støttede studieretninger i den valgte planen; valgemnekrav holdes atskilt fra faktiske emner.' } }
}
export function parsePhsNumberedPdf(pages, query, source) {
  const cohort = studentCohort(query), modelPage = pages.find(page => /Studiet er organisert i\s+\d+\s+emner/i.test(page.lines.map(clean).join(' ')))
  const body = modelPage?.lines.map(clean).join(' ') || '', count = +(body.match(/Studiet er organisert i\s+(\d+)\s+emner/i)?.[1] || 0), model = body.split(/Modellen illustrerer/i)[0], records = new Map(), requirements = []
  for (const match of model.matchAll(/Emne\s+(\d+):\s*(.+?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)\s*(?:stp|studiepoeng)\b/gi)) {
    const number = +match[1], name = clean(match[2]), credits = asCredits(match[3])
    if (records.has(number) && (records.get(number).name !== name || records.get(number).credits !== credits)) fail('source-changed', 'PDF-planen oppgir motstridende emneoversikter.')
    records.set(number, { number, name, credits, excerpt: clean(match[0]) })
  }
  if (!count || count > 40 || records.size !== count || [...records.keys()].some(number => number < 1 || number > count)) fail('not-supported', 'PHS-PDF-en har ikke en entydig støttet oversikt over navngitte emner. Bruk dokumentimport for å kontrollere innholdet.')
  const cover = pages[0].lines.map(clean).join(' '), title = clean(cover.match(/FOR\s+(.+?)\s+\d+\s+studiepoeng/i)?.[1] || 'Publisert PHS-plan'), courses = []
  for (const row of [...records.values()].sort((a, b) => a.number - b.number)) {
    if (/^Valgfrie emner$/i.test(row.name)) { requirements.push(`${row.excerpt}. Velg faktiske emner; samlekravet opprettes ikke som emne.`); continue }
    courses.push({ id: `phs-program:${query.program}:${cohort}:emne-${row.number}`, code: '', name: row.name, credits: row.credits, choice: /Alle emnene er obligatoriske/i.test(body) ? 'O' : '', requiresSemesterChoice: true, courseGroup: 'Navngitte emner i publisert PDF', year: null, semester: null, campus: '', university: 'Politihøgskolen', description: '', notes: `PDF-side ${modelPage.page}: ${row.excerpt}. Nummeret angir emnets rekkefølge, ikke studiesemester. Kilden oppgir ikke emnekode eller en bekreftet kobling til ditt opptakskull.`, sourceProvider: 'phs-program', sourceRecordId: `emne-${row.number}`, sourceVersion: 'published-pdf', sourceUrl: source })
  }
  if (!courses.length) fail('not-supported', 'PHS-PDF-en inneholder bare samlekrav, ikke navngitte emner.')
  return { status: 'ok', program: { code: query.program, name: title, cohort, cohortFromStudent: true, sourceUrl: source, sourceEdition: cover.slice(0,1000), campuses: [] }, models: [{ id: 'published-pdf', name: 'Publisert PDF · avklar semester og kull', periods: [{ id: 'unplaced', label: 'Navngitte emner · oppgi studiesemester', studySemester: null, requiresStudentStudySemester: true, year: null, semester: null, courses, requirements }] }], warnings: ['PDF-ens publiseringsdato blir ikke brukt som opptakskull. Kontroller at den publiserte planen gjelder ditt kull.', 'Emnenes rekkefølge er ikke en semesterplan. Velg bare emner som gjelder ditt studiesemester og oppgi kalenderperioden før import.', 'Kilden oppgir ingen emnekoder i oversikten. Navngitte emner har stabile kildeidentifikatorer basert på kildens emnenummer.'], completeness: { complete: false, pages: pages.length, returned: courses.length, reason: 'Navngitte emner og valgemnekrav i publisert PDF; kull og semesterplassering krever studentens avklaring.' } }
}
export async function phsPrograms(institution, action, query, { fetchText, fetchBytes }) {
  if (action === 'programs') {
    const data = await collectPages(catalogue, fetchText, programmeUrl, parsePhsCatalogue), $ = load(await page(fetchText, bachelor)), name = clean($('main h1').first().text()), q = clean(query.q).toLocaleLowerCase('nb')
    if (!name) fail('source-changed', 'PHS-bachelorens publiserte navn mangler.')
    const results = [{ code: 'POLITIUTDANNING', name, sourceUrl: bachelor, campuses: [] }, ...data.results]
    return { status: 'ok', ...data, results: results.filter(row => !q || `${row.code} ${row.name}`.toLocaleLowerCase('nb').includes(q)), completeness: { ...data.completeness, returned: results.length }, warnings: [...data.warnings, 'Listen viser publiserte studietilbud, også kurs og studier uten nytt opptak. Programimport krever en konkret publisert emneplan; listen alene bekrefter ikke dette.'] }
  }
  if (action === 'program-plan' && /\.pdf$/i.test(new URL(query.sourceUrl).pathname)) {
    const url = pdfUrl(query.sourceUrl)
    if (identifier(url) !== query.program) fail('invalid-selection', 'PDF-lenken tilhører ikke valgt PHS-program.')
    const cohorts = await phsPrograms(institution, 'program-cohorts', { ...query, sourceUrl: rootUrl(url) }, { fetchText })
    if (!cohorts.results.some(row => row.sourceUrl === url.href && row.requiresStudentCohort)) fail('invalid-selection', 'Velg en PDF som faktisk er publisert i PHS-programmets planliste.')
    const validate = input => { const next = pdfUrl(input); if (next.href !== url.href) fail('source-changed', 'PHS videresendte til en annen PDF-plan.'); return next }
    return parsePhsNumberedPdf(await readLdhPdf(fetchBytes, url.href, validate), query, url.href)
  }
  const url = programmeUrl(query.sourceUrl)
  if (identifier(url) !== query.program) fail('invalid-selection', 'Velg programmet fra den publiserte PHS-katalogen.')
  if (action === 'program-cohorts') {
    const root = rootUrl(url), $ = load(await page(fetchText, root)), indexLink = $('main a[href]').filter((_i, node) => /Se alle studieplaner/i.test(clean($(node).text()))).first().attr('href')
    const data = indexLink ? await collectPages(new URL(indexLink, root).href, fetchText, programmeUrl, parsePhsCohorts) : parsePhsCohorts($, root)
    if (!data.results.length) fail('not-supported', 'PHS-studiet har ingen publisert HTML- eller PDF-plan i den valgte planlisten. Bruk den offentlige kildesiden eller dokumentimport.')
    return { status: 'ok', ...data, results: data.results.sort((a, b) => b.cohort.localeCompare(a.cohort)), warnings: ['Bare faktisk publiserte planutgaver er listet. Studiestart i en presentasjon blir ikke brukt som bevis på en tilgjengelig emneplan.'] }
  }
  if (action !== 'program-plan') fail('not-supported', 'Denne PHS-handlingen er ikke støttet.')
  const cohorts = await phsPrograms(institution, 'program-cohorts', query, { fetchText }), choice = cohorts.results.find(row => row.cohort === query.cohort && !row.requiresStudentCohort)
  if (!choice) fail('invalid-selection', 'Velg en faktisk publisert PHS-planutgave.')
  return parsePhsPlan(await page(fetchText, choice.sourceUrl), query, choice.sourceUrl)
}
export async function phsDetails(query, fetchText) {
  const url = courseUrl(query.sourceUrl), sourceTerm = url.pathname.match(/\/emner\/(\d{4})\/(host|var)\//), $ = load(await page(fetchText, url, courseUrl)), title = clean($('main h1').first().text()), suffix = title.match(/\s+\((Høst|Vår) (\d{4})\)$/)
  if (!title.startsWith(`${query.code} `) || !suffix || suffix[2] !== sourceTerm[1] || (suffix[1] === 'Vår') !== (sourceTerm[2] === 'var') || !/^\d{4}$/.test(String(query.year)) || !['spring', 'autumn'].includes(query.semester)) fail('invalid-selection', 'PHS-emnebeskrivelsen bekrefter ikke valgt emnekode og kildeutgave.')
  const content = $('main').clone(); content.find('script,style,nav,.vrtx-breadcrumb-menu').remove()
  return { status: 'ok', course: { id: `phs:${query.code}:${query.year}:${query.semester}`, code: query.code, name: title.slice(query.code.length + 1).replace(suffix[0], ''), credits: asCredits(metadata($, 'Studiepoeng')), year: +query.year, semester: query.semester, university: 'Politihøgskolen', campus: query.campus || '', description: clean(content.text()), notes: `Emnebeskrivelsens kildeutgave er ${sourceTerm[1]} ${sourceTerm[2] === 'var' ? 'vår' : 'høst'}. Programplanens valgte kalendersemester er beholdt.`, sourceProvider: 'phs', sourceRecordId: query.code, sourceVersion: `${sourceTerm[1]}${sourceTerm[2] === 'var' ? 'V' : 'H'}`, sourceUrl: url.href }, warnings: ['Emneinnholdet bekrefter ikke en offentlig undervisningskalender eller personlig gruppetilhørighet.'], calendarUrl: null }
}
