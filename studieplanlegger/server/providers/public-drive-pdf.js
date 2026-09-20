import {fail,cachedText} from './program-source.js'
export function publicDriveViewer(input){const url=new URL(input.href||input);if(url.origin!=='https://drive.google.com'||!/^\/file\/d\/[A-Za-z0-9_-]{15,100}\/view$/.test(url.pathname)||url.username||url.password||url.hash||[...url.searchParams].some(([key,value])=>key!=='usp'||value!=='sharing'))fail('invalid-selection','Velg den offentlige PDF-visningslenken som institusjonen publiserer.');return url}
export function publicDriveDownloadGuard(fileId){return input=>{const url=new URL(input.href||input);if(url.origin!=='https://drive.usercontent.google.com'||!['/uc','/download'].includes(url.pathname)||url.username||url.password||url.hash||url.searchParams.get('id')!==fileId||url.searchParams.get('export')!=='download'||[...url.searchParams.keys()].some(key=>!['id','export'].includes(key))||[...url.searchParams.keys()].length!==2)fail('invalid-selection','PDF-nedlastingen samsvarer ikke med institusjonens offentlige fil.');return url}}
export function readPublicDriveMetadata(html,viewerUrl){
  const viewer=publicDriveViewer(viewerUrl),start=html.indexOf('itemJson:');if(start<0)fail('not-supported','Den offentlige PDF-visningen gir ingen publisert nedlastingslenke. Innlogging er ikke forsøkt.')
  const begin=html.indexOf('[',start);let depth=0,quoted=false,escaped=false,end=-1
  for(let index=begin;index<html.length&&index<begin+500000;index++){const c=html[index];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"')quoted=true;else if(c==='[')depth++;else if(c===']'&&!--depth){end=index+1;break}}
  let data;try{data=JSON.parse(html.slice(begin,end))}catch{fail('source-changed','Den offentlige PDF-visningens metadata kunne ikke leses.')}
  const fileId=viewer.pathname.split('/')[3],guard=publicDriveDownloadGuard(fileId),download=data.find(value=>typeof value==='string'&&value.startsWith('https://drive.usercontent.google.com/'))
  if(!download)fail('not-supported','Ingen anonym nedlastingslenke er publisert for studieplanen.')
  return{name:typeof data[1]==='string'?data[1]:'Offentlig studieplan',downloadUrl:guard(download).href,validateDownload:guard}
}
export async function publicDrivePdfMetadata(sourceUrl,fetchText){publicDriveViewer(sourceUrl);return readPublicDriveMetadata(await cachedText(fetchText,sourceUrl,publicDriveViewer),sourceUrl)}
