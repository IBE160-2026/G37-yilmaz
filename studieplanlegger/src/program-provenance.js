const text = value => typeof value==='string' && value.length<=2000
export function validProgramBinding(value) {
  if(!value || !['institution','programCode','programName','cohort','modelId','modelName','campus','choice','sourceUrl','checkedAt'].every(key=>text(value[key])))return false
  if(value.sourceNotes!==undefined&&(typeof value.sourceNotes!=='string'||value.sourceNotes.length>12000))return false
  if(['calendarClarifiedByStudent','studySemesterClarifiedByStudent','cohortFromStudent'].some(key=>value[key]!==undefined&&typeof value[key]!=='boolean'))return false
  if(value.studySemesters!==undefined&&(!Array.isArray(value.studySemesters)||value.studySemesters.length<2||value.studySemesters.some((semester,index)=>!Number.isInteger(semester)||semester<1||semester>40||(index&&semester<=value.studySemesters[index-1]))||!value.studySemesters.includes(value.studySemester)))return false
  if(!value.institution || !value.programCode || !value.cohort || !value.modelId || !Number.isInteger(value.studySemester) || value.studySemester<1 || value.studySemester>40 || !Number.isInteger(value.calendarYear) || value.calendarYear<1900 || value.calendarYear>2200 || !['autumn','spring'].includes(value.calendarSemester) || !Number.isFinite(Date.parse(value.checkedAt)))return false
  try {const url=new URL(value.sourceUrl);return url.protocol==='https:'&&!url.username&&!url.password} catch{return false}
}
