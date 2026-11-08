/* Studio-layer UI. It deliberately manages configuration and queued work only;
   no button suggests that a disconnected model generated an asset. */
let productionStudioState = { models: [], catalog: [], profiles: {}, jobs: [], assistants: null, error: '' };
let studioQueueProjectFilter = 'all';
let studioQueueStatusFilter = 'all';
let modelCenterTab = 'mine';
let modelProbeResults = {};
let modelSetupState = { modelId:null, step:1, mode:'simple', draft:null, error:'', probe:null };
async function refreshProductionStudio() {
  try {
    const [models, catalog, profiles, jobs, assistants] = await Promise.all([
      api('/api/studio/models'),
      api('/api/studio/model-catalog'),
      api('/api/studio/model-profiles'),
      api('/api/studio/generation-jobs'),
      api('/api/studio/assistants')
    ]);
    productionStudioState = { models, catalog, profiles, jobs, assistants, error: '' };
  } catch (error) { productionStudioState.error = error.message; }
}
function studioStatus(status) { return ({ ready: 'готова', available: 'доступна', installed: 'встановлена', connected: 'підключена', running: 'виконується', failed: 'помилка', 'not-installed': 'не встановлена', 'not-connected': 'не підключена', disabled: 'вимкнена', queued: 'у черзі', preparing: 'підготовка', paused: 'призупинено', completed: 'завершено', cancelled: 'скасовано', blocked: 'заблоковано' })[status] || status; }
function productionStudioPanel() {
  const error = productionStudioState.error ? `<p class="assistant-error">${esc(productionStudioState.error)}</p>` : '';
  if (view === 'models') return modelCenterPanel(error);
  if (view === 'modelSetup') return modelSetupPanel();
  if (view === 'queue') {
    const visible=productionStudioState.jobs.filter(job=>(studioQueueProjectFilter==='all'||job.projectId===studioQueueProjectFilter)&&(studioQueueStatusFilter==='all'||job.status===studioQueueStatusFilter));
    const projectOptions=(projects||[]).map(project=>`<option value="${esc(project.id)}">${esc(project.name)}</option>`).join('');
    const statuses=['queued','preparing','running','paused','blocked','failed','completed','cancelled'];
    return `<article class="card full studio-layer queue-page"><div class="queue-page-head"><div><p class="eyebrow">ЧЕРГА ГЕНЕРАЦІЙ</p><h3>Єдиний журнал запланованих робіт</h3><p class="muted">Черга глобальна для всієї студії. Повтор створює нову спробу; скасування не видаляє історію.</p></div><span class="queue-total">${productionStudioState.jobs.length} всього</span></div>${error}
      <div class="studio-queue-filter"><label>Проєкт<select onchange="setStudioQueueProjectFilter(this.value)"><option value="all">Усі проєкти</option>${(projects||[]).map(project=>`<option value="${esc(project.id)}" ${studioQueueProjectFilter===project.id?'selected':''}>${esc(project.name)}</option>`).join('')}</select></label><label>Статус<select onchange="setStudioQueueStatusFilter(this.value)"><option value="all">Усі статуси</option>${statuses.map(status=>`<option value="${status}" ${studioQueueStatusFilter===status?'selected':''}>${esc(studioStatus(status))}</option>`).join('')}</select></label><span>${visible.length} показано</span></div>
      <form class="studio-form queue-create-form" onsubmit="queueStudioGeneration(event)"><select name="projectId" aria-label="Проєкт">${projectOptions}</select><select name="type"><option value="image">Зображення</option><option value="video">Відео</option><option value="voice">Голос</option><option value="music">Музика</option><option value="ambient">Атмосфера</option><option value="sfx">SFX</option></select><select name="modelId">${productionStudioState.models.map(model => `<option value="${esc(model.id)}">${esc(model.name)} — ${esc(modelStatusLabel(model.status))}</option>`).join('')}</select><input name="prompt" placeholder="Опис завдання (необов’язково)"><button class="primary">Додати в чергу</button></form>
      <div class="queue-list">${visible.map(queueJobCard).join('') || '<p class="global-empty">У вибраному фільтрі завдань немає.</p>'}</div></article>`;
  }
  if (view === 'assistants') { const item = productionStudioState.assistants; const projectAssistant = item?.projectAssistants?.find(assistant => assistant.projectId === activeId); return `<article class="card full studio-layer"><p class="eyebrow">AI-ПОМІЧНИКИ</p><h3>Два ізольовані робочі простори</h3><div class="studio-list"><section><strong>Загальний помічник</strong><span class="tag">${esc(item?.general?.scope || 'завантаження')}</span><p>Працює з налаштуваннями та реєстром студії. Доступ до проєктів: <b>відсутній</b>.</p></section><section><strong>Помічник поточного проєкту</strong><span class="tag">${esc(projectAssistant?.scope || 'завантаження')}</span><p>Бачить лише «${esc(active.name)}». Доступ до загального помічника: <b>відсутній</b>.</p><small>Режим автономності: ${esc(projectAssistant?.autonomy || 'suggestions-only')}; усі творчі правки залишаються чернетками.</small></section></div></article>`; }
  if (view === 'davinci') return `<article class="card full studio-layer"><p class="eyebrow">DAVINCI RESOLVE</p><h3>Підготовка монтажного пакета</h3><p class="muted">Студія готує перевірені матеріали, субтитри й монтажний лист. Вона не створює автоматично проєкт Resolve та не виконує фінальний експорт.</p><div class="studio-list"><section><strong>Поточний шлях</strong><p>Сценарій → затверджені кадри та голоси → перевірка → ручне затвердження → DaVinci handoff.</p><button class="primary" onclick="goToView('preview')">Перевірити готовність випуску</button><button onclick="downloadDaVinciTimeline()">Завантажити монтажний CSV</button><button onclick="goToView('production')">Відкрити технічні інструменти</button></section></div></article>`;
  return null;
}
function setModelCenterTab(tab){modelCenterTab=tab;render();}
function clientModelSupports(model,task){
  const capability=String(model?.capability||'');
  if(task==='planning')return capability==='planning';
  if(task==='voice')return capability==='voice';
  if(task==='image'||task==='video')return capability===task||capability==='image-video';
  if(task==='music'||task==='ambient'||task==='sfx')return capability===task||capability==='audio'||capability==='music-sfx';
  return false;
}
function modelStatusClass(status){return ['ready','available','running'].includes(status)?'ready':['disabled','failed'].includes(status)?'disabled':'pending'}
function modelStatusLabel(status){return ({installed:'встановлена',connected:'підключена',running:'запущена',failed:'помилка'})[status]||studioStatus(status)}
function modelCatalogInfo(id){return productionStudioState.catalog.find(item=>item.id===id)}
function modelCard(model,catalog=modelCatalogInfo(model.id)){
  const probe=modelProbeResults[model.id]||model.lastProbe;
  const configured=Boolean(model.setup?.savedAt);
  return `<section class="model-card">
    <div class="model-card-head"><div><strong>${esc(model.name)}</strong><span class="tag">${esc(catalog?.category||model.capability)}</span></div><span class="model-state ${modelStatusClass(model.status)}">${esc(modelStatusLabel(model.status))}</span></div>
    <p>${esc(catalog?.description||model.notes||'')}</p>
    <div class="model-facts"><span>Рушій <b>${esc(model.runtime)}</b></span><span>Версія <b>${esc(model.version)}</b></span><span>Виконання <b>${esc(model.setup?.executionTarget||model.execution)}</b></span></div>
    <div class="model-readiness-mini"><span class="${configured?'ok':''}">Конфігурація <b>${configured?'збережена':'не збережена'}</b></span><span class="${probe?.ok?'ok':probe?'error':''}">Перевірка <b>${probe?(probe.ok?'успішна':'помилка'):'ще не виконана'}</b></span><span class="${model.status==='running'?'ok':''}">Запуск <b>${model.status==='running'?'активний':'не запущено'}</b></span></div>
    ${catalog?`<small>Ліцензія: ${esc(catalog.license)} · Вимоги: ${esc(catalog.requirements)} · ${esc(catalog.sizeNote)}</small>`:''}
    ${probe?`<div class="model-probe ${probe.ok?'ok':'error'}"><strong>${probe.ok?'✓ Перевірка пройдена':'Перевірка не пройдена'}</strong><span>${esc(probe.message)}</span><small>${probe.checkedAt?esc(new Date(probe.checkedAt).toLocaleString('uk-UA')):''}</small></div>`:''}
    <div class="model-card-actions"><button type="button" onclick="startModelSetup('${esc(model.id)}')">Налаштувати</button><button class="primary" type="button" onclick="probeStudioModelUI('${esc(model.id)}')">Перевірити готовність</button></div>
  </section>`;
}
function catalogCard(entry){
  const model=entry.registry;
  return `<section class="model-card catalog-card"><div class="model-card-head"><div><strong>${esc(entry.name)}</strong><span class="tag">${esc(entry.category)}</span></div><span class="model-state ${model?modelStatusClass(model.status):'pending'}">${esc(model?modelStatusLabel(model.status):'не додана')}</span></div><p>${esc(entry.description)}</p><div class="model-facts"><span>Тип <b>${esc(entry.capability)}</b></span><span>Підключення <b>${esc(entry.installMode)}</b></span><span>Вимоги <b>${esc(entry.requirements)}</b></span></div><small>Ліцензія: ${esc(entry.license)} · Розмір: ${esc(entry.sizeNote)}</small><div class="model-card-actions">${model?`<button type="button" onclick="startModelSetup('${esc(entry.id)}')">Відкрити майстер</button><button class="primary" type="button" onclick="probeStudioModelUI('${esc(entry.id)}')">Перевірити</button>`:'<button type="button" disabled>Ще не підтримується</button>'}</div></section>`;
}
function modelProfileOptions(task,current){
  const compatible=productionStudioState.models.filter(model=>clientModelSupports(model,task));
  return '<option value="">Не призначено</option>'+compatible.map(model=>`<option value="${esc(model.id)}" ${current===model.id?'selected':''}>${esc(model.name)} · ${esc(studioStatus(model.status))}</option>`).join('');
}
function modelProfilesPanel(){
  const p=productionStudioState.profiles||{};
  const rows=[['planning','Планування / текст'],['voice','Голос'],['image','Зображення'],['video','Відео'],['music','Музика'],['ambient','Атмосфера'],['sfx','SFX']];
  return `<form class="model-profiles" onsubmit="saveModelProfiles(event)"><p class="muted">Профіль визначає модель за замовчуванням для кожного типу завдання. В модулі її все одно можна змінити.</p>${rows.map(([id,title])=>`<label><span>${title}</span><select name="${id}">${modelProfileOptions(id,p[id]||'')}</select></label>`).join('')}<div class="model-profile-actions"><span>Зберігається локально для всієї студії.</span><button class="primary">Зберегти профілі</button></div></form>`;
}
function modelCenterPanel(error){
  const connected=productionStudioState.models.filter(model=>['ready','available','connected','running'].includes(model.status));
  const archived=productionStudioState.models.filter(model=>model.status==='disabled');
  let body='';
  if(modelCenterTab==='mine')body=connected.length?'<div class="model-grid">'+connected.map(model=>modelCard(model)).join('')+'</div>':'<p class="global-empty">Підключених готових моделей ще немає.</p>';
  else if(modelCenterTab==='catalog')body='<div class="model-grid">'+productionStudioState.catalog.map(catalogCard).join('')+'</div>';
  else if(modelCenterTab==='profiles')body=modelProfilesPanel();
  else body=archived.length?'<div class="model-grid">'+archived.map(model=>modelCard(model)).join('')+'</div>':'<p class="global-empty">Архів моделей порожній.</p>';
  return `<article class="card full studio-layer model-center"><div class="model-center-head"><div><p class="eyebrow">ЦЕНТР AI-МОДЕЛЕЙ</p><h3>Моделі для всієї студії</h3><p class="muted">Статуси показують реальну готовність конфігурації. Перевірка не запускає дорогу генерацію.</p></div></div>${error}<nav class="model-tabs"><button class="${modelCenterTab==='mine'?'active':''}" type="button" onclick="setModelCenterTab('mine')">Мої моделі</button><button class="${modelCenterTab==='catalog'?'active':''}" type="button" onclick="setModelCenterTab('catalog')">Каталог</button><button class="${modelCenterTab==='profiles'?'active':''}" type="button" onclick="setModelCenterTab('profiles')">Профілі</button><button class="${modelCenterTab==='archive'?'active':''}" type="button" onclick="setModelCenterTab('archive')">Архів</button></nav><div class="model-center-body">${body}</div></article>`;
}
async function probeStudioModelUI(id){
  modelProbeResults[id]={ok:false,message:'Перевірка…'};render();
  try{
    modelProbeResults[id]=await api('/api/studio/models/'+encodeURIComponent(id)+'/probe',{method:'POST',body:'{}'});
    await refreshProductionStudio();
  }catch(error){modelProbeResults[id]={ok:false,message:error.message}}
  if(modelSetupState.modelId===id)modelSetupState.probe=modelProbeResults[id];
  render();
}
function modelSetupModel(){return productionStudioState.models.find(item=>item.id===modelSetupState.modelId)}
function modelSetupCatalog(){return modelCatalogInfo(modelSetupState.modelId)}
function startModelSetup(id){
  const model=productionStudioState.models.find(item=>item.id===id);if(!model)return;
  const setup=model.setup||{};
  modelSetupState={modelId:id,step:1,mode:setup.mode||'simple',draft:{executionTarget:setup.executionTarget||model.execution||'local',storagePath:setup.storagePath||'',endpoint:setup.endpoint||'',connectionLabel:setup.connectionLabel||'',technicalNotes:setup.technicalNotes||''},error:'',probe:model.lastProbe||modelProbeResults[id]||null};
  view='modelSetup';workspaceMode='studio';render();window.scrollTo({top:0,left:0});
}
function modelSetupSet(field,value){modelSetupState.draft={...(modelSetupState.draft||{}),[field]:value}}
function modelSetupSetMode(mode){modelSetupState.mode=mode==='advanced'?'advanced':'simple';render()}
function modelSetupBack(){if(modelSetupState.step>1){modelSetupState.step--;render()}else{view='models';modelCenterTab='catalog';render()}}
function modelSetupNext(){modelSetupState.step=Math.min(3,modelSetupState.step+1);render()}
async function saveModelSetup(){
  const model=modelSetupModel();if(!model)return;
  modelSetupState.error='';
  try{
    const result=await api('/api/studio/models/'+encodeURIComponent(model.id)+'/setup',{method:'PUT',body:JSON.stringify({mode:modelSetupState.mode,...modelSetupState.draft})});
    await refreshProductionStudio();
    modelSetupState.draft={...modelSetupState.draft,...result.setup};
    modelSetupState.step=4;
    render();
  }catch(error){modelSetupState.error=error.message;render()}
}
function modelSetupReadiness(model){
  const probe=modelSetupState.probe||model?.lastProbe;
  return `<div class="model-readiness-grid"><div class="${model?.setup?.savedAt?'ok':''}"><span>КОНФІГУРАЦІЯ</span><strong>${model?.setup?.savedAt?'Збережена':'Не збережена'}</strong><small>${model?.setup?.savedAt?esc(new Date(model.setup.savedAt).toLocaleString('uk-UA')):'Майстер ще не завершено'}</small></div><div class="${probe?.ok?'ok':probe?'error':''}"><span>ПЕРЕВІРКА</span><strong>${probe?(probe.ok?'Пройдена':'Не пройдена'):'Не виконана'}</strong><small>${probe?esc(probe.message):'Натисніть «Перевірити готовність»'}</small></div><div class="${model?.status==='running'?'ok':''}"><span>ЗАПУСК</span><strong>${model?.status==='running'?'Запущена':'Не запущена'}</strong><small>Перевірка не запускає важку модель автоматично</small></div></div>`;
}
function modelSetupPanel(){
  const model=modelSetupModel(),entry=modelSetupCatalog();if(!model)return '<p class="global-empty">Модель не знайдена.</p>';
  const draft=modelSetupState.draft||{},step=modelSetupState.step||1;
  const steps=[['1','Огляд'],['2','Місце виконання'],['3','Конфігурація'],['4','Перевірка']];
  let body='';
  if(step===1)body=`<section class="model-wizard-section"><p class="eyebrow">КРОК 1</p><h4>Що саме підключається</h4><div class="model-wizard-summary"><strong>${esc(model.name)}</strong><p>${esc(entry?.description||model.notes||'')}</p><div class="model-wizard-facts"><span>Тип <b>${esc(entry?.category||model.capability)}</b></span><span>Ліцензія <b>${esc(entry?.license||'Не вказано')}</b></span><span>Розмір <b>${esc(entry?.sizeNote||'Не вказано')}</b></span><span>Вимоги <b>${esc(entry?.requirements||'Не вказано')}</b></span></div></div><div class="model-wizard-warning">Майстер не завантажує модель, не приймає ліцензію замість вас і не запускає віддалений сервіс.</div></section>`;
  if(step===2)body=`<section class="model-wizard-section"><p class="eyebrow">КРОК 2</p><h4>Де модель має працювати</h4><div class="model-execution-choice"><label class="${draft.executionTarget!=='remote'?'active':''}"><input type="radio" name="modelExecutionTarget" value="local" ${draft.executionTarget!=='remote'?'checked':''} onchange="modelSetupSet('executionTarget','local');render()"> <strong>Цей комп’ютер</strong><span>Локальні файли та обчислення на Mac.</span></label><label class="${draft.executionTarget==='remote'?'active':''}"><input type="radio" name="modelExecutionTarget" value="remote" ${draft.executionTarget==='remote'?'checked':''} onchange="modelSetupSet('executionTarget','remote');render()"> <strong>GPU-сервер / worker</strong><span>Окремий виконавець; модель не завантажується на Mac.</span></label></div>${draft.executionTarget==='remote'?`<label>Endpoint (без ключів і паролів)<input value="${esc(draft.endpoint||'')}" placeholder="https://worker.example.local" oninput="modelSetupSet('endpoint',this.value)"></label><label>Назва підключення<input value="${esc(draft.connectionLabel||'')}" placeholder="Наприклад: Home GPU Node" oninput="modelSetupSet('connectionLabel',this.value)"></label>`:`<label>Папка моделі / даних<input value="${esc(draft.storagePath||'')}" placeholder="Наприклад: ~/AI-Models/Piper" oninput="modelSetupSet('storagePath',this.value)"></label>`}<p class="muted">Це лише збережена конфігурація шляху/вузла. Файли не копіюються й сервер не реєструється автоматично.</p></section>`;
  if(step===3)body=`<section class="model-wizard-section"><p class="eyebrow">КРОК 3</p><h4>Підтвердити конфігурацію</h4><div class="model-wizard-mode"><button class="${modelSetupState.mode==='simple'?'active':''}" type="button" onclick="modelSetupSetMode('simple')">Простий режим</button><button class="${modelSetupState.mode==='advanced'?'active':''}" type="button" onclick="modelSetupSetMode('advanced')">Технічні деталі</button></div><div class="model-config-review"><span>Модель <b>${esc(model.name)}</b></span><span>Виконання <b>${esc(draft.executionTarget==='remote'?'GPU-сервер / worker':'цей Mac')}</b></span><span>Шлях / endpoint <b>${esc(draft.executionTarget==='remote'?(draft.endpoint||'не задано'):(draft.storagePath||'не задано'))}</b></span></div>${modelSetupState.mode==='advanced'?`<label>Технічна примітка<textarea oninput="modelSetupSet('technicalNotes',this.value)" placeholder="Аргументи запуску, середовище, особливості…">${esc(draft.technicalNotes||'')}</textarea></label>`:''}<div class="model-wizard-warning">«Зберегти конфігурацію» не означає «встановити» або «запустити». Після збереження потрібна окрема фактична перевірка.</div></section>`;
  if(step===4)body=`<section class="model-wizard-section"><p class="eyebrow">КРОК 4</p><h4>Перевірка підключення і готовності</h4>${modelSetupReadiness(model)}<div class="model-test-box"><p>Перевірка читає фактичний стан локального runtime або підключених worker-ів. Вона не виконує дорогу генерацію й не завантажує модель у RAM без потреби.</p><button class="primary" type="button" onclick="probeStudioModelUI('${esc(model.id)}')">Перевірити готовність зараз</button></div></section>`;
  return `<article class="card full studio-layer model-wizard"><header class="model-wizard-head"><div><button type="button" class="text-action" onclick="modelSetupBack()">← Центр моделей</button><p class="eyebrow">МАЙСТЕР МОДЕЛІ · G-06 / G-07</p><h3>${esc(model.name)}</h3><p>Просте підключення, технічні параметри та окрема перевірка фактичної готовності.</p></div><span class="model-state ${modelStatusClass(model.status)}">${esc(modelStatusLabel(model.status))}</span></header><nav class="model-wizard-steps">${steps.map(([id,title])=>`<span class="${Number(id)===step?'active':Number(id)<step?'done':''}"><b>${id}</b>${title}</span>`).join('')}</nav>${modelSetupState.error?`<p class="assistant-error">${esc(modelSetupState.error)}</p>`:''}${body}<footer class="model-wizard-actions"><span>Жодної автоматичної інсталяції або вибору моделі за вас.</span><div>${step>1&&step<4?'<button type="button" onclick="modelSetupBack()">Назад</button>':''}${step<3?`<button class="primary" type="button" onclick="modelSetupNext()">Далі</button>`:''}${step===3?'<button class="primary" type="button" onclick="saveModelSetup()">Зберегти конфігурацію</button>':''}${step===4?'<button type="button" onclick="view=\'models\';modelCenterTab=\'mine\';render()">Готово</button>':''}</div></footer></article>`;
}
async function saveModelProfiles(event){
  event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));
  try{productionStudioState.profiles=await api('/api/studio/model-profiles',{method:'PUT',body:JSON.stringify(data)});render();}
  catch(error){productionStudioState.error=error.message;render()}
}
function queueProjectName(id){return (projects||[]).find(project=>project.id===id)?.name||id}
function queueJobCard(job){
  const model=productionStudioState.models.find(item=>item.id===job.modelId);
  const events=(job.events&&job.events.length?job.events:[{id:'legacy',at:job.createdAt,status:job.status,message:job.note||job.error||'Старий запис без детального журналу.'}]).slice().reverse();
  const canCancel=!['completed','cancelled'].includes(job.status);
  const canRetry=['failed','blocked','cancelled'].includes(job.status);
  return `<article class="queue-job ${esc(job.status)}">
    <header><div><span class="queue-job-type">${esc(job.type)}</span><strong>${esc(queueProjectName(job.projectId))}</strong></div><div><span class="tag">${esc(studioStatus(job.status))}</span><span class="tag">спроба ${esc(job.attempt||1)}</span></div></header>
    <div class="queue-job-body"><p>${esc(job.prompt||'Без текстового опису')}</p><div class="queue-job-meta"><span>Модель <b>${esc(model?.name||job.modelId)}</b></span><span>Пріоритет <b>${esc(job.priority)}</b></span><span>Створено <b>${esc(new Date(job.createdAt).toLocaleString('uk-UA'))}</b></span></div>${job.error?`<p class="queue-job-error">${esc(job.error)}</p>`:''}${job.retryOf?`<small class="queue-retry-link">Повтор задачі ${esc(job.retryOf.slice(0,8))}</small>`:''}
      <details class="queue-events"><summary>Журнал · ${events.length}</summary><div>${events.map(event=>`<div class="queue-event"><span class="queue-event-dot"></span><div><strong>${esc(studioStatus(event.status))}</strong><p>${esc(event.message||'')}</p><small>${esc(event.at?new Date(event.at).toLocaleString('uk-UA'):'')}</small></div></div>`).join('')}</div></details>
    </div>
    <footer>${job.outputAssetId?`<button type="button" onclick="openQueueJobResult('${esc(job.id)}')">Відкрити результат</button>`:'<span></span>'}<div>${job.status==='queued'?`<button type="button" onclick="transitionStudioJob('${esc(job.id)}','paused')">Призупинити</button>`:''}${job.status==='paused'?`<button type="button" onclick="transitionStudioJob('${esc(job.id)}','queued')">Продовжити</button>`:''}${canRetry?`<button type="button" onclick="retryStudioJob('${esc(job.id)}')">Повторити</button>`:''}${canCancel?`<button class="danger-soft" type="button" onclick="cancelStudioJob('${esc(job.id)}')">Скасувати</button>`:''}</div></footer>
  </article>`;
}
function setStudioQueueProjectFilter(value){studioQueueProjectFilter=value||'all';render();}
function setStudioQueueStatusFilter(value){studioQueueStatusFilter=value||'all';render();}

async function queueStudioGeneration(event) { event.preventDefault(); const form = event.currentTarget, data = Object.fromEntries(new FormData(form)); try { await api('/api/studio/generation-jobs', { method: 'POST', body: JSON.stringify({ ...data, projectId: data.projectId || activeId }) }); await refreshProductionStudio(); render(); } catch (error) { productionStudioState.error = error.message; render(); } }
async function transitionStudioJob(id, status) { try { await api(`/api/studio/generation-jobs/${encodeURIComponent(id)}/transition`, { method: 'POST', body: JSON.stringify({ status }) }); await refreshProductionStudio(); render(); } catch (error) { productionStudioState.error = error.message; render(); } }
async function retryStudioJob(id){
  if(!window.confirm('Створити нову спробу цієї задачі? Якщо модель використовує платні або GPU-ресурси, нова спроба може їх витратити.'))return;
  try{await api(`/api/studio/generation-jobs/${encodeURIComponent(id)}/retry`,{method:'POST',body:'{}'});await refreshProductionStudio();render()}catch(error){productionStudioState.error=error.message;render()}
}
async function cancelStudioJob(id){
  if(!window.confirm('Скасувати цю задачу? Історія залишиться в журналі.'))return;
  try{await api(`/api/studio/generation-jobs/${encodeURIComponent(id)}/cancel`,{method:'POST',body:JSON.stringify({note:'Скасовано користувачем у глобальній черзі.'})});await refreshProductionStudio();render()}catch(error){productionStudioState.error=error.message;render()}
}
async function openQueueJobResult(id){
  const job=productionStudioState.jobs.find(item=>item.id===id);if(!job?.outputAssetId)return;
  try{await load(job.projectId);view='mediaLibrary';if(typeof mediaLibraryQuery!=='undefined'){const asset=(active.assets||[]).find(item=>item.id===job.outputAssetId);mediaLibraryQuery=asset?.label||'';}render()}catch(error){productionStudioState.error=error.message;render()}
}
function downloadDaVinciTimeline() { const episode = (active.episodes || []).find(item => item.id === activeEpisodeId) || (active.episodes || [])[0]; if (!episode) return window.alert('Спочатку створіть або виберіть випуск.'); window.location.href = `/api/projects/${encodeURIComponent(activeId)}/episodes/${encodeURIComponent(episode.id)}/davinci-handoff/timeline.csv`; }
const baseProductionPageContent = pageContent; pageContent = function () { return ['models', 'modelSetup', 'queue', 'assistants', 'davinci'].includes(view) ? productionStudioPanel() : baseProductionPageContent(); };
const baseProductionTitle = viewTitle; viewTitle = function () { return ({ models: 'Центр AI-моделей', modelSetup: 'Налаштування моделі', queue: 'Черга генерацій', assistants: 'AI-помічники', davinci: 'Підготовка DaVinci' })[view] || baseProductionTitle(); };
const baseProductionNav = renderWorkspaceNav; renderWorkspaceNav = function () { baseProductionNav(); };
setTimeout(refreshProductionStudio, 0);
