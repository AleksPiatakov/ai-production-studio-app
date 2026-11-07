/* P-02 demonstration only: approved layout, synthetic sample, no API or persistence. */
(()=>{
 const scenes=[
 'СЦЕНА 1. ЛІСОВА СТЕЖКА — ВЕЧІР\n\nМира проходить лісом, тримаючи креслення мосту. З далекого міста долинає тихий передзвін ліхтарів.\n\nМИРА: Я знайду дорогу до Дому Світла.\n',
 'СЦЕНА 2. ЗАГАДКОВИЙ МІСТ — НІЧ\n\nПеред Мирою з’являється міст, освітлений золотим сяйвом. Далеко внизу чути річку.\n\nМИРА: Це він? Той самий міст?\n\nГОЛОС: Деякі мости не будують із каменю…\n',
 'СЦЕНА 3. ЗУСТРІЧ ІЗ БУРШТИНОМ — СВІТАНОК\n\nМира бачить старого сича біля архіву. Він мовчки розгортає стародавню карту.\n\nБУРШТИН: Ти шукаєш міст, який уже збудовано.\n'
 ];
 let mode='whole',index=0,focus=false;
 const $=q=>document.querySelector(q);
 function render(){
  const box=$('#demo-script-text');if(!box)return;
  box.value=mode==='whole'?scenes.join('\n'):scenes[index];
  const reader=$('#demo-script-reader');
  if(reader)reader.innerHTML=window.APSApprovedScriptFormat.renderLines(box.value);
  $('#demo-script-count').textContent=box.value.trim().split(/\s+/).filter(Boolean).length+' слів · демонстрація';
  $('#demo-scene-selector').value=String(index);
  $('#demo-scene-selector').disabled=mode==='whole';
  document.querySelectorAll('[data-demo-script-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.demoScriptMode===mode);b.setAttribute('aria-pressed',String(b.dataset.demoScriptMode===mode));});
  $('#demo-scene-items').innerHTML=scenes.map((s,i)=>'<button type="button" data-demo-scene="'+i+'" class="'+(mode==='scene'&&index===i?'active':'')+'"><span>'+s.split('\n')[0]+'</span><small>Сцена '+(i+1)+' із 3</small></button>').join('');
  const screen=$('#screen-script');screen.classList.toggle('is-p02-focus',focus);
  screen.classList.toggle('demo-p02-focus',focus);
  const focusButton=$('#demo-script-focus');focusButton.textContent=focus?'Вийти з фокусу':'Режим зосередження';
  focusButton.classList.toggle('active',focus);
  const banner=$('#preview-feedback');if(focus)banner.textContent='P-02 · Focus Mode · демонстраційний текст без редагування.';
 }
 document.querySelectorAll('[data-demo-script-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.demoScriptMode;render()}));
 $('#demo-scene-items')?.addEventListener('click',event=>{const button=event.target.closest('[data-demo-scene]');if(!button)return;index=Number(button.dataset.demoScene);mode='scene';render()});
 $('#demo-scene-selector')?.addEventListener('change',e=>{index=Number(e.target.value);mode='scene';render()});
 $('#demo-script-focus')?.addEventListener('click',()=>{focus=!focus;render()});
 render();
})();
