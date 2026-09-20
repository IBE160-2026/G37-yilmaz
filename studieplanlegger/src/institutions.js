import { institutionEvidence } from './institution-evidence.js'
export const INVENTORY_SOURCE = 'https://www.nokut.no/hogare-utdanning/akkrediterte-institusjonar/'
export const INVENTORY_CHECKED = '2026-09-12'
// Complete NOKUT inventory: 11 universities, 9 specialized, 15 accredited,
// 14 institutions with accredited programmes. Inventory is not import coverage.
const groups = {
  university: [
    ['nord','Nord universitet','www.nord.no'], ['nmbu','Norges miljø- og biovitenskapelige universitet','www.nmbu.no'], ['ntnu','NTNU Norges teknisk-naturvitenskapelige universitet','www.ntnu.no'], ['oslomet','OsloMet - storbyuniversitetet','www.oslomet.no'], ['uit','UiT Norges arktiske universitet','www.uit.no'], ['uia','Universitetet i Agder','www.uia.no'], ['uib','Universitetet i Bergen','www.uib.no'], ['inn','Universitetet i Innlandet','www.inn.no'], ['uio','Universitetet i Oslo','www.uio.no'], ['uis','Universitetet i Stavanger','www.uis.no'], ['usn','Universitetet i Sørøst-Norge','www.usn.no'],
  ],
  specialized: [
    ['aho','Arkitektur- og designhøgskolen i Oslo','www.aho.no'], ['mf','MF vitenskapelig høyskole for teologi, religion og samfunn','www.mf.no'], ['bi','Handelshøyskolen BI','www.bi.no'], ['himolde','Høgskolen i Molde - vitenskapelig høgskole i logistikk','www.himolde.no'], ['khio','Kunsthøgskolen i Oslo','www.khio.no'], ['nhh','Norges Handelshøyskole','www.nhh.no'], ['nih','Norges idrettshøgskole','www.nih.no'], ['nmh','Norges musikkhøgskole','www.nmh.no'], ['vid','VID vitenskapelige høgskole','www.vid.no'],
  ],
  accredited: [
    ['ansgar','Ansgar Høyskole','ansgarhoyskole.no'], ['bas','Bergen Arkitekthøgskole','bas.org'], ['dmmh','Dronning Mauds Minne Høgskole for barnehagelærerutdanning','www.dmmh.no'], ['fih','Fjellhaug Internasjonale Høgskole','fih.fjellhaug.no'], ['fhs','Forsvarets høgskole','forsvaret.no/fhs'], ['hivolda','Høgskulen i Volda','www.hivolda.no'], ['hiof','Høgskolen i Østfold','www.hiof.no'], ['hlt','Høyskolen for ledelse og teologi','hlt.no'], ['kristiania','Høyskolen Kristiania','kristiania.no'], ['hvl','Høgskulen på Vestlandet','www.hvl.no'], ['ldh','Lovisenberg diakonale høgskole','ldh.no'], ['nla','NLA Høgskolen','www.nla.no'], ['phs','Politihøgskolen','www.phs.no'], ['samas','Sámi allaskuvla/Samisk høgskole','samas.no/nb'], ['steiner','Steinerhøyskolen','www.steinerhoyskolen.no'],
  ],
  programmes: [
    ['barrattdue','Barratt Due Musikkinstitutt','www.barrattdue.no'], ['ekko','Ekko Digitale AS',null], ['hgut','Høgskulen for grøn utvikling (HGUt)','www.hlb.no'], ['hfdk','Høyskolen for dansekunst','hfdk.no'], ['hfy','Høyskolen for yrkesfag','www.hfy.no'], ['krus','Kriminalomsorgens høgskole og utdanningssenter KRUS','www.krus.no'], ['limpi','Lillehammer Institute of Music Production and Industries (LIMPI)','limpimusic.com'], ['nhfh','Norges Høyskole for Helsefag','nhfh.no'], ['noroff','Noroff','www.noroff.no'], ['nbi','Norsk barnebokinstitutt','www.barnebokinstituttet.no'], ['gestalt','Norsk Gestaltinstitutt','www.gestalt.no'], ['nski','NSKI Høyskole','nski.no'], ['onh','Oslo Nye Høyskole','oslonyehoyskole.no'], ['skrivekunst','Skrivekunstakademiet','www.skrivekunst.no'],
  ],
}
export const institutions = Object.entries(groups).flatMap(([category, items]) => items.map(([id, name, site]) => ({ id, name, category, website: site ? `https://${site}/` : null, inventorySource: INVENTORY_SOURCE, checkedAt: INVENTORY_CHECKED, datatypes: institutionEvidence(id,name), capabilities: {
  courseSearch: id === 'ntnu' ? 'verified-code-name-campus' : ['uib','uit','nmh','samas'].includes(id) ? 'public-code-name-metadata' : ['nmbu','hvl'].includes(id) ? 'verified-timeedit-code-semester' : 'not-verified',
  courseDetails: ['ntnu','nmbu','uib','uit'].includes(id) ? 'verified-public' : ['nmh','samas'].includes(id) ? 'implemented-public' : id === 'hvl' ? 'timeedit-label-only' : 'not-verified',
  publicTimetable: ['ntnu','nmbu','hvl','usn','mf','nhh'].includes(id) ? 'verified-public-ics' : ['nmh','khio','samas','ldh','hfy','gestalt','ansgar','fih','steiner','hivolda','uit','uib','oslomet','nord','inn','uis','uio','uia','himolde','hiof','nih'].includes(id)?'implemented-public-ics':'not-verified',
  programImport: ['ntnu','inn','dmmh','oslomet','usn','hvl','nla','uib','nmbu','vid','hivolda','noroff','uis','mf','hlt','ldh','steiner','hfdk','bi','nhh','fih','krus','kristiania','ansgar','fhs','khio','onh','limpi','barrattdue','nbi','nmh','hfy','bas','phs','gestalt','nhfh','hgut','nski','samas','uit','nord','uia','uio','himolde','nih','hiof','skrivekunst','aho'].includes(id)?'implemented-public':'not-implemented',
  personalTimetable: ['nord','ntnu','oslomet','uit','uib','uio','uis','usn','mf','bi','himolde','nhh','vid','dmmh','fhs','hiof','hlt','kristiania','nla','phs','hfdk','krus','nhfh','noroff','onh'].includes(id)?'requires-institution-access':'no-suitable-anonymous-source', nationalCatalogue: 'optional-sikt-route', fileImport: true,
} })))
export const institutionById = id => institutions.find(item => item.id === id)
