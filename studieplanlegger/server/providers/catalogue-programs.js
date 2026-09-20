import { load, clean, fail, cachedText, restrictedUrl, collectPages, asCredits, calendarTerm, periodLabel } from './program-source.js'
export const catalogueSettings = {
  inn: { origin: 'https://studiekatalog.edutorium.no', prefix: '/inn/nb', name: 'Universitetet i Innlandet' },
  dmmh: { origin: 'https://studier.dmmh.no', prefix: '/nb', name: 'DMMH' },
}
const contract = institution => { const c = catalogueSettings[institution]; return { origin: c.origin, paths: [new RegExp(`^${c.prefix}/(?:program|emne)(?:/[^/]+/[^/]+)?/?$`)], keys: ['sem', 'study_level', 'title_search', 'page'] } }
export const catalogueUrl = (input, institution) => restrictedUrl(input, contract(institution))
const identity = url => { const match = decodeURI(url.pathname).match(/\/(program|emne)\/([^/]+)\/([^/]+)\/?$/); return match && { kind: match[1], code: match[2], version: match[3] } }
function selectedUrl(query, institution) {
  const url = catalogueUrl(query.sourceUrl, institution), id = identity(url)
  if (!id || id.kind !== 'program' || id.code !== query.program || (query.cohort && id.version !== String(query.cohort))) fail('invalid-selection', 'Program, kull og publisert lenke må samsvare.')
  return url
}
export function parseCataloguePlan(html, { institution, query, sourceUrl }) {
  const $ = load(html), settings = catalogueSettings[institution], models = [], warnings = []
  const cohort = String(query.cohort), program = { code: query.program, name: clean($('#page-title').text()), cohort, sourceUrl, campuses: [] }
  const factLabels = $('.label, dt, .study-facts-label, .facts-label')
  for (const label of factLabels.toArray()) {
    if (/^(Undervisningssted|Studiested|Campus):?$/i.test(clean($(label).text()))) {
      const value = clean($(label).next('.item, dd, .value, .facts-item').text())
      if (value) program.campuses.push(value)
    }
  }
  // The real family uses a separately labelled programme facts list on both hosts.
  $('li').each((_i, node) => {
    const label = $(node).children('.label').first()
    if (/^(Undervisningssted|Studiested|Campus):?$/i.test(clean(label.text()))) {
      const copy = $(node).clone(); copy.children('.label').remove(); const value = clean(copy.text()); if (value) program.campuses.push(value)
    }
  })
  program.campuses = [...new Set(program.campuses)]
  if (!program.name || !cohort || !$('.course-model').length) fail('not-supported', 'Programmet har ingen gjenkjennelig publisert studiemodell. Åpne studieplanen eller bruk dokumentimport.')
  $('table.course-model').each((modelIndex, table) => {
    const name = clean($(table).closest('fieldset').children('legend').text()) || `Studiemodell ${modelIndex + 1}`
    const model = { id: `${query.program}:${cohort}:${$(table).attr('id') || modelIndex}`, name, periods: [] }
    const columns = $(table).find('thead th').toArray().slice(2)
    columns.forEach((column, index) => {
      const label = clean($(column).text()), term = calendarTerm(label, cohort)
      if (!term) { warnings.push(`Uavklart semesterkolonne «${label}» i ${name}; emnene i kolonnen importeres ikke.`); return }
      const period = { id: `${model.id}:${index + 1}`, studySemester: index + 1, ...term, label: periodLabel(index + 1, term), courses: [], requirements: [] }
      $(table).find('tbody tr').each((_row, row) => {
        const cells = $(row).children('td'), value = clean(cells.eq(index + 2).text())
        if (!cells.length || $(row).hasClass('footer') || !value) return
        const first = cells.eq(0), label = clean(first.text()), choice = clean(cells.eq(1).text()), link = first.find('a[href]').first()
        let record, courseUrl
        if (link.length) { courseUrl = catalogueUrl(new URL(link.attr('href'), sourceUrl), institution); record = identity(courseUrl) }
        if (!record || record.kind !== 'emne') { period.requirements.push(`${label}: ${value}`); return }
        const linkedTerm = calendarTerm(record.version.replace('-', ' '), cohort)
        const mismatch = linkedTerm && (linkedTerm.year !== term.year || linkedTerm.semester !== term.semester)
        const course = { id: `${institution}:${record.code}:${term.year}:${term.semester}`, code: record.code, name: label.startsWith(record.code) ? clean(label.slice(record.code.length)) : label, credits: asCredits(value), choice, university: settings.name, description: '', notes: '', sourceUrl: courseUrl.href, sourceRecordId: record.code, sourceProvider: institution, sourceVersion: record.version, ...term, campus: '', allocationText: value }
        if (mismatch) { course.versionUncertain = true; warnings.push(`${record.code}: emnelenkens versjon ${record.version} avviker fra ${period.label}. Emnebeskrivelse må kontrolleres; kolonnens semester beholdes.`) }
        if (value === '-' || asCredits(value) === null) warnings.push(`${record.code}: kilden oppgir «${value}» studiepoeng i ${period.label}. Ingen verdi er gjettet.`)
        if (!['O', 'V'].includes(choice)) warnings.push(`${record.code}: emnetype «${choice || 'ikke oppgitt'}» krever ditt valg.`)
        period.courses.push(course)
      })
      model.periods.push(period)
    })
    const unplaced = $(table).find('tbody tr').filter((_i, row) => !$(row).hasClass('footer') && $(row).children('td').slice(2).toArray().every(node => !clean($(node).text())) && clean($(row).children('td').first().text())).map((_i,row)=>clean($(row).children('td').first().text())).get()
    if (unplaced.length) warnings.push(`Ingen publisert semesterplassering i ${name}: ${unplaced.join('; ')}. Disse radene er ikke flyttet til et antatt semester.`)
    const totalText = clean($(table).find('.footer td').first().text()), expected = Number(totalText.match(/\((\d+)/)?.[1])
    const allocated = model.periods.flatMap(period => period.courses).filter(course=>course.choice === 'O').reduce((sum,course)=>sum+(course.credits || 0),0)
    if (Number.isFinite(expected) && expected < allocated) warnings.push(`Kildens sum «${totalText}» avviker fra obligatoriske emner (${allocated}). Summer er ikke korrigert automatisk.`)
    models.push(model)
  })
  return { status: 'ok', program, models, warnings: [...new Set(warnings), 'Undervisning og personlige grupper er ikke publisert i denne studiemodellen. Bruk kalenderfil eller kalenderlenke for undervisning.'], completeness: { complete: !warnings.some(w=>w.startsWith('Uavklart semester')), pages: 1, returned: models.reduce((n,m)=>n+m.periods.length,0), scope: 'De publiserte studiemodellene på valgt program- og kullside; ikke garanti for et komplett studieløp.' } }
}
export async function cataloguePrograms(institution, action, query, { fetchText }) {
  const config = catalogueSettings[institution], validate = url => catalogueUrl(url,institution)
  if (action === 'programs') {
    const url = new URL(`${config.origin}${config.prefix}/program`)
    if (query.year) url.searchParams.set('sem',String(query.year))
    const data = await collectPages(url.href, fetchText, validate, ($,current) => {
      if (!$('form [name=sem]').length) fail('not-supported','Kildens programliste har endret format.')
      const results = []
      $('a[href]').each((_i,node)=>{ let link; try { link = new URL($(node).attr('href'),current) } catch { return }; if (!link.pathname.includes('/program/')) return; validate(link); const id = identity(link); if (!id || id.kind !== 'program' || !/^\d{4}$/.test(id.version)) return; results.push({code:id.code,name:clean($(node).text()),cohort:id.version,sourceUrl:link.href,campuses:[]}) })
      return {results}
    })
    const q = clean(query.q).toLocaleLowerCase('nb'); return {status:'ok',...data, results:data.results.filter(item=>!q || `${item.code} ${item.name}`.toLocaleLowerCase('nb').includes(q))}
  }
  const url = selectedUrl(query,institution), validateSelected = input => { const target=validate(input); if(target.pathname!==url.pathname)fail('invalid-selection','Kilden videresendte til et annet program eller kull.'); return target }, html = await cachedText(fetchText,url.href,validateSelected)
  if (action === 'program-cohorts') {
    const $ = load(html), results = [{cohort:identity(url).version,label:identity(url).version,sourceUrl:url.href}]
    $('a[href]').each((_i,node)=>{ const link = new URL($(node).attr('href'),url); if (link.hash || link.origin !== url.origin || !link.pathname.includes('/program/')) return; validate(link); const id = identity(link); if (id?.kind==='program' && id.code===query.program && /^\d{4}$/.test(id.version) && !results.some(item=>item.cohort===id.version)) results.push({cohort:id.version,label:clean($(node).text()) || id.version,sourceUrl:link.href}) })
    return {status:'ok',results:results.sort((a,b)=>b.cohort.localeCompare(a.cohort)),warnings:['Kullene er de publiserte lenkene fra valgt programside. Andre kull kan finnes via programlistens årfilter.'],completeness:{complete:false,pages:1,returned:results.length,reason:'Bare kildepubliserte kull-lenker; ingen årstall er gjettet.'}}
  }
  return parseCataloguePlan(html,{institution,query,sourceUrl:url.href})
}
