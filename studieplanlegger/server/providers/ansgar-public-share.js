import {fail} from './program-source.js'
const origin='https://ansgarskolenno-my.sharepoint.com',personal='/personal/kvalitet_ansgarskolen_no/'
export function ansgarPublicShareUrl(input){const url=new URL(input.href||input);if(url.origin!==origin||url.username||url.password||url.hash||!/^\/:b:\/g\/personal\/kvalitet_ansgarskolen_no\/[A-Za-z0-9_-]{20,100}$/.test(url.pathname)||[...url.searchParams.keys()].some(key=>key!=='e')||url.searchParams.has('e')&&!/^[A-Za-z0-9_-]{1,30}$/.test(url.searchParams.get('e')))fail('invalid-selection','Velg Ansgars publiserte anonyme PDF-lenke.');return url}
function previewUrl(input){const url=new URL(input.href||input);if(url.pathname.startsWith('/:b:/'))return ansgarPublicShareUrl(url);if(url.origin!==origin||url.username||url.password||url.hash||url.pathname!==personal+'_layouts/15/onedrive.aspx'||[...url.searchParams.keys()].some(key=>!['id','parent','ga'].includes(key))||!url.searchParams.get('id')?.startsWith(personal+'Documents/')||!url.searchParams.get('id')?.toLowerCase().endsWith('.pdf')||url.searchParams.get('parent')&&!url.searchParams.get('parent').startsWith(personal+'Documents/'))fail('not-supported','Den offentlige delingslenken viser ikke en anonym PDF. Innlogging er ikke forsøkt.');return url}
export function ansgarPublishedDownload(html){
  const match=html.match(/"\.downloadUrl"\s*:\s*("(?:[^"\\]|\\.)*")/),name=html.match(/"FileLeafRef"\s*:\s*("(?:[^"\\]|\\.)*")/)
  let url;try{url=new URL(JSON.parse(match?.[1]));}catch{fail('not-supported','Ingen anonym PDF-nedlasting er publisert i denne delingsvisningen.')}
  if(url.origin!==origin||url.username||url.password||url.hash||url.pathname!==personal+'_layouts/15/download.aspx'&&url.pathname!=='/_layouts/15/download.aspx'||[...url.searchParams.keys()].some(key=>!['UniqueId','Translate','tempauth'].includes(key))||!url.searchParams.get('UniqueId')||!url.searchParams.get('tempauth'))fail('source-changed','Den publiserte nedlastingsadressen har en ukjent kontrakt.')
  const exact=url.href,validate=input=>{const candidate=new URL(input.href||input);if(candidate.href!==exact)fail('source-changed','PDF-nedlastingen ble videresendt utenfor den publiserte adressen.');return candidate}
  return{url:exact,name:name?JSON.parse(name[1]):'Ansgar offentlig timeplan',validate}
}
export async function readAnsgarSharedPdf(sourceUrl,{fetchText,fetchBytes}){
  ansgarPublicShareUrl(sourceUrl);const anonymousShare={origin,cookies:new Map()}
  try{const html=await fetchText(sourceUrl,0,previewUrl,{anonymousShare}),meta=ansgarPublishedDownload(html),bytes=await fetchBytes(meta.url,0,meta.validate,{anonymousShare,maxBytes:10000000});return{bytes,name:meta.name}}
  finally{anonymousShare.cookies.clear()}
}
