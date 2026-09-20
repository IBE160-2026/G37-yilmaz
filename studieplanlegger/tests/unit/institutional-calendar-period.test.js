import {it,expect} from 'vitest'
import {filterInstitutionalSemester} from '../../src/institutional-calendar-period.js'
it('keeps institutional deadlines within the selected Oslo semester, including the exact boundary',()=>{
  const parsed={warnings:[],rows:[
    {kind:'task',title:'Before',deadlineLocal:'2026-06-30T23:59'},
    {kind:'task',title:'Start',deadlineLocal:'2026-07-01T00:00'},
    {kind:'task',title:'Last',deadlineLocal:'2026-12-31T23:59'},
    {kind:'task',title:'Next',deadlineLocal:'2027-01-01T00:00'},
    {kind:'task',title:'Unresolved',deadlineLocal:''},
    {kind:'event',title:'Already filtered by ICS'},
  ]}
  expect(filterInstitutionalSemester(parsed,{year:2026,semester:'autumn'}).rows.map(r=>r.title)).toEqual(['Start','Last','Unresolved','Already filtered by ICS'])
  expect(parsed.warnings[0]).toContain('2 frister utenfor')
})
