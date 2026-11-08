/* P-10 Video Studio / Animatic.
   Generates and reviews separate clips. Animatic is a simple sequence, never a final editing timeline. */
let videoStudioMode='clips';
let videoStudioSceneId='';
let videoStudioShotId='';
let videoStudioNotice='';
function orderedVideoScenes(){return [...(active.scenes||[])].sort((a,b)=>Number(a.order||0)-Number(b.order||0))}
function currentVideoScene(){
  const scenes=orderedVideoScenes();let scene=scenes.find(item=>item.id===videoStudioSceneId)||scenes.find(item=>(item.shots||[]).length)||scenes[0];
  if(scene)videoStudioSceneId=scene.id;return scene;
}
function currentVideoShot(scene=currentVideoScene()){
  const shots=[...(scene?.shots||[])].sort((a,b)=>Number(a.order||0)-Number(b.order||0));let shot=shots.find(item=>item.id===videoStudioShotId)||shots[0];
  if(shot)videoStudioShotId=shot.id;return shot;
}
function videoModels(){return (productionStudioState?.models||[]).filter(model=>typeof clientModelSupports==='function'&&clientModelSupports(model,'video'))}
function videoAssetsForShot(shotId){return (active.assets||[]).filter(asset=>asset.type==='video'&&asset.linkedShotId===shotId)}
function playableVideoUri(uri){const value=String(uri||'');return value.startsWith('/')||value.startsWith('data:video/')||value.startsWith('blob:')?value:''}
function shotKeyImage(shot){
  const ids=[shot?.keyImageAssetId,...(shot?.referenceAssetIds||[])].filter(Boolean);
  return ids.map(id=>(active.assets||[]).find(asset=>asset.id===id)).find(asset=>asset&&['image','reference'].includes(asset.type));
}
function videoAssetPayload(asset,extra={}){return {type:asset.type,scope:asset.scope||'shot',linkedCharacterId:asset.linkedCharacterId||'',linkedSceneId:asset.linkedSceneId||'',linkedShotId:asset.linkedShotId||'',label:asset.label,uri:asset.uri,version:asset.version||'0.1.0',notes:asset.notes||'',annotations:asset.annotations||[],status:asset.status||'draft',...extra}}
function videoClipCard(asset){
  const uri=playableVideoUri(asset.uri),approved=asset.status==='approved';
  return `<article class="video-clip-card"><div class="video-clip-preview">${uri?`<video controls preload="metadata" src="${esc(uri)}"></video>`:'<div class="video-empty-preview"><span>▶</span><small>Відеофайл зареєстровано</small></div>'}</div><div class="video-clip-copy"><div><strong>${esc(asset.label)}</strong><span class="tag">${esc(label('status',asset.status)||asset.status)}</span></div><p>${esc(asset.notes||'Окремий кліп для поточного кадру.')}</p><small>${esc(asset.uri)}</small><div class="video-clip-actions"><button type="button" onclick="openAsset('${esc(asset.id)}')">Відомості</button>${approved?'':`<button class="primary" type="button" onclick="approveVideoClip('${esc(asset.id)}')">Затвердити кліп</button>`}</div></div></article>`;
}
function videoStudioClips(){
  const scene=currentVideoScene(),shot=currentVideoShot(scene),scenes=orderedVideoScenes(),shots=[...(scene?.shots||[])].sort((a,b)=>Number(a.order||0)-Number(b.order||0));
  if(!scene||!shot)return '<p class="global-empty">Спочатку додайте сцену та хоча б один кадр у Storyboard.</p>';
  const models=videoModels(),profile=productionStudioState?.profiles?.video||'',key=shotKeyImage(shot),clips=videoAssetsForShot(shot.id),jobs=(productionStudioState?.jobs||[]).filter(job=>job.projectId===activeId&&job.type==='video'&&job.context?.shotId===shot.id).slice().reverse().slice(0,6);
  const modelOptions=models.map(model=>`<option value="${esc(model.id)}" ${profile===model.id?'selected':''}>${esc(model.name)} · ${esc(typeof modelStatusLabel==='function'?modelStatusLabel(model.status):model.status)}</option>`).join('');
  const keyUri=key&&String(key.uri||'').startsWith('/')?key.uri:'';
  return `<div class="video-studio-grid">
    <aside class="video-shot-rail"><div class="video-panel-title"><span>КОНТЕКСТ</span><strong>Сцена та кадр</strong></div><label>Сцена<select onchange="selectVideoScene(this.value)">${scenes.map(item=>`<option value="${esc(item.id)}" ${scene.id===item.id?'selected':''}>${esc(item.title)}</option>`).join('')}</select></label><div class="video-shot-list">${shots.map((item,index)=>`<button type="button" class="${shot.id===item.id?'active':''}" onclick="selectVideoShot('${esc(item.id)}')"><span>${index+1}</span><strong>${esc(item.action||item.imagePrompt||'Кадр')}</strong><small>${esc(item.seconds)} с · ${esc(item.camera||'camera')}</small></button>`).join('')}</div></aside>
    <section class="video-source-panel"><div class="video-panel-title"><span>КЛЮЧОВИЙ КАДР</span><strong>Вхід для генерації</strong></div><div class="video-source-frame">${keyUri?`<img src="${esc(keyUri)}" alt="Ключовий кадр">`:'<div class="video-empty-preview"><span>▧</span><small>Ключове зображення не додано</small></div>'}</div><dl class="video-shot-facts"><div><dt>Тривалість</dt><dd>${esc(shot.seconds)} с</dd></div><div><dt>Камера</dt><dd>${esc(shot.camera||'—')}</dd></div><div><dt>Статус</dt><dd>${esc(label('status',shot.status)||shot.status)}</dd></div></dl></section>
    <form class="video-generate-panel" onsubmit="queueVideoVariants(event)"><div class="video-panel-title"><span>ГЕНЕРАЦІЯ КЛІПУ</span><strong>Рух і камера</strong></div><label>Опис руху<textarea name="prompt" required>${esc(shot.motionPrompt||shot.action||'')}</textarea></label><label>Модель<select name="modelId" ${models.length?'':'disabled'}><option value="">Оберіть сумісну модель</option>${modelOptions}</select><small>${models.length?`Профіль: ${esc(profile||'не призначено')}`:'Сумісної video-моделі ще немає в Центрі AI-моделей.'}</small></label><div class="video-generate-options"><label>Тривалість, с<input name="durationSeconds" type="number" min="1" max="60" step=".5" value="${esc(shot.seconds||5)}"></label><label>Варіанти<select name="variantCount">${[1,2,3,4].map(n=>`<option value="${n}" ${n===2?'selected':''}>${n}</option>`).join('')}</select></label></div><button class="primary" type="submit" ${models.length?'':'disabled'}>Створити варіанти в черзі</button>${videoStudioNotice?`<p class="video-notice">${esc(videoStudioNotice)}</p>`:''}</form>
    <section class="video-variants-panel"><div class="video-panel-title"><span>ВАРІАНТИ</span><strong>Кліпи поточного кадру</strong></div><div class="video-clip-list">${clips.length?clips.map(videoClipCard).join(''):'<p class="global-empty">Згенерованих або імпортованих кліпів для цього кадру ще немає.</p>'}</div>${jobs.length?`<details class="video-jobs"><summary>Задачі генерації · ${jobs.length}</summary>${jobs.map(job=>`<div><span>${esc(studioStatus(job.status))}</span><small>варіант ${esc(job.parameters?.variantIndex||1)}/${esc(job.parameters?.variantCount||1)} · ${esc(job.prompt)}</small></div>`).join('')}</details>`:''}</section>
  </div>`;
}
function videoStudioAnimatic(){
  const scenes=orderedVideoScenes();
  const rows=[];
  let total=0;
  scenes.forEach((scene,sceneIndex)=>[...(scene.shots||[])].sort((a,b)=>Number(a.order||0)-Number(b.order||0)).forEach((shot,shotIndex)=>{
    const clips=videoAssetsForShot(shot.id),approved=clips.find(asset=>asset.status==='approved'),draft=clips.find(asset=>asset.status==='draft'),clip=approved||draft;
    total+=Number(shot.seconds||0);
    rows.push({scene,sceneIndex,shot,shotIndex,clip});
  }));
  return `<section class="animatic-sequence"><div class="animatic-summary"><div><p class="eyebrow">ПРОСТИЙ АНІМАТИК</p><h4>Перевірка порядку та приблизного хронометражу</h4><p>Це не монтажний редактор. Порядок береться зі Storyboard; фінальний монтаж виконується в DaVinci Resolve.</p></div><span>${rows.length} кадрів · ~${total.toFixed(1)} с</span></div><div class="animatic-cards">${rows.length?rows.map((row,index)=>`<article class="animatic-card"><span class="animatic-number">${index+1}</span><div class="animatic-thumb">${row.clip&&playableVideoUri(row.clip.uri)?`<video muted preload="metadata" src="${esc(playableVideoUri(row.clip.uri))}"></video>`:'<span>▶</span>'}</div><div><strong>${esc(row.scene.title)} · Кадр ${row.shotIndex+1}</strong><p>${esc(row.shot.action||row.shot.motionPrompt||row.shot.imagePrompt||'Без опису')}</p><small>${esc(row.shot.seconds)} с · ${row.clip?esc(label('status',row.clip.status)||row.clip.status):'кліп відсутній'}</small></div><button type="button" onclick="openVideoShot('${esc(row.scene.id)}','${esc(row.shot.id)}')">Відкрити</button></article>`).join(''):'<p class="global-empty">Кадрів для аніматика ще немає.</p>'}</div></section>`;
}
function videoStudioPanel(){return `<section class="video-studio"><header class="video-studio-head"><div><p class="eyebrow">VIDEO STUDIO</p><h3>Окремі кліпи для монтажу</h3><p>Ключовий кадр + опис руху + модель → варіанти → перегляд → затвердження.</p></div><button type="button" onclick="goToView('preview')">Перевірка готовності →</button></header><nav class="video-mode-tabs"><button type="button" class="${videoStudioMode==='clips'?'active':''}" onclick="setVideoStudioMode('clips')">Кліпи</button><button type="button" class="${videoStudioMode==='animatic'?'active':''}" onclick="setVideoStudioMode('animatic')">Аніматик</button></nav>${videoStudioMode==='animatic'?videoStudioAnimatic():videoStudioClips()}<p class="video-rule">Video Studio не містить багатодоріжкового монтажу, переходів, кольорокорекції або фінального рендера.</p></section>`}
function setVideoStudioMode(mode){videoStudioMode=mode==='animatic'?'animatic':'clips';videoStudioNotice='';render()}
function selectVideoScene(id){videoStudioSceneId=id;videoStudioShotId='';videoStudioNotice='';render()}
function selectVideoShot(id){videoStudioShotId=id;videoStudioNotice='';render()}
function openVideoShot(sceneId,shotId){videoStudioMode='clips';videoStudioSceneId=sceneId;videoStudioShotId=shotId;render()}
async function queueVideoVariants(event){
  event.preventDefault();const scene=currentVideoScene(),shot=currentVideoShot(scene),fd=new FormData(event.currentTarget),modelId=String(fd.get('modelId')||''),prompt=String(fd.get('prompt')||'').trim(),variantCount=Math.max(1,Math.min(4,Number(fd.get('variantCount'))||1)),durationSeconds=Number(fd.get('durationSeconds'))||Number(shot?.seconds)||5;
  if(!scene||!shot||!modelId||!prompt)return;
  if(variantCount>1&&!window.confirm(`Створити ${variantCount} окремі video-задачі? Підключений worker може використати значні GPU-ресурси.`))return;
  const inputs=[shot.keyImageAssetId,...(shot.referenceAssetIds||[])].filter(Boolean);
  videoStudioNotice='Додаємо video-задачі…';render();
  try{for(let i=1;i<=variantCount;i++)await api('/api/studio/generation-jobs',{method:'POST',body:JSON.stringify({projectId:activeId,type:'video',modelId,prompt,inputAssetIds:inputs,parameters:{durationSeconds,variantIndex:i,variantCount,camera:shot.camera||''},context:{sceneId:scene.id,shotId:shot.id}})});await refreshProductionStudio();videoStudioNotice=`Додано ${variantCount} задач(і) в глобальну чергу.`;}catch(error){videoStudioNotice='Помилка: '+error.message}render();
}
async function approveVideoClip(assetId){
 const asset=(active.assets||[]).find(item=>item.id===assetId);if(!asset||asset.status==='approved')return;
 if(!window.confirm('Затвердити цей кліп для кадру? Інші варіанти залишаться в бібліотеці.'))return;
 try{await api(`/api/projects/${encodeURIComponent(activeId)}/assets/${encodeURIComponent(asset.id)}`,{method:'PUT',body:JSON.stringify(videoAssetPayload(asset,{status:'approved'}))});await load(activeId)}catch(error){window.alert(error.message)}
}
const videoBasePageContent=pageContent;pageContent=function(){return view==='videoStudio'?videoStudioPanel():videoBasePageContent()};
const videoBaseViewTitle=viewTitle;viewTitle=function(){return view==='videoStudio'?'Video Studio':videoBaseViewTitle()};
const videoBaseViewActions=viewActions;viewActions=function(){return view==='videoStudio'?'<button onclick="setVideoStudioMode(\'animatic\')">Аніматик</button><button onclick="goToView(\'queue\')">Глобальна черга</button>':videoBaseViewActions()};
const videoBaseGoToView=goToView;goToView=function(nextView){if(nextView==='videoStudio'&&typeof refreshProductionStudio==='function'){view='videoStudio';workspaceMode='studio';refreshProductionStudio().then(render);return}videoBaseGoToView(nextView)};
