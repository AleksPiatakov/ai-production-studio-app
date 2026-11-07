/* Integrates approved P-06 in the local app without changing storage or worker behavior. */
(()=>{
 let selectedAssetId=null;
 const oldPage=pageContent;
 pageContent=function(){
  if(view!=='imageStudio')return oldPage();
  const scene=(active.scenes||[]).find(s=>s.id===activeSceneId)||(active.scenes||[])[0];
  const shot=(scene?.shots||[]).find(s=>s.id===activeShotId)||scene?.shots?.[0];
  return window.APSImageStudio.render({scene,shot,shots:scene?.shots||[],assets:active.assets||[],selectedAssetId});
 };
 const oldTitle=viewTitle;
 viewTitle=function(){return view==='imageStudio'?'Image Studio · Генерація зображень':oldTitle()};
 const oldNav=renderWorkspaceNav;
 renderWorkspaceNav=function(){
  oldNav();
  const nav=document.querySelector('#workspace-nav');
  if(nav&&!nav.querySelector('[data-view="imageStudio"]')){
   const button=document.createElement('button');button.type='button';
   button.className='project nav-project'+(view==='imageStudio'?' active':'');
   button.dataset.view='imageStudio';
   button.innerHTML='<span class="nav-icon" aria-hidden="true">▧</span><span class="nav-copy"><strong>Image Studio</strong><small>Зображення та референси</small></span>';
   const route=nav.querySelector('.nav-route');
   (route||nav).append(button);
   button.addEventListener('click',()=>goToView('imageStudio'));
  }
 };
 function attach(){
  const tabbar=document.querySelector('.storyboard-workspace .p04-project-tabs');
  if(tabbar&&!tabbar.querySelector('[data-p06-launch]')){
   const button=document.createElement('button');button.type='button';
   button.dataset.p06Launch='true';button.textContent='Image Studio';
   const reference=tabbar.querySelector('[data-p04-view="preview"]');
   if(reference)tabbar.insertBefore(button,reference);else tabbar.append(button);
   button.addEventListener('click',()=>goToView('imageStudio'));
  }
  if(view!=='imageStudio')return;
  const root=document.querySelector('.p06-studio');
  if(!root)return;
  root.querySelectorAll('[data-p06-route]').forEach(button=>button.addEventListener('click',()=>goToView(button.dataset.p06Route)));
  root.querySelectorAll('[data-p06-asset]').forEach(button=>button.addEventListener('click',()=>{
   selectedAssetId=button.dataset.p06Asset;render();
  }));
  root.querySelector('#p06-shot')?.addEventListener('change',event=>{
   activeShotId=event.target.value;render();
  });
  root.querySelectorAll('[data-p06-action]').forEach(button=>button.addEventListener('click',()=>{
   const scene=(active.scenes||[]).find(s=>s.id===activeSceneId)||(active.scenes||[])[0];
   const shot=(scene?.shots||[]).find(s=>s.id===activeShotId)||scene?.shots?.[0];
   const images=(active.assets||[]).filter(a=>['image','reference'].includes(a.type)&&typeof a.uri==='string'&&a.uri.startsWith('/')&&/\.(png|jpe?g|webp)(?:\?.*)?$/i.test(a.uri));
   const selected=images.find(a=>a.id===selectedAssetId)||images[0];
   switch(button.dataset.p06Action){
    case 'edit-shot':if(scene&&shot)openShot(scene.id,shot.id);break;
    case 'upload':openImageUpload();break;
    case 'open-image':if(selected)showReference(selected.id);break;
    case 'asset-details':if(selected)openAsset(selected.id);break;
   }
  }));
 }
 const before=render;
 render=function(){before();attach()};
 attach();
})();
