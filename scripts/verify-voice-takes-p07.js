// P-07 browser acceptance: actual saved audio drafts, never fabricated TTS output.
// Runs on a disposable seeded server and updates only in-memory client fixture.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1540,height:970}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const output='preview-screenshots';fs.mkdirSync(output,{recursive:true});
 try{
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.evaluate(async()=>{
   await load('animated-faith-stories');
   const episode={id:'p07-ep',title:'Сцена: Загадковий міст'};
   const character={id:'p07-mira',name:'Мира',ageBand:'young-adult',status:'approved'};
   const lineA={id:'p07-line-a',characterId:character.id,voiceIdentityKey:'p07-mira-uk',language:'uk',
     textUk:'Мира знаходить міст.',estimatedSeconds:3,status:'draft',emotion:'Рішучість',
     audioDrafts:[{id:'take-a',language:'uk',text:'Мира знаходить міст.',uri:'/assets/generated-audio/fixture-a.wav',engine:'Piper',durationSeconds:3.1,createdAt:'2026-11-07T09:00:00Z',status:'draft'},
     {id:'take-b',language:'uk',text:'Мира побачила міст.',uri:'/assets/generated-audio/fixture-b.wav',engine:'Piper',durationSeconds:3.2,createdAt:'2026-11-07T09:01:00Z',status:'draft'}]};
   const lineB={id:'p07-line-b',characterId:character.id,voiceIdentityKey:'p07-mira-uk',language:'uk',textUk:'Я не боюся.',estimatedSeconds:2,status:'draft',audioDrafts:[]};
   active.episodes=[episode];activeEpisodeId=episode.id;
   active.bibles.characters=[character];
   active.voiceProfiles=[{id:'p07-voice',identityKey:'p07-mira-uk',name:'Голос Мири',ageBand:'young-adult',languages:['uk'],engine:'Piper',status:'draft',license:'test only'}];
   active.scenes=[{id:'p07-scene',episodeId:episode.id,title:'Загадковий міст',order:1,dialogue:[lineA,lineB],shots:[]}];
   goToView('audio');
  });
  await page.locator('.p07-workspace').waitFor({timeout:8000});
  const columns=await page.locator('.p07-workspace').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if(columns!==3)throw Error('Expected three approved Voice Studio columns, got '+columns);
  if(await page.locator('.p07-take').count()!==2)throw Error('Must show exactly the two stored audio drafts');
  if(!await page.locator('.p07-review-warning').count())throw Error('Old text must mark take as needing review');
  if(await page.locator('.p07-take audio').count()!==2)throw Error('Take preview players missing');
  const geometry=await page.locator('.p07-workspace').evaluate(element=>{
    const blocks=['.p07-character-rail','.p07-lines-panel','.p07-settings-panel'].map(selector=>element.querySelector(selector).getBoundingClientRect());
    const color=getComputedStyle(element.querySelector('.audio-line')).backgroundColor;
    return {tops:blocks.map(r=>Math.round(r.top)),lefts:blocks.map(r=>Math.round(r.left)),color};
  });
  if(!(geometry.tops[0]===geometry.tops[1]&&geometry.tops[1]===geometry.tops[2]))
    throw Error('Approved P07 columns must align in one row: '+JSON.stringify(geometry));
  if(!(geometry.lefts[0]<geometry.lefts[1]&&geometry.lefts[1]<geometry.lefts[2]))
    throw Error('P07 columns out of order: '+JSON.stringify(geometry));
  if(geometry.color==='rgb(247, 251, 254)'||geometry.color==='rgb(255, 255, 255)')
    throw Error('Legacy daylight audio-line styling leaked into P07');
  const extraPanelColor=await page.locator('#voice-profiles').evaluate(el=>getComputedStyle(el).backgroundColor);
  if(extraPanelColor==='rgb(255, 255, 255)'||extraPanelColor==='rgb(242, 247, 251)')
    throw Error('Legacy white voice profiles leaked into P07: '+extraPanelColor);
  await page.screenshot({path:path.join(output,'p07-real-takes-desktop.png'),fullPage:true});
  await page.locator('[data-p07-count="5"]').click();
  if(!(await page.locator('.p07-plan-note').innerText()).includes('5 варіант'))throw Error('Variant count control is not wired');
  await page.locator('[data-p07-variation="high"]').click();
  if(!(await page.locator('.p07-plan-note').innerText()).includes('висока'))throw Error('Variation control is not wired');
  await page.locator('.audio-line[data-p07-line="p07-line-b"]').click({position:{x:15,y:20}});
  if(await page.locator('.p07-take').count())throw Error('Empty line should not borrow other line takes');
  if(!(await page.locator('.p07-variants-panel').innerText()).includes('Дублів ще немає'))throw Error('Missing empty state for selected line');
  await page.locator('.audio-line[data-p07-line="p07-line-a"]').click({position:{x:15,y:20}});
  if(await page.locator('.p07-take').count()!==2)throw Error('Switch back must restore real variants');
  await page.setViewportSize({width:390,height:844});
  if(await page.locator('#app-sidebar').isVisible())throw Error('Mobile project sidebar must not cover P07');
  await page.screenshot({path:path.join(output,'p07-real-takes-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1540,height:970});
  await page.goto('file://'+path.resolve('preview-dist/index.html'),{waitUntil:'load'});
  await page.locator('#app-sidebar [data-screen="voice"]').click();
  await page.locator('#screen-voice .p07-workspace').waitFor({state:'visible'});
  const previewCols=await page.locator('#screen-voice .p07-workspace').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if(previewCols!==3)throw Error('P07 online preview must show three approved columns, got '+previewCols);
  if(await page.locator('#screen-voice audio').count())throw Error('Demo must not claim to have generated audio');
  await page.locator('#screen-voice [data-p07-demo-count="5"]').click();
  await page.locator('#screen-voice [data-p07-demo-variation="high"]').click();
  if(!(await page.locator('#screen-voice #p07-demo-plan').innerText()).includes('5 варіанти'))throw Error('Demo take plan count not interactive');
  await page.locator('#screen-voice [data-p07-demo-line="1"]').click();
  if(!(await page.locator('#screen-voice #p07-demo-name').innerText()).includes('Бурштин'))throw Error('Demo line selection not interactive');
  await page.screenshot({path:path.join(output,'p07-online-preview.png'),fullPage:true});
  if(errors.length)throw Error('JavaScript errors: '+errors.join('; '));
  console.log('P07 PASS: three-column layout, two persisted takes, stale text flag, selectable line, controls, mobile');
 }catch(e){
  await page.screenshot({path:path.join(output,'p07-diagnostic.png'),fullPage:true}).catch(()=>{});
  console.error(errors);throw e;
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
