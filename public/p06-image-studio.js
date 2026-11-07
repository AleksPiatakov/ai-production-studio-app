/* P-06 Image Studio — approved interface. Pure renderer shared by desktop and
   online preview. Never suggests a disconnected generator produced an image. */
(()=>{
 const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const imageAssets=assets=>(assets||[]).filter(x=>['image','reference'].includes(x.type)&&typeof x.uri==='string'&&x.uri.startsWith('/'));
 const state={tab:'generate',ratio:'16:9',variants:4,selected:null,style:'cinematic',quality:80,creativity:70,prompt:'',negative:'розмиття, низька якість, текст, водяні знаки, зайві персонажі'};
 const styles=[['cinematic','Кінематографічний 3D'],['cartoon','3D мультфільм'],['illustration','Ілюстрація'],['stylized','Стилізований'],['realistic','Реалістичний'],['storybook','Казковий']];
 const tabs=[['generate','Генерація зображень'],['edit','Редактор зображень'],['styles','Арт-стилі'],['references','Референси'],['library','Бібліотека зображень']];
 function render({projectName='Демонстраційний проєкт',assets=[],demo=false}={}){
   const images=imageAssets(assets),selected=images.find(x=>x.id===state.selected)||images[0],isDraft=selected?.status!=='approved';
   const safe=escapeHTML;
   const gallery=images.length?images.map((asset,i)=>'<button type="button" class="p06-thumb '+(asset.id===selected?.id?'selected':'')+'" data-p06-select="'+safe(asset.id)+'" aria-label="Відкрити зображення '+safe(asset.label)+'"><img src="'+safe(asset.uri)+'" alt="'+safe(asset.label)+'"><small>'+safe(asset.label)+'</small></button>').join(''):'<div class="p06-empty-gallery">У цьому проєкті ще немає локальних зображень. Додай референси, щоб працювати з ними в Image Studio.</div>';
   return '<article class="p06-studio" aria-label="Image Studio">'
   +'<nav class="p06-tabs" aria-label="Розділи Image Studio">'+tabs.map(([id,title])=>'<button type="button" data-p06-tab="'+id+'" class="'+(state.tab===id?'active':'')+'">'+safe(title)+'</button>').join('')+'</nav>'
   +'<div class="p06-body"><section class="p06-prompt-panel">'
   +'<div class="p06-heading"><h3>Опис сцени (Prompt)</h3><span class="p06-tag">Чернетка</span></div>'
   +'<label class="p06-field">Опис зображення<textarea id="p06-prompt" maxlength="4000" placeholder="Опиши сцену, персонажів, композицію, освітлення...">'+safe(state.prompt)+'</textarea></label>'
   +'<label class="p06-field">Негативний опис<textarea id="p06-negative" maxlength="2000">'+safe(state.negative)+'</textarea></label>'
   +'<h4>Стиль зображення</h4><div class="p06-style-grid">'+styles.map(([id,title])=>'<button type="button" data-p06-style="'+id+'" class="p06-style '+(state.style===id?'selected':'')+'"><span class="p06-style-icon" aria-hidden="true">✧</span><small>'+title+'</small></button>').join('')+'</div>'
   +'<div class="p06-source"><strong>Проєкт</strong><small>'+safe(projectName)+'</small><small>Затверджені ресурси не перезаписуються</small></div>'
   +'</section><section class="p06-canvas-panel"><div class="p06-heading"><h3>Результат генерації</h3><span class="p06-tag">'+(selected?(isDraft?'Чернетка':'Затверджено'):'Немає результатів')+'</span></div>'
   +'<div class="p06-preview">'+(selected?'<img src="'+safe(selected.uri)+'" alt="'+safe(selected.label)+'">':'<div class="p06-empty-preview"><span class="p06-empty-icon" aria-hidden="true">▧</span><strong>Зображення ще не створено</strong><p>Результат з’явиться після підключення сумісної моделі або завантаження власного файлу.</p></div>')+'</div>'
   +'<div class="p06-image-actions"><button type="button" data-p06-action="compare" '+(images.length<2?'disabled':'')+'>Порівняти</button><button type="button" data-p06-action="library">Бібліотека</button><button type="button" data-p06-action="upload">↑ Завантажити референс</button></div>'
   +'<div class="p06-heading p06-variants-heading"><h3>Варіанти зображень</h3><small>'+images.length+' наявних у проєкті</small></div><div class="p06-variants">'+gallery+'</div>'
   +'</section><aside class="p06-settings"><div class="p06-heading"><h3>Параметри генерації</h3><span class="p06-tag">Модель не підключена</span></div>'
   +'<label class="p06-field">Модель генерації<select id="p06-model" disabled><option>Локальна Image (не підключена)</option></select></label>'
   +'<label class="p06-field">Співвідношення сторін<div class="p06-ratios">'+['16:9','1:1','4:3','9:16'].map(v=>'<button type="button" data-p06-ratio="'+v+'" class="'+(state.ratio===v?'selected':'')+'">'+v+'</button>').join('')+'</div></label>'
   +'<label class="p06-field">Кількість варіантів<div class="p06-counts">'+[1,2,3,4].map(v=>'<button type="button" data-p06-count="'+v+'" class="'+(state.variants===v?'selected':'')+'">'+v+'</button>').join('')+'</div></label>'
   +'<label class="p06-field">Деталізація <output id="p06-quality-label">'+state.quality+'%</output><input id="p06-quality" type="range" min="0" max="100" value="'+state.quality+'"></label>'
   +'<label class="p06-field">Креативність <output id="p06-creativity-label">'+state.creativity+'%</output><input id="p06-creativity" type="range" min="0" max="100" value="'+state.creativity+'"></label>'
   +'<button type="button" class="p06-build-brief" data-p06-action="brief">✧ Підготувати запит</button><p class="p06-disclaimer">Це підготовка параметрів. Генерація зображень стане доступною лише після підключення моделі.</p>'
   +'<div class="p06-heading"><h3>Історія зображень</h3><small>Ресурси цього проєкту</small></div><div class="p06-history">'+gallery+'</div>'
   +'</aside></div><div class="p06-feedback" id="p06-feedback" role="status">Режим перегляду. Дані зберігаються лише в локальному проєкті; онлайн-демо не має доступу до нього.</div></article>';
 }
 function brief(){
   return JSON.stringify({prompt:state.prompt.trim(),negativePrompt:state.negative.trim(),style:state.style,aspectRatio:state.ratio,variants:state.variants,quality:state.quality,creativity:state.creativity,modelStatus:'not-connected'},null,2);
 }
 function bind(root,{upload,library,showBrief,compare}={}){
   if(!root)return;
   root.querySelector('#p06-prompt')?.addEventListener('input',e=>state.prompt=e.target.value);
   root.querySelector('#p06-negative')?.addEventListener('input',e=>state.negative=e.target.value);
   ['quality','creativity'].forEach(key=>root.querySelector('#p06-'+key)?.addEventListener('input',e=>{state[key]=Number(e.target.value);root.querySelector('#p06-'+key+'-label').textContent=e.target.value+'%'}));
   const feedback=root.querySelector('#p06-feedback');
   const say=text=>{if(feedback)feedback.textContent=text};
   root.querySelectorAll('[data-p06-ratio]').forEach(b=>b.addEventListener('click',()=>{state.ratio=b.dataset.p06Ratio;root.querySelectorAll('[data-p06-ratio]').forEach(x=>x.classList.toggle('selected',x===b))}));
   root.querySelectorAll('[data-p06-count]').forEach(b=>b.addEventListener('click',()=>{state.variants=Number(b.dataset.p06Count);root.querySelectorAll('[data-p06-count]').forEach(x=>x.classList.toggle('selected',x===b))}));
   root.querySelectorAll('[data-p06-style]').forEach(b=>b.addEventListener('click',()=>{state.style=b.dataset.p06Style;root.querySelectorAll('[data-p06-style]').forEach(x=>x.classList.toggle('selected',x===b))}));
   root.querySelectorAll('[data-p06-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.p06Tab;root.querySelectorAll('[data-p06-tab]').forEach(x=>x.classList.toggle('active',x===b));say('Вкладку «'+b.textContent+'» буде завершено окремо. Налаштування зображення залишаються доступними.')}));
   root.querySelectorAll('[data-p06-select]').forEach(b=>b.addEventListener('click',()=>{state.selected=b.dataset.p06Select;if(typeof root.p06Refresh==='function')root.p06Refresh()}));
   root.querySelectorAll('[data-p06-action]').forEach(b=>b.addEventListener('click',()=>{
     const action=b.dataset.p06Action;
     if(action==='brief'){if(!state.prompt.trim()){say('Спочатку введи опис сцени.');root.querySelector('#p06-prompt')?.focus();return}if(showBrief)showBrief(brief());else say('Запит готовий: '+brief());}
     if(action==='upload'){if(upload)upload();else say('Завантаження доступне у локальній версії.')}
     if(action==='library'){if(library)library();else say('Бібліотека доступна у локальній версії.')}
     if(action==='compare'){if(compare)compare();else say('Порівняння відкриється після вибору декількох зображень.')}
   }));
 }
 window.APSImageStudio={render,bind,state,imageAssets,brief};
})();