/* Approved P-02 global studio rail. Existing project picker/workspace navigation
   stays mounted and unchanged; this rail only replaces its editor presentation.
   Every clickable route uses an existing local view or selectProject action. */
(()=>{
  const routes=[
    ['overview','⌂','Робочий стіл'],
    ['assistants','✧','AI Помічники'],
    ['models','▣','AI Моделі'],
    ['assets','▧','Бібліотека'],
    ['queue','≡','Черга генерацій'],
    ['davinci','⇧','Експорт DaVinci']
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function setup(){
    const aside=document.getElementById('app-sidebar');
    if(!aside)return;
    document.body.classList.toggle('aps-approved-editor-shell',view==='editor');
    if(view!=='editor')return;
    let rail=aside.querySelector('#aps-approved-nav');
    if(!rail){rail=document.createElement('div');rail.id='aps-approved-nav';aside.prepend(rail)}
    const projectList=typeof projects!=='undefined' && Array.isArray(projects)?projects:[];
    const current=typeof activeId!=='undefined'?activeId:'';
    rail.innerHTML='<div class="aps-nav-brand"><span aria-hidden="true">▣</span><div><strong>AI Production<br>Studio</strong><small>Творчий простір</small></div></div>'+
      '<div class="aps-nav-project-picker"><label for="aps-nav-project-select">ПОТОЧНИЙ ПРОЄКТ</label>'+
      '<select id="aps-nav-project-select" aria-label="Вибрати проєкт">'+
      projectList.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===current?'selected':'')+'>'+esc(p.name)+'</option>').join('')+
      '</select></div>'+
      '<nav class="aps-nav-main" aria-label="Глобальні розділи студії">'+
      routes.map(([id,icon,title])=>'<button type="button" data-aps-destination="'+id+'"><span aria-hidden="true">'+icon+'</span>'+title+'</button>').join('')+
      '</nav>'+
      '<div class="aps-nav-bottom"><span aria-hidden="true">◉</span><span>Локальний проєкт<br><small>Дані зберігаються на цьому Mac</small></span></div>';
    rail.querySelectorAll('[data-aps-destination]').forEach(button=>{
      button.addEventListener('click',()=>{
        const destination=button.dataset.apsDestination;
        if(destination==='davinci')goToView('davinci');
        else goToView(destination);
      });
    });
    rail.querySelector('select')?.addEventListener('change',event=>{
      if(typeof selectProject==='function')selectProject(event.target.value);
    });
  }
  const previousRender=render;
  render=function(){previousRender();setup()};
  setup();
})();