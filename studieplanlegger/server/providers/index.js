import { institutionById } from '../../src/institutions.js'
import { searchNtnu } from './ntnu.js'
import { searchTimeEdit, nmbuDetails } from './timeedit.js'
import { searchUib, uibDetails } from './uib.js'
import { searchUit, uitDetails } from './uit.js'
import { programsRequest } from './programs.js'
import { publicTimeEdit } from './public-timeedit.js'
import { publicTp, publicTpInstitutions } from './public-tp.js'
import { kristianiaDetails } from './kristiania-programs.js'
import { khioDetails } from './khio-programs.js'
import { searchNmh, nmhDetails } from './nmh-programs.js'
import { phsDetails } from './phs-programs.js'
import { searchSamas, samasDetails } from './samas-programs.js'
export async function providerRequest(institution, action, query, { fetchText, fetchBytes, ntnuDetails }) {
  const provider = institutionById(institution)
  if (!provider) return { status: 'not-found', error: 'Institusjonen finnes ikke i den lokale NOKUT-oversikten.' }
  try {
    if (['programs','program-cohorts','program-plan'].includes(action)) {
      if (query.q?.length > 120 || query.sourceUrl?.length > 2048 || query.program?.length > 200 || query.cohort?.length > 20 || (query.year && (!/^\d{4}$/.test(String(query.year)) || Number(query.year)<1900 || Number(query.year)>2200))) return {status:'invalid-selection',error:'Programvalget inneholder ugyldige eller for lange felt.'}
      return await programsRequest(institution, action, query, {fetchText, fetchBytes})
    }
    if (!['spring', 'autumn'].includes(query.semester) || !/^\d{4}$/.test(String(query.year)) || Number(query.year) < 1900 || Number(query.year) > 2200) return { status: 'semester-unavailable', error: 'Velg semester og gyldig år.' }
    if (['teaching-search','teaching-calendar'].includes(action)) return await (publicTpInstitutions.includes(institution)?publicTp:publicTimeEdit)(institution, action, query, { fetchText })
    if (institution==='kristiania'&&action==='details') return await kristianiaDetails(query,fetchText)
    if (institution==='khio'&&action==='details') return await khioDetails(query,fetchText)
    if (institution==='nmh'&&action==='details') return await nmhDetails(query,fetchText)
    if (institution==='nmh'&&action==='search') return await searchNmh(query,fetchText)
    if (institution==='phs'&&action==='details') return await phsDetails(query,fetchText)
    if (institution==='samas'&&action==='details') return await samasDetails(query,fetchText)
    if (institution==='samas'&&action==='search') return await searchSamas(query,fetchText)
    if (!['ntnu', 'nmbu', 'hvl', 'uib', 'uit'].includes(institution)) return { status:'not-supported', provider, error:'Direkte emnesøk er ikke implementert for denne institusjonen. Offentlige kilder og datatypebegrensninger vises i kildeoversikten. Bruk programimport der den finnes, dokument, kalender eller manuell registrering.' }
    if (action === 'search') {
      if (!query.q?.trim() || query.q.length > 120) return { status: 'not-found', results: [], error: 'Skriv en emnekode eller et navn (maks 120 tegn).' }
      if (institution === 'uib') return await searchUib(query, fetchText)
      if (institution === 'uit') return await searchUit(query, fetchText)
      return institution === 'ntnu' ? await searchNtnu(query, fetchText) : await searchTimeEdit(institution, query, fetchText)
    }
    if (action === 'details' && institution === 'ntnu') return { status: 'ok', ...await ntnuDetails(query) }
    if (action === 'details' && institution === 'nmbu') return await nmbuDetails(query, fetchText)
    if (action === 'details' && institution === 'uib') return await uibDetails(query, fetchText)
    if (action === 'details' && institution === 'uit') return await uitDetails(query, fetchText)
    return { status: 'not-supported', error: 'Detaljert emnekatalog er ikke verifisert. Behold det valgte TimeEdit-emnet og fyll inn manglende emneinformasjon manuelt.' }
  } catch (error) {
    return { status: error.status || (/HTTP (404|410)/.test(error.message) ? 'not-found' : /studieår/.test(error.message) ? 'semester-unavailable' : /Fant ikke emnet/.test(error.message) ? 'not-found' : 'transport-error'), error: error.message }
  }
}
