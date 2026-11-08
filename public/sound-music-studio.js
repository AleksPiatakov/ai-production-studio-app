/* P-11 Sound & Music Studio — deliberately simple.
   Create/listen/select/basic non-destructive edit/save. No multitrack editor. */
let soundStudioKind='music';
let soundStudioNotice='';
function soundKindLabel(kind){return ({music:'Музика',ambient:'Атмосфера',sfx:'SFX'})[kind]||kind}
function soundModelOptions(kind){
  const compatible=(productionStudioState?.models||[]).filter(model=>typeof clientModelSupports==='function'&&clientModelSupports(model,kind));
  const models=typeof preferredModelOrder==='function'?preferredModelOrder(compatible):compatible;
  return {models,html:models.map(model=>`<option value="${esc(model.id)}">${esc(model.name)} · ${esc(typeof modelStatusLabel==='function'?modelStatusLabel(model.status):model.status)}</option>`).join('')};
}
function projectSoundAssets(){
  return (active.assets||[]).filter(asset=>['music','ambient','sfx'].includes(asset.type));
}
function projectSoundJobs(){
  return (productionStudioState?.jobs||[]).filter(job=>job.projectId===activeId&&['music','ambient','sfx'].includes(job.type));
}
function playableAudioUri(uri){
  const value=String(uri||'');
  return value.startsWith('/')||value.startsWith('data:audio/')||value.startsWith('blob:') ? value : '';
}
function soundAssetSceneName(asset){
  return (active.scenes||[]).find(scene=>scene.id===asset.linkedSceneId)?.title||'Без прив’язки до сцени';
}
function soundAssetPayload(asset,extra={}){
  return {
    type:asset.type,scope:asset.scope||'audio',linkedCharacterId:asset.linkedCharacterId||'',linkedSceneId:asset.linkedSceneId||'',
    label:asset.label,uri:asset.uri,version:asset.version||'0.1.0',notes:asset.notes||'',annotations:asset.annotations||[],
    audioEdit:asset.audioEdit||{trimStart:0,trimEnd:0,fadeIn:0,fadeOut:0,volume:1},status:asset.status||'draft',...extra
  };
}
function soundAssetCard(asset){
  const uri=playableAudioUri(asset.uri),edit=asset.audioEdit||{},approved=asset.status==='approved';
  return `<article class="sound-result-card">
    <div class="sound-result-head"><div><span class="sound-kind">${esc(soundKindLabel(asset.type))}</span><strong>${esc(asset.label)}</strong></div><span class="tag">${esc(label('status',asset.status)||asset.status)}</span></div>
    <p>${esc(soundAssetSceneName(asset))} · v${esc(asset.version||'0.1.0')}</p>
    ${uri?`<audio controls preload="metadata" src="${esc(uri)}"></audio>`:`<div class="sound-uri"><span>Файл зареєстровано</span><code>${esc(asset.uri)}</code></div>`}
    <div class="sound-edit-summary"><span>Trim <b>${Number(edit.trimStart||0).toFixed(1)}–${Number(edit.trimEnd||0)?Number(edit.trimEnd).toFixed(1):'кінець'} с</b></span><span>Fade <b>${Number(edit.fadeIn||0).toFixed(1)} / ${Number(edit.fadeOut||0).toFixed(1)} с</b></span><span>Гучність <b>${Math.round(Number(edit.volume??1)*100)}%</b></span></div>
    <div class="sound-result-actions"><button type="button" onclick="openSoundAssetEditor('${esc(asset.id)}')">${approved?'Переглянути':'Базове редагування'}</button>${approved?'':`<button class="primary" type="button" onclick="approveSoundAsset('${esc(asset.id)}')">Затвердити</button>`}</div>
  </article>`;
}
function soundJobCard(job){
  const model=(productionStudioState.models||[]).find(item=>item.id===job.modelId);
  const scene=(active.scenes||[]).find(item=>item.id===job.context?.sceneId);
  return `<article class="sound-job"><div><strong>${esc(soundKindLabel(job.type))}</strong><span class="tag">${esc(studioStatus(job.status))}</span></div><p>${esc(job.prompt||'Без промпту')}</p><small>${esc(scene?.title||'Без сцени')} · ${esc(model?.name||job.modelId)} · варіант ${esc(job.parameters?.variantIndex||1)}/${esc(job.parameters?.variantCount||1)}</small>${job.error?`<span class="error">${esc(job.error)}</span>`:''}</article>`;
}
function soundStudioPanel(){
  const {models,html:modelOptions}=soundModelOptions(soundStudioKind);
  const assets=projectSoundAssets().filter(asset=>asset.type===soundStudioKind);
  const jobs=projectSoundJobs().filter(job=>job.type===soundStudioKind).slice().reverse().slice(0,8);
  const scenes=active.scenes||[];
  const profileId=productionStudioState?.profiles?.[soundStudioKind]||'';
  const hasReady=models.some(model=>['ready','available','running'].includes(model.status));
  return `<section class="sound-studio">
    <header class="sound-studio-head"><div><p class="eyebrow">ЗВУК І МУЗИКА</p><h3>Створити → прослухати → вибрати → зберегти</h3><p>Окремі музичні, атмосферні та SFX-матеріали. Фінальне зведення виконується в DaVinci Resolve.</p></div><button type="button" onclick="openSoundImport()">＋ Додати готовий аудіофайл</button></header>
    <nav class="sound-kind-tabs" aria-label="Тип аудіоматеріалу">
      ${[['music','Музика'],['ambient','Атмосфера'],['sfx','SFX']].map(([id,title])=>`<button type="button" class="${soundStudioKind===id?'active':''}" onclick="setSoundStudioKind('${id}')">${title}</button>`).join('')}
    </nav>
    <div class="sound-workspace">
      <form class="sound-create-panel" onsubmit="queueSoundVariants(event)">
        <div class="sound-panel-title"><span>СТВОРЕННЯ</span><strong>${esc(soundKindLabel(soundStudioKind))}</strong></div>
        <label>Сцена / контекст<select name="sceneId"><option value="">Без прив’язки до сцени</option>${scenes.map(scene=>`<option value="${esc(scene.id)}">${esc(scene.title)}</option>`).join('')}</select></label>
        <label>Промпт<textarea name="prompt" required placeholder="${soundStudioKind==='music'?'Настрій, жанр, темп, інструменти…':soundStudioKind==='ambient'?'Середовище, простір, інтенсивність, деталі…':'Який саме звуковий ефект потрібен…'}"></textarea></label>
        <label>Модель<select name="modelId" ${models.length?'':'disabled'}><option value="">Оберіть сумісну модель</option>${modelOptions}</select><small>${models.length?`Профіль за замовчуванням: ${esc(profileId||'не призначено')}`:'Сумісної моделі ще немає в Центрі AI-моделей.'}</small></label>
        <div class="sound-create-grid"><label>Тривалість, с<input name="durationSeconds" type="number" min="1" max="600" value="${soundStudioKind==='sfx'?5:30}"></label><label>Варіанти<select name="variantCount">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===3?'selected':''}>${n}</option>`).join('')}</select></label></div>
        <label>Пріоритет<select name="priority"><option value="normal">Звичайний</option><option value="high">Високий</option><option value="low">Низький</option></select></label>
        <div class="sound-create-status">${hasReady?'Є сумісна модель, готова до постановки задачі.':'Завдання можна підготувати, але виконання буде заблоковане, поки модель не стане готовою.'}</div>
        <button class="primary" type="submit" ${models.length?'':'disabled'}>Створити варіанти в черзі</button>
        ${soundStudioNotice?`<p class="sound-notice">${esc(soundStudioNotice)}</p>`:''}
      </form>
      <section class="sound-results-panel">
        <div class="sound-panel-title"><span>МАТЕРІАЛИ</span><strong>Збережені варіанти</strong></div>
        <div class="sound-results">${assets.length?assets.map(soundAssetCard).join(''):'<p class="global-empty">Для цього типу ще немає збережених аудіоматеріалів.</p>'}</div>
      </section>
    </div>
    <section class="sound-jobs-panel"><div class="sound-panel-title"><span>ЧЕРГА</span><strong>Останні задачі цього проєкту</strong></div><div class="sound-jobs">${jobs.length?jobs.map(soundJobCard).join(''):'<p class="global-empty">Завдань ще немає.</p>'}</div><button type="button" onclick="goToView('queue')">Відкрити глобальну чергу →</button></section>
    <p class="sound-rule">Базове редагування тут неруйнівне: зберігаються trim/fade/volume як інструкції. Оригінальний аудіофайл не перезаписується.</p>
  </section>`;
}
function setSoundStudioKind(kind){soundStudioKind=['music','ambient','sfx'].includes(kind)?kind:'music';soundStudioNotice='';render()}
async function queueSoundVariants(event){
  event.preventDefault();const form=event.currentTarget,fd=new FormData(form),modelId=String(fd.get('modelId')||''),prompt=String(fd.get('prompt')||'').trim();
  const variantCount=Math.max(1,Math.min(5,Number(fd.get('variantCount'))||1)),durationSeconds=Math.max(1,Number(fd.get('durationSeconds'))||1),sceneId=String(fd.get('sceneId')||'');
  if(!modelId||!prompt)return;
  if(!confirmExpensiveGeneration(soundStudioKind,variantCount))return;
  soundStudioNotice='Додаємо задачі в чергу…';render();
  try{
    for(let i=1;i<=variantCount;i++)await api('/api/studio/generation-jobs',{method:'POST',body:JSON.stringify({projectId:activeId,type:soundStudioKind,modelId,prompt,priority:fd.get('priority')||'normal',parameters:{durationSeconds,variantIndex:i,variantCount},context:{sceneId}})});
    await refreshProductionStudio();soundStudioNotice=`Додано ${variantCount} задач(і) у глобальну чергу.`;
  }catch(error){soundStudioNotice='Помилка: '+error.message}
  render();
}
function openSoundImport(){
  const scenes=active.scenes||[];
  modal('Додати готовий аудіоматеріал',`<p class="muted">Файл не копіюється автоматично: вкажіть локальний URI/шлях, яким керує проєкт.</p><label>Тип<select name="type"><option value="music">Музика</option><option value="ambient">Атмосфера</option><option value="sfx">SFX</option></select></label><label>Назва<input name="label" required></label><label>URI / шлях<input name="uri" required placeholder="/assets/... або asset://..."></label><label>Сцена<select name="linkedSceneId"><option value="">Без прив’язки</option>${scenes.map(scene=>`<option value="${esc(scene.id)}">${esc(scene.title)}</option>`).join('')}</select></label><label>Нотатка<textarea name="notes"></textarea></label>`,f=>{const input=Object.fromEntries(f);input.scope=input.linkedSceneId?'scene':'audio';input.linkedCharacterId='';input.version='0.1.0';input.annotations=[];input.audioEdit={trimStart:0,trimEnd:0,fadeIn:0,fadeOut:0,volume:1};input.status='draft';return api(`/api/projects/${encodeURIComponent(activeId)}/assets`,{method:'POST',body:JSON.stringify(input)})});
}
function openSoundAssetEditor(assetId){
  const asset=(active.assets||[]).find(item=>item.id===assetId);if(!asset)return;
  const edit={trimStart:0,trimEnd:0,fadeIn:0,fadeOut:0,volume:1,...(asset.audioEdit||{})};
  if(asset.status==='approved'){
    modal('Затверджений аудіоматеріал',`<p class="ok">Цей матеріал затверджено й він не редагується напряму.</p><p><strong>${esc(asset.label)}</strong></p><p class="muted">Щоб змінити його, створіть новий чернетковий варіант; затверджена версія лишається незмінною.</p>`,()=>Promise.resolve());
    document.querySelector('#modal-form button[type="submit"]').textContent='Закрити';return;
  }
  const scenes=active.scenes||[];
  modal('Базове редагування аудіо',`<p class="muted">Неруйнівні інструкції. Оригінальний файл не переписується.</p><label>Сцена<select name="linkedSceneId"><option value="">Без прив’язки</option>${scenes.map(scene=>`<option value="${esc(scene.id)}" ${asset.linkedSceneId===scene.id?'selected':''}>${esc(scene.title)}</option>`).join('')}</select></label><div class="sound-edit-grid"><label>Початок, с<input name="trimStart" type="number" min="0" max="36000" step="0.1" value="${esc(edit.trimStart)}"></label><label>Кінець, с<input name="trimEnd" type="number" min="0" max="36000" step="0.1" value="${esc(edit.trimEnd)}"><small>0 = до кінця файла</small></label><label>Fade in, с<input name="fadeIn" type="number" min="0" max="60" step="0.1" value="${esc(edit.fadeIn)}"></label><label>Fade out, с<input name="fadeOut" type="number" min="0" max="60" step="0.1" value="${esc(edit.fadeOut)}"></label><label>Гучність<input name="volume" type="range" min="0" max="2" step="0.05" value="${esc(edit.volume)}" oninput="this.nextElementSibling.value=Math.round(this.value*100)+'%'"><output>${Math.round(Number(edit.volume)*100)}%</output></label></div><label>Нотатка<textarea name="notes">${esc(asset.notes||'')}</textarea></label>`,f=>{const input=soundAssetPayload(asset,{scope:f.get('linkedSceneId')?'scene':'audio',linkedSceneId:String(f.get('linkedSceneId')||''),notes:String(f.get('notes')||''),audioEdit:{trimStart:Number(f.get('trimStart'))||0,trimEnd:Number(f.get('trimEnd'))||0,fadeIn:Number(f.get('fadeIn'))||0,fadeOut:Number(f.get('fadeOut'))||0,volume:Number(f.get('volume')??1)}});return api(`/api/projects/${encodeURIComponent(activeId)}/assets/${encodeURIComponent(asset.id)}`,{method:'PUT',body:JSON.stringify(input)})});
}
async function approveSoundAsset(assetId){
  const asset=(active.assets||[]).find(item=>item.id===assetId);if(!asset||asset.status==='approved')return;
  if(!window.confirm('Затвердити цей аудіоматеріал? Після затвердження базові параметри не можна буде змінювати напряму.'))return;
  try{await api(`/api/projects/${encodeURIComponent(activeId)}/assets/${encodeURIComponent(asset.id)}`,{method:'PUT',body:JSON.stringify(soundAssetPayload(asset,{status:'approved'}))});await load(activeId)}
  catch(error){window.alert(error.message)}
}
const soundBasePageContent=pageContent;
pageContent=function(){return view==='sound'?soundStudioPanel():soundBasePageContent()};
const soundBaseViewTitle=viewTitle;
viewTitle=function(){return view==='sound'?'Звук і музика':soundBaseViewTitle()};
const soundBaseViewActions=viewActions;
viewActions=function(){return view==='sound'?'<button onclick="openSoundImport()">＋ Додати аудіо</button><button onclick="goToView(\'queue\')">Глобальна черга</button>':soundBaseViewActions()};
const soundBaseGoToView=goToView;
goToView=function(nextView){
  if(nextView==='sound'&&typeof refreshProductionStudio==='function'){
    view='sound';workspaceMode='studio';refreshProductionStudio().then(render);return;
  }
  soundBaseGoToView(nextView);
};
