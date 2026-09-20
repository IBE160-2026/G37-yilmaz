import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { navigate, saved, key, openTaskDetails, openImportMethod, openCourseImport } from './helpers.js'

const course = { id:'course-a',name:'Innføring i programmering',code:'TEST101',university:'Isolert',semester:'autumn',year:2026,credits:10,notes:'Eget emnenotat' }
const courseB = { ...course,id:'course-b',code:'TEST202',name:'Matematikk' }
const task = (id,patch={}) => ({id,title:`Oppgave ${id}`,course:'TEST101',courseId:course.id,deadlineLocal:'2026-09-08T12:00',estimatedMinutes:90,remainingMinutes:45,completed:false,...patch})
const event = (id,start,end,patch={}) => ({id,title:`Forelesning ${id}`,courseId:course.id,start,end,location:'Rom A101',notes:'Lokalt notat',...patch})
const fixture = () => ({schemaVersion:1,tasks:[task('i-dag'),task('reservert',{deadlineLocal:'2026-09-18T12:00'}),task('ukjent',{deadlineLocal:'',estimatedMinutes:null,remainingMinutes:undefined})],planner:{courses:[course,courseB],sources:[],events:[
  event('lecture','2026-09-08T08:00:00Z','2026-09-08T09:00:00Z',{notes:'Langt lokalt notat. '.repeat(100)}),
  event('collision','2026-09-08T08:30:00Z','2026-09-08T09:30:00Z'),
  event('short','2026-09-08T09:30:00Z','2026-09-08T09:35:00Z'),
  event('other','2026-09-09T08:00:00Z','2026-09-09T09:00:00Z',{courseId:courseB.id}),
  event('night','2026-09-12T21:00:00Z','2026-09-13T01:00:00Z'),
]},sessions:[{id:'reservation',taskId:'reservert',dateLocal:'2026-09-08',startTime:'08:00',endTime:'09:00'}],workWindows:[{id:'work',start:'2026-09-08T06:00:00Z',end:'2026-09-08T16:00:00Z',label:'Studiedag'}]})
async function seed(page,data=fixture()) {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message))
  await page.clock.setFixedTime(new Date('2026-09-08T06:00:00Z'))
  await page.addInitScript(({key,data})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(data))},{key,data})
  await page.goto('/'); await expect(page.locator('#workspace')).toBeVisible()
  return errors
}
async function dataMenu(page) { await navigate(page,'settings'); const menu=page.locator('.data-menu'); if(!await menu.evaluate(node=>node.open))await menu.locator('summary').click() }
async function calendar(page,view) { await navigate(page,'calendar'); if(view)await page.locator(`[data-calendar-view="${view}"]`).click(); await page.locator('#full-calendar-date').fill('2026-09-08') }

test('desktop calendar aligns time, keeps point bands visible, exposes accurate details and persists context',async({page})=>{
  await page.setViewportSize({width:1440,height:900}); const errors=await seed(page); await calendar(page,'week')
  const viewport=page.locator('.full-calendar-viewport'); await viewport.evaluate(node=>node.scrollTop=440)
  const tops=await page.locator('.calendar-timeline').evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().top)))
  expect(new Set(tops).size).toBe(1)
  await expect(page.locator('.calendar-points [data-calendar-key="task:i-dag"]')).toBeInViewport()
  expect(await page.locator('.short-event').evaluate(node=>node.getBoundingClientRect().height)).toBe(5)
  await expect(page.locator('.calendar-work-background')).toHaveCount(1)
  await expect(page.locator('.calendar-timeline .entry-work')).toHaveCount(0)
  await expect(page.locator('.calendar-time-axis')).toHaveCount(1)
  const control=page.locator('.calendar-point-extras [data-calendar-key="event:lecture"]'), before=await viewport.evaluate(node=>node.scrollTop)
  expect((await control.boundingBox()).width).toBeGreaterThanOrEqual(95)
  await control.click(); const dialog=page.locator('.calendar-details')
  await expect(dialog).toContainText('TEST101 Innføring i programmering'); await expect(dialog).toContainText('Rom A101'); await expect(dialog).toContainText('2026'); await expect(dialog).toContainText('Europe/Oslo')
  await page.keyboard.press('Escape'); await expect(control).toBeFocused(); expect(await viewport.evaluate(node=>node.scrollTop)).toBe(before)
  await page.screenshot({path:'artifacts/eleven-calendar-desktop-1440.png'})
  await page.locator('[data-calendar-view="month"]').click(); await expect(page.getByRole('button',{name:/\+ \d+ flere/}).first()).toBeVisible()
  await page.locator('[data-calendar-view="agenda"]').click(); await page.locator('#full-calendar-date').fill('2026-09-12')
  await page.reload(); await navigate(page,'calendar'); await expect(page.locator('[data-calendar-view="agenda"]')).toHaveAttribute('aria-pressed','true'); await expect(page.locator('#full-calendar-date')).toHaveValue('2026-09-12')
  expect(errors).toEqual([])
})

test('mobile Calendar is directly reachable, month adapts, keyboard/large text fit',async({page})=>{
  await page.setViewportSize({width:390,height:844}); const errors=await seed(page); await expect(page.locator('#view-calendar')).toBeVisible(); await calendar(page)
  await expect(page.locator('[data-calendar-view="day"]')).toHaveAttribute('aria-pressed','true')
  const viewport = page.locator('.full-calendar-viewport'), bounds = await viewport.boundingBox(), nav = await page.locator('.view-actions').boundingBox()
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(nav.y)
  expect(bounds.height).toBeGreaterThan(200)
  await viewport.evaluate(node => node.scrollTop = 500)
  await expect(page.locator('.calendar-timeline [data-calendar-key="event:lecture"]')).toBeInViewport()
  await page.screenshot({path:'artifacts/eleven-calendar-mobile-390.png'})
  await page.locator('[data-calendar-view="month"]').click()
  expect(await page.locator('.full-calendar-viewport').evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true)
  await page.screenshot({path:'artifacts/eleven-calendar-mobile-month.png'})
  await page.evaluate(()=>document.documentElement.style.fontSize='200%')
  await page.locator('[data-calendar-view="agenda"]').focus(); await page.keyboard.press('Enter')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'artifacts/eleven-calendar-mobile-200percent.png'})
  expect(errors).toEqual([])
})

test('calendar filters course and kind without changing selected date',async({page})=>{
  await seed(page); await calendar(page,'agenda'); await page.locator('.full-calendar-filters summary').click()
  await page.locator('#full-calendar-course').selectOption(courseB.id)
  await expect(page.locator('.calendar-full-agenda')).toContainText('Forelesning other')
  await expect(page.locator('.calendar-full-agenda')).not.toContainText('Forelesning lecture')
  await page.locator('.full-calendar-filters').getByLabel('Undervisning',{exact:true}).uncheck()
  await expect(page.locator('.calendar-full-agenda')).toContainText('Ingen oppføringer')
  await expect(page.locator('#full-calendar-date')).toHaveValue('2026-09-08')
})

test('inline course is atomic with task and explicit cancel preserves saved state',async({page})=>{
  await seed(page); const before=await saved(page); await page.locator('#new-task').click(); await page.locator('#title').fill('Utkast beholdes')
  await openTaskDetails(page)
  await expect(page.locator('#courseId')).toBeHidden(); await page.locator('.inline-course summary').click()
  await page.locator('[name=inlineName]').fill('Nytt isolert emne'); await page.locator('[name=inlineCode]').fill('NEW101'); await page.getByRole('button',{name:'Bruk nytt emne'}).click()
  await expect(page.locator('#title')).toHaveValue('Utkast beholdes'); expect(await saved(page)).toEqual(before)
  await page.locator('#cancel-task').click(); expect(await saved(page)).toEqual(before); await expect(page.locator('#completion-badge')).toBeHidden()
  await page.locator('#new-task').click(); await page.locator('#title').fill('Atomisk oppgave'); await openTaskDetails(page); await page.locator('.inline-course summary').click(); await page.locator('[name=inlineName]').fill('Nytt isolert emne'); await page.locator('[name=inlineCode]').fill('NEW101'); await page.getByRole('button',{name:'Bruk nytt emne'}).click()
  await page.locator('#task-form button[type=submit]').click(); await expect(page.locator('#task-form')).toBeHidden()
  const after=await saved(page), created=after.tasks.find(t=>t.title==='Atomisk oppgave'); expect(after.planner.courses.some(c=>c.id===created.courseId&&c.code==='NEW101')).toBe(true)
})

test('course trash survives reload and restores exact relations, status undo is exact',async({page})=>{
  await seed(page); const before=await saved(page); await navigate(page,'subjects')
  page.once('dialog',dialog=>dialog.accept()); await page.getByRole('button',{name:'Slett emne TEST101',exact:true}).click()
  expect((await saved(page)).tasks[0]).not.toHaveProperty('courseId'); await page.reload(); await dataMenu(page); await page.getByRole('button',{name:/Papirkurv/}).click()
  await page.locator('.data-dialog').getByRole('button',{name:'Gjenopprett',exact:true}).click(); await page.locator('.data-dialog').getByRole('button',{name:'Lukk',exact:true}).click()
  const restored=await saved(page); expect(restored.tasks).toEqual(before.tasks); expect(restored.planner).toEqual(before.planner)
  await navigate(page,'overview'); await page.locator('#daily-overview [data-daily-row="task:i-dag"]').getByRole('button',{name:'Marker arbeid ferdig'}).click()
  await page.locator('.contextual-undo').getByRole('button',{name:'Angre siste endring'}).click(); expect((await saved(page)).tasks).toEqual(before.tasks)
  expect((await saved(page)).workLogs).toBeUndefined()
  expect((await saved(page)).sessions).toEqual(before.sessions)
})

test('backup preview rejects malformed history, successful replacement has recoverable prior copy',async({page})=>{
  await seed(page); await dataMenu(page); const original=await saved(page)
  const downloadPromise=page.waitForEvent('download'); await page.getByRole('button',{name:'Eksporter sikkerhetskopi'}).click(); const download=await downloadPromise
  const raw=await readFile(await download.path(),'utf8'), exported=JSON.parse(raw)
  const malformed=structuredClone(exported); malformed.data.history={version:1,undo:[],trash:[{id:'bad',label:'bad',at:'2026-09-08T06:00:00Z',changes:[{path:'tasks',id:'broken',index:0,before:{id:'broken'},after:null}]}]}
  await page.locator('#backup-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(malformed))})
  await expect(page.locator('.data-tools [role=status]')).toContainText('Ugyldig'); expect(await saved(page)).toEqual(original)
  exported.data.tasks[0].title='Restored isolated task'
  await page.locator('#backup-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))})
  await expect(page.locator('.data-dialog')).toContainText('Forhåndsvis'); expect(await saved(page)).toEqual(original)
  await page.getByRole('button',{name:'Erstatt lokale data'}).click(); expect((await saved(page)).tasks[0].title).toBe('Restored isolated task')
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('studieplanlegger:recovery:v1')).data)).toEqual(original)
})

test('work windows and task reservations are saved, shown, and do not reduce remaining work',async({page})=>{
  await seed(page); await navigate(page,'capacity'); const before=(await saved(page)).tasks
  const form=page.locator('.work-window-form'); await form.locator('[name=kind]').selectOption('busy'); await form.locator('[name=label]').fill('Reise'); await form.locator('[name=startLocal]').fill('2026-09-08T14:00'); await form.locator('[name=endLocal]').fill('2026-09-08T15:00'); await form.getByRole('button',{name:'Lagre tidsrom'}).click()
  expect((await saved(page)).busyWindows).toHaveLength(1)
  await page.locator('#new-session').click(); await page.locator('#session-dateLocal').fill('2026-09-08'); await page.locator('#session-startTime').fill('16:00'); await page.locator('#session-endTime').fill('17:00'); await page.locator('#session-taskId').selectOption('i-dag'); await page.getByRole('button',{name:'Lagre studieøkt'}).click()
  expect((await saved(page)).tasks).toEqual(before); await expect(page.locator('#capacity-task-list')).toContainText('Reservert:')
})

for(const [institution,code] of [['nmbu','math100'],['hvl','dat100']])test(`actual public ${institution} file preview and commit preserve missing metadata warnings`,async({page})=>{
  const data={schemaVersion:1,tasks:[],planner:{courses:[{...course,name:code.toUpperCase(),code:code.toUpperCase(),university:institution.toUpperCase()}],sources:[],events:[]}}
  const requests=[];page.on('request',request=>{if(!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))requests.push(request.url())})
  await seed(page,data); await navigate(page,'subjects')
  await openImportMethod(page, 'calendar')
  await page.locator('#calendar-import-form [name=file]').setInputFiles(resolve(`tests/fixtures/public-programs/timeedit-${institution}-${code}-2026.ics`));await page.locator('#ics-preview').click()
  await expect(page.locator('#import-preview')).toContainText('gruppenummer')
  if(institution==='nmbu')expect(await page.locator('.activity-choices label').filter({hasText:'Regneøving'}).locator('input').isChecked()).toBe(false)
  await page.screenshot({path:`artifacts/eleven-import-${institution}-desktop.png`})
  await page.getByRole('button',{name:'Bekreft import',exact:true}).click()
  const imported=await saved(page); expect(imported.planner.events.length).toBeGreaterThan(0); expect(imported.planner.sources[0].kind).toBe('file')
  await page.reload(); expect((await saved(page)).planner.events).toEqual(imported.planner.events); expect(requests).toEqual([])
})

test('wizard preserves search/semester/campus on back, distinguishes gates, and commits selected metadata',async({page})=>{
  await page.route('**/api/import/providers/ntnu/search?**',route=>route.fulfill({json:{status:'ok',results:[{code:'TEST101',name:'Isolert søkeresultat',campus:'Trondheim',semester:'autumn',year:2026}],warnings:[]}}))
  await page.route('**/api/import/providers/ntnu/details?**',route=>route.fulfill({json:{status:'ok',course:{...course,university:'NTNU'},warnings:['Studiepoeng er testdata.'],calendarUrl:null}}))
  await seed(page,{schemaVersion:1,tasks:[],planner:emptyPlanner()});await navigate(page,'subjects')
  await openCourseImport(page)
  await expect(page.locator('#course-import-form [name=code]')).toBeHidden()
  await page.locator('#course-import-form [name=university]').selectOption('ntnu')
  await expect(page.locator('.import-wizard')).toContainText('Steg 1')
  await page.getByRole('button',{name:'Neste: søk og semester'}).click()
  await expect(page.locator('#course-import-form [name=university]')).toBeHidden()
  await page.locator('#course-import-form [name=code]').fill('TEST101');await page.locator('#course-import-form [name=campus]').fill('Trondheim');await page.locator('#ntnu-fetch').click()
  await expect(page.locator('#course-import-form')).toBeHidden()
  await page.locator('.wizard-results button').first().click();await expect(page.locator('#import-preview')).toContainText('TEST101')
  await page.getByRole('button',{name:'Tilbake',exact:true}).click();await expect(page.locator('#course-import-form [name=code]')).toHaveValue('TEST101');await expect(page.locator('#course-import-form [name=campus]')).toHaveValue('Trondheim');await expect(page.locator('#course-import-form')).toBeHidden()
  await page.getByRole('button',{name:'Vis valgt forhåndsvisning'}).click();await page.getByRole('button',{name:'Importer bare emnet'}).click();expect((await saved(page)).planner.courses).toHaveLength(1)
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/eleven-import-mobile-390.png'})
})
function emptyPlanner(){return {courses:[],events:[],sources:[]}}

for(const width of [1440,390])test(`daily overview and empty account render actual state at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:width===390?844:900});const errors=await seed(page)
  await expect(page.locator('#daily-overview')).toContainText('Oppgave i-dag');await expect(page.locator('#daily-overview [data-daily-row="task:reservert"]')).toContainText('Oppgave reservert');await page.screenshot({path:`artifacts/eleven-overview-${width}.png`})
  await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({schemaVersion:1,tasks:[]})),key);await page.reload();await expect(page.locator('#daily-overview')).toBeHidden();await expect(page.locator('#connected-onboarding')).toBeVisible();expect(errors).toEqual([])
})
