import {test,expect} from '@playwright/test'
import {navigate,key} from './helpers.js'

test('published exam preview keeps information separate from deadlines and filters the requested semester',async({page})=>{
  const sourceUrl='https://www.politihogskolen.no/for-studenter/eksamen/eksamensoversikt-ba'
  await page.route('**/api/import/calendar-sources/phs',route=>route.fulfill({json:{status:'ok',results:[{name:'Publisert bacheloroversikt',sourceUrl}],warnings:[]}}))
  await page.route('**/api/import/calendar',route=>route.fulfill({json:{sourceKind:'phs-public-exam',name:'Publisert eksamensoversikt',warnings:[],calendar:[
    'BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT','UID:oral-public-period','DTSTART;VALUE=DATE:20261126','DTEND;VALUE=DATE:20261210','SUMMARY:Muntlig eksamensperiode','TRANSP:TRANSPARENT','END:VEVENT',
    'BEGIN:VTODO','UID:published-deadline','DUE:20261214T110000Z','SUMMARY:Innlevering rapport','END:VTODO',
    'BEGIN:VTODO','UID:next-semester-deadline','DUE:20270514T100000Z','SUMMARY:Innlevering neste semester','END:VTODO','END:VCALENDAR',''
  ].join('\r\n')}}))
  await page.goto('/');await navigate(page,'subjects');await page.getByRole('button',{name:'Importer emner og plan',exact:true}).click();await page.getByRole('button',{name:'Fra kalenderfil eller lenke',exact:true}).click()
  const form=page.locator('.institutional-calendar-import')
  if (!await form.evaluate(node => node.open)) await form.locator(':scope > summary').click()
  await form.getByRole('combobox',{name:'Offentlig kalenderkilde',exact:true}).selectOption('phs')
  await form.getByRole('button',{name:'Hent offentlige eksamensoversikter',exact:true}).click()
  await form.getByRole('combobox',{name:'Publisert eksamensoversikt',exact:true}).selectOption(sourceUrl)
  await form.getByLabel('Kalenderår',{exact:true}).fill('2026');await form.getByRole('combobox',{name:'Kalendersemester',exact:true}).selectOption('autumn')
  await form.getByRole('button',{name:'Forhåndsvis institusjonskalender',exact:true}).click()
  const choices=form.getByRole('checkbox',{name:'Ta med i planen',exact:true});await expect(choices).toHaveCount(2)
  expect(await choices.evaluateAll(nodes=>nodes.every(node=>!node.checked))).toBe(true)
  await expect(form.locator('.document-preview')).toContainText('1 frister utenfor valgt kalendersemester')
  for(const row of await form.locator('.document-preview details').all()){if(!await row.evaluate(node=>node.open))await row.locator(':scope > summary').click();await row.getByRole('checkbox',{name:'Ta med i planen',exact:true}).check()}
  await form.getByRole('button',{name:'Bekreft valgt plan',exact:true}).click();await expect(form.getByRole('status')).toContainText('Institusjonskalender lagret')
  const state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)
  expect(state.planner.events).toHaveLength(1);expect(state.planner.events[0]).toMatchObject({information:true,transparent:true,allDay:true})
  expect(state.tasks).toHaveLength(1);expect(state.tasks[0]).toMatchObject({deadlineLocal:'2026-12-14T12:00',remainingMinutes:null,requiresSubmission:true,completed:false})
  expect(state.planner.courses).toEqual([])
})

test('a public institutional calendar is explicitly selected, saved without a course, and remains transparent across updates',async({page})=>{
  let revision=0
  await page.route('**/api/import/calendar',route=>route.fulfill({json:{institutional:true,name:'Offentlig informasjonskalender',warnings:['Dette er informasjon, ikke undervisning.'],calendar:`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:stable-public-meeting\r\nDTSTART:20260915T100000Z\r\nDTEND:20260915T110000Z\r\nSUMMARY:Informasjonsdag${revision?' oppdatert':''}\r\nTRANSP:TRANSPARENT\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`}}))
  await page.goto('/')
  let firstId
  for(let run=0;run<3;run++){
    await navigate(page,'subjects');await page.getByRole('button',{name:'Importer emner og plan',exact:true}).click();await page.getByRole('button',{name:'Fra kalenderfil eller lenke',exact:true}).click()
    const form=page.locator('.institutional-calendar-import')
    if (!await form.evaluate(node => node.open)) await form.locator(':scope > summary').click()
    await form.getByLabel('Offentlig Plandisc-lenke',{exact:true}).fill('https://create.plandisc.com/wheel/showPublic/EJuyq2e')
    await form.getByLabel('Kalenderår',{exact:true}).fill('2026');await form.getByRole('combobox',{name:'Kalendersemester',exact:true}).selectOption('autumn')
    await form.getByRole('button',{name:'Forhåndsvis institusjonskalender',exact:true}).click()
    await expect(form.getByRole('heading',{name:'Kontroller planen før import'})).toBeVisible()
    const checkbox=form.getByRole('checkbox',{name:'Ta med i planen',exact:true});await expect(checkbox).not.toBeChecked();await checkbox.check()
    await expect(form.getByText('Informasjonsoppføring: reserverer ikke arbeidstid.')).toBeVisible()
    await form.getByRole('button',{name:'Bekreft valgt plan',exact:true}).click()
    await expect(form.getByRole('status')).toContainText('Institusjonskalender lagret')
    const state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)
    expect(state.planner.courses).toEqual([]);expect(state.planner.events).toHaveLength(1)
    const event=state.planner.events[0];expect(event).toMatchObject({courseId:'',transparent:true,information:true,title:revision?'Informasjonsdag oppdatert':'Informasjonsdag'})
    if(firstId)expect(event.id).toBe(firstId);else firstId=event.id
    expect(state.importSources).toHaveLength(1)
    await page.reload();revision=1
  }
})

test('an institutional calendar update retains the course explicitly linked at first import',async({page})=>{
  let revision=0
  await page.route('**/api/import/calendar',route=>route.fulfill({json:{institutional:true,name:'Offentlig kalender',warnings:[],calendar:`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:linked-public-event\r\nDTSTART:20260915T100000Z\r\nDTEND:20260915T110000Z\r\nSUMMARY:Informasjonsdag${revision?' oppdatert':''}\r\nTRANSP:TRANSPARENT\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`}}))
  await page.goto('/');await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({schemaVersion:1,tasks:[],planner:{courses:[{id:'existing-course',code:'INF101',name:'Programmering',university:'',year:2026,semester:'autumn',credits:null,description:'',notes:''}],events:[],sources:[]}})),key);await page.reload()
  for(let run=0;run<2;run++){
    await navigate(page,'subjects');await page.getByRole('button',{name:'Importer emner og plan',exact:true}).click();await page.getByRole('button',{name:'Fra kalenderfil eller lenke',exact:true}).click()
    const form=page.locator('.institutional-calendar-import')
    if (!await form.evaluate(node => node.open)) await form.locator(':scope > summary').click()
    await form.getByLabel('Offentlig Plandisc-lenke',{exact:true}).fill('https://create.plandisc.com/wheel/showPublic/EJuyq2e')
    await form.getByLabel('Kalenderår',{exact:true}).fill('2026');await form.getByRole('combobox',{name:'Kalendersemester',exact:true}).selectOption('autumn')
    await form.getByRole('button',{name:'Forhåndsvis institusjonskalender',exact:true}).click()
    const row=form.locator('.document-preview details');await row.getByRole('checkbox',{name:'Ta med i planen',exact:true}).check()
    const course=row.getByRole('combobox',{name:'Emne (valgfritt)',exact:true})
    if(!run)await course.selectOption('existing-course');else await expect(course).toHaveValue('existing-course')
    await form.getByRole('button',{name:'Bekreft valgt plan',exact:true}).click();await expect(form.getByRole('status')).toContainText('Institusjonskalender lagret')
    const state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)
    expect(state.planner.events).toHaveLength(1);expect(state.planner.events[0]).toMatchObject({courseId:'existing-course',title:revision?'Informasjonsdag oppdatert':'Informasjonsdag'})
    await page.reload();revision=1
  }
})
