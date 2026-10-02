import { test, expect } from '@playwright/test'
import { navigate, key } from './helpers.js'

test('restoring an explicitly empty program and cohort never silently chooses the first source option', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => sessionStorage.setItem('studieplanlegger:program-import-draft:v1', JSON.stringify({ version: 1, institution: 'nhh', query: '', year: 2026, programs: [{ code: 'TEST', name: 'First program', sourceUrl: 'https://www.nhh.no/studier/test/' }], cohorts: [{ cohort: '2026', requiresStudentCohort: true }], addedCourses: [], plan: null, values: { program: '', cohort: '' } })))
  await page.reload(); await navigate(page, 'subjects')
  await page.getByRole('button', { name: 'Importer emner og plan', exact: true }).click()
  await page.getByRole('button', { name: 'Fra lærested', exact: true }).click()
  const host = page.locator('.program-import')
  await expect(host.locator('[name=program]')).toHaveValue('')
  await expect(host.locator('[name=cohort]')).toHaveValue('')
  await expect(host.locator('[name=studentCohort]')).toBeHidden()
  await host.getByRole('button', { name: 'Hent studieplan', exact: true }).click()
  await expect(host).toContainText('Velg studieprogram og opptakskull.')
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull()
})

test('source course type stays intact while a missing study semester requires an explicit student placement', async ({ page }) => {
  const sourceUrl='https://www.nhh.no/studier/testprofil/'
  await page.route('**/api/import/providers/nhh/**',async route=>{
    const action=new URL(route.request().url()).pathname.split('/').at(-1)
    const data=action==='programs'?{results:[{code:'TEST',name:'Syntetisk profil',sourceUrl}]}:action==='program-cohorts'?{results:[{cohort:'2026',sourceUrl}]}:{
      program:{code:'TEST',name:'Syntetisk profil',cohort:'2026',sourceUrl,campuses:[]},models:[{id:'profile',name:'Emnegruppe fra kilde',periods:[{id:'unplaced',label:'Emnegruppe – avklar studiesemester',studySemester:null,requiresStudentStudySemester:true,year:null,semester:null,courses:[]}],unplacedCourses:[{id:'course',code:'TEST101',name:'Obligatorisk kildeemne',university:'NHH',year:null,semester:null,credits:7.5,choice:'O',sourceUrl,sourceProvider:'nhh-program',sourceRecordId:'TEST101',sourceVersion:'2026'}]}]
    }
    await route.fulfill({json:{status:'ok',...data}})
  })
  await page.goto('/');await navigate(page,'subjects')
  await page.getByRole('button',{name:'Importer emner og plan',exact:true}).click()
  await page.getByRole('button',{name:'Fra lærested',exact:true}).click()
  const host=page.locator('.program-import')
  await host.locator('[name=institution]').selectOption('nhh')
  await host.getByRole('button',{name:'Hent studieprogram',exact:true}).click()
  await host.locator('[name=program]').selectOption('0');await host.locator('[name=cohort]').selectOption('0')
  await host.getByRole('button',{name:'Hent studieplan',exact:true}).click()
  await host.locator('[name=model]').selectOption('profile');await host.locator('[name=studySemester]').selectOption('unplaced')
  await host.locator('[name=clarifiedYear]').fill('2026');await host.locator('[name=clarifiedSemester]').selectOption('autumn');await expect(host.locator('[name=programCampus]')).toBeHidden()
  const choice=host.getByRole('checkbox',{name:/TEST101.*Obligatorisk.*Bekreft plassering/})
  await expect(choice).not.toBeChecked();await choice.check()
  await host.getByRole('button',{name:'Forhåndsvis valgte emner',exact:true}).click()
  await expect(host.getByRole('status')).toContainText('hvilket studiesemester')
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull()
  await host.locator('[name=clarifiedStudySemester]').fill('3')
  await host.getByRole('button',{name:'Forhåndsvis valgte emner',exact:true}).click()
  await host.getByRole('button',{name:'Bekreft programimport',exact:true}).click()
  await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key))?.planner?.courses?.length,key)).toBe(1)
  const binding=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).planner.courses[0].programBinding,key)
  expect(binding).toMatchObject({studySemester:3,studySemesterClarifiedByStudent:true,calendarClarifiedByStudent:true,choice:'O'})
  await page.reload()
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).planner.courses[0].programBinding,key)).toEqual(binding)
})
