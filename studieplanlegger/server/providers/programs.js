import { ntnuPrograms } from './ntnu-programs.js'
import { cataloguePrograms } from './catalogue-programs.js'
import { oslometPrograms } from './oslomet-programs.js'
import { usnPrograms } from './usn-programs.js'
import { hvlPrograms } from './hvl-programs.js'
import { nlaPrograms } from './nla-programs.js'
import { uibPrograms } from './uib-programs.js'
import { nmbuPrograms } from './nmbu-programs.js'
import { vidPrograms } from './vid-programs.js'
import { semesterTablePrograms } from './semester-table-programs.js'
import { uisPrograms } from './uis-programs.js'
import { mfPrograms } from './mf-programs.js'
import { hltPrograms } from './hlt-programs.js'
import { ldhPrograms } from './ldh-programs.js'
import { webflowPrograms } from './webflow-programs.js'
import { biPrograms } from './bi-programs.js'
import { nhhPrograms } from './nhh-programs.js'
import { fihPrograms } from './fih-programs.js'
import { krusPrograms } from './krus-programs.js'
import { kristianiaPrograms } from './kristiania-programs.js'
import { ansgarPrograms } from './ansgar-programs.js'
import { fhsPrograms } from './fhs-programs.js'
import { khioPrograms } from './khio-programs.js'
import { onhPrograms } from './onh-programs.js'
import { limpiPrograms } from './limpi-programs.js'
import { barrattduePrograms } from './barrattdue-programs.js'
import { nbiPrograms } from './nbi-programs.js'
import { nmhPrograms } from './nmh-programs.js'
import { hfyPrograms } from './hfy-programs.js'
import { basPrograms } from './bas-programs.js'
import { phsPrograms } from './phs-programs.js'
import { gestaltPrograms } from './gestalt-programs.js'
import { nhfhPrograms } from './nhfh-programs.js'
import { hgutPrograms } from './hgut-programs.js'
import { nskiPrograms } from './nski-programs.js'
import { samasPrograms } from './samas-programs.js'
import { uitPrograms } from './uit-programs.js'
import { nordPrograms } from './nord-programs.js'
import { uiaPrograms } from './uia-programs.js'
import { uioPrograms } from './uio-programs.js'
import { vortexPrograms } from './vortex-programs.js'
import { skrivekunstPrograms } from './skrivekunst-programs.js'
import { ahoPrograms } from './aho-programs.js'
export const programProviders = ['ntnu','inn','dmmh','oslomet','usn','hvl','nla','uib','nmbu','vid','hivolda','noroff','uis','mf','hlt','ldh','steiner','hfdk','bi','nhh','fih','krus','kristiania','ansgar','fhs','khio','onh','limpi','barrattdue','nbi','nmh','hfy','bas','phs','gestalt','nhfh','hgut','nski','samas','uit','nord','uia','uio','himolde','nih','hiof','skrivekunst','aho']
export async function programsRequest(institution, action, query, dependencies) {
  if (institution==='ntnu') return ntnuPrograms(action,query,dependencies)
  if (institution==='uit') return uitPrograms(institution,action,query,dependencies)
  if (institution==='nord') return nordPrograms(action,query,dependencies)
  if (institution==='uia') return uiaPrograms(action,query,dependencies)
  if (institution==='uio') return uioPrograms(institution,action,query,dependencies)
  if (['himolde','nih','hiof'].includes(institution)) return vortexPrograms(institution,action,query,dependencies)
  if (institution==='skrivekunst') return skrivekunstPrograms(institution,action,query,dependencies)
  if (institution==='aho') return ahoPrograms(institution,action,query,dependencies)
  if (['inn','dmmh'].includes(institution)) return cataloguePrograms(institution,action,query,dependencies)
  if (institution==='oslomet') return oslometPrograms(institution,action,query,dependencies)
  if (institution==='usn') return usnPrograms(institution,action,query,dependencies)
  if (institution==='hvl') return hvlPrograms(institution,action,query,dependencies)
  if (institution==='nla') return nlaPrograms(institution,action,query,dependencies)
  if (institution==='uib') return uibPrograms(institution,action,query,dependencies)
  if (institution==='nmbu') return nmbuPrograms(institution,action,query,dependencies)
  if (institution==='vid') return vidPrograms(institution,action,query,dependencies)
  if (['hivolda','noroff'].includes(institution)) return semesterTablePrograms(institution,action,query,dependencies)
  if (institution==='uis') return uisPrograms(institution,action,query,dependencies)
  if (institution==='mf') return mfPrograms(institution,action,query,dependencies)
  if (institution==='hlt') return hltPrograms(institution,action,query,dependencies)
  if (institution==='ldh') return ldhPrograms(institution,action,query,dependencies)
  if (['steiner','hfdk'].includes(institution)) return webflowPrograms(institution,action,query,dependencies)
  if (institution==='bi') return biPrograms(institution,action,query,dependencies)
  if (institution==='nhh') return nhhPrograms(institution,action,query,dependencies)
  if (institution==='fih') return fihPrograms(institution,action,query,dependencies)
  if (institution==='krus') return krusPrograms(institution,action,query,dependencies)
  if (institution==='kristiania') return kristianiaPrograms(institution,action,query,dependencies)
  if (institution==='ansgar') return ansgarPrograms(institution,action,query,dependencies)
  if (institution==='fhs') return fhsPrograms(institution,action,query,dependencies)
  if (institution==='khio') return khioPrograms(institution,action,query,dependencies)
  if (institution==='onh') return onhPrograms(institution,action,query,dependencies)
  if (institution==='limpi') return limpiPrograms(institution,action,query,dependencies)
  if (institution==='barrattdue') return barrattduePrograms(institution,action,query,dependencies)
  if (institution==='nbi') return nbiPrograms(institution,action,query,dependencies)
  if (institution==='nmh') return nmhPrograms(institution,action,query,dependencies)
  if (institution==='hfy') return hfyPrograms(institution,action,query,dependencies)
  if (institution==='bas') return basPrograms(institution,action,query,dependencies)
  if (institution==='phs') return phsPrograms(institution,action,query,dependencies)
  if (institution==='gestalt') return gestaltPrograms(institution,action,query,dependencies)
  if (institution==='nhfh') return nhfhPrograms(institution,action,query,dependencies)
  if (institution==='hgut') return hgutPrograms(institution,action,query,dependencies)
  if (institution==='nski') return nskiPrograms(institution,action,query,dependencies)
  if (institution==='samas') return samasPrograms(institution,action,query,dependencies)
  return {status:'not-supported',error:'Direkte programimport er ikke implementert for denne institusjonen. Se datatypene og kildene nedenfor, eller bruk dokument, kalender eller manuell registrering.'}
}
