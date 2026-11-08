/* P-04 approved storyboard composition.
   Enhances existing functional storyboard without changing scene/shot storage. */
(()=>{
 const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 function enhance(){
  if(view!=='storyboard'||!active)return;
  const root=document.querySelector('.storyboard-workspace');
  const desk=root?.querySelector('.director-desk');
  if(!root||!desk||root.dataset.p04Ready==='true')return;
  root.dataset.p04Ready='true';
  const scenes=[...(active.scenes||[])].sort((a,b)=>Number(a.order||0)-Number(b.order||0));
  const scene=scenes.find(x=>x.id===activeSceneId)||scenes[0];
  const shots=scene?.shots||[];
  const shot=shots.find(x=>x.id===activeShotId)||shots[0];
  const title=root.querySelector('.storyboard-title');
  title?.insertAdjacentHTML('beforebegin',`<nav class="p04-project-tabs" aria-label="Розділи проєкту">
    <button data-p04-view="overview" type="button">Огляд</button>
    <button data-p04-view="script" type="button">Сценарій</button>
    <button class="active" type="button" aria-current="page">Сторіборд</button>
    <button data-p04-view="preview" type="button">Аніматик</button>
    <button data-p04-view="episodes" type="button">Сцени</button>
    <button data-p04-view="assets" type="button">Персонажі</button>
    <button data-p04-view="assets" type="button">Локації</button>
    <button data-p04-view="assets" type="button">Матеріали</button>
    <button data-p04-view="production" type="button">Виробництво</button>
  </nav>`);
  root.querySelector('.p04-project-tabs')?.addEventListener('click',event=>{const button=event.target.closest('[data-p04-view]');if(button)goToView(button.dataset.p04View)});
  root.querySelector('.storyboard-title h3')?.replaceChildren(document.createTextNode(scene?'Сцена '+(scene.order||'—')+'. '+scene.title:'Сторіборд'));
  root.querySelector('.desk-canvas')?.classList.add('p04-shot-workspace');
  root.querySelector('.desk-inspector')?.classList.add('p04-shot-settings');
  const assistant=document.createElement('aside');
  assistant.className='p04-assistant-dock';
  assistant.setAttribute('aria-label','AI Помічник проєкту');
  assistant.innerHTML=`<div class="p04-ai-heading"><span class="p04-ai-symbol" aria-hidden="true">✧</span><div><strong>AI Помічник проєкту</strong><small>${safe(active.name)} · лише цей проєкт</small></div></div>
    <div class="p04-ai-tabs"><span class="active">Чат</span><span>Пропозиції</span><span>Завдання</span><span>Пам'ять</span></div>
    <div class="p04-ai-box"><p class="eyebrow">ПЕРЕВІРКА КАДРУ</p><h4>${shot?'Кадр '+(shots.indexOf(shot)+1):'Виберіть кадр'}</h4>
      <p>Помічник може аналізувати сценарій, референси та узгодженість кадрів. Він не застосовує творчі зміни без вашого підтвердження.</p>
      <button class="p04-open-assistant" type="button">✧ Відкрити помічника</button></div>
    <div class="p04-ai-box"><p class="eyebrow">ПАРАМЕТРИ СЦЕНИ</p>
      <div><span>Сцена</span><strong>${safe(scene?.title||'Не обрано')}</strong></div>
      <div><span>Кадрів</span><strong>${shots.length}</strong></div>
      <div><span>Стан</span><strong>${safe(shot?.status||'чернетка')}</strong></div></div>
    <div class="p04-ai-bottom">Рішення та правки залишаються під контролем автора</div>`;
  desk.append(assistant);
  assistant.querySelector('.p04-open-assistant')?.addEventListener('click',()=>{if(typeof toggleFloatingAdvisor==='function')toggleFloatingAdvisor(true);else goToView('advisor')});
  if(shots.length){
   const strip=document.createElement('section');
   strip.className='p04-filmstrip';
   strip.setAttribute('aria-label','Стрічка кадрів сцени');
   strip.innerHTML=`<div class="p04-strip-title"><strong>Сцена ${safe(scene.order||'—')} · ${shots.length} кадрів</strong><button class="p04-add-shot" type="button">＋ Додати кадр</button></div>
     <div class="p04-strip-items">${shots.map((item,index)=>{
       const asset=(item.referenceAssetIds||[]).map(id=>(active.assets||[]).find(a=>a.id===id)).find(a=>typeof a?.uri==='string'&&a.uri.startsWith('/'));
       return `<button type="button" class="p04-strip-item ${item.id===shot?.id?'active':''}" data-p04-shot="${safe(item.id)}">
        <span class="p04-shot-number">${index+1}</span>
        ${asset?'<img loading="lazy" alt="Затверджений або чернетковий референс кадру" src="'+safe(asset.uri)+'">':'<span class="p04-image-pending">Кадр '+(index+1)+'<small>Зображення не додано</small></span>'}
        <small>${safe(item.seconds||'—')} с · ${safe(item.camera||'План не задано')}</small>
        <span class="p04-shot-status">${safe(typeof label==='function'?(label('status',item.status)||item.status):(item.status||'чернетка'))}</span>
       </button>`}).join('')}</div>`;
   desk.after(strip);
   strip.querySelector('.p04-add-shot')?.addEventListener('click',()=>openShot(scene.id));
   strip.querySelectorAll('[data-p04-shot]').forEach(button=>button.addEventListener('click',()=>selectShotForDesk(scene.id,button.dataset.p04Shot)));
  }
 }
 const before=render;
 render=function(){before();enhance()};
 enhance();
})();
