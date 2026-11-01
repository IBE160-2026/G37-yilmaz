// Synthetic, minimal parser fixtures derived from public source structures
// inspected 2026-11-01. No downloaded HTML/PDF, personal data or live fetches.
// NTNU: https://www.ntnu.no/studier/alle returned docs:[], numFound:0.
// AHO: https://www.aho.no/studier/program/master-i-arkitektur/studieplaner/2026.html
// jumps from autumn 2029 to spring 2031; the years below retain that source gap.
// UiT: https://uit.no/utdanning/program/446261/applied_computer_science_-_master
// links PDF 941723: English cover, numbered Termin rows and ECTS columns.
// Synthetic names/codes replace course content; coordinates retain only the
// layout needed to distinguish readable unsupported terms from an image table.

export const ntnuCataloguePage = '<div data-allstudiesurl="https://www.ntnu.no/studier/alle?p_p_resource_id=allStudies&amp;p_p_lifecycle=2"></div>'
export const ntnuEmptyIndex = { q: 'ntnu', numFound: 0, pageNr: 1, pageSize: 100000, lang: 'no', types: ['studyprog'], docs: [] }

export const ahoSource = 'https://www.aho.no/studier/program/master-i-arkitektur/studieplaner/2026.html'
export const ahoTerms = ['Høst 2026', 'Vår 2027', 'Høst 2027', 'Vår 2028', 'Høst 2028', 'Vår 2029', 'Høst 2029', 'Vår 2031', 'Høst 2031']
export const ahoFixture = (terms = ahoTerms) => `<main><h1>Studieplan for Syntetisk arkitektur (2026–2031)</h1>
  <div class="facts-wrapper"><div class="dg"><dt>Studiested:</dt><dd>AHO OSLO</dd></div></div>
  <div class="vrtx-fs-study-model">${terms.map((heading, index) => `<div class="term"><h3>${heading}</h3>
    <div class="combination"><h4>Obligatoriske emner</h4><ul><li class="mandatory">
    <a class="course-link" href="https://www.aho.no/studier/emner/2026/host/synthetic-${index + 1}.html">
    <span class="course-code">SYNTH${index + 1}</span><span class="course-name">Syntetisk emne ${index + 1}</span>
    <span class="course-study-points"><span>30</span><span>stp</span></span></a></li></ul></div></div>`).join('')}</div></main>`

const item = (str, x, y) => ({ str, transform: [10, 0, 0, 10, x, y], width: str.length * 5 })
export const uitTermPages = (cover = 'Program description') => [
  { page: 1, items: [item(cover, 70, 700), item('Synthetic English master', 70, 670), item('120 Credits', 70, 640)] },
  { page: 5, items: [item('Termin', 223, 710), item('5 ECTS', 279, 710), item('5 ECTS', 370, 710), item('5 ECTS', 456, 710),
    item('1. termin', 223, 684), item('Aug-Oct', 223, 670), item('SYN-1001 Synthetic theory', 279, 684),
    item('2. termin', 223, 641), item('Oct-Des', 223, 627), item('SYN-1002 Synthetic methods', 279, 641),
    item('7. termin', 223, 323), item('Jan-Mar', 223, 309), item('SYN-1003 Synthetic thesis', 279, 323),
    item('8. termin', 223, 295), item('Mar-Jun', 223, 281)] },
]
export const uitPdfUrl = 'https://uit.no/Content/941723/cache=20262310134639/2026%20Study%20Plan%20Applied%20Computer%20Science%20-%20Master%20M-IT.pdf'
export const uitInfo = { record: '446261', pdfId: '941723', pdfUrl: uitPdfUrl, label: '2026 Study Plan Applied Computer Science', name: 'Syntetisk engelsk master', studyCode: 'M-IT', sourceUrl: 'https://uit.no/utdanning/program/446261/applied_computer_science_-_master', campuses: ['Narvik'] }
export const uitQuery = { program: 'UIT-446261', cohort: '2026', cohortFromStudent: 'true' }
