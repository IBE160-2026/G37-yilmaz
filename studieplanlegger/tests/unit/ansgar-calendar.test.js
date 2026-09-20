import {readFileSync} from 'node:fs'
import {describe,it,expect} from 'vitest'
import ICAL from 'ical.js'
import {parseAnsgarCalendar,parseAnsgarCalendarSources,fetchAnsgarCalendar} from '../../server/providers/ansgar-calendar.js'
import {ansgarPublicShareUrl,ansgarPublishedDownload,readAnsgarSharedPdf} from '../../server/providers/ansgar-public-share.js'
const fixture=n=>JSON.parse(readFileSync(new URL(`../fixtures/ansgar-timetable-${n}.json`,import.meta.url)))
const parsed=n=>{const data=fixture(n),result=parseAnsgarCalendar(data.pages,data.source);return {...result,events:new ICAL.Component(ICAL.parse(result.calendar)).getAllSubcomponents('vevent')}}
const value=(event,key)=>event.getFirstPropertyValue(key)?.toString()
describe('published Ansgar weekly timetables',()=>{
  it('uses merged source times and named weeks, leaving unspecified eleven-week seminars unresolved',()=>{
    const r=parsed(7),first=r.events.find(e=>value(e,'summary').startsWith('PSY131'))
    expect(r.count).toBe(87);expect(r.unresolved).toHaveLength(3);expect(r.authoritative).toBe(false)
    expect(value(first,'dtstart')).toBe('2026-08-17T07:15:00Z');expect(value(first,'dtend')).toBe('2026-08-17T10:00:00Z')
    expect(value(first,'summary')).toBe('PSY131 Innføring i psykologiens perspektiver')
    expect(r.unresolved.every(row=>row.reason.includes('11 undervisningsuker'))).toBe(true)
    expect(r.events.every(e=>!/^2026-10-0[1-4]/.test(value(e,'dtstart')))).toBe(true)
    expect(r.events.some(e=>/lunsj|egenøving|kollokvietid/i.test(value(e,'summary')))).toBe(false)
  })
  it('keeps simultaneous published groups separate and leaves counted music weeks undated',()=>{
    const r=parsed(0),first=r.events.filter(e=>value(e,'dtstart')==='2026-08-17T08:25:00Z')
    expect(first.map(e=>value(e,'summary'))).toEqual(expect.arrayContaining([expect.stringContaining('Gr. 1'),expect.stringContaining('Gr. 2')]))
    expect(new Set(first.map(e=>value(e,'uid'))).size).toBe(first.length)
    expect(r.unresolved.some(row=>row.reason.includes('12 undervisningsuker'))).toBe(true)
    expect(r.events.filter(e=>value(e,'summary').includes('MUS141/241'))).toHaveLength(84)
  })
  it('honours an explicitly moved teaching week without retaining the original Thursday',()=>{
    const r=parsed(15),moved=r.events.find(e=>value(e,'summary').includes('flyttet undervisning'))
    expect(value(moved,'dtstart')).toBe('2026-10-09T07:15:00Z');expect(value(moved,'dtend')).toBe('2026-10-09T13:00:00Z')
    expect(r.events.some(e=>value(e,'summary').startsWith('PSY232')&&value(e,'dtstart').startsWith('2026-10-08'))).toBe(false)
  })
  it('preserves occurrence identity when a published clock or incidental share parameter changes',()=>{
    const d=fixture(7),before=parseAnsgarCalendar(d.pages,d.source)
    for(const page of d.pages)for(const item of page.items)item.str=item.str.replace('09.15','09.20').replace('09:15','09:20')
    const after=parseAnsgarCalendar(d.pages,d.source)
    const ids=r=>new ICAL.Component(ICAL.parse(r.calendar)).getAllSubcomponents('vevent').map(e=>value(e,'uid')).sort()
    expect(ids(after)).toEqual(ids(before));expect(after.calendar).not.toBe(before.calendar)
  })
  it('reads published programme years without collapsing similar programme labels',()=>{
    const url=fixture(7).source.sourceUrl,other=fixture(0).source.sourceUrl
    const rows=parseAnsgarCalendarSources(`<h1>Timeplaner for høsten 2026</h1><p>Første år</p><ul><li><a href="${url}">Bachelor</a></li></ul><p>Andre år</p><ul><li><a href="${other}">Bachelor</a></li></ul>`)
    expect(rows.map(r=>r.name)).toEqual(['Bachelor · Første år','Bachelor · Andre år'])
  })
  it('rejects unlisted PDFs before any binary download',async()=>{
    await expect(fetchAnsgarCalendar(fixture(7).source.sourceUrl,{fetchText:async()=>`<h1>Timeplaner for høsten 2026</h1><ul><li><a href="${fixture(0).source.sourceUrl}">Bachelor</a></li></ul>`,fetchBytes:()=>{throw Error('must not fetch')}})).rejects.toThrow(/publisert på Ansgars/)
  })
})
describe('anonymous source-published PDF share contract',()=>{
  const download='https://ansgarskolenno-my.sharepoint.com/_layouts/15/download.aspx?UniqueId=public-example&Translate=false&tempauth=synthetic-test-only',html=JSON.stringify({'.downloadUrl':download,FileLeafRef:'Published.pdf'})
  it('reads inert JSON without evaluating script and rejects external downloads and login links',()=>{
    expect(ansgarPublishedDownload(html).url).toBe(download)
    expect(()=>ansgarPublishedDownload(html.replace('ansgarskolenno-my.sharepoint.com','example.org'))).toThrow(/ukjent kontrakt/)
    expect(()=>ansgarPublicShareUrl('https://ansgarskolenno-my.sharepoint.com/_layouts/15/Authenticate.aspx')).toThrow(/anonyme PDF/)
    expect(()=>ansgarPublishedDownload(html).validate(new URL('https://example.org/file.pdf'))).toThrow(/videresendt/)
  })
  it('keeps anonymous cookies request-local and clears them after both success and failure',async()=>{
    let jar
    const deps={fetchText:async(url,n,validate,options)=>{validate(new URL(url));jar=options.anonymousShare.cookies;jar.set('anonymous','test');return html},fetchBytes:async(url,n,validate,options)=>{validate(new URL(url));expect(options.anonymousShare.cookies).toBe(jar);return new Uint8Array([37,80,68,70])}}
    const r=await readAnsgarSharedPdf(fixture(7).source.sourceUrl,deps);expect(r.name).toBe('Published.pdf');expect(jar.size).toBe(0);expect(r).not.toHaveProperty('url')
    deps.fetchBytes=async()=>{throw Error('transport failed')};await expect(readAnsgarSharedPdf(fixture(7).source.sourceUrl,deps)).rejects.toThrow('transport failed');expect(jar.size).toBe(0)
  })
})
