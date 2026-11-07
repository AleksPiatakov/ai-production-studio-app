// Automated phone-width UI acceptance for public-safe static preview.
// No account data, local assets or generation engines are used.
const {chromium}=require('playwright');
const path=require('node:path');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const out=path.resolve('preview-screenshots');
 fs.mkdirSync(out,{recursive:true});
 const widths=[390,375];
 try{
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('file://'+path.resolve('preview-dist','index.html'),{waitUntil:'load'});
   if(!(await page.locator('#preview-layout').evaluate(el=>el.classList.contains('sidebar-collapsed'))))throw Error('Phone sidebar must start collapsed');
   for(const [screen,selector] of [['project','#preview-dashboard'],['script','#screen-script .p02-edit-layout'],['storyboard','#screen-storyboard .director-desk']]){
    await page.locator('.preview-controls [data-screen="'+screen+'"]').click();
    await page.locator(selector).waitFor({state:'visible',timeout:10000});
    const overflow=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,bodyWidth:document.body.scrollWidth,rootWidth:document.documentElement.scrollWidth}));
    if(overflow.bodyWidth>overflow.viewport+2||overflow.rootWidth>overflow.viewport+2)throw Error('Horizontal page overflow on '+screen+' at '+width+': '+JSON.stringify(overflow));
    await page.screenshot({path:path.join(out,'phone-'+width+'-'+screen+'.png'),fullPage:true});
    if(screen==='script'){
      const textarea=page.locator('#demo-script-text');
      if(!(await textarea.isVisible()))throw Error('Mobile screenplay text hidden');
      await page.locator('#screen-script [data-demo-script-mode="scene"]').click();
      await page.locator('#demo-scene-selector').selectOption('1');
      if(!(await textarea.inputValue()).includes('СЦЕНА 2'))throw Error('Mobile scene selection broken');
      await page.locator('#demo-script-focus').click();
      if(!(await page.locator('#screen-script').evaluate(el=>el.classList.contains('demo-p02-focus'))))throw Error('Mobile focus did not open');
      if(await page.locator('#screen-script .p02-ai-panel').isVisible())throw Error('Mobile focus assistant not hidden');
      await page.screenshot({path:path.join(out,'phone-'+width+'-focus.png'),fullPage:true});
      await page.locator('#demo-script-focus').click();
    }
    if(screen==='storyboard'){
      const firstScene=page.locator('#screen-storyboard .desk-scene').first();
      if(!(await firstScene.isVisible()))throw Error('Mobile scene list hidden');
      const sceneBounds=await firstScene.boundingBox();
      if(!sceneBounds||sceneBounds.x+sceneBounds.width>width+2)throw Error('Mobile scene choice offscreen: '+JSON.stringify(sceneBounds));
      await page.locator('[data-demo-p04-shot="2"]').click();
      if((await page.locator('#demo-p04-inspector-title').innerText())!=='Кадр 2')throw Error('Mobile shot selection broken');
    }
   }
   if(errors.length)throw Error('Phone '+width+' JS errors: '+errors.join(' ; '));
   await page.close();
  }
  console.log('Mobile acceptance passed: 390/375 px; project, screenplay, storyboard, focus and scene/shot selection');
 } finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
