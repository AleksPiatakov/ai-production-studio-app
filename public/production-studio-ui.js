/* Studio-layer UI. It deliberately manages configuration and queued work only;
   no button suggests that a disconnected model generated an asset. */
let productionStudioState = { models: [], catalog: [], profiles: {}, jobs: [], assistants: null, error: '' };
let studioQueueProjectFilter = 'all';
let modelCenterTab = 'mine';
let modelProbeResults = {};
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
  if (view === 'queue') {
    const projectName=id=>(projects||[]).find(project=>project.id===id)?.name||id;
    const visible=productionStudioState.jobs.filter(job=>studioQueueProjectFilter==='all'||job.projectId===studioQueueProjectFilter);
    const projectOptions=(projects||[]).map(project=>`<option value="${esc(project.id)}">${esc(project.name)}</option>`).join('');
    return `<article class="card full studio-layer"><p class="eyebrow">ЧЕРГА ГЕНЕРАЦІЙ</p><h3>Єдиний журнал запланованих робіт</h3><p class="muted">Черга глобальна для всієї студії. Постановка в чергу не означає, що важка модель уже запущена.</p>${error}
      <div class="studio-queue-filter"><label>Показати проєкт<select onchange="setStudioQueueProjectFilter(this.value)"><option value="all">Усі проєкти</option>${(projects||[]).map(project=>`<option value="${esc(project.id)}" ${studioQueueProjectFilter===project.id?'selected':''}>${esc(project.name)}</option>`).join('')}</select></label><span>${visible.length} завдань</span></div>
      <form class="studio-form" onsubmit="queueStudioGeneration(event)"><select name="projectId" aria-label="Проєкт">${projectOptions}</select><select name="type"><option value="image">Зображення</option><option value="video">Відео</option><option value="voice">Голос</option><option value="music">Музика</option><option value="sfx">SFX</option></select><select name="modelId">${productionStudioState.models.map(model => `<option value="${esc(model.id)}">${esc(model.name)} — ${esc(studioStatus(model.status))}</option>`).join('')}</select><input name="prompt" placeholder="Опис завдання (необов’язково)"><button class="primary">Додати в чергу</button></form>
      <div class="studio-list">${visible.map(job => `<section><strong>${esc(job.type)}</strong><span class="tag">${esc(projectName(job.projectId))}</span><span class="tag">${esc(studioStatus(job.status))}</span><span class="tag">${esc(job.priority)}</span><p>${esc(job.prompt || 'Без текстового опису')}</p>${job.inputAssetIds?.length?`<small>Референсів у завданні: ${job.inputAssetIds.length}</small>`:''}<small>${esc(job.note || job.error || '')}</small>${job.status === 'queued' ? `<button onclick="transitionStudioJob('${esc(job.id)}','paused')">Призупинити</button>` : ''}${job.status === 'paused' || job.status === 'failed' ? `<button onclick="transitionStudioJob('${esc(job.id)}','queued')">Повернути в чергу</button>` : ''}</section>`).join('') || '<p class="empty">У вибраному фільтрі завдань немає.</p>'}</div></article>`;
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
  if(task==='music'||task==='sfx')return capability===task||capability==='audio'||capability==='music-sfx';
  return false;
}
function modelStatusClass(status){return ['ready','available','running'].includes(status)?'ready':['disabled','failed'].includes(status)?'disabled':'pending'}
function modelStatusLabel(status){return ({installed:'встановлена',connected:'підключена',running:'запущена',failed:'помилка'})[status]||studioStatus(status)}
function modelCatalogInfo(id){return productionStudioState.catalog.find(item=>item.id===id)}
function modelCard(model,catalog=modelCatalogInfo(model.id)){
  const probe=modelProbeResults[model.id];
  return `<section class="model-card">
    <div class="model-card-head"><div><strong>${esc(model.name)}</strong><span class="tag">${esc(catalog?.category||model.capability)}</span></div><span class="model-state ${modelStatusClass(model.status)}">${esc(modelStatusLabel(model.status))}</span></div>
    <p>${esc(catalog?.description||model.notes||'')}</p>
    <div class="model-facts"><span>Рушій <b>${esc(model.runtime)}</b></span><span>Версія <b>${esc(model.version)}</b></span><span>Запуск <b>${esc(model.execution)}</b></span></div>
    ${catalog?`<small>Ліцензія: ${esc(catalog.license)} · Вимоги: ${esc(catalog.requirements)} · ${esc(catalog.sizeNote)}</small>`:''}
    ${probe?`<div class="model-probe ${probe.ok?'ok':'error'}"><strong>${probe.ok?'✓ Готовність підтверджено':'Не готова'}</strong><span>${esc(probe.message)}</span></div>`:''}
    <div class="model-card-actions"><button type="button" onclick="openModelSetupInfo('${esc(model.id)}')">Параметри</button><button class="primary" type="button" onclick="probeStudioModelUI('${esc(model.id)}')">Перевірити готовність</button></div>
  </section>`;
}
function catalogCard(entry){
  const model=entry.registry;
  return `<section class="model-card catalog-card"><div class="model-card-head"><div><strong>${esc(entry.name)}</strong><span class="tag">${esc(entry.category)}</span></div><span class="model-state ${model?modelStatusClass(model.status):'pending'}">${esc(model?modelStatusLabel(model.status):'не додана')}</span></div><p>${esc(entry.description)}</p><div class="model-facts"><span>Тип <b>${esc(entry.capability)}</b></span><span>Встановлення <b>${esc(entry.installMode)}</b></span><span>Вимоги <b>${esc(entry.requirements)}</b></span></div><small>Ліцензія: ${esc(entry.license)} · Розмір: ${esc(entry.sizeNote)}</small><div class="model-card-actions">${model?`<button type="button" onclick="openModelSetupInfo('${esc(entry.id)}')">Налаштувати</button><button class="primary" type="button" onclick="probeStudioModelUI('${esc(entry.id)}')">Перевірити</button>`:'<button type="button" disabled>Ще не підтримується</button>'}</div></section>`;
}
function modelProfileOptions(task,current){
  const compatible=productionStudioState.models.filter(model=>clientModelSupports(model,task));
  return '<option value="">Не призначено</option>'+compatible.map(model=>`<option value="${esc(model.id)}" ${current===model.id?'selected':''}>${esc(model.name)} · ${esc(studioStatus(model.status))}</option>`).join('');
}
function modelProfilesPanel(){
  const p=productionStudioState.profiles||{};
  const rows=[['planning','Планування / текст'],['voice','Голос'],['image','Зображення'],['video','Відео'],['music','Музика'],['sfx','SFX']];
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
  try{modelProbeResults[id]=await api('/api/studio/models/'+encodeURIComponent(id)+'/probe',{method:'POST',body:'{}'});}
  catch(error){modelProbeResults[id]={ok:false,message:error.message}}
  render();
}
function openModelSetupInfo(id){
  const model=productionStudioState.models.find(item=>item.id===id),entry=modelCatalogInfo(id);
  if(!model)return;
  modal('Параметри моделі',`<div class="model-setup-summary"><p class="eyebrow">БЕЗ УДАВАНОГО ВСТАНОВЛЕННЯ</p><h3>${esc(model.name)}</h3><p>${esc(entry?.description||model.notes||'')}</p></div><label>Статус<input value="${esc(studioStatus(model.status))}" readonly></label><label>Рушій<input value="${esc(model.runtime)}" readonly></label><label>Спосіб підключення<input value="${esc(entry?.installMode||model.execution)}" readonly></label><label>Вимоги<textarea readonly>${esc(entry?.requirements||'Не задано')}</textarea></label><p class="muted">Цей екран не позначає модель встановленою вручну. Після реального налаштування натисніть «Перевірити готовність» у Центрі моделей.</p>`,()=>Promise.resolve());
  const submit=document.querySelector('#modal-form button[type="submit"]');if(submit)submit.textContent='Закрити';
}
async function saveModelProfiles(event){
  event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));
  try{productionStudioState.profiles=await api('/api/studio/model-profiles',{method:'PUT',body:JSON.stringify(data)});render();}
  catch(error){productionStudioState.error=error.message;render()}
}
function setStudioQueueProjectFilter(value){studioQueueProjectFilter=value||'all';render();}
async function queueStudioGeneration(event) { event.preventDefault(); const form = event.currentTarget, data = Object.fromEntries(new FormData(form)); try { await api('/api/studio/generation-jobs', { method: 'POST', body: JSON.stringify({ ...data, projectId: data.projectId || activeId }) }); await refreshProductionStudio(); render(); } catch (error) { productionStudioState.error = error.message; render(); } }
async function transitionStudioJob(id, status) { try { await api(`/api/studio/generation-jobs/${encodeURIComponent(id)}/transition`, { method: 'POST', body: JSON.stringify({ status }) }); await refreshProductionStudio(); render(); } catch (error) { productionStudioState.error = error.message; render(); } }
function downloadDaVinciTimeline() { const episode = (active.episodes || []).find(item => item.id === activeEpisodeId) || (active.episodes || [])[0]; if (!episode) return window.alert('Спочатку створіть або виберіть випуск.'); window.location.href = `/api/projects/${encodeURIComponent(activeId)}/episodes/${encodeURIComponent(episode.id)}/davinci-handoff/timeline.csv`; }
const baseProductionPageContent = pageContent; pageContent = function () { return ['models', 'queue', 'assistants', 'davinci'].includes(view) ? productionStudioPanel() : baseProductionPageContent(); };
const baseProductionTitle = viewTitle; viewTitle = function () { return ({ models: 'Центр AI-моделей', queue: 'Черга генерацій', assistants: 'AI-помічники', davinci: 'Підготовка DaVinci' })[view] || baseProductionTitle(); };
const baseProductionNav = renderWorkspaceNav; renderWorkspaceNav = function () { baseProductionNav(); };
setTimeout(refreshProductionStudio, 0);
