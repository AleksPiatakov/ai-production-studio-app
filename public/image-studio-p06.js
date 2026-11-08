/* P-06. Approved Image Studio shell.
 * Pure renderer shared by local app and static preview.
 * Only stored image assets are displayed. No inference is simulated.
 */
(function(){
 const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const photo=asset=>asset&&typeof asset.uri==='string'&&asset.uri.startsWith('/')&&/\.(png|jpe?g|webp)(?:\?.*)?$/i.test(asset.uri);
 function render(data){
  const assets=(data.assets||[]).filter(a=>['image','reference'].includes(a.type)&&photo(a));
  const scene=data.scene||null, shot=data.shot||null;
  const choices=data.shots||[];
  const selected=assets.find(x=>x.id===data.selectedAssetId)||assets[0];
  const src=selected?.uri||'';
  const shotPrompt=shot?.imagePrompt||shot?.prompt||'';
  const negativePrompt=data.negativePrompt||'';
  const imageModels=data.imageModels||[];
  const imageProfile=data.imageProfile||'';
  const modelOptions=imageModels.map(model=>`<option value="${esc(model.id)}" ${model.id===imageProfile?'selected':''}>${esc(model.name)} · ${esc(model.status||'')}</option>`).join('');
  return `<article class="p06-studio" aria-label="Image Studio">
   <nav class="p06-project-tabs" aria-label="Розділи проєкту"><button type="button" data-p06-route="overview">Огляд</button><button type="button" data-p06-route="script">Сценарій</button><button type="button" data-p06-route="storyboard">Сторіборд</button><button type="button" class="active" aria-current="page">Image Studio</button><button type="button" data-p06-route="audio">Voice Studio</button><button type="button" data-p06-route="assets">Матеріали</button></nav>
   <div class="p06-section-tabs"><span class="active">Генерація зображень</span><span>Редактор зображень</span><span>Арт-стилі</span><span>Референси</span><span>Бібліотека зображень</span></div>
   <div class="p06-body">
    <section class="p06-prompts">
     <div class="p06-column-title"><strong>Опис сцени (Prompt)</strong><span class="p06-muted">${scene?esc(scene.title):'Оберіть сцену'}</span></div>
     <label class="p06-field-label" for="p06-shot">Кадр</label>
     <select id="p06-shot" aria-label="Поточний кадр" ${choices.length?'':'disabled'}>${choices.length?choices.map((v,i)=>`<option value="${esc(v.id)}" ${v.id===shot?.id?'selected':''}>Кадр ${i+1} · ${esc(v.seconds||'—')} с</option>`).join(''):'<option>Кадрів немає</option>'}</select>
     <label class="p06-field-label" for="p06-prompt">Позитивний промпт</label>
     <textarea id="p06-prompt" readonly aria-label="Збережений опис кадру" placeholder="Поки немає опису кадру">${esc(shotPrompt)}</textarea>
     <p class="p06-hint">Промпт прив'язаний до кадру. Його можна змінити через редагування кадру.</p>
     <button type="button" class="p06-secondary" data-p06-action="edit-shot" ${shot?'':'disabled'}>✎ Редагувати опис кадру</button>
     <button type="button" class="p06-secondary p06-brief-action" data-p06-action="prepare-brief" ${shotPrompt.trim()?'':'disabled'}>✧ Підготувати запит на зображення</button>
     <label class="p06-field-label" for="p06-negative">Негативний промпт</label>
     <textarea id="p06-negative" placeholder="Необов’язково: що модель не повинна додавати в цей кадр">${esc(negativePrompt)}</textarea>
     <p class="p06-hint">Передається лише як параметр поточного generation job. Підтримка залежить від вибраної image-моделі.</p>
     <div class="p06-reference-block"><div class="p06-column-title"><strong>Референси з бібліотеки</strong><span>${assets.length}</span></div><div class="p06-reference-grid">${assets.slice(0,6).map(a=>`<button type="button" data-p06-asset="${esc(a.id)}" title="${esc(a.label)}"><img src="${esc(a.uri)}" alt="${esc(a.label)}"></button>`).join('')||'<p class="p06-empty">Додайте перше зображення</p>'}</div><button type="button" class="p06-secondary" data-p06-action="upload">＋ Завантажити референс</button></div>
    </section>
    <section class="p06-preview">
     <div class="p06-column-title"><strong>Результат / вибраний матеріал</strong><span>${selected?esc(selected.label):'Зображення відсутнє'}</span></div>
     <div class="p06-preview-stage">${selected?`<img src="${esc(src)}" alt="${esc(selected.label)}" class="p06-selected-image">`:'<div class="p06-placeholder"><span aria-hidden="true">▧</span><strong>Поки немає зображень</strong><small>Референси та результати генерації з’являться після їх створення й збереження в бібліотеці</small></div>'}</div>
     <div class="p06-preview-toolbar"><span>${selected?esc(selected.version||'Чернетка')+' · '+esc(selected.status||'draft'):'Локальна бібліотека'}</span><button type="button" data-p06-action="open-image" ${selected?'':'disabled'}>Переглянути</button><button type="button" data-p06-action="asset-details" ${selected?'':'disabled'}>Властивості</button></div>
     <div class="p06-bottom-title"><strong>Варіанти зображень (${assets.length})</strong><span>Реальні матеріали проєкту</span></div>
     <div class="p06-variants">${assets.length?assets.map((a,i)=>`<button type="button" class="p06-variant ${a.id===selected?.id?'active':''}" data-p06-asset="${esc(a.id)}" aria-pressed="${a.id===selected?.id?'true':'false'}"><img src="${esc(a.uri)}" alt="${esc(a.label)}"><span>${i+1}. ${esc(a.label)}</span></button>`).join(''):'<p class="p06-empty">Варіантів поки немає — генератор зображень не підключено.</p>'}</div>
    </section>
    <aside class="p06-settings">
     <div class="p06-setting-header"><strong>Параметри</strong><span>Локальна робота</span></div>
     <label>Модель генерації<select id="p06-model" ${imageModels.length?'':'disabled'}><option value="">${imageModels.length?'Оберіть модель':'Не підключена'}</option>${modelOptions}</select></label>
     <label>Роздільна здатність<select id="p06-resolution"><option value="1920x1080">1920 × 1080</option><option value="1280x720">1280 × 720</option><option value="1024x1024">1024 × 1024</option></select></label>
     <div class="p06-setting-row"><span>Співвідношення</span><strong>16:9</strong></div>
     <label>Кількість варіантів<select id="p06-variants-count">${[1,2,3,4].map(n=>`<option value="${n}" ${n===2?'selected':''}>${n}</option>`).join('')}</select></label>
     <div class="p06-setting-row"><span>Рівень деталізації</span><strong>Залежить від моделі</strong></div>
     <button type="button" class="p06-generate" data-p06-action="generate" ${imageModels.length&&shotPrompt.trim()?'':'disabled'}>${imageModels.length?'Створити варіанти':'Генерація недоступна'}</button>
     <p class="p06-hint">${imageModels.length?'Задачі підуть у глобальну чергу й виконаються тільки сумісним worker-ом.':'Для створення нових зображень потрібно підключити сумісну image-модель у Центрі моделей.'}</p>
     <div class="p06-history"><strong>Історія матеріалів</strong><p>${assets.length} збережених зображень і референсів</p><button type="button" data-p06-route="assets" class="p06-secondary">Відкрити бібліотеку</button></div>
    </aside>
   </div>
  </article>`;
 }
 window.APSImageStudio=Object.freeze({render});
})();
