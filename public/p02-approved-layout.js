/* P-02 approved layout: right project-scoped assistant panel, project context.
   No AI suggestions are fabricated. The existing assistant stays authoritative. */
(()=>{
 const safe = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function setupApprovedLayout(){
  if(typeof view==='undefined'||view!=='editor'||!active)return;
  const form=document.querySelector('#script-workspace-form');
  const layout=form?.querySelector('.p02-edit-layout');
  if(!form||!layout)return;
  form.classList.add('p02-approved-layout');
  if(!form.querySelector('.p02-project-context')){
   const episodeId=editorState?.scriptId?(active.scripts||[]).find(s=>s.id===editorState.scriptId)?.episodeId:editorState?.initial?.episodeId;
   const episode=(active.episodes||[]).find(e=>e.id===episodeId);
   const context=document.createElement('div');
   context.className='p02-project-context';
   context.innerHTML='<span class="p02-context-logo" aria-hidden="true">▣</span><strong>'+safe(active.name)+'</strong><span>Сезон '+safe(episode?.seasonNumber||1)+' · '+safe(episode?.title||'Сценарій')+'</span><span class="p02-context-state">● Чернетка сценарію</span>';
   form.querySelector('.editor-topbar')?.prepend(context);
  }
  if(!layout.querySelector('.p02-ai-panel')){
   const episodeId=editorState?.scriptId?(active.scripts||[]).find(s=>s.id===editorState.scriptId)?.episodeId:editorState?.initial?.episodeId;
   const episode=(active.episodes||[]).find(e=>e.id===episodeId);
   const scenes=(active.scenes||[]).filter(scene=>scene.episodeId===episodeId);
   const characters=active.bibles?.characters||[];
   const relatedCharacters=characters.filter(ch=>scenes.some(s=>(s.characterIds||[]).includes(ch.id)));
   const aside=document.createElement('aside');
   aside.className='p02-ai-panel';
   aside.setAttribute('aria-label','AI Помічник проєкту');
   aside.innerHTML=`<div class="p02-ai-title"><span class="p02-ai-avatar" aria-hidden="true">✧</span><div><strong>AI Помічник проєкту</strong><small>${safe(active.name)} · ізольований контекст</small></div></div>
   <div class="p02-ai-tabs"><span class="active">Огляд</span><span>Пропозиції</span><span>Контекст</span></div>
   <section class="p02-ai-card"><p class="eyebrow">ПРАЦЮЙ ІЗ ТЕКСТОМ</p><h4>Допомога під час написання</h4><p>Переглядай сюжет, узгодженість персонажів і сцени через помічника проєкту. Правки не застосовуються автоматично.</p><button type="button" class="p02-ai-open">✧ Відкрити помічника</button></section>
   <section class="p02-ai-card"><p class="eyebrow">КОНТЕКСТ СЦЕНАРІЮ</p><div class="p02-ai-row"><span>Епізод</span><strong>${safe(episode?.title||'Не обрано')}</strong></div><div class="p02-ai-row"><span>Сцен у плані</span><strong>${scenes.length}</strong></div><div class="p02-ai-row"><span>Персонажі</span><strong>${relatedCharacters.length}</strong></div></section>
   <div class="p02-ai-footer"><span>Пропозиції потребують перегляду</span><button type="button" class="p02-ai-open" aria-label="Відкрити чат помічника">✧</button></div>`;
   layout.append(aside);
   aside.querySelectorAll('.p02-ai-open').forEach(b=>b.addEventListener('click',()=>{if(typeof toggleFloatingAdvisor==='function')toggleFloatingAdvisor(true);else if(typeof goToView==='function')goToView('advisor')}));
  }
 }
 const renderBeforeApproved=render;
 render=function(){renderBeforeApproved();setupApprovedLayout()};
 // The current script editor wraps render and only enters after a user action.
 // Patching at the end avoids changing script text, form submit or storage.
 setupApprovedLayout();
})();
