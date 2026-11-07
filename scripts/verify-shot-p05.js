// Approved P-05: browser test for real shot-linked editor and synthetic online preview.
const {chromium}=require('playwright'), fs=require('node:fs'), path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const out=path.resolve('preview-screenshots');fs.mkdirSync(out,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1660,height:980}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
   await load('animated-faith-stories');
   const shots=[
    {id:'p05-shot-1',seconds:5,imagePrompt:'Мира дивиться на міст',camera:'medium',lighting:'Тепле',referenceAssetIds:[],status:'draft'},
    {id:'p05-shot-2',seconds:7,imagePrompt:'Широкий план мосту',camera:'wide',referenceAssetIds:[],status:'draft'}
   ];
   active.scenes=[{id:'p05-ci-scene',episodeId:'ci',order:2,title:'Загадковий міст',shots}];
   activeSceneId='p05-ci-scene';activeShotId='p05-shot-1';
   goToView('storyboard');
  });
  await page.locator('[data-p05-open]').click();
  await page.locator('.p05-workspace').waitFor();
  if(!(await page.locator('#p05-prompt').inputValue()).includes('Мира дивиться'))throw Error('Selected shot prompt missing');
  if(await page.locator('.p05-generate').isEnabled())throw Error('Disconnected generator must stay disabled');
  if(await page.locator('.p05-large-frame img').count())throw Error('Preview invented a generated image');
  const col=await page.locator('.p05-body').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if(col!==4)throw Error('Approved large desktop P-05 must have four columns, got '+col);
  await page.screenshot({path:path.join(out,'p05-real-desktop.png'),fullPage:true});
  await page.locator('#p05-shot-picker').selectOption('p05-shot-2');
  if(!(await page.locator('#p05-prompt').inputValue()).includes('Широкий план'))throw Error('Shot switch did not update prompt');
  await page.locator('[data-p05-action="edit"]').first().click();
  if(!(await page.locator('#modal').isVisible()))throw Error('Edit shot failed to open existing modal');
  await page.evaluate(()=>document.querySelector('#modal').close());
  await page.goto('file://'+path.resolve('preview-dist','index.html'),{waitUntil:'load'});
  await page.evaluate(() => window.previewNavigate('shot'));
  await page.locator('#screen-shot .p05-workspace').waitFor();
  const previewColumns=await page.locator('#screen-shot .p05-body').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if(previewColumns!==4)throw Error('P05 online desktop columns mismatch '+previewColumns);
  await page.screenshot({path:path.join(out,'p05-online-desktop.png'),fullPage:true});
  await page.locator('#screen-shot #p05-shot-picker').selectOption('shot-c');
  if(!(await page.locator('#screen-shot #p05-prompt').inputValue()).includes('Реакція Мири'))throw Error('Online shot picker broken');
  await page.setViewportSize({width:390,height:844});
  const mobile=await page.locator('#screen-shot .p05-body').evaluate(el=>getComputedStyle(el).flexDirection);
  if(mobile!=='column')throw Error('Mobile shot editor not stacked: '+mobile);
  const overflow=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,width:document.documentElement.scrollWidth}));
  if(overflow.width>overflow.viewport+2)throw Error('Mobile overflow '+JSON.stringify(overflow));
  await page.screenshot({path:path.join(out,'p05-online-mobile.png'),fullPage:true});
  if(errors.length)throw Error('Page errors: '+errors.join('; '));
  console.log('P05 PASS: actual selected shot and edit modal, no fake model, online demo, mobile adaptation.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
