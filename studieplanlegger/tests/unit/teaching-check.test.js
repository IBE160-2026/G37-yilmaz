import {describe,expect,it} from 'vitest'
import {emptyPlanner,nextTeachingCheck,validPlanner} from '../../src/planner.js'
import {recordChange,undoLast} from '../../src/history.js'
import {exportBackup,previewBackup} from '../../src/backup.js'
import {validEnvelope} from '../../src/storage.js'
import {teachingCheckText,teachingOutcome,failedCalendarRefresh} from '../../src/teaching-check.js'
import {createCalendarSync} from '../../src/calendar-sync.js'

const course=(teachingCheck)=>({id:'course',code:'IBE160',name:'Programmering med KI',university:'HiMolde',semester:'autumn',year:2026,notes:'',...(teachingCheck?{teachingCheck}:{})})
const state=teachingCheck=>({schemaVersion:1,tasks:[],planner:{...emptyPlanner(),courses:[course(teachingCheck)]}})

describe('persisted teaching checks',()=>{
  it('manual source failure preserves all event choices and last success while updating only failed-check bookkeeping',()=>{
    const previous=state(nextTeachingCheck('success',undefined,{now:new Date('2026-09-24T08:00:00Z'),eventCount:12})).planner
    previous.sources=[{id:'source',courseId:'course',kind:'url',url:'https://example.test/public.ics',name:'Syntetisk offentlig kilde',groups:['g'],excludedKeys:['hidden'],lastUpdated:'2026-09-24T08:00:00.000Z',lastSuccess:'2026-09-24T08:00:00.000Z'}]
    previous.events=[{id:'event',courseId:'course',sourceId:'source',sourceKey:'stable',title:'Syntetisk undervisning',start:'2026-10-01T08:00:00Z',end:'2026-10-01T09:00:00Z',notes:'',group:'g',excluded:true}]
    const raw=JSON.stringify(previous),now=new Date('2026-09-25T08:00:00Z')
    const next=failedCalendarRefresh(previous,'source',Object.assign(new Error('Syntetisk timeout'),{status:'timeout'}),{now})
    expect(JSON.stringify(previous)).toBe(raw)
    expect(next.events).toEqual(previous.events)
    expect(next.sources[0]).toMatchObject({groups:['g'],excludedKeys:['hidden'],lastSuccess:'2026-09-24T08:00:00.000Z',lastAttempt:now.toISOString(),failures:1})
    expect(next.courses[0].teachingCheck).toMatchObject({status:'timeout',lastSuccess:'2026-09-24T08:00:00.000Z',lastAttempt:now.toISOString(),eventCount:12})
    expect(recordChange({schemaVersion:1,tasks:[],planner:previous},{schemaVersion:1,tasks:[],planner:next}).undo).toEqual([])
    expect(validPlanner(next)).toBe(true)
    expect(failedCalendarRefresh(previous,'missing',new Error('synthetic'))).toBeNull()
  })
  it('validates bounded outcomes and keeps last success across a later failure',()=>{
    const success=nextTeachingCheck('success',undefined,{now:new Date('2026-09-24T08:00:00Z'),eventCount:12,source:'himolde-tp-json'}),failure=nextTeachingCheck('timeout',success,{now:new Date('2026-09-25T08:00:00Z'),source:'himolde-tp-json'})
    expect(failure).toMatchObject({status:'timeout',lastAttempt:'2026-09-25T08:00:00.000Z',lastSuccess:'2026-09-24T08:00:00.000Z',eventCount:12,source:'himolde-tp-json'})
    expect(validPlanner(state(failure).planner)).toBe(true)
    expect(validPlanner(state({...failure,status:'unknown'}).planner)).toBe(false)
    expect(validPlanner(state({...failure,detail:'x'.repeat(501)}).planner)).toBe(false)
    expect(teachingCheckText(failure)).toContain('Tidligere kontrollresultat og lagrede undervisningsdata er beholdt')
    expect(teachingCheckText({...success,eventCount:undefined})).toContain('Undervisning ble hentet')
    expect(teachingCheckText({...success,eventCount:undefined})).not.toContain('0 publiserte')
  })
  it('describes a failure after a successful empty check without implying prior teaching existed',()=>{
    const empty=nextTeachingCheck('empty',undefined,{now:new Date('2026-09-24T08:00:00Z'),eventCount:0}),failure=nextTeachingCheck('timeout',empty,{now:new Date('2026-09-25T08:00:00Z')})
    expect(teachingCheckText(failure)).toContain('Tidligere kontrollresultat og lagrede undervisningsdata er beholdt')
  })
  it('does not create undo entries for bookkeeping alone and preserves a newer check when undoing a course edit',()=>{
    const before=state(nextTeachingCheck('success',undefined,{now:new Date('2026-09-24T08:00:00Z'),eventCount:12})),bookkeeping=structuredClone(before)
    bookkeeping.planner.courses[0].teachingCheck=nextTeachingCheck('timeout',before.planner.courses[0].teachingCheck,{now:new Date('2026-09-25T08:00:00Z')})
    expect(recordChange(before,bookkeeping).undo).toEqual([])
    const edited=structuredClone(before);edited.planner.courses[0].name='Lokalt navn'
    const history=recordChange(before,edited)
    edited.planner.courses[0].teachingCheck=bookkeeping.planner.courses[0].teachingCheck
    const restored=undoLast(edited,history)
    expect(restored.ok).toBe(true)
    expect(restored.state.planner.courses[0]).toMatchObject({name:'Programmering med KI',teachingCheck:bookkeeping.planner.courses[0].teachingCheck})
  })
  it('round-trips the check through a portable backup without connection material',()=>{
    const input=state({status:'access-required',lastAttempt:'2026-09-25T08:00:00.000Z',lastSuccess:'2026-09-24T08:00:00.000Z',eventCount:12,source:'himolde-tp-json'})
    expect(validEnvelope(input,{relations:true})).toBe(true)
    const backup=exportBackup(input,new Date('2026-09-25T09:00:00Z')),restored=previewBackup(JSON.stringify(backup),state())
    expect(restored.ok).toBe(true)
    expect(restored.data.planner.courses[0].teachingCheck).toEqual(input.planner.courses[0].teachingCheck)
    expect(JSON.stringify(backup)).not.toContain('PHPSESSID')
  })
  it('classifies timeout, access, invalid response, unsupported and ordinary transport failures separately',()=>{
    expect(teachingOutcome({status:'timeout'})).toBe('timeout')
    expect(teachingOutcome({status:'access-required'})).toBe('access-required')
    expect(teachingOutcome({status:'not-supported'})).toBe('unsupported')
    expect(teachingOutcome({status:'source-changed'})).toBe('invalid-response')
    expect(teachingOutcome(new Error('JSON-formatet er ugyldig'))).toBe('invalid-response')
    expect(teachingOutcome(new Error('ECONNRESET'))).toBe('transport-error')
  })
  it('keeps prior events and last success when a later background refresh fails',async()=>{
    let value=state({status:'success',lastAttempt:'2026-09-24T08:00:00.000Z',lastSuccess:'2026-09-24T08:00:00.000Z',eventCount:1,source:'fixture'})
    value.planner.events=[{id:'event',title:'Forelesning',courseId:'course',sourceId:'source',sourceKey:'key',start:'2026-10-01T08:00:00.000Z',end:'2026-10-01T09:00:00.000Z',notes:''}]
    value.planner.sources=[{id:'source',courseId:'course',kind:'url',url:'https://calendar.example.test/course.ics',name:'Test',groups:['Forelesning'],lastUpdated:'2026-09-24T08:00:00.000Z',lastSuccess:'2026-09-24T08:00:00.000Z'}]
    const sync=createCalendarSync({getState:()=>value,commit:planner=>{value={...value,planner};return true},isEditing:()=>false,visible:()=>true,clock:()=>Date.parse('2026-09-25T08:00:00.000Z'),fetchText:async()=>{throw Object.assign(new Error('Forespørselen tok for lang tid.'),{status:'timeout'})}})
    await sync.tick()
    expect(value.planner.events).toHaveLength(1)
    expect(value.planner.courses[0].teachingCheck).toMatchObject({status:'timeout',lastSuccess:'2026-09-24T08:00:00.000Z'})
    expect(value.planner.sources[0]).toMatchObject({failures:1,lastError:'Forespørselen tok for lang tid.'})
  })
  it('preserves structured refresh failures and rejects malformed saved selection arrays',async()=>{
    let value=state({status:'success',lastAttempt:'2026-09-24T08:00:00.000Z',lastSuccess:'2026-09-24T08:00:00.000Z',eventCount:1,source:'fixture'})
    value.planner.sources=[{id:'source',courseId:'course',kind:'url',url:'https://calendar.example.test/course.ics',name:'Test',groups:[],excludedKeys:[],lastUpdated:'2026-09-24T08:00:00.000Z'}]
    const sync=createCalendarSync({getState:()=>value,commit:planner=>{value={...value,planner};return true},isEditing:()=>false,visible:()=>true,clock:()=>Date.parse('2026-09-25T08:00:00.000Z'),fetchText:async()=>{throw Object.assign(new Error('Kilden endret format.'),{status:'source-changed'})}})
    await sync.tick()
    expect(value.planner.courses[0].teachingCheck).toMatchObject({status:'invalid-response',eventCount:1})
    expect(validPlanner({...value.planner,sources:[{...value.planner.sources[0],excludedKeys:{bad:true}}]})).toBe(false)
  })
})
