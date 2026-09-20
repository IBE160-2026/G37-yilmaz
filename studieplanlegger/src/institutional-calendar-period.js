import {semesterWindow,toInstant} from './planner.js'
// VEVENT is already expanded within the selected semester by the ICS parser.
// Its VTODO reader is also used by unrestricted document import, so restrict
// only this explicitly semester-scoped institutional-calendar flow here.
export function filterInstitutionalSemester(parsed,{semester,year}){
  const window=semesterWindow(semester,year),start=Date.parse(window.start),end=Date.parse(window.end);let omitted=0
  parsed.rows=parsed.rows.filter(row=>{if(row.kind!=='task'||!row.deadlineLocal)return true;try{const at=Date.parse(toInstant(row.deadlineLocal));if(at<start||at>=end){omitted++;return false}}catch{/* Keep ambiguous source dates visible for explicit clarification. */}return true})
  if(omitted)parsed.warnings.push(`${omitted} frister utenfor valgt kalendersemester er utelatt. Tidligere lagrede oppføringer slettes ikke.`)
  return parsed
}
