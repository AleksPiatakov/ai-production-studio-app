// P-06 browser acceptance for the approved offline-first Image Studio.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true}),out='preview-screenshots',errors=[];
 fs.mkdirSync(out,{recursive:true});
 const page=await browser.newPage({viewport:{width:1650,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{await load('animated-faith-stories');goToView('image-studio')});
  await page.locator('.p06-studio').waitFor({timeout:15000});
  if(await page.locator('.p06-tabs button').count()!==5)throw Error('Expected five approved tabs');
  if(await page.locator('#p06-model').isEnabled())throw Error('Disconnected generator must not enable generation');
  const cols=await page.locator('.p06-body').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if(cols!==3)throw Error('Approved Image Studio must be three columns on desktop: '+cols);
  await page.screenshot({path:path.join(out,'p06-desktop.png'),fullPage:true});
  await page.locator('#p06-prompt').fill('Мира дивиться на Міст із Світла.');
  await page.locator('[data-p06-ratio="9:16"]').click();
  await page.locator('[data-p06-style="illustration"]').click();
  await page.locator('[data-p06-action="brief"]').click();
  if(!await page.locator('#modal').isVisible())throw Error('Prompt preparation modal failed');
  const brief=await page.locator('#modal textarea').inputValue();
  if(!brief.includes('9:16')||!brief.includes('illustration')||!brief.includes('Мира'))throw Error('Prompt manifest was not assembled');
  await page.locator('#modal-cancel').click();
  await page.locator('[data-p06-action="upload"]').click();
  if(!await page.locator('#modal').isVisible())throw Error('Existing local upload modal did not open');
  await page.locator('#modal-cancel').click();
  await page.locator('[data-p06-action="library"]').click();
  if(await page.locator('.p06-studio').count())throw Error('Library navigation failed');
  await page.evaluate(()=>goToView('image-studio'));
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'p06-mobile.png'),fullPage:true});
  await page.goto('file://'+path.resolve('preview-dist/index.html'),{waitUntil:'load'});
  await page.locator('[data-screen="image"]').first().click();
  if(await page.locator('#screen-image .p06-studio').count()!==1)throw Error('Online preview failed');
  await page.setViewportSize({width:1650,height:1000});
  await page.screenshot({path:path.join(out,'p06-online.png'),fullPage:true});
  if(errors.length)throw Error('JavaScript errors: '+errors.join(' ; '));
  console.log('P06 PASS: real route, generation disabled, brief settings, upload, library, responsive and online preview');
 }catch(e){await page.screenshot({path:path.join(out,'p06-diagnostic.png'),fullPage:true}).catch(()=>{});console.error(errors);throw e}
 finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});