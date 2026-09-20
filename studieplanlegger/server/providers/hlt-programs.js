import { load, clean, fail, cachedText, restrictedUrl, collectPages } from './program-source.js'
import { sourceEdition, studentCohort, unknownPeriod, coursesFromLinks, textWithSpaces } from './current-program-source.js'

const origin = 'https://hlt.no', catalogue = `${origin}/studietilbud/`
export const hltProgramUrl = input => restrictedUrl(input, { origin, paths: [/^\/(?:[a-z\d_-]+\/){1,2}$/i], keys: ['page'] })
const ref = input => { const url = hltProgramUrl(input); if (url.search) fail('invalid-selection', 'Velg en HLT-programside uten søkeparametere.'); return { url, code: url.pathname.replace(/^\/+|\/+$/g, '') } }
const selectedProgramUrl = selected => {
  const expected = ref(selected)
  return input => {
    const actual = ref(input)
    if (actual.code !== expected.code || actual.url.pathname.replace(/\/$/, '') !== expected.url.pathname.replace(/\/$/, '')) fail('source-changed', 'HLT videresendte til et annet program enn det studenten valgte.')
    return actual.url
  }
}
export function parseHltCards(html, sourceUrl) {
  const $ = load(html), results = []
  $('.main_content > a.image-link[href]').each((_, link) => {
    const source = ref(new URL($(link).attr('href'), sourceUrl)), parent = $(link).parent(), name = textWithSpaces($, parent.children('h2,h3,h4').first())
    if (!name) return
    const campus = clean(parent.children('.text').first().text())
    results.push({ code: source.code, name, sourceUrl: source.url.href, campuses: campus ? [campus] : [] })
  })
  return results
}
export function parseHltPlan(html, query) {
  const source = ref(query.sourceUrl), cohort = studentCohort(query), $ = load(html), name = clean($('h1').first().text()), edition = sourceEdition(html)
  if (source.code !== query.program || !name) fail('invalid-selection', 'Programmet stemmer ikke med HLT-siden.')
  const section = $('.studieplan-section'), alternatives = section.find('.studieplan-alt'), models = [], warnings = []
  const ordinal = ['første', 'andre', 'tredje', 'fjerde', 'femte', 'sjette', 'sjuende', 'åttende']
  const containers = alternatives.length ? alternatives.toArray() : section.toArray()
  for (const [index, container] of containers.entries()) {
    const id = $(container).attr('id') || `published-${index + 1}`, label = clean(section.find('button[data-target]').filter((_, button) => $(button).attr('data-target') === id).text()) || 'Publisert studiemodell', periods = []
    const copy = $(container).clone()
    copy.find('strong').each((_, heading) => {
      const header = clean($(heading).text()), numeric = header.match(/^(\d{1,2})\.?\s*semester$/i), word = header.match(/^(\p{L}+)\s+semester$/iu), number = numeric ? Number(numeric[1]) : word ? ordinal.indexOf(word[1].toLocaleLowerCase('nb')) + 1 : 0
      if (!number) { if (/semester/i.test(header)) fail('source-changed', 'En studiesemesteroverskrift i HLT-planen har endret format.'); return }
      if (number > 40) fail('source-changed', 'HLT-semesteret er utenfor importgrensen.')
      $(heading).replaceWith(`<!--study-period:${number}-->`)
    })
    // HLT uses both separate class-info blocks and headings nested inside them.
    // Split at the actual source headings, including malformed nested paragraphs.
    const parts = copy.html().split(/<!--study-period:(\d+)-->/)
    for (let part = 1; part < parts.length; part += 2) {
      const number = Number(parts[part])
      if (periods.some(period => period.studySemester === number)) fail('source-changed', 'HLT-modellen har flere rader med samme studiesemester. Ingen alternative løp er slått sammen.')
      const fragment = load(parts[part + 1]), content = fragment.root()
      const period = unknownPeriod(number), parsed = coursesFromLinks(fragment, content, { sourceUrl: source.url.href, courseUrl: input => ref(input).url, institution: 'hlt', university: 'Høyskolen for ledelse og teologi', scope: `${source.code}:${cohort}:${id}`, number })
      const term = clean(content.text()).match(/^(høst|vår)(?:\s|$)/i)?.[1]
      if (term) { period.semester = /^vår$/i.test(term) ? 'spring' : 'autumn'; period.label = `${number}. studiesemester · ${term.toLocaleLowerCase('nb')} · avklar år` }
      period.courses = parsed.courses.map(course => ({ ...course, sourceVersion: 'current', semester: period.semester }))
      period.requirements = [parsed.text]
      // Links to a whole PDF programme are requirements, not course records.
      if (/valgfritt emne|starter|fullføres|eller/i.test(parsed.text)) warnings.push(`${label}, ${number}. semester: kontroller kildeutdragets valg og fordeling av praksis.`)
      periods.push(period)
    }
    if (periods.some(period => period.courses.length)) models.push({ id, name: label, periods: periods.sort((a, b) => a.studySemester - b.studySemester) })
  }
  if (!models.length) fail('not-supported', 'HLT-programsiden har ingen gjenkjennelig offentlig semester-/emnemodell. Kilden kan ha en PDF eller en annen oppbygning; bruk dokumentimport eller registrer fra kilden.')
  warnings.push('Dette er den gjeldende publiserte HLT-programsiden. Den verifiserer ikke ditt opptakskull eller et kalenderår. Kull og kalenderår må oppgis og kontrolleres av deg.', 'Velg emnene fra den faktiske studieretningen og kontroller valgreglene. Emnekoder og studiepoeng som mangler i lenketeksten beholdes ukjent; detaljer, undervisning og NOA-grupper er separate kilder.')
  return { status: 'ok', program: { code: source.code, name, cohort, cohortFromStudent: true, sourceEdition: edition, sourceUrl: source.url.href, campuses: [] }, models, warnings: [...new Set(warnings)], completeness: { complete: true, pages: 1, returned: models.reduce((n, model) => n + model.periods.flatMap(period => period.courses).length, 0), scope: 'Alle emnelenker i den gjeldende sidens publiserte studiemodeller; emnekode, kullår og undervisning er ikke antatt.' } }
}
export async function hltPrograms(institution, action, query, { fetchText }) {
  if (action === 'programs') {
    const html = await cachedText(fetchText, catalogue, hltProgramUrl), categories = parseHltCards(html, catalogue).filter(item => !/enkeltemne/i.test(item.name)), all = new Map(), warnings = []
    if (!categories.length) fail('source-changed', 'HLT-studietilbudet har ingen gjenkjennelige kategorikort.')
    let pages = 1, complete = true
    for (const category of categories) {
      try {
        const data = await collectPages(category.sourceUrl, fetchText, hltProgramUrl, ($, url) => {
          const results = parseHltCards($.html(), url)
          if (!results.length) fail('source-changed', 'Programkategorien har ingen gjenkjennelige programkort.')
          return { results }
        })
        for (const item of data.results) all.set(item.sourceUrl, item)
        pages += data.completeness.pages; complete &&= data.completeness.complete; warnings.push(...data.warnings)
      } catch (error) { if (error.name === 'AbortError') throw error; complete = false; warnings.push(`${category.name}: ${error.message} De øvrige programmene er beholdt.`) }
    }
    const q = clean(query.q).toLocaleLowerCase('nb')
    return { status: 'ok', results: [...all.values()].filter(item => !q || `${item.code} ${item.name}`.toLocaleLowerCase('nb').includes(q)), warnings: [...warnings, 'Programlisten er gjeldende tilbud, ikke et år- eller kullarkiv. Bekreft selv at programmodellen gjelder ditt kull.'], completeness: { complete, pages, returned: all.size, scope: 'Programkort fra kategoriene som HLT selv lenker til i studietilbudet.' } }
  }
  const source = ref(query.sourceUrl)
  if (source.code !== query.program) fail('invalid-selection', 'Programmet må stemme med valgt HLT-kildelenke.')
  const html = await cachedText(fetchText, source.url.href, selectedProgramUrl(source.url))
  if (action === 'program-cohorts') return { status: 'ok', results: [{ cohort: 'current', label: 'Gjeldende programside – oppgi ditt eget kull', sourceUrl: source.url.href, requiresStudentCohort: true }], warnings: ['Programsidens plan har ingen bekreftet kullvelger. Oppgi ditt eget kull og kontroller planens gyldighet.'], completeness: { complete: false, pages: 1, returned: 1, scope: 'Gjeldende programside, ikke kullarkiv.' } }
  if (action === 'program-plan') return parseHltPlan(html, query)
  fail('not-supported', 'Handlingen støttes ikke av HLT-programkilden.')
}
