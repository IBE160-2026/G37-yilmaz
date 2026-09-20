import { load, clean, fail, restrictedUrl, cachedText, asCredits } from './program-source.js'
import { studentCohort, sourceEdition, textWithSpaces } from './current-program-source.js'
import { readLdhPdf } from './ldh-pdf.js'

const origin = 'https://hgut.no', home = `${origin}/`, admin = /^(?:generell-studieinfo|internasjonalisering-utveksling|skreddarsydde-kursmodular|praksissamlingar)$/
export const hgutProgramUrl = input => restrictedUrl(input, { origin, paths: [/^\/$/, /^\/studietilbod\/[a-z-]+\/?$/] })
export const hgutPdfUrl = input => restrictedUrl(input, { origin, paths: [/^\/wp-content\/uploads\/\d{4}\/\d{2}\/[^/]+\.pdf$/i] })
function reference(input) { const url = hgutProgramUrl(input), code = url.pathname.match(/^\/studietilbod\/([a-z-]+)\/?$/)?.[1]; if (!code || admin.test(code)) fail('invalid-selection', 'Velg et offentlig publisert studietilbud fra HGUt-listen.'); return { code, sourceUrl: url.href } }
export function parseHgutCatalogue(html) {
  const $ = load(html), result = new Map()
  $('a[href]').each((_, anchor) => { let source; try { source = reference(new URL($(anchor).attr('href'), home)) } catch { return } const name = textWithSpaces($, anchor); if (!name || /^Les\s|^Søk\s/i.test(name)) return; const previous = result.get(source.code); if (!previous || previous.name.length < name.length) result.set(source.code, { ...source, name, campuses: [] }) })
  if (!result.size) fail('source-changed', 'HGUt-siden mangler den publiserte studietilbudslisten.')
  return [...result.values()]
}
const annual = (year, courses, requirements, partial = false) => ({ id: `year-${year}`, studySemester: null, requiresStudentStudySemester: true, ...(partial ? {} : { allowedStudySemesters: [year * 2 - 1, year * 2] }), year: null, semester: null, label: `${year}. normerte studieår · avklar studiesemester og kalender`, courses, requirements })
function course(source, name, credits, scope, notes, code = '') {
  const recordId = `${source.code}:${scope}`
  return { id: `hgut:${recordId}`, code, name, credits, choice: '', sourceProvider: 'hgut', sourceRecordId: recordId, sourceVersion: 'current', sourceUrl: source.sourceUrl, university: 'Høgskulen for grøn utvikling', description: '', notes, year: null, semester: null, campus: '', requiresSemesterChoice: true }
}
export function parseHgutBachelor(html, sourceUrl) {
  const source = reference(sourceUrl), $ = load(html), name = clean($('h1').first().text()), periods = []
  $('main strong').each((_, heading) => {
    const year = clean($(heading).text()).match(/^(\d)\.\s*Studieår$/i); if (!year) return
    const paragraph = $(heading).closest('p'), list = paragraph.next('ul'), description = textWithSpaces($, paragraph), groupCredits = description.match(/alle på\s+(\d+)\s*stp/i)?.[1], choices = /Valfrie emne/.test(description)
    if (!list.length) fail('source-changed', 'HGUt-årsgruppen mangler den tilhørende emnelisten.')
    const courses = []
    list.children('li').each((_, item) => {
      const links = new Map()
      $(item).find('a[href]').each((_, anchor) => { const ref = reference(new URL($(anchor).attr('href'), sourceUrl)); const labels = links.get(ref.sourceUrl) || { ref, texts: [] }; labels.texts.push(textWithSpaces($, anchor)); links.set(ref.sourceUrl, labels) })
      if (links.size !== 1) fail('source-changed', 'Årslisten har en utydelig emnekobling.')
      const linked = [...links.values()][0], excerpt = textWithSpaces($, item), credits = excerpt.match(/(\d+)\s*studiepoeng/i)?.[1] || groupCredits
      if (!credits) fail('source-changed', 'Årslisten mangler studiepoeng for et emne.')
      const row = course(linked.ref, clean(linked.texts.join(' ')), asCredits(credits), 'whole-course', `Kildeutdrag fra ${year[1]}. studieår: ${excerpt}. ${description}. Studiepoengene gjelder hele emnet; semesterfordeling må avklares.`)
      row.choice = choices ? 'V' : ''
      const existing = courses.find(course => course.sourceUrl === row.sourceUrl)
      if (existing) {
        if (existing.credits !== row.credits) fail('source-changed', 'Den samme emnelenken har ulike studiepoeng i årslisten.')
        if (!existing.name.includes(row.name)) existing.name = clean(`${existing.name} ${row.name}`)
        existing.notes += ` Fortsettelse av samme publiserte lenke: ${row.name}.`
      } else courses.push(row)
    })
    periods.push(annual(+year[1], courses, [description, 'Velg bare kursene du faktisk følger i valgt semester. Årsgruppen er normert studieprogresjon, ikke et bestemt kalenderår.']))
  })
  if (periods.length !== 3 || !/Bachelor/i.test(name)) fail('source-changed', 'HGUt-siden mangler den støttede bacheloroversikten med tre studieår.')
  return { name, model: { id: 'published-annual', name: 'Publisert normert bachelorløp', periods } }
}
export function hgutAvailability(html) {
  const $ = load(html), text = clean($('main').text()), match = text.match(/Dette kurset vil ikkje gå i\s+(20\d{2})\s*[/-]\s*(\d{2}|20\d{2})/i)
  if (!match) return {}
  const end = match[2].length === 2 ? Math.floor(+match[1] / 100) * 100 + +match[2] : +match[2]
  if (end !== +match[1] + 1) fail('source-changed', 'Kildens beskjed om avlyst tilbud har en uklar studieperiode.')
  return { unavailableCalendarPeriods: [{ year: +match[1], semester: 'autumn' }, { year: end, semester: 'spring' }], sourceAvailabilityNote: match[0] }
}
export function parseHgutModule(html, sourceUrl, pages = []) {
  const source = reference(sourceUrl), $ = load(html), name = clean($('h1').first().text()), text = clean($('main').text()), pdf = pages.flatMap(page => page.lines.map(line => ({ page: page.page, text: clean(line) }))), joined = pdf.map(line => line.text).join(' '), courses = [], requirements = []
  if (!name) fail('source-changed', 'Emnesiden mangler en publisert tittel.')
  const modules = [...text.matchAll(/Modul\s+([IVX]+),\s*(\d+)\s*stp\.?/gi)]
  if (modules.length) {
    if (!/gjennomført parallelt/i.test(joined)) fail('source-changed', 'Modulenes organisering må kontrolleres i den publiserte PDF-planen før import. Ingen sekvens eller semester er antatt.')
    for (const match of modules) {
      if (!new RegExp(`Modul ${match[1]}\\s*\\(\\s*${match[2]}\\s*stp`).test(joined)) fail('source-changed', 'Emnesiden og PDF-planen bekrefter ikke samme modulverdi.')
      if (!courses.some(row => row.name.endsWith(`Modul ${match[1]}`))) courses.push(course(source, `${name} · Modul ${match[1]}`, +match[2], `modul-${match[1]}`, `${match[0]}. PDF-planen sier at undervisningen i modulene gjennomføres parallelt. Modulnummeret er ikke et studiesemester.`))
    }
    requirements.push('Modul I og II gjennomføres parallelt ifølge PDF-planen. Kontroller faktisk heltids-/deltidsprogresjon og velg eget studiesemester; modulene er ikke fordelt automatisk på høst og vår.')
  } else {
    const ny = text.match(/NY\s*1:\s*(.+?)\s*\((\d+)\s*stp\)\s*NY\s*2:\s*(.+?)\s*\((\d+)\s*stp\)\s*(.+?)\s*\((\d+)\s*stp\)/i)
    if (ny) {
      courses.push(course(source, clean(ny[1]), +ny[2], 'ny-1', `Publisert NY 1: ${ny[1]} (${ny[2]} stp). Semesterplassering er ikke oppgitt.`, 'NY1'))
      courses.push(course(source, `${clean(ny[3])} og ${clean(ny[5])}`, +ny[4] + +ny[6], 'ny-2', `Publisert NY 2 består av ${ny[3]} (${ny[4]} stp) og ${ny[5]} (${ny[6]} stp). Summen er emnets verdi, ikke to ekstra emner.`, 'NY2'))
    } else {
      const explicit = [...text.matchAll(/(?:Kurset|Modulen|Dette kurset|Regenerativt landbruk\s*\(RL\))[^.]{0,70}?(\d+)\s*(?:studiepoeng|stp)/gi)].map(match => +match[1]), values = [...new Set(explicit)]
      if (values.length !== 1) fail('source-changed', 'Emnesiden mangler én entydig studiepoengverdi for kurset.')
      const pdfCredits = joined.match(/This course is a\s+(\d+)\s*stp course/i)?.[1]
      if (pdfCredits && +pdfCredits !== values[0]) fail('source-changed', 'Emnesiden og PDF-planen oppgir ulike studiepoeng. Avklar riktig emneutgave før import.')
      courses.push(course(source, name, values[0], 'whole-course', `Kildeutdrag: ${name}, ${values[0]} studiepoeng. ${/går over to semester/.test(text) ? 'Kilden sier at hele kurset går over to semestre.' : 'Kilden oppgir ikke et entydig studiesemester.'} Studiepoengene gjelder hele kurset.`))
    }
  }
  const availability = hgutAvailability(html)
  for (const row of courses) { Object.assign(row, availability); if (availability.sourceAvailabilityNote) row.notes += ` ${availability.sourceAvailabilityNote}.` }
  if (availability.sourceAvailabilityNote) requirements.push(availability.sourceAvailabilityNote)
  return { name, model: { id: 'published-modules', name: 'Publiserte kurs og moduler · avklar egen progresjon', periods: [{ id: 'clarified', studySemester: null, requiresStudentStudySemester: true, year: null, semester: null, label: 'Velg faktisk studiesemester og kalendersemester', courses, requirements }] } }
}
export async function hgutPrograms(institution, action, query, { fetchText, fetchBytes }) {
  if (institution !== 'hgut') fail('invalid-selection', 'Ukjent lærested.')
  if (query.sourceUrl) reference(query.sourceUrl)
  const rootHtml = await cachedText(fetchText, home, hgutProgramUrl), root = parseHgutCatalogue(rootHtml), bachelor = root.find(row => /^Bachelor\b/i.test(row.name))
  if (!bachelor) fail('source-changed', 'Studietilbudslisten mangler den publiserte bachelorgraden.')
  const bachelorHtml = await cachedText(fetchText, bachelor.sourceUrl, hgutProgramUrl), all = new Map([...root, ...parseHgutBachelor(bachelorHtml, bachelor.sourceUrl).model.periods.flatMap(period => period.courses).map(row => ({ ...reference(row.sourceUrl), name: row.name, campuses: [] }))].map(row => [row.code, row]))
  if (action === 'programs') return { status: 'ok', results: [...all.values()].filter(row => !query.q || row.name.toLocaleLowerCase('nb').includes(clean(query.q).toLocaleLowerCase('nb'))), warnings: ['Listen viser bachelorgraden og navngitte kurs/moduler fra studietilbudet og bachelorens årsoversikt. Enkelte tilbud kan ha avlyste studieperioder eller en utilgjengelig detaljside.'], completeness: { complete: true, pages: 2, returned: all.size, scope: 'Alle navngitte grads-/kurstilbud i hjemmenavigasjonen og bachelorens årsliste; administrasjon, skreddersøm, utveksling og generelle praksisopplysninger er ikke studieprogrammer.' } }
  const selected = all.get(query.program)
  if (!selected || query.sourceUrl && reference(query.sourceUrl).code !== selected.code) fail('invalid-selection', 'Velg et publisert HGUt-studietilbud fra listen.')
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: 'current', label: 'Gjeldende generell plan · oppgi eget opptakskull', requiresStudentCohort: true, sourceUrl: selected.sourceUrl }], warnings: ['Kildeplanenes revisjonsår er ikke opptakskull. Studenten oppgir sitt kull og kalendersemester.'] }
  if (action !== 'program-plan') fail('not-supported', 'Handlingen støttes ikke av HGUt-programkilden.')
  const cohort = studentCohort(query), html = selected.code === bachelor.code ? bachelorHtml : await cachedText(fetchText, selected.sourceUrl, hgutProgramUrl), $ = load(html), pdfLinks = $('main a[href]').filter((_, anchor) => /^Studieplan/.test(clean($(anchor).text()))).map((_, anchor) => hgutPdfUrl(new URL($(anchor).attr('href'), selected.sourceUrl)).href).get(), warnings = [], pages = []; let complete = true
  // The selected public page, not a client URL, chooses the PDF source.
  if (pdfLinks.length) try { pages.push(...await readLdhPdf(fetchBytes, pdfLinks[0], hgutPdfUrl)) } catch (error) { if (error.name === 'AbortError') throw error; complete = false; warnings.push(`Den publiserte PDF-planen kunne ikke leses: ${error.message}`) }
  const result = selected.code === bachelor.code ? parseHgutBachelor(html, selected.sourceUrl) : parseHgutModule(html, selected.sourceUrl, pages), models = [result.model]
  if (selected.code === bachelor.code) {
    for (const period of result.model.periods) for (const row of period.courses) {
      try { const details = await cachedText(fetchText, row.sourceUrl, hgutProgramUrl), availability = hgutAvailability(details); Object.assign(row, availability); if (availability.sourceAvailabilityNote) { row.notes += ` ${availability.sourceAvailabilityNote}.`; period.requirements.push(`${row.name}: ${availability.sourceAvailabilityNote}.`) } }
      catch (error) { if (error.name === 'AbortError') throw error; complete = false; warnings.push(`${row.name}: detaljsiden kunne ikke hentes (${error.message}). Navn og studiepoeng kommer fortsatt fra bachelorens publiserte årsliste.`) }
    }
    const pdf = pages.flatMap(page => page.lines).map(clean).join(' ')
    if (/takast på de\s*ltid|takast på deltid/i.test(pdf)) models.push({ id: 'published-part-time', name: 'Deltid · avklar individuell semesterplassering', periods: result.model.periods.map(period => { const copy = structuredClone(period); delete copy.allowedStudySemesters; copy.requirements.push('PDF-planen åpner for deltid. Årsgruppen viser normert faglig progresjon; din faktiske semesterplassering må avklares.'); return copy }) })
    if (/Bacheloroppgåva er på 20 stp/i.test(pdf)) warnings.push('PDF-planen beskriver bacheloroppgaven som 20 studiepoeng i siste semester av normert tredjeår. Den inngår i Nyskaping og utviklingsarbeid og er ikke lagt til på toppen av årsgruppens 60 studiepoeng.')
  }
  warnings.push('Emner og moduler er kildedata. Kull, kalendersemester, gruppetilhørighet og personlige studieprogresjoner er ikke antatt. Samlingsantall eller praksisomtaler er ikke gjort om til undervisningshendelser.')
  return { status: 'ok', program: { code: selected.code, name: result.name, sourceUrl: selected.sourceUrl, cohort, cohortFromStudent: true, sourceEdition: sourceEdition(html), campuses: [] }, models, warnings, completeness: { complete, pages: 1 + pages.length, returned: result.model.periods.reduce((n, period) => n + period.courses.length, 0), scope: 'Navngitte emner/moduler i valgt generell kildeplan; ingen verifisert opptakskullversjon eller undervisningskalender.' } }
}
