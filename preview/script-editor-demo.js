/* P-02 demonstration only: approved layout, synthetic sample, no API or persistence. */
(()=>{
 const scenes=[
 'СЦЕНА 1. ЛІСОВА СТЕЖКА — ВЕЧІР\n\nМира проходить лісом, тримаючи креслення мосту. З далекого міста долинає тихий передзвін ліхтарів.\n\nМИРА: Я знайду дорогу до Дому Світла.\n',
 'СЦЕНА 2. ЗАГАДКОВИЙ МІСТ — НІЧ\n\nПеред Мирою з’являється міст, освітлений золотим сяйвом. Далеко внизу чути річку.\n\nМИРА: Це він? Той самий міст?\n\nГОЛОС: Деякі мости не будують із каменю…\n',
 'СЦЕНА 3. ЗУСТРІЧ ІЗ БУРШТИНОМ — СВІТАНОК\n\nМира бачить старого сича біля архіву. Він мовчки розгортає стародавню карту.\n\nБУРШТИН: Ти шукаєш міст, який уже збудовано.\n'
 ];
 let mode='whole',surface='read',index=0,focus=false,scenesCollapsed=false,aiCollapsed=false;
 const $=q=>document.querySelector(q);
 function render(){
  const box=$('#demo-script-text');if(!box)return;
  box.value=mode==='whole'?scenes.join('\n'):scenes[index];
  const reader=$('#demo-script-reader');
  const structured=$('#demo-script-structured');
  const field=box.closest('.editor-body-label');
  if(reader)reader.innerHTML=window.APSApprovedScriptFormat.renderLines(box.value);
  if(structured){
   structured.innerHTML=box.value.split(/\r?\n/).map((line,i)=>{
    const type=window.APSApprovedScriptFormat.classify(line),safe=String(line).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    if(type==='blank')return '<div class="aps-structured-gap" aria-hidden="true"></div>';
    if(type==='dialogue'){
      const t=line.trim(),p=t.indexOf(':'),speaker=t.slice(0,p).trim(),text=t.slice(p+1).trim(),narrator=/^(?:ГОЛОС|VOICE|ОПОВІДАЧ)/iu.test(speaker);
      return '<section class="aps-structured-block dialogue '+(narrator?'is-narrator':'')+'"><span class="aps-screenplay-avatar" aria-hidden="true">'+(narrator?'◖':'♙')+'</span><div><div class="aps-structured-speaker">'+speaker+'</div><div class="aps-structured-dialogue">'+text+'</div></div></section>';
    }
    const labels={scene:'СЦЕНА',detail:'ДЕТАЛЬ',action:'ДІЯ',direction:'РЕМАРКА',prose:'ТЕКСТ'};
    return '<section class="aps-structured-block '+type+'"><span class="aps-structured-kind">'+(labels[type]||'ТЕКСТ')+'</span><div class="aps-structured-value">'+safe+'</div></section>';
   }).join('');
  }
  if(reader)reader.hidden=surface!=='read';
  if(structured)structured.hidden=surface!=='structured';
  if(field)field.classList.toggle('aps-reading',surface!=='text');
  document.querySelectorAll('[data-demo-script-surface]').forEach(b=>{b.classList.toggle('active',b.dataset.demoScriptSurface===surface);b.setAttribute('aria-pressed',String(b.dataset.demoScriptSurface===surface));});
  $('#demo-script-count').textContent=box.value.trim().split(/\s+/).filter(Boolean).length+' слів · демонстрація';
  $('#demo-scene-selector').value=String(index);
  $('#demo-scene-selector').disabled=mode==='whole';
  document.querySelectorAll('[data-demo-script-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.demoScriptMode===mode);b.setAttribute('aria-pressed',String(b.dataset.demoScriptMode===mode));});
  $('#demo-scene-items').innerHTML=scenes.map((s,i)=>'<button type="button" data-demo-scene="'+i+'" class="'+(mode==='scene'&&index===i?'active':'')+'"><span>'+s.split('\n')[0]+'</span><small>Сцена '+(i+1)+' із 3</small></button>').join('');
  const screen=$('#screen-script');screen.classList.toggle('is-p02-focus',focus);
  screen.classList.toggle('demo-p02-focus',focus);
  const layout=screen.querySelector('.p02-edit-layout');
  layout?.classList.toggle('scenes-collapsed',scenesCollapsed&&!focus);
  layout?.classList.toggle('ai-collapsed',aiCollapsed&&!focus);
  const scenesButton=$('#demo-toggle-scenes');if(scenesButton){scenesButton.textContent=scenesCollapsed?'Показати сцени':'Сховати сцени';scenesButton.setAttribute('aria-pressed',String(!scenesCollapsed));}
  const aiButton=$('#demo-toggle-ai');if(aiButton){aiButton.textContent=aiCollapsed?'Показати AI':'Сховати AI';aiButton.setAttribute('aria-pressed',String(!aiCollapsed));}
  const focusButton=$('#demo-script-focus');focusButton.textContent=focus?'Вийти з фокусу':'Режим зосередження';
  focusButton.classList.toggle('active',focus);
  const banner=$('#preview-feedback');if(focus)banner.textContent='P-02 · Focus Mode · демонстраційний текст без редагування.';
 }
 document.querySelectorAll('[data-demo-script-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.demoScriptMode;render()}));
 document.querySelectorAll('[data-demo-script-surface]').forEach(button=>button.addEventListener('click',()=>{surface=button.dataset.demoScriptSurface;render()}));
 $('#demo-scene-items')?.addEventListener('click',event=>{const button=event.target.closest('[data-demo-scene]');if(!button)return;index=Number(button.dataset.demoScene);mode='scene';render()});
 $('#demo-scene-selector')?.addEventListener('change',e=>{index=Number(e.target.value);mode='scene';render()});
 $('#demo-toggle-scenes')?.addEventListener('click',()=>{scenesCollapsed=!scenesCollapsed;render()});
 $('#demo-toggle-ai')?.addEventListener('click',()=>{aiCollapsed=!aiCollapsed;render()});
 $('#demo-script-focus')?.addEventListener('click',()=>{focus=!focus;render()});
 render();
})();
