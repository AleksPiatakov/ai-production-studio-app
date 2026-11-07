// P-04 browser acceptance uses an in-memory scene fixture in an isolated runner.
// No writes to project storage; no fake generated media or model results.
const { chromium } = require('playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1650,height:990},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 fs.mkdirSync('preview-screenshots',{recursive:true});
 try{
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
   await load('animated-faith-stories');
   const shots=[
    {id:'p04-demo-shot-1',seconds:5,camera:'Середній план',lighting:'Тепле світло',imagePrompt:'Погляд героїні на міст',referenceAssetIds:[],status:'draft'},
    {id:'p04-demo-shot-2',seconds:7,camera:'Загальний план',lighting:'Золотий світанок',imagePrompt:'Міст через прірву',referenceAssetIds:[],status:'draft'},
    {id:'p04-demo-shot-3',seconds:6,camera:'Крупний план',lighting:'Контрове світло',imagePrompt:'Реакція Мири',referenceAssetIds:[],status:'draft'}
   ];
   active.scenes=[{id:'p04-demo-scene-1',episodeId:'p04-demo-episode',order:1,title:'Загадковий міст',purpose:'Показати надію',durationSeconds:18,status:'draft',characterIds:[],dialogue:[],shots}];
   activeSceneId='p04-demo-scene-1';
   activeShotId='p04-demo-shot-1';
   goToView('storyboard');
  });
  await page.locator('.p04-filmstrip').waitFor();
  const count=await page.locator('.p04-strip-item').count();
  if(count!==3)throw Error('Expected 3 in-memory shots, got '+count);
  if(!(await page.locator('.p04-assistant-dock').isVisible()))throw Error('P-04 project assistant dock missing');
  const cols=await page.locator('.director-desk').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if(cols!==4)throw Error('P-04 should have four columns (scenes/canvas/settings/AI), got '+cols);
  await page.screenshot({path:path.join('preview-screenshots','p04-approved-storyboard-desktop.png'),fullPage:true});
  await page.locator('[data-p04-shot="p04-demo-shot-2"]').click();
  if(!(await page.locator('[data-p04-shot="p04-demo-shot-2"]').getAttribute('class')).includes('active'))throw Error('Filmstrip did not switch to selected shot');
  await page.setViewportSize({width:800,height:900});
  await page.screenshot({path:path.join('preview-screenshots','p04-approved-storyboard-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1650,height:990});
  await page.goto('file://'+path.resolve('preview-dist','index.html'),{waitUntil:'load'});
  await page.locator('[data-screen="storyboard"]').first().click();
  if(await page.locator('#screen-storyboard .p04-strip-item').count()!==3)throw Error('P04 preview missing synthetic filmstrip');
  if(!(await page.locator('#screen-storyboard .p04-assistant-dock').isVisible()))throw Error('P04 preview missing project assistant');
  await page.locator('[data-demo-p04-shot="2"]').click();
  if((await page.locator('#demo-p04-inspector-title').innerText())!=='Кадр 2')throw Error('Preview shot selection broken');
  await page.screenshot({path:path.join('preview-screenshots','p04-approved-online.png'),fullPage:true});
  if(errors.length)throw Error('Browser errors: '+errors.join('; '));
  console.log('P04 OK: four-col desktop, shot filmstrip navigation and mobile screen');
 }catch(error){await page.screenshot({path:'preview-screenshots/p04-diagnostic.png',fullPage:true}).catch(()=>{});throw error}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
