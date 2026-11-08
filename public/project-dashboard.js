/* One markup implementation for local app and mock-data online preview. */
window.APSProjectDashboard = Object.freeze({ render: function renderDashboard(data){
 const esc = value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const p=data.progress||{scenes:[],shots:[],storyReady:false,voicesReady:false,shotsReady:false,reviewReady:false};
 const steps=[
  {name:'Сценарій',ready:p.storyReady,view:'script',hint:'Текст, сцени й репліки'},
  {name:'Аудіо',ready:p.voicesReady,view:'audio',hint:'Голоси та інтонації'},
  {name:'Відеоряд',ready:p.shotsReady,view:'storyboard',hint:'Зображення та рух'},
  {name:'Збірка',ready:p.reviewReady,view:'preview',hint:'Перевірка перед DaVinci'}
 ];
 const next=steps.find(step=>!step.ready)||steps[steps.length-1];
 const modules=[
  {icon:'✎',title:'Сценарій',view:'script',description:'Епізоди, сцени та діалоги'},
  {icon:'♙',title:'Персонажі',view:'assets',description:'Біблія персонажів і стилю'},
  {icon:'▦',title:'Сторіборд',view:'storyboard',description:'Плани, кадри та референси'},
  {icon:'▧',title:'Зображення',view:'imageStudio',description:'Варіанти зображень і ресурси'},
  {icon:'◖',title:'Голос і звук',view:'audio',description:'Озвучення, мови й голоси'},
  {icon:'▶',title:'Відео',view:'videoStudio',description:'Кліпи, рух та простий аніматик'}
 ];
 const episodes=(data.episodes||[]).slice(-3).reverse(), assets=data.assets||[], characters=data.characters||[], statusLabel=typeof data.statusLabel==='function'?data.statusLabel:(x=>x);
 const approvedAssets=assets.filter(a=>a.status==='approved').length;
 return `<article class="card full p01-dashboard">
 <div class="p01-heading"><div><p class="eyebrow">ПРОЄКТНИЙ РОБОЧИЙ ПРОСТІР</p><h3>${esc(data.name)}</h3><p>Створення матеріалів від сценарію до підготовки монтажного пакета.</p></div><button class="p01-season-link" type="button" onclick="goToView('episodes')">Сезон і випуски →</button></div>
 <div class="p01-module-grid" role="group" aria-label="Шість виробничих модулів">${modules.map(item=>`<button type="button" class="p01-module" onclick="goToView('${item.view}')"><span class="p01-module-icon" aria-hidden="true">${item.icon}</span><strong>${item.title}</strong><small>${item.description}</small></button>`).join('')}</div>
 <div class="p01-lower-grid">
  <section class="p01-panel"><div class="p01-panel-heading"><div><p class="eyebrow">НЕЩОДАВНІ ВИПУСКИ</p><h4>Сценарії та епізоди</h4></div><button onclick="goToView('episodes')" type="button">Усі випуски</button></div>
  ${episodes.length?episodes.map(item=>`<button type="button" class="p01-list-item" onclick="goToView('episodes')"><span>${esc(item.title||'Без назви')}</span><small>${esc(statusLabel(item.status||'draft'))}</small></button>`).join(''):'<p class="empty">Випусків поки немає.</p>'}
  </section>
  <section class="p01-panel"><div class="p01-panel-heading"><div><p class="eyebrow">МАТЕРІАЛИ ПРОЄКТУ</p><h4>Ресурси й готовність</h4></div><button onclick="goToView('assets')" type="button">Бібліотека</button></div>
   <div class="p01-list-item"><span>Ресурси</span><small>${assets.length} всього · ${approvedAssets} затверджено</small></div>
   <div class="p01-list-item"><span>Персонажі</span><small>${characters.length} у біблії персонажів</small></div>
   <div class="p01-list-item"><span>Поточний випуск</span><small>${(p.scenes||[]).length} сцен · ${(p.shots||[]).length} кадрів</small></div>
  </section>
 </div>
 <div class="p01-next"><div><p class="eyebrow">НАСТУПНА ДІЯ</p><strong>${next.name} · ${next.hint}</strong><small>Усі зміни зберігаються як версії. Затверджені матеріали не перезаписуються.</small></div><button class="primary" type="button" onclick="goToView('${next.view}')">Продовжити</button></div>
 <details class="p01-workflow-details"><summary>Показати виробничі етапи · ${steps.filter(step=>step.ready).length} із 4 готово</summary><div class="p01-workflow-steps">${steps.map((step,index)=>`<button type="button" class="p01-workflow-step ${step.ready?'ready':''}" onclick="goToView('${step.view}')">${step.ready?'✓':index+1}. ${step.name}<small>${step.hint}</small></button>`).join('')}</div></details>
 </article>`;
} });
