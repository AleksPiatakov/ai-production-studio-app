/* P-01 Project Overview — operational project dashboard.
   Shared by the local app and the synthetic Pages preview. */
window.APSProjectDashboard = Object.freeze({ render: function renderDashboard(data){
 const esc = value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const p=data.progress||{scenes:[],shots:[],lines:[],storyReady:false,voicesReady:false,shotsReady:false,reviewReady:false};
 const episodes=data.episodes||[], current=data.currentEpisode||episodes[0]||null, scenes=p.scenes||[], assets=data.assets||[], characters=data.characters||[], tasks=(data.tasks||[]).filter(task=>task.status!=='done'), statusLabel=typeof data.statusLabel==='function'?data.statusLabel:(x=>x);
 const steps=[
  {name:'Сценарій',ready:p.storyReady,view:'script',hint:'Текст і репліки'},
  {name:'Кадри',ready:p.shotsReady,view:'storyboard',hint:'Ключові кадри'},
  {name:'Озвучення',ready:p.voicesReady,view:'audio',hint:'Затверджені дублі'},
  {name:'Готовність',ready:p.reviewReady,view:'preview',hint:'Перед DaVinci'}
 ];
 const nextStep=steps.find(step=>!step.ready)||{name:'DaVinci',ready:true,view:'davinci',hint:'Підготувати пакет'};
 const approvedAssets=assets.filter(a=>a.status==='approved').length;
 const draftAssets=assets.filter(a=>a.status!=='approved').length;
 const approvedScenes=scenes.filter(scene=>['approved','production'].includes(scene.status)).length;
 const recentEpisodes=[...episodes].slice(-4).reverse();
 const sceneRows=scenes.slice(0,5);
 const quick=[
  ['✎','Сценарій','script'],['▦','Сторіборд','storyboard'],['◖','Озвучування','audio'],
  ['▤','Медіа','mediaLibrary'],['✧','AI Помічник','advisor'],['⇧','DaVinci','davinci']
 ];
 return `<article class="card full p01-dashboard">
  <header class="p01-heading">
   <div><p class="eyebrow">ОГЛЯД ПРОЄКТУ</p><h3>${esc(data.name||'Проєкт')}</h3><p>Епізоди, сцени, завдання, статуси та активи в одному робочому огляді.</p></div>
   <button class="p01-season-link" type="button" onclick="goToView('episodes')">Сезон і випуски →</button>
  </header>

  <section class="p01-current">
   <div class="p01-current-copy"><p class="eyebrow">ПОТОЧНИЙ ВИПУСК</p><strong>${esc(current?.title||'Випуск ще не створено')}</strong><small>${current?esc(statusLabel(current.status||'draft')):'Створіть випуск, щоб почати виробничий цикл'}</small></div>
   <div class="p01-status-grid" aria-label="Статус поточного випуску">
    ${steps.map(step=>`<button type="button" class="p01-status ${step.ready?'ready':''}" onclick="goToView('${step.view}')"><span>${step.ready?'✓':'○'}</span><strong>${step.name}</strong><small>${step.hint}</small></button>`).join('')}
   </div>
  </section>

  <section class="p01-kpis" aria-label="Ключові показники проєкту">
   <button type="button" onclick="goToView('episodes')"><span>Випуски</span><strong>${episodes.length}</strong><small>${current?esc(statusLabel(current.status||'draft')):'Немає поточного'}</small></button>
   <button type="button" onclick="goToView('storyboard')"><span>Сцени</span><strong>${scenes.length}</strong><small>${approvedScenes} затверджено · ${(p.shots||[]).length} кадрів</small></button>
   <button type="button" onclick="goToView('mediaLibrary')"><span>Активи</span><strong>${assets.length}</strong><small>${approvedAssets} затверджено · ${draftAssets} в роботі</small></button>
   <button type="button" onclick="goToView('advisor')"><span>Завдання</span><strong>${tasks.length}</strong><small>відкритих у проєкті</small></button>
  </section>

  <div class="p01-overview-grid">
   <section class="p01-panel">
    <div class="p01-panel-heading"><div><p class="eyebrow">ВИПУСКИ</p><h4>Останні епізоди</h4></div><button onclick="goToView('episodes')" type="button">Усі</button></div>
    ${recentEpisodes.length?recentEpisodes.map(item=>`<button type="button" class="p01-list-item" onclick="goToView('episodes')"><span><strong>${esc(item.title||'Без назви')}</strong><small>Сезон ${item.seasonNumber||1} · Епізод ${item.episodeNumber||1}</small></span><em>${esc(statusLabel(item.status||'draft'))}</em></button>`).join(''):'<div class="p01-empty"><strong>Випусків ще немає</strong><small>Створіть перший випуск у розділі «Сезон і випуски».</small></div>'}
   </section>

   <section class="p01-panel">
    <div class="p01-panel-heading"><div><p class="eyebrow">СЦЕНИ</p><h4>Поточний випуск</h4></div><button onclick="goToView('storyboard')" type="button">Сторіборд</button></div>
    ${sceneRows.length?sceneRows.map(scene=>`<button type="button" class="p01-list-item" onclick="goToView('storyboard')"><span><strong>${esc(scene.title||'Сцена')}</strong><small>${Number(scene.durationSeconds||0)} с · ${(scene.shots||[]).length} кадрів</small></span><em>${esc(statusLabel(scene.status||'draft'))}</em></button>`).join(''):'<div class="p01-empty"><strong>Сцен у поточному випуску ще немає</strong><small>Після створення сцен вони з’являться тут зі статусами.</small></div>'}
   </section>

   <section class="p01-panel">
    <div class="p01-panel-heading"><div><p class="eyebrow">ЗАВДАННЯ</p><h4>Що потребує уваги</h4></div><button onclick="goToView('advisor')" type="button">AI Помічник</button></div>
    ${tasks.length?tasks.slice(0,5).map(task=>`<button type="button" class="p01-list-item" onclick="goToView('advisor')"><span><strong>${esc(task.title||task.summary||'Завдання')}</strong><small>${esc(task.note||task.description||'Проєктне завдання')}</small></span><em>${esc(task.status||'open')}</em></button>`).join(''):'<div class="p01-empty ready"><strong>Відкритих завдань немає</strong><small>Нові задачі з’являться тут або в AI Помічнику проєкту.</small></div>'}
   </section>

   <section class="p01-panel">
    <div class="p01-panel-heading"><div><p class="eyebrow">АКТИВИ</p><h4>Стан матеріалів</h4></div><button onclick="goToView('mediaLibrary')" type="button">Медіабібліотека</button></div>
    <div class="p01-asset-summary"><div><strong>${approvedAssets}</strong><span>затверджено</span></div><div><strong>${draftAssets}</strong><span>чернетки / в роботі</span></div><div><strong>${characters.length}</strong><span>персонажів</span></div></div>
    <p class="p01-panel-note">Затверджені ресурси не перезаписуються напряму; зміни створюють нову версію.</p>
   </section>
  </div>

  <section class="p01-next">
   <div><p class="eyebrow">НАСТУПНА ДІЯ</p><strong>${nextStep.name} · ${nextStep.hint}</strong><small>${p.reviewReady?'Випуск пройшов базову перевірку готовності.':'Dashboard показує фактичні стани матеріалів, без автоматичного затвердження.'}</small></div>
   <button class="primary" type="button" onclick="goToView('${nextStep.view}')">Продовжити</button>
  </section>

  <nav class="p01-quick-actions" aria-label="Швидкі переходи проєкту">
   ${quick.map(([icon,label,view])=>`<button type="button" onclick="goToView('${view}')"><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}
  </nav>
 </article>`;
} });