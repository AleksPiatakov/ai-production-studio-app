/* P-07 Voice Studio — grounded real-take inspector.
   Approved layout: character rail / lines / generation settings / take gallery.
   Existing synthesize endpoint remains the only producer of audio.
   No fabricated takes, no approval writes, no bulk paid generation. */
(()=>{
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={projectId:null,episodeId:null,selectedLineId:null,takeCount:3,variation:'medium'};
  function currentItems(){
    const episode=(active.episodes||[]).find(e=>e.id===activeEpisodeId)||(active.episodes||[])[0];
    return (active.scenes||[]).filter(s=>!episode||s.episodeId===episode.id)
      .sort((a,b)=>Number(a.order||0)-Number(b.order||0))
      .flatMap(scene=>(scene.dialogue||[]).map(line=>({scene,line,
        character:(active.bibles?.characters||[]).find(c=>c.id===line.characterId),
        voice:(active.voiceProfiles||[]).find(v=>v.identityKey===line.voiceIdentityKey)})));
  }
  function projectScope(){
    const episode=(active.episodes||[]).find(e=>e.id===activeEpisodeId)||(active.episodes||[])[0];
    const episodeId=episode?.id||'';
    if(state.projectId!==activeId||state.episodeId!==episodeId){
      state.projectId=activeId;state.episodeId=episodeId;state.selectedLineId=null;
    }
  }
  function selected(items){
    return items.find(item=>item.line.id===state.selectedLineId)||items[0]||null;
  }
  function allTakes(item){
    const lang=item.line.language==='en'?'en':'uk';
    return (item.line.audioDrafts||[]).filter(d=>d.language===lang);
  }
  function status(draft,source){
    const sourceText=String(source.line.language==='en'?source.line.textEn:(source.line.textUk||source.line.text||'')).trim();
    const same=sourceText===String(draft.text||'').trim();
    return same?'Чернетка':'Потрібна перевірка: текст репліки змінився';
  }
  function metadata(item){
    if(!item)return '<p class="p07-empty">Оберіть репліку, щоб побачити її налаштування.</p>';
    const drafts=allTakes(item);
    return '<div class="p07-selected-name"><strong>'+safe(item.character?.name||'Персонаж')+'</strong><small>'+safe(item.scene.title)+'</small></div>'+
      '<p class="p07-quote">'+safe(item.line.textUk||item.line.text||item.line.textEn||'Репліка порожня')+'</p>'+
      '<dl class="p07-key-values"><div><dt>Мова</dt><dd>'+(item.line.language==='en'?'EN':'UA')+'</dd></div>'+
      '<div><dt>Голос</dt><dd>'+safe(item.voice?.name||'Профіль не призначено')+'</dd></div>'+
      '<div><dt>Емоція</dt><dd>'+safe(item.line.emotion||'Не задано')+'</dd></div>'+
      '<div><dt>Дублі</dt><dd>'+drafts.length+' збережено</dd></div></dl>'+
      '<button type="button" class="p07-setting-button" data-p07-action="settings">⚙ Інтонація репліки</button>';
  }
  function variants(item){
    if(!item)return '<p class="p07-empty">Додайте репліку, щоб розпочати озвучення.</p>';
    const drafts=allTakes(item);
    const count=Math.min(5,state.takeCount);
    return '<div class="p07-variants-header"><div><strong>Дублі та варіанти</strong><small>'+safe(item.character?.name||'Персонаж')+' · '+drafts.length+' реальних записів</small></div>'+
      '<button type="button" class="p07-new-take" data-p07-action="generate">＋ Створити ще один дубль</button></div>'+
      '<div class="p07-takes">'+(drafts.length?drafts.slice().reverse().map((draft,index)=>{
        const itemNumber=drafts.length-index;
        const changed=status(draft,item).startsWith('Потрібна');
        return '<article class="p07-take" data-p07-take="'+safe(draft.id)+'"><div class="p07-take-name"><strong>Варіант '+itemNumber+'</strong><span class="p07-take-status '+(changed?'needs-review':'')+'">'+(changed?'Потрібна перевірка':'Чернетка')+'</span></div>'+
          '<audio controls preload="none" src="'+safe(draft.uri)+'" aria-label="Прослухати варіант '+itemNumber+'"></audio>'+
          '<small>'+safe(draft.durationSeconds??'—')+' с · '+safe(draft.engine||'Невідомий рушій')+'</small>'+
          '<small>'+safe(draft.createdAt?new Date(draft.createdAt).toLocaleString('uk-UA'):'Дата невідома')+'</small>'+
          (changed?'<p class="p07-review-warning">Текст змінився після створення цього дубля. Перевірте відповідність.</p>':'')+
          '</article>';
      }).join(''):'<p class="p07-empty">Дублів ще немає. Натисніть «Створити ще один дубль» — генерація відбудеться лише після вашого натискання і за наявності сумісного рушія.</p>')+'</div>'+
      '<p class="p07-plan-note">План: '+count+' '+(count===1?'варіант':'варіанти')+' · різноманітність '+({low:'низька',medium:'середня',high:'висока'}[state.variation])+'. Наразі рушій створює по одному дублю. План не запускає автоматичну або платну генерацію.</p>';
  }
  function renderInspector(root,items){
    const item=selected(items);
    if(item)state.selectedLineId=item.line.id;
    root.querySelectorAll('[data-p07-line]').forEach(btn=>{
      const selectedLine=btn.dataset.p07Line===state.selectedLineId;
      btn.classList.toggle('active',selectedLine);
      btn.setAttribute('aria-pressed',String(selectedLine));
    });
    const panel=root.querySelector('.p07-inspector-content');
    if(panel)panel.innerHTML=metadata(item);
    const variantsBox=root.querySelector('.p07-variant-content');
    if(variantsBox)variantsBox.innerHTML=variants(item);
    const label=root.querySelector('.p07-selected-label');
    if(label)label.textContent=item?'Репліка '+(items.findIndex(i=>i===item)+1)+' із '+items.length:'Репліки відсутні';
  }
  function enhance(){
    if(view!=='audio'||!active)return;
    const panel=document.querySelector('.audio-plan');
    if(!panel||panel.dataset.p07Ready)return;
    projectScope();const items=currentItems();
    panel.dataset.p07Ready='true';panel.classList.add('p07-lines-panel');
    panel.querySelectorAll('.audio-line').forEach((node,i)=>{if(items[i]){
      node.dataset.p07Line=items[i].line.id;
      node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label','Вибрати репліку '+(i+1));
    }});
    const layout=document.createElement('section');layout.className='p07-workspace';
    layout.setAttribute('aria-label','Voice Studio: персонажі, репліки й параметри');
    panel.parentNode.insertBefore(layout,panel);
    const rail=document.createElement('aside');rail.className='p07-character-rail';
    const unique=items.filter((item,i,all)=>all.findIndex(x=>x.character?.id===item.character?.id)===i);
    rail.innerHTML='<div class="p07-heading"><strong>Персонажі та голоси</strong></div>'+
      (unique.length?unique.map(item=>'<button type="button" data-p07-character="'+safe(item.character?.id||'')+'"><span class="p07-avatar">♙</span><span><strong>'+safe(item.character?.name||'Персонаж')+'</strong><small>'+safe(item.voice?.name||'Голос не призначено')+'</small></span></button>').join(''):'<p class="p07-empty">Немає реплік або персонажів.</p>');
    const right=document.createElement('aside');right.className='p07-settings-panel';right.innerHTML=
      '<div class="p07-heading"><strong>Голос та інтонація</strong><small class="p07-selected-label"></small></div>'+
      '<div class="p07-inspector-content"></div>'+
      '<div class="p07-take-plan"><strong>План дублів</strong><p>Кількість для порівняння (1–5)</p><div class="p07-counts">'+[1,2,3,4,5].map(n=>'<button type="button" data-p07-count="'+n+'" class="'+(n===state.takeCount?'active':'')+'">'+n+'</button>').join('')+'</div>'+
      '<p>Різноманітність — орієнтир для режисерського вибору</p><div class="p07-diversity">'+[['low','Низька'],['medium','Середня'],['high','Висока']].map(([v,t])=>'<button type="button" data-p07-variation="'+v+'" class="'+(v===state.variation?'active':'')+'">'+t+'</button>').join('')+'</div>'+
      '<small>Параметри варіацій не передаються рушію, доки він їх не підтримує. Ідентичність голосу не змінюється.</small></div>';
    layout.append(rail,panel,right);
    const gallery=document.createElement('section');gallery.className='p07-variants-panel';gallery.innerHTML='<div class="p07-variant-content"></div>';
    layout.after(gallery);
    const rerender=()=>renderInspector(layout.parentElement||document,items);
    layout.addEventListener('click',event=>{
      const target=event.target.closest('[data-p07-line],[data-p07-character],[data-p07-count],[data-p07-variation],[data-p07-action]');
      if(!target)return;
      if(target.dataset.p07Line){
        if(event.target.closest('button,a,input,textarea,audio,select'))return;
        state.selectedLineId=target.dataset.p07Line;rerender();
      }
      if(target.dataset.p07Character!==undefined){
        const item=items.find(i=>String(i.character?.id||'')===target.dataset.p07Character);
        if(item){state.selectedLineId=item.line.id;rerender();}
      }
      if(target.dataset.p07Count){state.takeCount=Number(target.dataset.p07Count);
        layout.querySelectorAll('[data-p07-count]').forEach(b=>b.classList.toggle('active',b===target));rerender();}
      if(target.dataset.p07Variation){state.variation=target.dataset.p07Variation;
        layout.querySelectorAll('[data-p07-variation]').forEach(b=>b.classList.toggle('active',b===target));rerender();}
      if(target.dataset.p07Action==='settings'){
        const item=selected(items);if(item)openLineVoiceSettings(item.scene.id,item.line.id);
      }
    });
    panel.querySelectorAll('[data-p07-line]').forEach(node=>{
      node.addEventListener('click',event=>{
        if(event.target.closest('button,a,input,textarea,audio,select'))return;
        state.selectedLineId=node.dataset.p07Line;rerender();
      });
      node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){if(event.target!==node)return;event.preventDefault();state.selectedLineId=node.dataset.p07Line;rerender();}});
    });
    gallery.addEventListener('click',event=>{
      if(!event.target.closest('[data-p07-action="generate"]'))return;
      const item=selected(items);if(!item)return;
      const lang=item.line.language==='en'?'en':'uk';
      if(typeof createLocalVoice==='function')createLocalVoice(item.scene.id,item.line.id,lang);
    });
    renderInspector(document,items);
  }
  const previousRender=render;
  render=function(){previousRender();enhance()};
  enhance();
})();
