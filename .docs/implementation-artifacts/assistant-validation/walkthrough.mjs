import { createServer } from 'file:///C:/IBE160/2026/studieplanlegger/node_modules/vite/dist/node/index.js';
import { chromium, expect } from 'file:///C:/IBE160/2026/studieplanlegger/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'walkthrough');
await mkdir(out, { recursive: true });
const results = { performedAt: new Date().toISOString(), kind: 'KI-test med syntetiske data, ikke studentens bruk', clock: '2026-09-08T08:00:00+02:00', checks: [], snapshots: [], errors: [] };
const server = await createServer({ root: 'C:/IBE160/2026/studieplanlegger', configFile: false, cacheDir: join(root, 'vite-cache'), server: { host: '127.0.0.1', port: 5186, strictPort: true }, logLevel: 'error' });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, timezoneId: 'Europe/Oslo', locale: 'nb-NO' });
  const page = await context.newPage();
  page.on('pageerror', e => results.errors.push(String(e)));
  await page.clock.install({ time: new Date('2026-09-08T07:59:00+02:00') });
  await page.clock.pauseAt(new Date(results.clock));
  await page.goto('http://127.0.0.1:5186');
  const definitions = [
    { title: 'TEST Rapport i programmering', course: 'IBE160', date: '2026-09-08', time: '11:30', estimated: 120, remaining: 90, submission: true },
    { title: 'TEST Regneøving', course: 'MAT110', date: '2026-09-08', time: '13:00', estimated: 60, remaining: 60 },
    { title: 'TEST Lesing i metode', course: 'Metode', date: '2026-09-09', time: '12:00', estimated: 45, remaining: 45 },
    { title: 'TEST Ferdig øving', course: 'IBE160', date: '2026-09-08', time: '10:30', estimated: 30, remaining: 30, done: true },
    { title: 'TEST Klar til levering', course: 'IBE160', date: '2026-09-08', time: '11:00', estimated: 20, remaining: 20, submission: true, done: true }
  ];
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('studieplanlegger:v1')));
  const row = title => page.locator('#task-list > li').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  async function menu(title) { const d=row(title).locator('details'); if (!(await d.evaluate(el=>el.open))) await d.locator('summary').click(); }
  async function all() { await page.locator('#view-all').click(); }
  async function capacity() { await page.locator('#view-capacity').click(); }
  async function session(date, start, end) {
    await capacity(); await page.locator('#new-session').click();
    await page.locator('#session-dateLocal').fill(date); await page.locator('#session-startTime').fill(start); await page.locator('#session-endTime').fill(end);
    await page.locator('#session-form button[type=submit]').click(); await expect(page.locator('#session-form')).toBeHidden();
  }
  for (const d of definitions) {
    await page.locator('#new-task').click();
    for (const [id,value] of Object.entries({ title:d.title, course:d.course, deadlineDate:d.date, deadlineTime:d.time, estimatedMinutes:d.estimated, remainingMinutes:d.remaining })) await page.locator('#'+id).fill(String(value));
    if (d.submission) await page.locator('#requiresSubmission').check();
    await page.locator('#task-form button[type=submit]').click(); await expect(page.locator('#task-form')).toBeHidden();
    await all();
    if (d.done) { await menu(d.title); await row(d.title).getByRole('checkbox').check(); }
  }
  await menu(definitions[0].title);
  await row(definitions[0].title).getByRole('button', { name: 'Legg til neste steg «'+definitions[0].title+'»', exact: true }).click();
  await page.locator('#step-description').fill('TEST Les oppgaveteksten og skriv tre stikkord');
  await page.locator('#step-estimatedMinutes').fill('15');
  await page.locator('#step-form button[type=submit]').click();
  results.initialData = await read();
  const ids = results.initialData.tasks.map(t=>t.id);
  results.checks.push('Fem oppgaver og ett neste steg registrert med faktiske skjemaer; vanlig fullføring og klar-til-levering valgt i grensesnittet.');
  await page.locator('#view-time').click();
  for (const minutes of [15,30,20]) {
    if (minutes!==20) await page.locator('[data-minutes="'+minutes+'"]').click();
    else { await page.locator('#available-minutes').fill('20'); await page.locator('#time-form button[type=submit]').click(); }
    await expect(page.locator('#task-list > li').first()).toContainText(definitions[0].title);
  }
  results.checks.push('Hurtigforslag 15, 30 og egendefinert 20 minutter velger rapportens 15-minutterssteg; hele oppgaven trenger fortsatt 90 minutter.');
  await session('2026-09-08','10:00','11:00');
  await session('2026-09-08','11:00','12:00');
  async function snapshot(name, allocation, missing, spare) {
    await capacity();
    for(let i=0;i<5;i++) await expect(page.locator('[data-capacity-task="'+ids[i]+'"]')).toContainText('Foreslått: '+allocation[i]+' min · Mangler: '+missing[i]+' min');
    const sum = allocation.reduce((a,b)=>a+b,0), shortage=missing.reduce((a,b)=>a+b,0);
    await expect(page.locator('#capacity-summary')).toHaveText('195 min arbeid · '+sum+' min foreslått · '+shortage+' min mangler · '+spare+' min ledig i øktene.');
    results.snapshots.push({name, summary:await page.locator('#capacity-summary').innerText(), tasks:await page.locator('#capacity-task-list > li').allTextContents(), data:await read()});
    await page.screenshot({path:join(out,name+'.png'),fullPage:true});
  }
  await snapshot('01-to-okter',[90,30,0,0,0],[0,30,45,0,0],0);
  await page.locator('#new-session').click();
  await page.locator('#session-dateLocal').fill('2026-09-08'); await page.locator('#session-startTime').fill('10:30'); await page.locator('#session-endTime').fill('11:30');
  await page.locator('#session-form button[type=submit]').click();
  await expect(page.locator('#session-error')).toContainText('overlapper');
  expect((await read()).sessions).toHaveLength(2);
  await page.locator('#cancel-session').click();
  results.checks.push('Overlapp 10:30–11:30 avvist; de to lagrede øktene beholdt.');
  await page.locator('#session-list > li').nth(1).getByRole('button',{name:/Rediger studieøkt/}).click();
  await page.locator('#session-startTime').fill('12:00'); await page.locator('#session-endTime').fill('13:00');
  await page.locator('#session-form button[type=submit]').click();
  await snapshot('02-flyttet-okt',[60,60,0,0,0],[30,0,45,0,0],0);
  page.once('dialog',d=>d.accept());
  await page.locator('#session-list > li').nth(1).getByRole('button',{name:/Slett studieøkt/}).click();
  await snapshot('03-slettet-okt',[60,0,0,0,0],[30,60,45,0,0],0);
  await session('2026-09-09','10:00','12:00');
  await snapshot('04-senere-ledig-tid',[60,0,45,0,0],[30,60,0,0,0],75);
  const beforeReload=await read();
  await page.reload(); await capacity();
  expect(await read()).toEqual(beforeReload);
  results.checks.push('Alle fem oppgaver, statuser, neste steg og gjenværende økter beholdt ved omlasting.');
  await page.locator('#calendar-host').getByRole('button',{name:'Agenda',exact:true}).click();
  await expect(page.locator('.calendar-agenda')).toContainText('Studieøkt');
  await expect(page.locator('.calendar-agenda')).toContainText('Frist');
  await page.setViewportSize({width:360,height:900});
  await page.screenshot({path:join(out,'05-mobil.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#new-session').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#session-dateLocal')).toBeFocused();
  await page.locator('#cancel-session').click();
  results.checks.push('Mobilvisning 360 px: kalender med frist/økt, ingen horisontal sideskrolling; tastatur åpner øktskjema og gir fokus til dato.');
  await all(); await row(definitions[0].title).getByRole('button',{name:'Neste steg gjort «'+definitions[0].title+'»',exact:true}).click();
  expect((await read()).tasks[0].remainingMinutes).toBe(90);
  expect((await read()).tasks[0].nextStep ?? null).toBeNull();
  await menu(definitions[0].title);
  await row(definitions[0].title).getByRole('button',{name:'Rediger «'+definitions[0].title+'»',exact:true}).click();
  await page.locator('#remainingMinutes').fill('75'); await page.locator('#task-form button[type=submit]').click();
  await capacity();
  await expect(page.locator('[data-capacity-task="'+ids[0]+'"]')).toContainText('Gjenstående: 75 min · Foreslått: 60 min · Mangler: 15 min');
  results.checks.push('Simulert neste steg fullført: gjenstående beholdes på 90; manuell oppdatering til 75 gir 15 minutter mangel før rapportfristen.');
  await all();
  await row(definitions[4].title).getByRole('button',{name:'Bekreft levert «'+definitions[4].title+'»',exact:true}).click();
  expect((await read()).tasks[4].submitted).toBe(true);
  await menu(definitions[4].title);
  await row(definitions[4].title).getByRole('button',{name:'Angre levering «'+definitions[4].title+'»',exact:true}).click();
  expect((await read()).tasks[4].submitted).toBe(false);
  expect((await read()).tasks[4].completed).toBe(true);
  results.checks.push('Simulert levering og angre: levertflagget endres separat; arbeid forblir ferdig. Ingen virkelig innlevering utført.');
  expect(results.errors).toEqual([]);
  results.finalData=await read(); results.status='passed';
  await context.close();
} catch(e) { results.status='failed'; results.failure=String(e.stack || e); process.exitCode=1; }
finally {
  await browser?.close(); await server.close();
  results.finishedAt=new Date().toISOString(); await writeFile(join(out,'result.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({status:results.status,checks:results.checks,snapshots:results.snapshots.map(s=>({name:s.name,summary:s.summary})),errors:results.errors,failure:results.failure,output:out},null,2));
}
