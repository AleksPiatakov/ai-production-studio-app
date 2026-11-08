/* Approved P-02 screenplay surface.
   All modes edit/read the existing canonical script.body. Structured mode is a
   presentation layer only: it never creates a second script store. */
(()=>{
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let mode='read';
  let currentScriptKey=null;

  const {renderLines,classify}=window.APSApprovedScriptFormat;
  function currentKey(){
    const scriptId=editorState?.scriptId||'new',episodeId=editorState?.initial?.episodeId||activeEpisodeId||'';
    return String(scriptId)+':'+String(episodeId);
  }
  function getLabel(){
    return document.querySelector('#script-workspace-body')?.closest('.editor-body-label');
  }
  function structuredLine(raw,index){
    const line=String(raw??''),trimmed=line.trim(),type=classify(line);
    if(type==='blank')return '<div class="aps-structured-gap" data-line-index="'+index+'" aria-hidden="true"></div>';
    if(type==='dialogue'){
      const split=trimmed.indexOf(':'),speaker=trimmed.slice(0,split).trim(),text=trimmed.slice(split+1).trim();
      const narrator=/^(?:ГОЛОС|VOICE|ОПОВІДАЧ)/iu.test(speaker);
      return '<section class="aps-structured-block dialogue '+(narrator?'is-narrator':'')+'" data-line-index="'+index+'" data-line-type="dialogue"><span class="aps-screenplay-avatar" aria-hidden="true">'+(narrator?'◖':'♙')+'</span><div><div class="aps-structured-speaker" contenteditable="true" spellcheck="false" data-structured-field="speaker">'+escapeHTML(speaker)+'</div><div class="aps-structured-dialogue" contenteditable="true" data-structured-field="dialogue">'+escapeHTML(text)+'</div></div></section>';
    }
    const labels={scene:'СЦЕНА',detail:'ДЕТАЛЬ',action:'ДІЯ',direction:'РЕМАРКА',prose:'ТЕКСТ'};
    return '<section class="aps-structured-block '+type+'" data-line-index="'+index+'" data-line-type="'+type+'"><span class="aps-structured-kind">'+(labels[type]||'ТЕКСТ')+'</span><div class="aps-structured-value" contenteditable="true" data-structured-field="line">'+escapeHTML(trimmed)+'</div></section>';
  }
  function renderStructured(text){
    return String(text??'').split(/\r?\n/).map((line,index)=>structuredLine(line,index)).join('');
  }
  function syncStructuredBlock(block){
    const editor=document.querySelector('#script-workspace-body');
    if(!editor||!block)return;
    const lines=String(editor.value??'').split(/\r?\n/),index=Number(block.dataset.lineIndex);
    if(!Number.isInteger(index)||index<0||index>=lines.length)return;
    if(block.dataset.lineType==='dialogue'){
      const speaker=block.querySelector('[data-structured-field="speaker"]')?.textContent?.trim()||'';
      const dialogue=block.querySelector('[data-structured-field="dialogue"]')?.textContent?.trim()||'';
      lines[index]=speaker+(dialogue?': '+dialogue:'');
    }else{
      lines[index]=block.querySelector('[data-structured-field="line"]')?.textContent??'';
    }
    editor.value=lines.join('\n');
    editor.dispatchEvent(new Event('input',{bubbles:true}));
    const structured=document.querySelector('#aps-structured-editor');
    if(structured)structured.dataset.encodedContent=editor.value;
  }
  function paint(){
    const field=getLabel(),editor=document.querySelector('#script-workspace-body');
    const reader=document.querySelector('#aps-screenplay-reader'),structured=document.querySelector('#aps-structured-editor'),controls=document.querySelector('#aps-screenplay-controls');
    if(!field||!reader||!structured||!editor||!controls)return;
    const focus=document.body.classList.contains('p02-focus');
    field.classList.toggle('aps-reading',mode!=='edit');
    reader.hidden=mode!=='read';
    structured.hidden=mode!=='structured';
    controls.querySelectorAll('[data-aps-script-mode]').forEach(button=>{
      const active=button.dataset.apsScriptMode===mode;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    const fieldValue=editor.value;
    if(mode==='read'&&reader.dataset.encodedContent!==fieldValue){
      reader.innerHTML=renderLines(fieldValue);
      reader.dataset.encodedContent=fieldValue;
    }
    if(mode==='structured'&&structured.dataset.encodedContent!==fieldValue){
      structured.innerHTML=renderStructured(fieldValue);
      structured.dataset.encodedContent=fieldValue;
    }
    reader.setAttribute('aria-label',focus?'Сценарій у режимі зосередження':'Форматований сценарій');
    structured.setAttribute('aria-label',focus?'Структуроване редагування у режимі зосередження':'Структуроване редагування сценарію');
  }
  function setup(){
    if(typeof view==='undefined'||view!=='editor')return;
    const field=getLabel();
    if(!field)return;
    const key=currentKey();
    if(key!==currentScriptKey){currentScriptKey=key;mode='read';}
    if(!document.querySelector('#aps-screenplay-controls')){
      const controls=document.createElement('div');
      controls.id='aps-screenplay-controls';
      controls.className='aps-screenplay-controls';
      controls.setAttribute('role','group');
      controls.setAttribute('aria-label','Режим сценарного редактора');
      controls.innerHTML='<span class="aps-screenplay-controls-title">Сценарний формат</span><button type="button" data-aps-script-mode="read" aria-pressed="true">Перегляд</button><button type="button" data-aps-script-mode="structured" aria-pressed="false">▤ Структура</button><button type="button" data-aps-script-mode="edit" aria-pressed="false">✎ Текст</button><span class="aps-screenplay-safe-note">Один документ · усі режими змінюють той самий script.body</span>';
      field.before(controls);
      const reader=document.createElement('div');
      reader.id='aps-screenplay-reader';
      reader.className='aps-screenplay-reader';
      reader.setAttribute('role','region');
      field.after(reader);
      const structured=document.createElement('div');
      structured.id='aps-structured-editor';
      structured.className='aps-structured-editor';
      structured.setAttribute('role','region');
      reader.after(structured);
      controls.addEventListener('click',event=>{
        const button=event.target.closest('[data-aps-script-mode]');
        if(!button)return;
        mode=['read','structured','edit'].includes(button.dataset.apsScriptMode)?button.dataset.apsScriptMode:'read';
        const preview=document.querySelector('#aps-screenplay-reader');
        const blocks=document.querySelector('#aps-structured-editor');
        if(preview)delete preview.dataset.encodedContent;
        if(blocks)delete blocks.dataset.encodedContent;
        paint();
        if(mode==='edit')document.querySelector('#script-workspace-body')?.focus();
        if(mode==='structured')document.querySelector('#aps-structured-editor [contenteditable="true"]')?.focus();
      });
      structured.addEventListener('input',event=>{
        const block=event.target.closest('.aps-structured-block');
        if(block)syncStructuredBlock(block);
      });
      structured.addEventListener('keydown',event=>{
        if(event.key==='Enter'&&!event.shiftKey){
          event.preventDefault();
          const block=event.target.closest('.aps-structured-block');
          if(block)syncStructuredBlock(block);
        }
      });
    }
    const form=document.querySelector('#script-workspace-form');
    if(form&&!form.dataset.apsReadingBound){
      form.dataset.apsReadingBound='true';
      form.addEventListener('input',event=>{
        if(event.target.id!=='script-workspace-body')return;
        const reader=document.querySelector('#aps-screenplay-reader');
        const structured=document.querySelector('#aps-structured-editor');
        if(reader)delete reader.dataset.encodedContent;
        if(structured&&mode!=='structured')delete structured.dataset.encodedContent;
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
  window.APSApprovedScriptReading={renderLines,renderStructured,classify};
})();