import { readFile } from 'node:fs/promises'
import { describe, it, expect, vi } from 'vitest'
import ICAL from 'ical.js'
import { parseCalendar } from '../../src/calendar-import.js'
import { parseDocumentIcs } from '../../src/document-parsers.js'
import { emptyPlanner, mergeImport } from '../../src/planner.js'
import { parseTpSemester, parseTpCourses, normalizeTpCalendar, normalizeTpJsonEvents, publicTp, fetchPublicTpCalendar, isPublicTpCalendarUrl, isPublicTpJsonUrl } from '../../server/providers/public-tp.js'

describe('synthetic TP raw time and identity boundary', () => {
  const semester = { id: '44h', year: 2044, season: 'AUTUMN', pubexdate: true, pubextime: true, pubexroom: true }
  const selected = { id: 'SYN974¤1', code: 'SYN974', name: 'Oppdiktet kalenderemne', term: 1 }
  const options = { institution: 'himolde', semester, selected }
  const row = { id: 'synthetic-time-valid', eventid: 'synthetic-time-valid', courseid: selected.code, semesterid: semester.id, terminnr: 1, summary: 'Oppdiktet tidskontroll', status: 'active', dtstart: '2044-11-18T09:00:07+01', dtend: '2044-11-18T10:00:17+01' }
  it.each(['2045-02-29T09:00:07+01', '2044-04-31T09:00:07+01', '2044-13-18T09:00:07+01', '2044-11-18T24:00:00+01', '2044-11-18T09:60:07+01', '2044-11-18T09:00:60+01', '2044-11-18T09:00:07+24', '2044-11-18T09:00:07+0160', '2044-11-18T09:00:07+01:99'])('rejects raw JSON fields before Date.parse can normalize %s', invalid => {
    for (const field of ['dtstart', 'dtend']) {
      const result = normalizeTpJsonEvents({ events: [row, { ...row, id: 'synthetic-invalid', eventid: 'synthetic-invalid', status: 'cancelled', [field]: invalid }] }, options)
      expect(result).toMatchObject({ eventCount: 1, cancelledCount: 0, rejectedCount: 1, authoritative: false })
      const parsed = parseCalendar(result.calendar, { fileImport: true })
      expect(parsed.events).toHaveLength(1)
      expect(parsed.events[0]).toMatchObject({ start: '2044-11-18T08:00:07.000Z', end: '2044-11-18T09:00:17.000Z' })
      expect(parsed.cancellations).toEqual([])
      expect(parsed.accounting).toMatchObject({ total: 2, rejected: 1, retained: 1 })
      const document = parseDocumentIcs(result.calendar)
      expect(document.complete).toBe(false)
      expect(document.rows.filter(item => item.kind === 'event')).toHaveLength(1)
      expect(document.cancellations).toEqual([])
      expect(document.accounting).toMatchObject({ total: 2, retained: 1, rejected: 1 })
    }
  })
  it.each(['+01', '+0100', '+01:00'])('retains valid JSON leap dates and published offset %s', offset => {
    const result = normalizeTpJsonEvents({ events: [{ ...row, dtstart: `2044-02-29T09:00:07${offset}`, dtend: `2044-02-29T10:00:17${offset}` }] }, options)
    expect(result).toMatchObject({ eventCount: 1, rejectedCount: 0 })
    expect(parseCalendar(result.calendar, { fileImport: true }).events[0].start).toBe('2044-02-29T08:00:07.000Z')
  })
  const event = (uid, fields) => `BEGIN:VEVENT\r\nUID:${uid}\r\nSUMMARY:Oppdiktet tidskontroll\r\n${fields}\r\nEND:VEVENT`
  const calendar = (...parts) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...parts, 'END:VCALENDAR'].join('\r\n')
  const icsOptions = { institution: 'himolde', semester, selectedIds: [selected.id], selectedCourse: selected }
  it.each(['DTSTART:20441118T090007Ztail', 'DTSTART:20441131T090007Z', 'DTSTART:20441118T090007Z\r\nDTEND:20441118T100007Z\r\nDURATION:PT1H', 'DTSTART:20441118T090007Z\r\nRRULE:FREQ=DAILY;UNTIL=20441120', 'DTSTART:20441118T090007Z\r\nUID:synthetic-another'])('keeps component rejection across TP ICS serialization: %s', fields => {
    const result = normalizeTpCalendar(calendar(event('synthetic-invalid', fields), event('synthetic-valid', 'DTSTART:20441118T090007Z')), icsOptions)
    const parsed = parseCalendar(result.calendar, { fileImport: true })
    expect(result.eventCount).toBe(1)
    expect(parsed.events.map(item => item.sourceUid)).toEqual(['synthetic-valid'])
    expect(parsed.accounting).toMatchObject({ total: 2, rejected: 1, retained: 1 })
  })
  it('retains lower-case TP cancellation semantics and a cancellation with only UID', () => {
    for (const text of [calendar('METHOD:cancel', event('synthetic-cancelled', '')), calendar(event('synthetic-cancelled', 'STATUS:cancelled'))]) {
      const result = normalizeTpCalendar(text, icsOptions)
      expect(result.eventCount).toBe(0)
      expect(parseCalendar(result.calendar, { fileImport: true })).toMatchObject({ events: [], cancellations: [{ uid: 'synthetic-cancelled', recurrence: null }] })
    }
  })

  it('rejects repeated METHOD in either order before returning a normalized calendar', () => {
    for (const methods of [['METHOD:PUBLISH', 'METHOD:cancel'], ['METHOD:cancel', 'METHOD:PUBLISH']]) {
      expect(() => normalizeTpCalendar(calendar(...methods, event('synthetic-valid', 'DTSTART:20441118T090007Z')), icsOptions)).toThrow(/flertydig METHOD/)
    }
  })

  it.each([['STATUS', 'CONFIRMED', 'cancelled'], ['TRANSP', 'OPAQUE', 'transparent']])('rejects repeated TP %s in either order without cancellation effects', (name, first, second) => {
    for (const values of [[first, second], [second, first]]) {
      const invalid = event('synthetic-repeated-symbol', `DTSTART:20441118T090007Z\r\n${values.map(value => `${name}:${value}`).join('\r\n')}`)
      const normalized = normalizeTpCalendar(calendar(invalid, event('synthetic-valid', 'DTSTART:20441118T090007Z')), icsOptions)
      const document = parseDocumentIcs(normalized.calendar)
      expect(normalized.eventCount).toBe(1)
      expect(document.rows.filter(item => item.kind === 'event')).toHaveLength(1)
      expect(document).toMatchObject({ complete: false, cancellations: [], accounting: { total: 2, retained: 1, rejected: 1, cancelled: 0 } })
    }
  })

  it.each(['date', 'identity'])('applies exam publication restrictions before returning an invalid %s component', invalidKind => {
    const invalid = event('synthetic-unpublished-exam', `${invalidKind === 'date' ? 'DTSTART:20441131T090007Z' : 'DTSTART:20441118T090007Z\r\nUID:synthetic-second-exam-id'}\r\nLOCATION:Synthetic unpublished room marker\r\nDESCRIPTION:Synthetic unpublished description marker`).replace('SUMMARY:Oppdiktet tidskontroll', 'SUMMARY:Oppdiktet eksamen')
    const valid = event('synthetic-valid', 'DTSTART:20441118T090007Z')
    for (const field of ['pubexdate', 'pubextime']) {
      const result = normalizeTpCalendar(calendar(invalid, valid), { ...icsOptions, semester: { ...semester, [field]: false } })
      const output = new ICAL.Component(ICAL.parse(result.calendar)).getAllSubcomponents('vevent')
      // Boolean diagnostics avoid printing even these invented rejected values.
      expect(output.length === 1).toBe(true)
      expect(output.some(item => item.getFirstPropertyValue('summary')?.includes('eksamen'))).toBe(false)
      expect(result.eventCount).toBe(1)
    }
    const hidden = normalizeTpCalendar(calendar(invalid, valid), { ...icsOptions, semester: { ...semester, pubexroom: false } })
    const output = new ICAL.Component(ICAL.parse(hidden.calendar)).getAllSubcomponents('vevent')
    expect(output.some(item => item.hasProperty('location') || item.hasProperty('description'))).toBe(false)
    expect(parseDocumentIcs(hidden.calendar)).toMatchObject({ complete: false, cancellations: [], accounting: { total: 2, retained: 1, rejected: 1 } })
  })

  it('requires clarification for proven generated UID-only cancellations and retains stable UID-only cancellations', () => {
    const generated = `7${Math.floor(Date.UTC(2044, 10, 18) / 1000).toString(16)}abcde`
    const stamp = 'DTSTAMP:20441118T000000Z'
    const active = normalizeTpCalendar(calendar(event(generated, `${stamp}\r\nDTSTART:20441118T090007Z`)), icsOptions)
    expect(new ICAL.Component(ICAL.parse(active.calendar)).getFirstSubcomponent('vevent').getFirstPropertyValue('uid')).toMatch(/^tp-occurrence-/)
    for (const method of ['', 'METHOD:cancel']) {
      const cancellation = ['BEGIN:VEVENT', `UID:${generated}`, stamp, ...(method ? [] : ['STATUS:cancelled']), 'END:VEVENT'].join('\r\n')
      expect(() => normalizeTpCalendar(calendar(method, cancellation), icsOptions)).toThrow(/ustabil eksport-ID.*Kilden må avklares/)
    }
    for (const uid of ['synthetic-stable-cancel', generated]) {
      // A UID with a similar shape but an unrelated stamp is not proven generated.
      const cancellation = ['BEGIN:VEVENT', `UID:${uid}`, 'DTSTAMP:20441119T000000Z', 'STATUS:cancelled', 'END:VEVENT'].join('\r\n')
      const stable = parseCalendar(normalizeTpCalendar(calendar(cancellation), icsOptions).calendar, { fileImport: true })
      expect(stable.events).toEqual([])
      expect(stable.cancellations).toEqual([{ uid, recurrence: null }])
      expect(stable.accounting).toMatchObject({ total: 1, rejected: 0, cancelled: 1 })
    }
  })
})
const fixture=name=>readFile(new URL(`../fixtures/public-tp/${name}`,import.meta.url),'utf8')
const json=name=>fixture(name).then(JSON.parse)
const query={q:'INF-0101',year:'2026',semester:'autumn'}
const sample=async inst=>parseTpSemester(await json(`${inst}-semesters.json`),query)
const components=text=>new ICAL.Component(ICAL.parse(text)).getAllSubcomponents('vevent')
const uids=text=>components(text).map(event=>event.getFirstPropertyValue('uid'))
const scope=semester=>({institution:'uit',semester,selectedIds:['INF-0101¤1']})

describe('public TP semester, course and source-offered calendar export',()=>{
  it('keeps mock and practice examinations as assessments, not actual exams',async()=>{
    const semester={id:'26h',pubexdate:true,pubextime:true,pubexroom:true}
    for(const title of ['Mock examination','Practice examination']){
      const raw=['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT',`UID:${title.replaceAll(' ','-')}@test`,'DTSTART:20261001T080000Z','DTEND:20261001T090000Z',`SUMMARY:${title}`,'END:VEVENT','END:VCALENDAR'].join('\r\n')
      const item=components(normalizeTpCalendar(raw,scope(semester)).calendar)[0]
      expect(item.getFirstPropertyValue('x-studieplan-activity-kind')).toBe('assessment')
    }
  })
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
    expect(parsed.events[0]).toMatchObject({transparent:true,information:true,activityKind:'assessment'})
    expect(parsed.events[0].activityKind).not.toBe('exam')
    const hidden=normalizeTpCalendar(calendar.toString(),scope({...semester,pubexdate:false}))
    expect(components(hidden.calendar).some(row=>String(row.getFirstPropertyValue('summary')).includes('WISEFLOW'))).toBe(false)
  })
  it.each(['Prøve eksamen','Prøve-eksamen','Mock-exam','Practice exam','Exam-preparation','Forberedelse til eksamen','Forelesning om eksamen','Lecture about the exam'])('keeps non-exam wording as structured assessment: %s',async title=>{
    const semester=await sample('uit'),calendar=new ICAL.Component(ICAL.parse(await fixture('uit.ics'))),event=calendar.getFirstSubcomponent('vevent')
    event.updatePropertyWithValue('summary',title)
    const normalized=normalizeTpCalendar(calendar.toString(),scope(semester)),first=components(normalized.calendar)[0]
    expect(first.getFirstPropertyValue('x-studieplan-activity-kind')).toBe('assessment')
    expect(parseCalendar(normalized.calendar,{courseId:'test',year:2026,semester:'autumn'}).events[0]).toMatchObject({title,activityKind:'assessment'})
  })
  it('maps HiMolde anonymous JSON events conservatively with stable identity, cancellation and source offsets',async()=>{
    const semester=await sample('himolde'),selected=parseTpCourses(await json('himolde-courses.json'),semester,'himolde').find(row=>row.id==='IBE160¤1')
    const result=normalizeTpJsonEvents(await fixture('himolde-events.json'),{institution:'himolde',semester,selected}),parsed=parseCalendar(result.calendar,{courseId:'himolde:IBE160:2026:autumn',semester:'autumn',year:2026})
    expect(result).toMatchObject({eventCount:2,cancelledCount:1,sourceKind:'himolde-tp-json',authoritative:false})
    expect(parsed.events).toHaveLength(2)
    expect(parsed.cancellations).toHaveLength(1)
    expect(parsed.events.map(event=>event.start)).toEqual(['2026-08-20T10:15:00.000Z','2026-10-29T13:15:00.000Z'])
    expect(parsed.events[0]).toMatchObject({title:'Forelesning',location:'Auditorium B-138',publishedGroups:['LOG-ÅR-IT [1.sem] CAMPUS','LOG-ÅR-IT [1.sem] NETT']})
    expect(parsed.events[0].groupMissing).toBeUndefined()
    expect(parsed.events[0].description).not.toContain('LOG-ÅR-IT')
    expect(uids(result.calendar).every(uid=>uid.startsWith('tp-json-'))).toBe(true)
  })
  describe.each(['teaching', 'assessment'])('published group contract for %s JSON rows', kind => {
    const semester = { id: '39h' }, selected = { id: 'SYN843¤1', code: 'SYN843', name: 'Oppdiktet gruppefag', term: 1 }
    const base = { semesterid: '39h', courseid: 'SYN843', terminnr: 1, id: 'synthetic-row', summaryNb: 'Oppdiktet aktivitet', dtstart: '2039-10-20T10:00:00+02', dtend: '2039-10-20T11:00:00+02', ...(kind === 'assessment' ? { status: null, eventid: null, active: true, publish: true, assessmentCode: 'SYN843' } : { status: 'active', eventid: 'synthetic-occurrence' }) }
    const normalize = studentgroups => normalizeTpJsonEvents({ events: [{ ...base, studentgroups }] }, { institution: 'himolde', semester, selected })
    it.each([
      ['string', 'Publisert gruppe'], ['object', { group: 'Publisert gruppe' }], ['number', 0], ['boolean', false], ['empty scalar', ''],
      ['non-string member', [42]], ['null member', [null]], ['empty identity', ['  ']], ['overlong identity', ['g'.repeat(301)]],
      ['control character', ['Gruppe\nA']], ['too many identities', Array.from({ length: 101 }, (_, index) => `Gruppe ${index}`)],
    ])('rejects %s without inventing or truncating group identities', (_label, groups) => {
      expect(() => normalize(groups)).toThrow(expect.objectContaining({ status: 'invalid-response' }))
    })
    it('keeps full bounded identities and accepts absent or empty group metadata', () => {
      for (const groups of [undefined, null, []]) expect(components(normalize(groups).calendar)[0].getAllProperties('x-group')).toEqual([])
      const full = 'Oppdiktet blå gruppe '.padEnd(300, 'x')
      const groups = [full, ...Array.from({ length: 99 }, (_, index) => `Oppdiktet gruppe ${index}`)]
      expect(full).toHaveLength(300)
      const values = text => components(text)[0].getAllProperties('x-group').map(property => property.getFirstValue())
      expect(values(normalize(groups).calendar)).toEqual(groups)
      expect(values(normalize([' Oppdiktet gruppe ', 'Oppdiktet gruppe']).calendar)).toEqual(['Oppdiktet gruppe'])
    })
  })
  it('follows the official HiMolde page and anonymous session bootstrap before the bounded event request',async()=>{
    const requests=[],jars=[]
    const fetchText=vi.fn(async(input,_depth,guard,options={})=>{const url=new URL(input);guard(url);requests.push(url);if(options.anonymousSession){jars.push(options.anonymousSession.cookies);if(url.pathname.endsWith('/app/schedule'))options.anonymousSession.cookies.set('PHPSESSID','fixture-session')}
      if(url.pathname.endsWith('semesters.php'))return fixture('himolde-semesters.json')
      if(url.pathname.endsWith('info.php'))return fixture('himolde-courses.json')
      if(url.pathname.endsWith('inst.php'))return '{}'
      if(url.pathname.endsWith('session.php'))return 'null'
      if(url.pathname.endsWith('/ws/timeplan/'))return fixture('himolde-events.json')
      if(url.pathname.endsWith('/app/schedule'))return '<!doctype html><title>TP</title>'
      throw Error('unexpected request')
    })
    const result=await publicTp('himolde','teaching-calendar',{q:'IBE160',year:'2026',semester:'autumn',sourceObjectId:'IBE160¤1'},{fetchText})
    expect(result).toMatchObject({status:'ok',eventCount:2,sourceKind:'himolde-tp-json'})
    expect(requests.map(url=>url.pathname).slice(-4)).toEqual(['/himolde/app/schedule','/himolde/ws/db/inst.php','/himolde/ws/user/session.php','/himolde/ws/timeplan/'])
    expect(requests.at(-1).searchParams.get('id[]')).toBe('IBE160¤1')
    expect(new Set(jars).size).toBe(1)
    expect(jars[0].size).toBe(0)
    expect(isPublicTpJsonUrl(result.calendarUrl)).toBe(true)
    expect(isPublicTpCalendarUrl(result.calendarUrl)).toBe(true)
  })
  it.each([401,403])('keeps anonymous bootstrap HTTP %s unconfirmed rather than asserting an access requirement',async(code)=>{
    const fetchText=async(input)=>{const url=new URL(input)
      if(url.pathname.endsWith('semesters.php'))return fixture('himolde-semesters.json')
      if(url.pathname.endsWith('info.php'))return fixture('himolde-courses.json')
      throw new Error(`HTTP ${code}. Årsaken er ikke bekreftet`)
    }
    await expect(publicTp('himolde','teaching-calendar',{q:'IBE160',year:'2026',semester:'autumn',sourceObjectId:'IBE160¤1'},{fetchText})).rejects.toMatchObject({status:'transport-error'})
  })
  it('rejects malformed HiMolde JSON without replacing prior teaching and accepts a successful empty source',async()=>{
    const semester=await sample('himolde'),selected=parseTpCourses(await json('himolde-courses.json'),semester,'himolde').find(row=>row.id==='IBE160¤1')
    expect(()=>normalizeTpJsonEvents('{',{institution:'himolde',semester,selected})).toThrow(/lesbar JSON/)
    expect(()=>normalizeTpJsonEvents({events:[{semesterid:'26h'}]},{institution:'himolde',semester,selected})).toThrow(/mangler gyldig/)
    const valid=JSON.parse(await fixture('himolde-events.json')).events[0]
    expect(()=>normalizeTpJsonEvents({events:[{...valid,alerts:{message:'feil form'}}]},{institution:'himolde',semester,selected})).toThrow(/hendelsesdetaljer/)
    expect(()=>normalizeTpJsonEvents({events:[{...valid,staffnames:'Navn'}]},{institution:'himolde',semester,selected})).toThrow(/hendelsesdetaljer/)
    expect(()=>normalizeTpJsonEvents({events:[{...valid,eventid:'x'.repeat(501)}]},{institution:'himolde',semester,selected})).toThrow(/kildeidentitet/)
    const assessment={...valid,status:null,eventid:null,active:true,publish:true,assessmentCode:'IBE160',id:undefined}
    expect(()=>normalizeTpJsonEvents({events:[assessment]},{institution:'himolde',semester,selected})).toThrow(/kildeidentitet/)
    const empty=normalizeTpJsonEvents({events:[]},{institution:'himolde',semester,selected})
    expect(empty).toMatchObject({eventCount:0,cancelledCount:0})
    expect(parseCalendar(empty.calendar,{courseId:'c',semester:'autumn',year:2026}).events).toEqual([])
  })
  it('keeps timed public assessments and zero-length points without fabricating duration',async()=>{
    const semester=await sample('himolde'),selected=parseTpCourses(await json('himolde-courses.json'),semester,'himolde').find(row=>row.id==='IBE160¤1'),base={semesterid:'26h',courseid:'IBE160',terminnr:1,status:null,eventid:null,active:true,publish:true,assessmentCode:'S',id:'IBE160-1-S-2026-HØST-O',teachingTitle:'Skoleeksamen',examformNb:'Skoleeksamen',room:{},studentgroups:null,action:''}
    const result=normalizeTpJsonEvents({events:[{...base,dtstart:'2026-11-16T09:00:00+01',dtend:'2026-11-16T12:00:00+01'},{...base,id:'IBE160-MARKER',dtstart:'2026-11-17T09:00:00+01',dtend:'2026-11-17T09:00:00+01'}]},{institution:'himolde',semester,selected}),parsed=parseCalendar(result.calendar,{courseId:'c',semester:'autumn',year:2026})
    expect(result.eventCount).toBe(2)
    expect(parsed.events).toHaveLength(2)
    expect(parsed.events[1]).toMatchObject({point:true,transparent:true,start:'2026-11-17T08:00:00.000Z',end:'2026-11-17T08:00:00.000Z'})
    expect(parsed.events[0]).toMatchObject({title:'Skoleeksamen',start:'2026-11-16T08:00:00.000Z',end:'2026-11-16T11:00:00.000Z',activityKind:'exam'})
    const source={id:'tp-source',courseId:'c',name:'TP',groups:[]},course={id:'c',code:'IBE160',name:'IBE160',semester:'autumn',year:2026}
    const first=mergeImport(emptyPlanner(),parsed.events,source,{course}).planner,stored=first.events[0]
    const refreshed=mergeImport(first,[{...parsed.events[0],location:'Oppdatert rom'}],source).planner
    expect(refreshed.events).toHaveLength(2)
    expect(refreshed.events[0]).toMatchObject({id:stored.id,sourceKey:stored.sourceKey,activityKind:'exam',location:'Oppdatert rom'})
    expect(result.warnings.join(' ')).toContain('null-lange vurderingsmarkører')
    const marker={...base,id:'WRONG-MARKER',courseid:'OTHER',dtstart:'2026-11-17T09:00:00+01',dtend:'2026-11-17T09:00:00+01'}
    expect(()=>normalizeTpJsonEvents({events:[marker]},{institution:'himolde',semester,selected})).toThrow(/kildeidentitet/)
  })
})
