import { readFile } from 'node:fs/promises'
import { describe, it, expect, vi } from 'vitest'
import ICAL from 'ical.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { parseTpSemester, parseTpCourses, normalizeTpCalendar, publicTp, fetchPublicTpCalendar, isPublicTpCalendarUrl } from '../../server/providers/public-tp.js'
const fixture=name=>readFile(new URL(`../fixtures/public-tp/${name}`,import.meta.url),'utf8')
const json=name=>fixture(name).then(JSON.parse)
const query={q:'INF-0101',year:'2026',semester:'autumn'}
const sample=async inst=>parseTpSemester(await json(`${inst}-semesters.json`),query)
const components=text=>new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent')
const uids=text=>components(text).map(event=>event.getFirstPropertyValue('uid'))
const scope=semester=>({institution:'uit',semester,selectedIds:['INF-0101¤1']})

describe('public TP semester, course and source-offered calendar export',()=>{
  it('reads all courses and actual teaching terms, including slash codes and zero terms, without inferring a study semester',async()=>{
    for(const [inst,count,total]of[['uit',2112,2269],['uib',2557,2658],['oslomet',1439,1457],['nord',769,775],['inn',1386,1496],['uis',1035,1052],['uio',2297,2380],['uia',1657,1669],['himolde',323,325],['hiof',377,383]]){
      const data=await json(`${inst}-courses.json`),semester=await sample(inst),rows=parseTpCourses(data,semester,inst)
      expect(data).toHaveLength(count)
      expect(rows).toHaveLength(total)
      expect(rows.some(row=>row.term===0)).toBe(data.some(row=>row.term.some(term=>term.term===0)))
      expect(rows.every(row=>row.label.includes('kildens undervisningstermin'))).toBe(true)
    }
  })
  it('requires an actually published and consistent semester and never requests an unpublished one',async()=>{
    const rows=await json('uit-semesters.json'),semester=rows.find(row=>row.id==='26h')
    semester.publish_timetable=false
    expect(()=>parseTpSemester(rows,query)).toThrow(/ikke er offentlig publisert/)
    semester.publish_timetable=true;semester.id='27h'
    expect(()=>parseTpSemester(rows,query)).toThrow(/stemmer ikke overens/)
    expect(()=>parseTpSemester(rows,{...query,year:'2100'})).toThrow(/tilbyr ikke/)
    expect(()=>parseTpSemester([{...rows.find(row=>row.id==='26v'),fromdate:'2026-02-30'}],{q:'X',year:'2026',semester:'spring'})).toThrow(/gyldige publiserte semestergrenser/)
  })
  it('uses only public metadata and the documented export, with explicitly selected course and term',async()=>{
    const requests=[],fetchText=vi.fn(async(input,_depth,guard)=>{const url=new URL(input);guard(url);requests.push(url);if(url.pathname.endsWith('semesters.php'))return fixture('uit-semesters.json');if(url.pathname.endsWith('info.php'))return fixture('uit-courses.json');if(url.pathname.endsWith('ical.php'))return fixture('uit.ics');throw Error('No activity API or login requests allowed')})
    const results=await publicTp('uit','teaching-search',query,{fetchText})
    expect(results.results).toHaveLength(1)
    expect(results.results[0].id).toBe('INF-0101¤1')
    expect(results.warnings.join(' ')).toContain('Kilden varsler')
    const calendar=await publicTp('uit','teaching-calendar',{...query,sourceObjectId:'INF-0101¤1'},{fetchText})
    expect(components(calendar.calendar)).toHaveLength(16)
    expect(calendar).toMatchObject({coverage:'unknown',authoritative:false,identityMode:'source-occurrence-fingerprint'})
    expect(requests).toHaveLength(3)
    expect(requests[2].searchParams.get('id[]')).toBe('INF-0101,1')
    expect(requests[2].searchParams.get('rkey')).toBe('404984')
    expect(requests[2].searchParams.has('username')).toBe(false)
    await expect(publicTp('uit','teaching-calendar',{...query,sourceObjectId:'INF-0101¤9'},{fetchText})).rejects.toThrow(/Velg en faktisk/)
  })
  it('stabilizes only proven generated UIDs and preserves identity for room, end-time and teacher updates',async()=>{
    const semester=await sample('uit'),raw=await fixture('uit.ics'),first=normalizeTpCalendar(raw,scope(semester)),changed=new ICAL.Component(ICAL.parse(raw))
    for(const event of changed.getAllSubcomponents('vevent')){event.updatePropertyWithValue('uid',event.getFirstPropertyValue('uid').slice(0,-3)+'abc');event.updatePropertyWithValue('location','Endret offentlig rom');event.updatePropertyWithValue('description','Endret offentlig lærer');const end=event.getFirstPropertyValue('dtend').clone();end.adjust(0,0,5,0);event.updatePropertyWithValue('dtend',end)}
    const second=normalizeTpCalendar(changed.toString(),scope(semester))
    expect(uids(second.calendar)).toEqual(uids(first.calendar))
    const parsedFirst=parseCalendar(first.calendar,{courseId:'uit:INF-0101:2026:autumn',semester:'autumn',year:2026}),parsedSecond=parseCalendar(second.calendar,{courseId:'uit:INF-0101:2026:autumn',semester:'autumn',year:2026})
    expect(parsedSecond.events.map(event=>event.sourceKey)).toEqual(parsedFirst.events.map(event=>event.sourceKey))
    expect(parsedSecond.authoritative).toBe(false)
    expect(parsedSecond.events.every(event=>event.groupMissing)).toBe(true)
    expect(parsedSecond.warnings.join(' ')).toContain('Ved endret starttid eller navn')
    expect(components(second.calendar)[0].getFirstPropertyValue('location')).toBe('Endret offentlig rom')
    expect(first.warnings.join(' ')).toContain('Ved endret starttid eller navn')
    const genuine=new ICAL.Component(ICAL.parse(raw));genuine.getFirstSubcomponent('vevent').updatePropertyWithValue('uid','stable-activity-1@source')
    expect(uids(normalizeTpCalendar(genuine.toString(),scope(semester)).calendar)[0]).toBe('stable-activity-1@source')
  })
  it('detects simultaneous matching labels instead of silently merging distinct source activities',async()=>{
    const semester=await sample('uit'),calendar=new ICAL.Component(ICAL.parse(await fixture('uit.ics'))),first=calendar.getFirstSubcomponent('vevent'),duplicate=new ICAL.Component(JSON.parse(JSON.stringify(first.jCal)))
    duplicate.updatePropertyWithValue('uid','99'+first.getFirstPropertyValue('uid').slice(-13));duplicate.updatePropertyWithValue('location','Et annet rom');calendar.addSubcomponent(duplicate)
    expect(()=>normalizeTpCalendar(calendar.toString(),scope(semester))).toThrow(/De er ikke slått sammen/)
  })
  it('keeps moved-start identity uncertain and respects unpublished exam date/time/room flags',async()=>{
    const semester=await sample('uib'),raw=await fixture('uib.ics'),selectedIds=['INF100¤1'],full=normalizeTpCalendar(raw,{institution:'uib',semester,selectedIds}),withoutExams=normalizeTpCalendar(raw,{institution:'uib',semester:{...semester,pubexdate:false},selectedIds})
    expect(components(full.calendar)).toHaveLength(294)
    expect(components(withoutExams.calendar).length).toBeLessThan(294)
    expect(components(withoutExams.calendar).every(event=>!/eksamen|examination|\bexam\b/i.test(event.getFirstPropertyValue('summary')))).toBe(true)
    const withoutRooms=normalizeTpCalendar(raw,{institution:'uib',semester:{...semester,pubexroom:false},selectedIds})
    expect(components(withoutRooms.calendar).filter(event=>/eksamen/i.test(event.getFirstPropertyValue('summary'))).every(event=>!event.hasProperty('location')&&!event.hasProperty('description'))).toBe(true)
    const moved=new ICAL.Component(ICAL.parse(raw)),event=moved.getFirstSubcomponent('vevent'),start=event.getFirstPropertyValue('dtstart').clone();start.adjust(1,0,0,0);event.updatePropertyWithValue('dtstart',start)
    expect(uids(normalizeTpCalendar(moved.toString(),{institution:'uib',semester,selectedIds}).calendar)[0]).not.toBe(uids(full.calendar)[0])
    expect(full.authoritative).toBe(false)
  })
  it('uses the same identity rule on explicit calendar refresh and refuses mixed source or invalid identities',async()=>{
    const fetchText=async(input,_depth,guard)=>{const url=new URL(input);guard(url);return fixture(url.pathname.endsWith('semesters.php')?'uit-semesters.json':url.pathname.endsWith('info.php')?'uit-courses.json':'uit.ics')},url='https://tp.educloud.no/uit/timeplan/ical.php?type=course&sem=26h&rkey=404984&id%5B%5D=INF-0101%2C1'
    const first=await fetchPublicTpCalendar(url,{fetchText}),second=await fetchPublicTpCalendar(url,{fetchText})
    expect(uids(first.calendar)).toEqual(uids(second.calendar))
    await expect(fetchPublicTpCalendar(url.replace('INF-0101%2C1','UNKNOWN%2C1'),{fetchText})).rejects.toThrow(/ikke er publisert/)
    await expect(fetchPublicTpCalendar(url.replace('tp.educloud.no','localhost'),{fetchText})).rejects.toThrow(/utenfor/)
    expect(isPublicTpCalendarUrl(url)).toBe(true)
    // Existing source subscriptions with other published filters keep their
    // original import route; this course-only adapter must not break them.
    expect(isPublicTpCalendarUrl(url+'&campus%5B%5D=TROMSO')).toBe(false)
    expect(isPublicTpCalendarUrl(url+'&coursegroup%5B%5D=selected')).toBe(false)
    expect(isPublicTpCalendarUrl(url.replace('type=course','type=student'))).toBe(false)
  })
  it('keeps a one-second source assessment as information and does not reserve a fabricated work interval',async()=>{
    const semester=await sample('uit'),calendar=new ICAL.Component(ICAL.parse(await fixture('uit.ics'))),event=calendar.getFirstSubcomponent('vevent'),start=event.getFirstPropertyValue('dtstart'),end=start.clone();end.adjust(0,0,0,1)
    event.updatePropertyWithValue('summary','2PRO101 Individuell mappevurdering (WISEFLOW)');event.updatePropertyWithValue('dtend',end)
    const normalized=normalizeTpCalendar(calendar.toString(),scope(semester)),first=components(normalized.calendar)[0]
    expect(first.getFirstPropertyValue('transp')).toBe('TRANSPARENT')
    expect(first.getFirstPropertyValue('x-studieplan-activity-kind')).toBe('assessment')
    expect(normalized.warnings.join(' ')).toContain('ikke tolket som en bekreftet innleveringsfrist')
    const parsed=parseCalendar(normalized.calendar,{courseId:'test',year:2026,semester:'autumn'})
    expect(parsed.events[0]).toMatchObject({transparent:true,information:true})
    const hidden=normalizeTpCalendar(calendar.toString(),scope({...semester,pubexdate:false}))
    expect(components(hidden.calendar).some(row=>String(row.getFirstPropertyValue('summary')).includes('WISEFLOW'))).toBe(false)
  })
})
