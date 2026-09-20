import { load } from 'cheerio'
import { cachedText, restrictedUrl } from './program-source.js'
export const courseCodePattern = /(?<![A-ZÆØÅ0-9-])[A-ZÆØÅ]{2,10}(?:-[A-ZÆØÅ]{2,10})*\d{2,6}[A-Z]?(?![A-ZÆØÅ0-9-])/i
const settings = {
  nmbu: { base: 'https://cloud.timeedit.net/nmbu/web/student/', entry: 'ri1Q7.html', sid: '3', types: '5', name: 'NMBU' },
  hvl: { base: 'https://cloud.timeedit.net/hvl/web/pen/', entry: 'ri1Q28.html', sid: '74', types: '36', name: 'HVL' },
}
export async function searchTimeEdit(institution, query, fetchText) {
  const config = settings[institution]
  const params = new URLSearchParams({ max: '100', fr: 't', partajax: 't', im: 'f', sid: config.sid, l: 'nb_NO', search_text: query.q, objects: '', types: config.types })
  if (institution === 'hvl') params.set('fe', `80.${encodeURIComponent(`${query.year} ${query.semester === 'spring' ? 'VÅR' : 'HØST'}`)}`)
  let sourceUrl,all=[],complete=false,pages=0;const extraWarnings=[]
  const validate=input=>restrictedUrl(input,{origin:'https://cloud.timeedit.net',paths:[new RegExp(`^${new URL(config.base).pathname}objects\\.html$`)],keys:['max','fr','partajax','im','sid','l','search_text','objects','types','fe']})
  for(const limit of [100,1000,5000]) {
    params.set('max',String(limit));sourceUrl=`${config.base}objects.html?${params}`
    try {const $=load(await cachedText(fetchText,sourceUrl,validate));const found=$('.searchObject[data-id]').map((_i,node)=>({sourceObjectId:$(node).attr('data-id'),label:$(node).attr('data-name')||$(node).text().replace(/\s+/g,' ').trim()})).get();pages++
      // A smaller result after increasing max is not proof of a complete catalogue.
      if(found.length<all.length || (all.length && JSON.stringify(found)===JSON.stringify(all))){extraWarnings.push('Kilden returnerte samme eller færre treff ved utvidet søk. Det største bekreftede utvalget er beholdt; fullstendighet er ukjent.');break}
      all=found;if(found.length<limit){complete=true;break}
    }catch(error){if(!pages||error.name==='AbortError')throw error;extraWarnings.push(`Utvidet søk kunne ikke hentes: ${error.message}`);break}
  }
  const season = `${query.year} ${query.semester === 'spring' ? 'VÅR' : 'HØST'}`
  const period = all.filter(item => item.label.includes(season))
  const results = period.filter(item => !query.campus || institution === 'nmbu' || item.label.toLowerCase().includes(query.campus.toLowerCase())).map(item => ({ ...item, code: item.label.match(courseCodePattern)?.[0]?.toUpperCase() || query.q, name: item.label, university: config.name, campus: institution === 'hvl' ? item.label : '', campusVerified: institution === 'hvl', semester: query.semester, year: Number(query.year), sourceUrl, entryUrl: `${config.base}${config.entry}` }))
  return { status: results.length ? 'ok' : all.length && !period.length ? 'semester-unavailable' : 'not-found', results, sourceUrl, warnings: ['Offentlig TimeEdit-søk er kontrollert. Emnenavn og gruppenummer kan mangle i kalenderfilen. Velg abonnement i den offentlige timeplanen og importer fil eller lenke.',...extraWarnings,...(!complete?['Kildeutvalget er ufullstendig. Høyst 5000 treff hentes; avgrens søket.']:[])], truncated: !complete, completeness:{complete,pages,returned:all.length} }
}
export async function nmbuDetails(query, fetchText) {
  if (String(query.code || '').match(courseCodePattern)?.[0] !== query.code) return { status: 'not-found', error: 'Oppgi en gyldig emnekode.' }
  const sourceUrl = `https://www.nmbu.no/emne/${query.code.toLowerCase()}`, $ = load(await fetchText(sourceUrl))
  const title = $('main h1').first().text().trim()
  if (!title.toUpperCase().includes(query.code.toUpperCase())) return { status: 'not-found', error: 'Emnet ble ikke funnet hos NMBU.' }
  const year = query.semester === 'spring' ? Number(query.year) - 1 : Number(query.year), selected = $('input[name=semester]').attr('value')
  if (selected !== `${year}-HØST-${year + 1}-VÅR`) return { status: 'semester-unavailable', error: 'NMBUs side returnerte et annet studieår. Ingen data er importert.' }
  const facts = {}; $('.info-item').each((_i, node) => { facts[$(node).find('dt').text().trim()] = $(node).find('dd').text().trim() })
  const credits = /^\d+(?:[.,]\d+)?$/.test(facts.Studiepoeng || '') ? Number(facts.Studiepoeng.replace(',', '.')) : null
  return { status: 'ok', course: { id: `nmbu:${query.code.toUpperCase()}:${query.year}:${query.semester}`, code: query.code.toUpperCase(), name: title.replace(new RegExp(`^${query.code}\\s*`, 'i'), ''), university: 'NMBU', semester: query.semester, year: Number(query.year), credits, campus: facts.Undervisning || '', notes: '', description: '', sourceUrl }, calendarUrl: null, entryUrl: `${settings.nmbu.base}${settings.nmbu.entry}`, warnings: ['Emneinformasjon er hentet fra NMBU. Velg offentlig TimeEdit-abonnement for timeplanen. Beskrivelse er ikke importert.'] }
}
