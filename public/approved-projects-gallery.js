/* G-02 Projects gallery — approved concept.
   Pure rendering for real local projects and synthetic online examples.
   Never infer progress, stage, cover image or completion from missing metadata. */
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const types={'animated-series':'Мультсеріал',general:'Інший проєкт',science:'Навчальне відео','animated-film':'Анімаційний фільм','music-video':'Музичний кліп'};
 const state={query:'',type:'all',sort:'latest',layout:'grid'};
 function selectItems(projects){
  const text=state.query.trim().toLocaleLowerCase('uk-UA');
  const filtered=(projects||[]).filter(p=>(state.type==='all'||p.type===state.type)&&(!text||String(p.name||'').toLocaleLowerCase('uk-UA').includes(text)));
  return state.sort==='az'?[...filtered].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'uk')):filtered;
 }
 function projectCard(p,activeId){
  const cover=typeof p.coverImageUri==='string'&&/^\/assets\/[a-z0-9_/.-]+\.(?:png|jpe?g|webp)(?:\?.*)?$/i.test(p.coverImageUri)?p.coverImageUri:null;
  const title=esc(p.name||'Без назви'),type=types[p.type]||'Відеопроєкт';
  return '<button type="button" class="g02-project-card '+(p.id===activeId?'is-current':'')+'" data-g02-project="'+esc(p.id)+'">'+
  '<div class="g02-cover">'+(cover?'<img alt="Обкладинка проєкту" src="'+esc(cover)+'">':'<div class="g02-missing-cover" aria-label="Обкладинки поки немає"><span aria-hidden="true">▣</span><small>Обкладинку не додано</small></div>')+
  '<span class="g02-type">'+esc(type)+'</span></div>'+
  '<div class="g02-card-details"><strong>'+title+'</strong><small>'+esc(type)+(Number.isFinite(Number(p.targetMinutes))&&Number(p.targetMinutes)>0?' · '+Number(p.targetMinutes)+' хв':'')+'</small>'+
  '<span class="g02-open">'+(p.id===activeId?'Поточний проєкт':'Відкрити проєкт')+' →</span></div></button>';
 }
 function render(projects=[],activeId='',demo=false){
  const allTypes=[...new Set(projects.map(p=>p.type).filter(Boolean))];
  const visible=selectItems(projects);
  return '<section class="g02-gallery" aria-label="Галерея творчих проєктів">'+
   '<div class="g02-top"><div><p class="g02-kicker">ПРОЄКТИ · AI PRODUCTION STUDIO</p><h2><span aria-hidden="true">▱</span> Проєкти</h2><p>Усі ваші творчі проєкти. Обери робочий простір для продовження виробництва.</p></div>'+
   '<div class="g02-top-actions"><div class="g02-view-switch" role="group" aria-label="Вигляд проєктів"><button data-g02-layout="grid" class="'+(state.layout==='grid'?'active':'')+'" aria-pressed="'+(state.layout==='grid')+'">▦ Сітка</button><button data-g02-layout="list" class="'+(state.layout==='list'?'active':'')+'" aria-pressed="'+(state.layout==='list')+'">☷ Список</button></div><button type="button" class="g02-create" data-g02-create>＋ Створити проєкт</button></div></div>'+
   '<div class="g02-controls"><label class="g02-search"><span>⌕</span><input type="search" id="g02-search" value="'+esc(state.query)+'" placeholder="Пошук проєктів…" aria-label="Пошук проєктів"></label>'+
   '<label>Тип <select id="g02-type"><option value="all">Усі проєкти</option>'+allTypes.map(t=>'<option value="'+esc(t)+'" '+(state.type===t?'selected':'')+'>'+esc(types[t]||t)+'</option>').join('')+'</select></label>'+
   '<label>Сортування <select id="g02-sort"><option value="latest" '+(state.sort==='latest'?'selected':'')+'>Поточний порядок</option><option value="az" '+(state.sort==='az'?'selected':'')+'>За назвою А–Я</option></select></label></div>'+
   '<div class="g02-cards '+(state.layout==='list'?'as-list':'')+'">'+(visible.length?visible.map(p=>projectCard(p,activeId)).join(''):'<div class="g02-empty">Проєктів за цими умовами немає. Зміни пошук або фільтр.</div>')+'</div>'+
   '<div class="g02-summary"><strong>'+visible.length+'</strong> показано з '+projects.length+' проєктів <small>'+(demo?'Демо: лише вигадані приклади.':'Справжні дані з локального списку проєктів.')+'</small></div></section>';
 }
 function bind(root,projects,activeId,{open,create,demo=false}={}){
  const redraw=()=>{
    const parent=root.parentElement;if(!parent)return;
    root.outerHTML=render(projects,activeId,demo);
    const next=parent.querySelector('.g02-gallery');if(next)bind(next,projects,activeId,{open,create,demo});
  };
  root.querySelector('#g02-search')?.addEventListener('input',event=>{
    const el=event.target;state.query=el.value;
    const pos=el.selectionStart||state.query.length;
    redraw();
    const replacement=parentDocumentInput();
    if(replacement){replacement.focus();replacement.setSelectionRange(pos,pos)}
  });
  function parentDocumentInput(){return document.getElementById('g02-search')}
  root.querySelector('#g02-type')?.addEventListener('change',event=>{state.type=event.target.value;redraw()});
  root.querySelector('#g02-sort')?.addEventListener('change',event=>{state.sort=event.target.value;redraw()});
  root.querySelectorAll('[data-g02-layout]').forEach(button=>button.addEventListener('click',()=>{state.layout=button.dataset.g02Layout;redraw()}));
  root.querySelectorAll('[data-g02-project]').forEach(button=>button.addEventListener('click',()=>{if(open)open(button.dataset.g02Project)}));
  root.querySelector('[data-g02-create]')?.addEventListener('click',()=>{if(create)create()});
 }
 window.APSProjectsGallery=Object.freeze({render,bind,state,selectItems});
})();