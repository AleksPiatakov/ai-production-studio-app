// Browser acceptance for P-02 approved two-mode scenario editor and focus mode.
// Runs against disposable seeded server in CI. Never touches user-local projects.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:950}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const base='http://127.0.0.1:4173';
 const project='animated-faith-stories';
 const requestJson=async(url,payload)=>{
  const response=await page.request.post(base+url,{data:payload});
  if(!response.ok())throw new Error('POST '+url+': '+response.status()+' '+await response.text());
  return response.json();
 };
 const output=path.resolve('preview-screenshots');
 fs.mkdirSync(output,{recursive:true});
 try{
  const episode=await requestJson('/api/projects/'+project+'/episodes',{
   title:'P02 Smoke Episode',seasonNumber:1,episodeNumber:1,targetMinutes:7,status:'development',theme:'',logline:''
  });
  const original='ВСТУП\n\nСЦЕНА 1. ЛІС — ДЕНЬ\nОпис лісу.\n\nСЦЕНА 2. МІСТ — ДЕНЬ\nОпис моста.';
  const script=await requestJson('/api/projects/'+project+'/scripts',{
   episodeId:episode.id,title:'P02 Test Script',logline:'Тест обох режимів',body:original,status:'draft'
  });
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.evaluate(async ({scriptId,episodeId})=>{
   await load('animated-faith-stories');
   activeEpisodeId=episodeId;openScript(scriptId);
  },{scriptId:script.id,episodeId:episode.id});
  await page.locator('[data-p02-mode="whole"]').waitFor();
  const originalVisible=await page.locator('#script-workspace-body').inputValue();
  if(originalVisible!==original)throw new Error('Whole episode text mismatch');
  await page.screenshot({path:path.join(output,'p02-whole-episode.png'),fullPage:true});
  await page.locator('[data-p02-mode="scene"]').click();
  const sceneCount=await page.locator('#p02-scene-items button').count();
  if(sceneCount!==3)throw new Error('Expected intro + two scenes, got '+sceneCount);
  await page.locator('[data-p02-scene="2"]').click();
  const selected=await page.locator('#script-workspace-body').inputValue();
  if(!selected.includes('СЦЕНА 2.')||selected.includes('СЦЕНА 1.'))throw new Error('Scene-only display is wrong');
  await page.locator('#script-workspace-body').fill(selected.replace('Опис моста.','Опис моста, який світиться.'));
  await page.locator('[data-p02-focus]').click();
  if(!(await page.locator('body').evaluate(el=>el.classList.contains('p02-focus'))))throw new Error('Focus not enabled');
  await page.screenshot({path:path.join(output,'p02-focus.png'),fullPage:true});
  await page.locator('[data-p02-focus]').click();
  await page.locator('[data-p02-mode="whole"]').click();
  const full=await page.locator('#script-workspace-body').inputValue();
  if(!full.includes('Опис лісу.')||!full.includes('Опис моста, який світиться.'))throw new Error('Edits not synchronized to full episode');
  await page.locator('#script-workspace-form button[type="submit"]').last().click();
  await page.waitForFunction(()=>!!document.querySelector('.editor-success'),null,{timeout:15000});
  const response=await page.request.get(base+'/api/projects/'+project);
  if(!response.ok())throw new Error('Project read failed');
  const proj=await response.json();
  const data=proj.project||proj;
  const stored=(data.scripts||[]).find(s=>s.id===script.id);
  if(!stored?.body.includes('Опис лісу.')||!stored.body.includes('Опис моста, який світиться.'))throw new Error('Scene edit was not persisted to canonical script');
  if(errors.length)throw new Error('JS errors: '+errors.join('; '));
  console.log('P-02 OK: whole/scene modes, focus, canonical script save, original text preserved');
 }catch(error){
  await page.screenshot({path:path.join(output,'p02-diagnostic.png'),fullPage:true}).catch(()=>{});
  console.error('P02 diagnostic:',(await page.locator('body').innerText().catch(()=>'' )).slice(0,1200),errors);
  throw error;
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
