/* Approved P-02 screenplay surface.
   Read the existing canonical script.body; do not replace the textarea or invent
   structured scene/dialogue data. Reading mode follows the approved PNG while
   Edit mode preserves the existing versioned save and Focus flow. */
(()=>{
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let editMode=false;
  let currentScriptKey=null;

  function classify(line){
    const text=line.trim();
    if(!text)return 'blank';
    if(/^(?:СЦЕНА|SCENE)\s+\d+/iu.test(text))return 'scene';
    if(/^(?:ЛОКАЦІЯ|LOCATION|МІСЦЕ|МЕТА СЦЕНИ|ЦІЛЬ СЦЕНИ)\s*:/iu.test(text))return 'detail';
    if(/^(?:[А-ЯІЇЄҐA-Z][А-ЯІЇЄҐA-Zа-яіїєґa-z\s().–—-]{1,40})\s*:\s*.+$/u.test(text))return 'dialogue';
    if(/^\((?:[^)]{1,70})\)$/.test(text))return 'direction';
    if(/^(?:ДІЯ|КАМЕРА|ПЛАН|РУХ КАМЕРИ)\s*:/iu.test(text))return 'action';
    return 'prose';
  }
  function renderLines(text){
    const source=String(text??'').split(/\r?\n/);
    const pieces=[];
    let prose=[];
    let empty=0;
    const flush=()=>{
      if(prose.length){pieces.push('<p class="aps-screenplay-paragraph">'+prose.map(escapeHTML).join(' ')+'</p>');prose=[]}
    };
    for(const raw of source){
      const line=raw.trim(),type=classify(raw);
      if(type==='blank'){empty++;if(empty>=2)flush();continue;}
      empty=0;
      if(type==='prose'){prose.push(line);continue;}
      flush();
      if(type==='scene'){
        pieces.push('<h4 class="aps-screenplay-scene"><span aria-hidden="true">▧</span>'+escapeHTML(line)+'</h4>');
        continue;
      }
      if(type==='detail'){
        const i=line.indexOf(':');
        pieces.push('<p class="aps-screenplay-detail"><strong>'+escapeHTML(line.slice(0,i))+':</strong> '+escapeHTML(line.slice(i+1).trim())+'</p>');
        continue;
      }
      if(type==='dialogue'){
        const i=line.indexOf(':'),speaker=line.slice(0,i).trim(),dialogue=line.slice(i+1).trim();
        const narrator=/^(?:ГОЛОС|VOICE|ОПОВІДАЧ)/iu.test(speaker);
        pieces.push('<section class="aps-screenplay-dialogue '+(narrator?'is-narrator':'')+'"><span class="aps-screenplay-avatar" aria-hidden="true">'+(narrator?'◖':'♙')+'</span><div><strong>'+escapeHTML(speaker)+'</strong><p>'+escapeHTML(dialogue)+'</p></div></section>');
        continue;
      }
      if(type==='direction'){pieces.push('<p class="aps-screenplay-direction">'+escapeHTML(line)+'</p>');continue;}
      pieces.push('<p class="aps-screenplay-action"><span aria-hidden="true">▣</span>'+escapeHTML(line)+'</p>');
    }
    flush();
    return pieces.length?pieces.join(''):'<p class="aps-screenplay-empty">Сценарій поки порожній. Натисни «Редагувати», щоб почати.</p>';
  }

  function currentKey(){
    const scriptId=editorState?.scriptId||'new',episodeId=editorState?.initial?.episodeId||activeEpisodeId||'';
    return String(scriptId)+':'+String(episodeId);
  }
  function getLabel(){
    return document.querySelector('#script-workspace-body')?.closest('.editor-body-label');
  }
  function paint(){
    const field=getLabel(),editor=document.querySelector('#script-workspace-body');
    const reader=document.querySelector('#aps-screenplay-reader'),controls=document.querySelector('#aps-screenplay-controls');
    if(!field||!reader||!editor||!controls)return;
    const focus=document.body.classList.contains('p02-focus');
    field.classList.toggle('aps-reading',!editMode);
    reader.hidden=editMode;
    controls.querySelectorAll('[data-aps-script-mode]').forEach(button=>{
      const active=button.dataset.apsScriptMode===(editMode?'edit':'read');
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    const fieldValue=editor.value;
    if(!editMode){
      const html=renderLines(fieldValue);
      if(reader.dataset.encodedContent!==fieldValue){
        reader.innerHTML=html;
        reader.dataset.encodedContent=fieldValue;
      }
    }
    reader.setAttribute('aria-label',focus?'Сценарій у режимі зосередження':'Форматований сценарій');
  }
  function setup(){
    if(typeof view==='undefined'||view!=='editor')return;
    const field=getLabel();
    if(!field)return;
    const key=currentKey();
    if(key!==currentScriptKey){currentScriptKey=key;editMode=false;}
    if(!document.querySelector('#aps-screenplay-controls')){
      const controls=document.createElement('div');
      controls.id='aps-screenplay-controls';
      controls.className='aps-screenplay-controls';
      controls.setAttribute('role','group');
      controls.setAttribute('aria-label','Режим сценарного редактора');
      controls.innerHTML='<span class="aps-screenplay-controls-title">Сценарний формат</span><button type="button" data-aps-script-mode="read" aria-pressed="true">Перегляд</button><button type="button" data-aps-script-mode="edit" aria-pressed="false">✎ Редагувати текст</button><span class="aps-screenplay-safe-note">Один документ · збереження через «Зберегти сценарій»</span>';
      field.before(controls);
      const reader=document.createElement('div');
      reader.id='aps-screenplay-reader';
      reader.className='aps-screenplay-reader';
      reader.setAttribute('role','region');
      field.after(reader);
      controls.addEventListener('click',event=>{
        const button=event.target.closest('[data-aps-script-mode]');
        if(!button)return;
        editMode=button.dataset.apsScriptMode==='edit';
        const preview=document.querySelector('#aps-screenplay-reader');
        if(preview)delete preview.dataset.encodedContent;
        paint();
        if(editMode)document.querySelector('#script-workspace-body')?.focus();
      });
    }
    const form=document.querySelector('#script-workspace-form');
    if(form&&!form.dataset.apsReadingBound){
      form.dataset.apsReadingBound='true';
      form.addEventListener('input',event=>{
        if(event.target.id!=='script-workspace-body')return;
        const reader=document.querySelector('#aps-screenplay-reader');
        if(reader)delete reader.dataset.encodedContent;
      });
      form.querySelector('#p02-scene-items')?.addEventListener('click',()=>queueMicrotask(paint));
      form.querySelector('#p02-scene-select')?.addEventListener('change',()=>queueMicrotask(paint));
      form.querySelectorAll('[data-p02-mode],[data-p02-focus]').forEach(button=>button.addEventListener('click',()=>queueMicrotask(paint)));
    }
    paint();
  }
  const priorRender=render;
  render=function(){priorRender();setup();};
  setup();
  window.APSApprovedScriptReading={renderLines,classify};
})();