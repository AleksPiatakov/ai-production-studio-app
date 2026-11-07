// P-06 acceptance: approved layout, real route and safe no-generator state.
// Runs in disposable CI environment, never submits jobs or changes user media.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const out=path.resolve('preview-screenshots');fs.mkdirSync(out,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1500,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
    await load('animated-faith-stories');
    active.scenes=[{
      id:'p06-scene-ci',episodeId:'p06-ep-ci',title:'Загадковий міст',order:1,
      shots:[{id:'p06-shot-ci',seconds:5,imagePrompt:'Мира стоїть перед мостом.',referenceAssetIds:[],status:'draft'}]
    }];
    activeSceneId='p06-scene-ci';activeShotId='p06-shot-ci';
    goToView('overview');
  });
  await page.locator('.p01-module').nth(3).click();
  await page.locator('.p06-studio').waitFor();
  if(!(await page.locator('#p06-prompt').inputValue()).includes('Мира стоїть'))throw Error('Local prompt not linked to selected shot');
  if(await page.locator('.p06-generate').isEnabled())throw Error('Disconnected generator must remain disabled');
  if(await page.locator('.p06-selected-image').count())throw Error('Fabricated image appeared');
  const cols=await page.locator('.p06-body').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if(cols!==3)throw Error('Expected approved desktop 3-column Image Studio, got '+cols);
  const prepare=page.locator('[data-p06-action="prepare-brief"]');
  if(!(await prepare.isEnabled()))throw Error('Shot with saved image prompt must allow brief preparation');
  await prepare.click();
  await page.locator('#modal').waitFor({state:'visible',timeout:10000});
  const briefText=await page.locator('#modal .image-brief-text').inputValue();
  if(!briefText.includes('Мира стоїть'))throw Error('Prepared image brief omitted existing shot prompt');
  await page.evaluate(()=>document.querySelector('#modal').close());
  await page.screenshot({path:path.join(out,'p06-desktop.png'),fullPage:true});
  await page.locator('[data-p06-action="edit-shot"]').click();
  if(!(await page.locator('#modal').isVisible()))throw Error('Image Studio failed to open real shot editor');
  await page.screenshot({path:path.join(out,'p06-shot-editor.png'),fullPage:true});
  await page.evaluate(()=>document.querySelector('#modal').close());
  await page.goto('file://'+path.resolve('preview-dist','index.html'),{waitUntil:'load'});
  await page.locator('.preview-controls [data-screen="images"]').click();
  await page.locator('.p06-studio').waitFor();
  const pcols=await page.locator('#screen-images .p06-body').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if(pcols!==3)throw Error('Online P06 missing approved 3 columns');
  if(await page.locator('#screen-images .p06-generate').isEnabled())throw Error('Fake generation must not run');
  await page.screenshot({path:path.join(out,'p06-online-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  if(await page.locator('#app-sidebar').isVisible())throw Error('Image Studio must not be covered by sidebar on phone');
  await page.locator('#screen-images #p06-shot').selectOption('demo-shot-b');
  if(!(await page.locator('#screen-images #p06-prompt').inputValue()).includes('Міст через ущелину'))throw Error('First image demo scene switch failed');
  await page.locator('#screen-images #p06-shot').selectOption('demo-shot-a');
  if(!(await page.locator('#screen-images #p06-prompt').inputValue()).includes('Мира дивиться'))throw Error('Repeated image demo scene switch failed');
  const overflow=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  if(overflow.scroll>overflow.width+2)throw Error('Mobile horizontal page overflow '+JSON.stringify(overflow));
  const mobileCols=await page.locator('#screen-images .p06-body').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if(mobileCols!==1)throw Error('Expected single mobile column, got '+mobileCols);
  await page.screenshot({path:path.join(out,'p06-online-mobile.png'),fullPage:true});
  if(errors.length)throw Error('Page errors: '+errors.join(' ; '));
  console.log('P06 PASS: local asset-linked route, disabled generator, shot editor, desktop/phone online preview');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
