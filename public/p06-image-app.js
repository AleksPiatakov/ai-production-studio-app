/* Local P-06 Image Studio adapter. Registered as a dedicated view without replacing
   asset library. No generation is performed without a worker. */
(()=>{
 const priorContent=pageContent, priorTitle=viewTitle, priorActions=viewActions,priorRender=render;
 pageContent=function(){
   if(view==='image-studio')return window.APSImageStudio.render({projectName:active.name,assets:active.assets||[]});
   return priorContent();
 };
 viewTitle=function(){return view==='image-studio'?'Image Studio':priorTitle()};
 viewActions=function(){return view==='image-studio'?'<button onclick="goToView(\'storyboard\')">← Сторіборд</button>':priorActions()};
 function setup(){
   const node=document.querySelector('.p06-studio');
   if(view!=='image-studio'||!node)return;
   const refresh=()=>{const content=document.querySelector('#content');const target=content?.querySelector('.p06-studio');if(!target)return;target.outerHTML=window.APSImageStudio.render({projectName:active.name,assets:active.assets||[]});setup()};
   node.p06Refresh=refresh;
   window.APSImageStudio.bind(node,{
     upload:()=>openImageUpload(),
     library:()=>goToView('assets'),
     compare:()=>{const feedback=node.querySelector('#p06-feedback');if(feedback)feedback.textContent='Порівняння доступних зображень буде реалізовано з бібліотекою варіантів. Затверджені ресурси не змінено.'},
     showBrief:text=>{if(typeof modal==='function'){
       modal('Підготовлений запит на зображення','<p class="muted">Це параметри для майбутнього локального генератора. Запит не запускає генерацію.</p><label>Маніфест<textarea readonly>'+text.replace(/[&<>"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]))+'</textarea></label>',()=>Promise.resolve());
     }else window.prompt('Підготовлений запит',text)}
   });
   const nav=document.querySelector('#workspace-nav');
   if(nav&&!nav.querySelector('[data-p06-nav]')){
     const button=document.createElement('button');
     button.className='project nav-project';
     button.type='button';button.dataset.p06Nav='true';
     button.textContent='▧ Image Studio';
     button.addEventListener('click',()=>goToView('image-studio'));
     const anchor=nav.querySelector('.nav-extra')||nav;
     anchor.append(button);
   }
 }
 render=function(){priorRender();setup()};
 // Add a stable navigation link after every screen render, not only while in Image Studio.
 const previousWrapper=render;
 render=function(){
   previousWrapper();
   const nav=document.querySelector('#workspace-nav');
   if(nav&&!nav.querySelector('[data-p06-nav]')){
     const button=document.createElement('button');button.className='project nav-project';button.type='button';
     button.dataset.p06Nav='true';button.textContent='▧ Image Studio';
     button.addEventListener('click',()=>goToView('image-studio'));
     (nav.querySelector('.nav-extra')||nav).append(button);
   }
   const button=nav?.querySelector('[data-p06-nav]');
   if(button)button.classList.toggle('active',view==='image-studio');
 };
})();
