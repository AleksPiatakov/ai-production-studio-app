/* Bind approved P-05 renderer to current project without changing storage. */
(()=>{
 let selectedAssetId='';
 const previousPage=pageContent;
 pageContent=function(){
  if(view!=='shotStudio')return previousPage();
  const scene=(active.scenes||[]).find(s=>s.id===activeSceneId)||(active.scenes||[])[0];
  const shot=(scene?.shots||[]).find(s=>s.id===activeShotId)||scene?.shots?.[0];
  const imageModels=(productionStudioState?.models||[]).filter(model=>typeof clientModelSupports==='function'&&clientModelSupports(model,'image'));
  const preferred=productionStudioState?.profiles?.image;
  const imageModel=imageModels.find(model=>model.id===preferred)||imageModels[0]||null;
  return window.APSShotWorkspace.render({projectName:active.name,scene,shot,shots:scene?.shots||[],sceneIndex:scene?.order,assets:active.assets||[],selectedAssetId,imageModel});
 };
 const previousTitle=viewTitle;
 viewTitle=function(){return view==='shotStudio'?'Редактор кадру · P-05':previousTitle()};
 function attach(){
  const root=document.querySelector('.p05-workspace');
  if(view==='storyboard'){
    const nav=document.querySelector('.storyboard-workspace .p04-project-tabs');
    if(nav&&!nav.querySelector('[data-p05-open]')){
      const button=document.createElement('button');button.type='button';button.dataset.p05Open='';
      button.textContent='Редактор кадру';
      nav.append(button);
      button.addEventListener('click',()=>goToView('shotStudio'));
    }
  }
  if(!root)return;
  root.querySelectorAll('[data-p05-route]').forEach(button=>button.addEventListener('click',()=>goToView(button.dataset.p05Route)));
  root.querySelector('#p05-shot-picker')?.addEventListener('change',event=>{
    activeShotId=event.target.value;selectedAssetId='';render();
  });
  root.querySelectorAll('[data-p05-asset]').forEach(button=>button.addEventListener('click',()=>{selectedAssetId=button.dataset.p05Asset;render()}));
  root.querySelectorAll('[data-p05-action]').forEach(button=>button.addEventListener('click',()=>{
    const scene=(active.scenes||[]).find(s=>s.id===activeSceneId)||(active.scenes||[])[0];
    const shot=(scene?.shots||[]).find(s=>s.id===activeShotId)||scene?.shots?.[0];
    switch(button.dataset.p05Action){
      case 'edit': if(scene&&shot)openShot(scene.id,shot.id);break;
      case 'upload':openImageUpload();break;
      case 'brief':if(scene&&shot)openShotImageBrief(scene.id,shot.id);break;
      case 'assistant':if(typeof toggleFloatingAdvisor==='function')toggleFloatingAdvisor(true);else goToView('assistants');break;
    }
  }));
 }
 const previousRender=render;
 render=function(){previousRender();attach()};
 attach();
})();
