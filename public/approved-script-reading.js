/* Approved P-02 screenplay surface.
   Read the existing canonical script.body; do not replace the textarea or invent
   structured scene/dialogue data. Reading mode follows the approved PNG while
   Edit mode preserves the existing versioned save and Focus flow. */
(()=>{
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let editMode=false;
  let currentScriptKey=null;

  const {renderLines}=window.APSApprovedScriptFormat;
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
  window.APSApprovedScriptReading={renderLines,classify:window.APSApprovedScriptFormat.classify};
})();