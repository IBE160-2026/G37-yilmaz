import {spawnSync} from 'node:child_process'
import {publicTp} from '../server/providers/public-tp.js'
import {fetchPublicText,universityProviders} from '../server/import-api.js'
import {parseCalendar} from '../src/calendar-import.js'

const live=process.argv.includes('--live')
if(!live){
  const files=[
    'tests/unit/public-tp.test.js','tests/unit/public-timeedit.test.js','tests/unit/khio-teaching.test.js',
    'tests/unit/ansgar-calendar.test.js','tests/unit/fih-calendar.test.js','tests/unit/gestalt-calendar.test.js',
    'tests/unit/hfy-calendar.test.js','tests/unit/phs-calendar.test.js','tests/unit/plandisc-calendar.test.js',
    'tests/unit/teaching-check.test.js'
  ]
  const command=process.platform==='win32'?process.env.ComSpec:'npm'
  const args=process.platform==='win32'?['/d','/s','/c','npm.cmd','run','test','--',...files]:['run','test','--',...files]
  const result=spawnSync(command,args,{cwd:new URL('..',import.meta.url),stdio:'inherit'})
  process.exitCode=result.status??1
}else{
  const samples=[
    ...['IBE110','IBE430','IBE160'].map(code=>({institution:'HiMolde',code,run:async()=>{const result=await publicTp('himolde','teaching-calendar',{q:code,year:'2026',semester:'autumn',sourceObjectId:`${code}¤1`},{fetchText:fetchPublicText});return result.eventCount}})),
    ...['ARK1001','EXPH0100'].map(code=>({institution:'NTNU',code,run:async()=>{const detail=await universityProviders.ntnu({code,year:'2026',semester:'autumn'});if(!detail.calendarUrl)throw new Error('Kilden publiserte ingen TP-kalenderlenke.');const calendar=await fetchPublicText(detail.calendarUrl),parsed=parseCalendar(calendar,{courseId:`ntnu:${code}:2026:autumn`,year:2026,semester:'autumn'});return parsed.events.length}}))
  ]
  let cursor=0,failed=false
  async function worker(){for(;;){const index=cursor++;if(index>=samples.length)return;const sample=samples[index],started=Date.now();try{const eventCount=await sample.run();console.log(JSON.stringify({institution:sample.institution,course:sample.code,status:eventCount?'ok':'empty',eventCount,durationMs:Date.now()-started}))}catch(error){failed=true;console.log(JSON.stringify({institution:sample.institution,course:sample.code,status:error.status||error.name||'error',error:String(error.message||error).slice(0,300),durationMs:Date.now()-started}))}}}
  await Promise.all([worker(),worker()])
  if(failed)process.exitCode=1
}
