/* Approved P-05: detailed shot workspace. Pure UI, no generated media or fake AI.
   Data is confined to the selected project; used by local studio and safe preview. */
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const image=a=>a&&typeof a.uri==='string'&&a.uri.startsWith('/')&&/\.(png|jpe?g|webp)(?:\?.*)?$/i.test(a.uri);
 const cards=(assets,shot)=>[...(shot?.keyImageAssetId?[shot.keyImageAssetId]:[]),...(shot?.referenceAssetIds||[])].map(id=>assets.find(a=>a.id===id)).filter(image).filter((a,i,all)=>all.findIndex(b=>b.id===a.id)===i);
 function render(d){
  const scene=d.scene||null,shot=d.shot||null,shots=d.shots||[],assets=d.assets||[];
  const refs=cards(assets,shot),allImages=assets.filter(a=>['image','reference'].includes(a.type)&&image(a));
  const main=allImages.find(a=>a.id===d.selectedAssetId)||assets.find(a=>a.id===shot?.keyImageAssetId&&image(a))||refs[0]||null;
  const imageModel=d.imageModel||null;
  const noModel=imageModel?'<span class="p05-no-model ready">'+esc(imageModel.name)+' · '+esc(imageModel.status||'доступна')+'</span>':'<span class="p05-no-model">Модель не підключена · генерація вимкнена</span>';
  const sceneIndex=d.sceneIndex??'—';
  return `<article class="p05-workspace" aria-label="P-05 — редактор кадру">
   <nav class="p05-tabs" aria-label="Розділи проєкту">
    <button data-p05-route="overview">Огляд</button><button data-p05-route="script">Сценарій</button>
    <button data-p05-route="storyboard">Сторіборд</button><button class="active" aria-current="page">Редактор кадру</button>
    <button data-p05-route="imageStudio">Image Studio</button><button data-p05-route="assets">Матеріали</button>
   </nav>
   <div class="p05-body">
    <aside class="p05-references">
     <div class="p05-head"><strong>Поточний кадр</strong><span>${esc(d.projectName||'Проєкт')}</span></div>
     <label class="p05-field" for="p05-shot-picker">Сцена ${esc(sceneIndex)} · ${esc(scene?.title||'Не обрано')}</label>
     <select id="p05-shot-picker" ${shots.length?'':'disabled'}>${shots.length?shots.map((s,i)=>`<option value="${esc(s.id)}" ${shot?.id===s.id?'selected':''}>Кадр ${i+1} · ${esc(s.seconds||'—')} с</option>`).join(''):'<option>Немає кадрів</option>'}</select>
     <div class="p05-filter-tabs"><span class="active">Персонажі</span><span>Локації</span><span>Об'єкти</span></div>
     <div class="p05-assets"><strong>Референси кадру (${refs.length})</strong>
       <div class="p05-reference-grid">${refs.length?refs.map(a=>`<button class="p05-ref" type="button" data-p05-asset="${esc(a.id)}"><img src="${esc(a.uri)}" alt="${esc(a.label)}"><small>${esc(a.label)}</small></button>`).join(''):'<p class="p05-empty">Референси поки не прикріплено. Додайте їх у бібліотеку.</p>'}</div>
     </div>
     <button class="p05-outline" data-p05-action="edit" type="button" ${shot?'':'disabled'}>✎ Параметри кадру</button>
     ${shot?.dependencyStatus==='needs-review'?'<button class="p05-outline p05-review-resolve" data-p05-action="resolve-review" type="button">✓ Позначити кадр перевіреним</button>':''}
     <button class="p05-outline" data-p05-action="upload" type="button">＋ Завантажити референс</button>
     <div class="p05-local-state">Локальна генерація зображень<br><strong>${imageModel?esc(imageModel.name):'Не підключена'}</strong></div>
    </aside>
    <section class="p05-canvas">
     <div class="p05-canvas-top"><strong>Кадр ${Math.max(1,shots.findIndex(s=>s.id===shot?.id)+1)} · Сцена ${esc(sceneIndex)}</strong><span>${esc(shot?.seconds||'—')} с · ${shot?.dependencyStatus==='needs-review'?'Потрібна перевірка':esc(shot?.status||'чернетка')}</span></div>
     <div class="p05-large-frame">
       ${main?`<img src="${esc(main.uri)}" alt="${esc(main.label)}">`:'<div class="p05-no-image"><span aria-hidden="true">▧</span><strong>Ключове зображення ще не додано</strong><small>Для цього кадру можна вибрати або завантажити референс, а потім створити новий варіант через підключену модель.</small></div>'}
     </div>
     <div class="p05-gallery-head"><strong>Матеріали кадру (${refs.length})</strong><span>Лише реальні файли з бібліотеки</span></div>
     <div class="p05-strip">${refs.length?refs.map(a=>`<button type="button" class="p05-thumb ${main?.id===a.id?'active':''}" data-p05-asset="${esc(a.id)}"><img src="${esc(a.uri)}" alt="${esc(a.label)}"><small>${esc(a.label)}</small></button>`).join(''):'<p class="p05-empty">Варіантів немає</p>'}</div>
     <div class="p05-gallery-head"><strong>Галерея зображень проєкту</strong><span>${allImages.length} файлів</span></div>
     <div class="p05-global-gallery">${allImages.length?allImages.map(a=>`<button type="button" class="p05-gallery-item" data-p05-asset="${esc(a.id)}" title="${esc(a.label)}"><img src="${esc(a.uri)}" alt="${esc(a.label)}"></button>`).join(''):'<p class="p05-empty">У бібліотеці немає зображень</p>'}</div>
    </section>
    <aside class="p05-controls">
     <div class="p05-toggle"><strong>Генерація</strong><span>Редагування</span></div>
     <label class="p05-field" for="p05-prompt">Промпт</label>
     <textarea id="p05-prompt" readonly placeholder="Поки немає опису кадру">${esc(shot?.imagePrompt||shot?.prompt||'')}</textarea>
     <div class="p05-control-buttons"><button data-p05-action="edit" ${shot?'':'disabled'}>✎ Редагувати</button><button data-p05-action="brief" ${shot?'':'disabled'}>▧ Зібрати промпт</button></div>
     <details class="p05-detail"><summary>Негативний промпт</summary><p>Окреме поле негативного промпту поки не підтримується моделлю збереження.</p></details>
     <div class="p05-params"><strong>Параметри кадру</strong><div><span>Камера</span><b>${esc(shot?.camera||'Не задано')}</b></div><div><span>Світло</span><b>${esc(shot?.lighting||'Не задано')}</b></div><div><span>Емоція</span><b>${esc(shot?.emotion||'Не задано')}</b></div><div><span>Критерії готовності</span><b>${shot?.acceptanceCriteria?'Указані':'Не задані'}</b></div></div>
     <button type="button" class="p05-generate" data-p05-route="imageStudio" ${imageModel?'':'disabled'}>${imageModel?'✦ Відкрити Image Studio':'✦ Генерація недоступна'}</button>
     ${noModel}
    </aside>
    <aside class="p05-assistant">
      <div class="p05-assistant-title"><span>✧</span><div><strong>AI Помічник проєкту</strong><small>${esc(d.projectName||'Проєкт')}</small></div></div>
      <p>Контекст поточного кадру. Для аналізу відкрийте помічника проєкту; його пропозиції не застосовуються автоматично.</p>
      <div class="p05-context-line"><span>Сцена</span><strong>${esc(scene?.title||'Не обрано')}</strong></div>
      <div class="p05-context-line"><span>Статус</span><strong>${shot?.dependencyStatus==='needs-review'?'Потрібна перевірка':esc(shot?.status||'чернетка')}</strong></div>${shot?.dependencyStatus==='needs-review'?'<div class="p05-context-line"><span>Причина</span><strong>Змінено затверджений сценарій</strong></div>':''}
      <button data-p05-action="assistant" type="button">✧ Відкрити помічника</button>
    </aside>
   </div>
  </article>`;
 }
 window.APSShotWorkspace=Object.freeze({render});
})();