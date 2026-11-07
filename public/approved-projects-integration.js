/* G-02: native Projects view backed only by the real local projects list.
   Existing create/select functions remain canonical. */
(()=>{
 const beforeContent=pageContent,beforeTitle=viewTitle,beforeActions=viewActions;
 pageContent=function(){
   if(view==='projects')return window.APSProjectsGallery.render(projects,activeId);
   return beforeContent();
 };
 viewTitle=function(){return view==='projects'?'Проєкти':beforeTitle()};
 viewActions=function(){return view==='projects'?'':beforeActions()};
 const beforeGlobal=renderGlobalNav;
 renderGlobalNav=function(){
   beforeGlobal();
   const nav=document.getElementById('global-nav');
   if(!nav||nav.querySelector('[data-g02-nav]'))return;
   const button=document.createElement('button');
   button.type='button';button.className='global-nav-item';
   button.dataset.g02Nav='true';
   button.textContent='▱ Проєкти';
   if(view==='projects'){button.classList.add('active');button.setAttribute('aria-current','page')}
   nav.prepend(button);
   button.addEventListener('click',()=>goToView('projects'));
 };
 const beforeRender=render;
 render=function(){
   beforeRender();
   if(view!=='projects')return;
   const root=document.querySelector('.g02-gallery');
   if(root)window.APSProjectsGallery.bind(root,projects,activeId,{
     open:id=>{view='overview';selectProject(id)},
     create:()=>openProject()
   });
 };
})();