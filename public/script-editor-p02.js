/* P-02 — approved script editor interaction layer.
   Full episode and single scene operate on ONE script.body. No duplicate scene storage.
   Ref: P-02_Script_Editor.png / P-02_Script_Focus_Mode.png; local files remain canonical. */
(()=>{
  const $ = selector=>document.querySelector(selector);
  const safe = value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const state={scriptId:undefined,mode:'whole',sceneIndex:0,fullBody:'',dirty:false,focus:false};
  const headings=/^\s*(?:СЦЕНА|SCENE)\s+[^\r\n]+/gim;
  function segments(value){
    const text=String(value??'');
    const matches=[...text.matchAll(headings)];
    if(!matches.length)return [{start:0,end:text.length,title:'Увесь текст'}];
    const out=matches.map((m,i)=>({start:m.index,end:i+1<matches.length?matches[i+1].index:text.length,title:m[0].trim()}));
    if(matches[0].index>0)out.unshift({start:0,end:matches[0].index,title:'Вступ / логлайн'});
    return out;
  }
  function currentText(){const part=segments(state.fullBody)[Math.max(0,Math.min(state.sceneIndex,segments(state.fullBody).length-1))];return state.fullBody.slice(part.start,part.end)}
  function saveVisible(){
    const textarea=$('#script-workspace-body');
    if(!textarea)return;
    if(state.mode==='whole'){state.fullBody=textarea.value;return;}
    const sections=segments(state.fullBody);
    const part=sections[Math.max(0,Math.min(state.sceneIndex,sections.length-1))];
    state.fullBody=state.fullBody.slice(0,part.start)+textarea.value+state.fullBody.slice(part.end);
  }
  function setCurrentEditorBody(){
    const body=$('#script-workspace-body');
    if(!body)return;
    body.value=state.mode==='scene'?currentText():state.fullBody;
    body.setAttribute('aria-label',state.mode==='scene'?'Текст поточної сцени':'Текст усього епізоду');
  }
  function updateUI(){
    const shell=$('.editor-page-frame');
    if(!shell)return;
    shell.classList.toggle('p02-editor',true);
    document.body.classList.toggle('p02-focus',state.focus);
    shell.classList.toggle('is-p02-focus',state.focus);
    const sections=segments(state.fullBody);
    state.sceneIndex=Math.max(0,Math.min(state.sceneIndex,sections.length-1));
    document.querySelectorAll('[data-p02-mode]').forEach(button=>{
      const on=button.dataset.p02Mode===state.mode;
      button.classList.toggle('active',on);
      button.setAttribute('aria-pressed',String(on));
    });
    const focus=$('[data-p02-focus]');
    if(focus){focus.classList.toggle('active',state.focus);focus.setAttribute('aria-pressed',String(state.focus));focus.textContent=state.focus?'Повернути панелі':'Режим зосередження'}
    const items=$('#p02-scene-items');
    if(items){
      const script=(active?.scripts||[]).find(s=>s.id===editorState?.scriptId);
      const episodeId=script?.episodeId||editorState?.initial?.episodeId||activeEpisodeId;
      const sceneData=(active?.scenes||[]).filter(s=>s.episodeId===episodeId);
      const assets=active?.assets||[];
      const safeImage=asset=>asset&&typeof asset.uri==='string'&&/^\/assets\/[a-z0-9_./-]+\.(?:png|jpe?g|webp)(?:\?.*)?$/i.test(asset.uri);
      const related=item=>{
        const match=item.title.match(/^(?:СЦЕНА|SCENE)\s*(\d+)/i);
        if(!match)return null;
        const scene=sceneData.find(s=>Number(s.order)===Number(match[1]));
        if(!scene)return null;
        const ids=[
          ...(scene.keyImageAssetId?[scene.keyImageAssetId]:[]),
          ...(scene.referenceAssetIds||[]),
          ...(scene.shots||[]).flatMap(shot=>[
            ...(shot.keyImageAssetId?[shot.keyImageAssetId]:[]),
            ...(shot.referenceAssetIds||[])
          ])
        ];
        return {scene,asset:ids.map(id=>assets.find(a=>a.id===id)).find(safeImage)};
      };
      items.innerHTML=sections.map((item,i)=>{
        const linked=related(item);
        const thumbnail=linked?.asset
          ?'<img class="p02-scene-thumb" alt="Референс сцени" loading="lazy" src="'+safe(linked.asset.uri)+'">'
          :'<span class="p02-scene-thumb is-empty" aria-hidden="true">▧</span>';
        const duration=linked?.scene?.durationSeconds;
        return `<button type="button" data-p02-scene="${i}" class="${i===state.sceneIndex&&state.mode==='scene'?'active':''}" aria-current="${i===state.sceneIndex&&state.mode==='scene'?'true':'false'}">
          ${thumbnail}<span class="p02-scene-meta"><strong>${safe(item.title)}</strong><small>${duration?Math.floor(duration/60)+':'+String(duration%60).padStart(2,'0'):i+1+' із '+sections.length}</small></span>
        </button>`;
      }).join('');
    }
    const sceneSelect=$('#p02-scene-select');
    if(sceneSelect){
      sceneSelect.innerHTML=sections.map((item,i)=>`<option value="${i}" ${i===state.sceneIndex?'selected':''}>${safe(item.title)}</option>`).join('');
      sceneSelect.disabled=state.mode==='whole';
    }
    const count=$('#p02-word-count');
    if(count)count.textContent=state.fullBody.trim().split(/\s+/).filter(Boolean).length+' слів';
    const banner=$('#p02-draft-note');
    if(banner)banner.textContent=state.dirty?'Є незбережені зміни · натисніть «Зберегти»':'Редагування одного сценарію · збережені версії доступні в історії';
  }
  function changeMode(mode,index){
    saveVisible();
    state.mode=mode==='scene'?'scene':'whole';
    if(Number.isInteger(index))state.sceneIndex=index;
    setCurrentEditorBody();
    updateUI();
  }
  function setFocus(value){
    saveVisible();
    state.focus=Boolean(value);
    setCurrentEditorBody();
    updateUI();
    $('#script-workspace-body')?.focus();
  }
  function episodeOptions(){
    const current=editorState?.scriptId?(active.scripts||[]).find(item=>item.id===editorState.scriptId):null;
    const id=current?.episodeId||editorState?.initial?.episodeId||activeEpisodeId||'';
    return (active.episodes||[]).map(item=>`<option value="${safe(item.id)}" ${item.id===id?'selected':''}>${safe('Сезон '+(item.seasonNumber||1)+' · Епізод '+(item.episodeNumber||1)+': '+item.title)}</option>`).join('');
  }
  function setup(){
    if(view!=='editor'){if(state.focus){state.focus=false;document.body.classList.remove('p02-focus')}return;}
    const form=$('#script-workspace-form'),body=$('#script-workspace-body'),shell=$('.editor-page-frame');
    if(!form||!body||!shell||form.dataset.p02Ready)return;
    form.dataset.p02Ready='true';
    const scriptKey=editorState?.scriptId||'__new__'+(editorState?.initial?.episodeId||'');
    if(state.scriptId!==scriptKey){
      state.scriptId=scriptKey;state.mode='whole';state.sceneIndex=0;state.fullBody=body.value;state.dirty=false;state.focus=false;
    }else if(state.mode==='scene')body.value=currentText();else body.value=state.fullBody;
    const top=form.querySelector('.editor-topbar');
    top?.insertAdjacentHTML('afterend',`<section class="p02-commandbar" aria-label="Режими сценарію">
      <div class="p02-segments" role="group" aria-label="Відображення сценарію">
        <button type="button" data-p02-mode="whole">Увесь епізод</button>
        <button type="button" data-p02-mode="scene">Окрема сцена</button>
      </div>
      <div class="p02-commandbar-right">
        <label>Епізод <select id="p02-episode-select" aria-label="Вибрати епізод">${episodeOptions()}</select></label>
        <label>Сцена <select id="p02-scene-select" aria-label="Вибрати сцену"></select></label>
        <button type="button" data-p02-focus aria-pressed="false">Режим зосередження</button>
      </div>
    </section>`);
    const main=form.querySelector('.editor-main');
    if(main){
      main.insertAdjacentHTML('beforebegin',`<aside class="p02-scene-sidebar" aria-label="Сцени сценарію">
        <div class="p02-scenes-heading"><strong>Сцени сценарію</strong><small>Той самий текст епізоду</small></div>
        <div id="p02-scene-items"></div>
      </aside>`);
      const container=document.createElement('div');container.className='p02-edit-layout';
      const sidebar=form.querySelector('.p02-scene-sidebar');
      main.before(container);container.append(sidebar,main);
      main.querySelector('.editor-writing-label')?.insertAdjacentHTML('afterend','<small class="p02-draft-note" id="p02-draft-note"></small>');
    }
    form.addEventListener('input',event=>{
      if(event.target.id!=='script-workspace-body')return;
      state.dirty=true;
      saveVisible();
      updateUI();
    });
    form.querySelectorAll('[data-p02-mode]').forEach(button=>button.addEventListener('click',()=>changeMode(button.dataset.p02Mode)));
    form.querySelector('[data-p02-focus]')?.addEventListener('click',()=>setFocus(!state.focus));
    form.querySelector('#p02-scene-items')?.addEventListener('click',event=>{
      const button=event.target.closest('[data-p02-scene]');
      if(button)changeMode('scene',Number(button.dataset.p02Scene));
    });
    form.querySelector('#p02-scene-select')?.addEventListener('change',event=>changeMode('scene',Number(event.target.value)));
    form.querySelector('#p02-episode-select')?.addEventListener('change',event=>{
      const episodeId=event.target.value;
      if(state.dirty&&!window.confirm('Є незбережені зміни сценарію. Перейти до іншого епізоду без їх збереження?')){event.target.value=(active.scripts||[]).find(item=>item.id===editorState?.scriptId)?.episodeId||activeEpisodeId||'';return;}
      state.focus=false;
      const script=(active.scripts||[]).find(item=>item.episodeId===episodeId&&!item.deletedAt);
      activeEpisodeId=episodeId;
      openScript(script?.id||null,{episodeId});
    });
    updateUI();
  }
  const originalRender=render;
  render=function(){
    originalRender();
    setup();
  };
  const originalSave=saveScriptEditor;
  saveScriptEditor=async function(event){
    if(view==='editor'){
      saveVisible();
      const body=$('#script-workspace-body');
      if(body)body.value=state.fullBody;
    }
    return originalSave(event);
  };
  // Keep actual app and static demo sharing P-01; P-02 is a local editor only.
})();
