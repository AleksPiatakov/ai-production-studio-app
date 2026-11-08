/* P-08/P-09 Voice Profiles & Voice Library.
   Saved voices are project-scoped. Cloning is never simulated: rights metadata can be recorded,
   but no clone is created unless a real provider workflow exists. */
let voiceLibraryQuery='';
let voiceLibraryProvider='all';
let voiceLibraryStatus='all';
let voiceLibraryLanguage='all';
let voiceLibraryAge='all';
let voiceLibraryCompare=new Set();

function voiceOriginLabel(value){
  return ({synthetic:'Синтетичний голос',system:'Системний голос','licensed-library':'Ліцензована бібліотека','self-recorded':'Власний запис','authorized-clone':'Авторизований клон'})[value]||'Не вказано';
}
function voiceAssignedCharacter(voice){
  return (active.bibles?.characters||[]).find(character=>character.identityKey&&character.identityKey===voice.identityKey)||null;
}
function voiceUsageCount(voice){
  return (active.scenes||[]).reduce((sum,scene)=>sum+(scene.dialogue||[]).filter(line=>line.voiceIdentityKey===voice.identityKey).length,0);
}
function voiceLibraryItems(){
  const q=voiceLibraryQuery.trim().toLowerCase();
  return (active.voiceProfiles||[]).filter(voice=>{
    if(voiceLibraryProvider!=='all'&&(voice.provider||'local')!==voiceLibraryProvider)return false;
    if(voiceLibraryStatus!=='all'&&(voice.status||'draft')!==voiceLibraryStatus)return false;
    if(voiceLibraryLanguage!=='all'&&!(voice.languages||[]).includes(voiceLibraryLanguage))return false;
    if(voiceLibraryAge!=='all'&&voice.ageBand!==voiceLibraryAge)return false;
    if(q&&!String([voice.name,voice.engine,voice.license,voice.notes,voice.identityKey].join(' ')).toLowerCase().includes(q))return false;
    return true;
  });
}
function voiceRightsBadge(voice){
  if(voice.voiceOrigin==='authorized-clone')return voice.rightsConfirmed?'<span class="voice-rights ok">✓ Права підтверджено</span>':'<span class="voice-rights error">! Немає підтвердження прав</span>';
  return '<span class="voice-rights neutral">'+esc(voiceOriginLabel(voice.voiceOrigin||((voice.provider||'local')==='elevenlabs'?'licensed-library':'system')))+'</span>';
}
function voiceLibraryCard(voice){
  const character=voiceAssignedCharacter(voice),uses=voiceUsageCount(voice),selected=voiceLibraryCompare.has(voice.id);
  return `<article class="voice-library-card ${selected?'is-compare':''}">
    <header><div><span class="voice-provider-chip">${esc((voice.provider||'local')==='elevenlabs'?'ElevenLabs':'Local')}</span><strong>${esc(voice.name)}</strong></div><span class="tag">${esc(label('status',voice.status||'draft'))}</span></header>
    <div class="voice-library-body"><p>${esc(voice.notes||'Нотатки для цього голосу ще не додано.')}</p>
      <div class="voice-library-facts"><span><small>Вік</small><b>${esc(label('age',voice.ageBand))}</b></span><span><small>Мови</small><b>${esc((voice.languages||[]).map(code=>label('language',code)).join(' / ')||'—')}</b></span><span><small>Використання</small><b>${uses} реплік</b></span></div>
      <div class="voice-library-assignment"><span>Персонаж</span><strong>${esc(character?.name||'Не призначено')}</strong></div>
      ${voiceRightsBadge(voice)}
      <small class="voice-library-license">${esc(voice.license||'Ліцензію не вказано')}</small>
    </div>
    <footer><label class="voice-compare-check"><input type="checkbox" ${selected?'checked':''} onchange="toggleVoiceCompare('${esc(voice.id)}',this.checked)"> Порівняти</label><div><button type="button" onclick="openVoiceProfile('${esc(voice.id)}')">Профіль</button>${voice.status==='approved'?'':`<button type="button" onclick="openVoiceAssignment('${esc(voice.id)}')">Призначити</button>`}</div></footer>
  </article>`;
}
function voiceComparePanel(){
  const voices=[...voiceLibraryCompare].map(id=>(active.voiceProfiles||[]).find(v=>v.id===id)).filter(Boolean).slice(0,3);
  if(voices.length<2)return '';
  const rows=[
    ['Джерело',v=>voiceOriginLabel(v.voiceOrigin||((v.provider||'local')==='elevenlabs'?'licensed-library':'system'))],
    ['Вік',v=>label('age',v.ageBand)],
    ['Мови',v=>(v.languages||[]).map(code=>label('language',code)).join(' / ')],
    ['Рушій',v=>v.engine||'—'],
    ['Статус',v=>label('status',v.status||'draft')],
    ['Персонаж',v=>voiceAssignedCharacter(v)?.name||'Не призначено'],
    ['Реплік',v=>String(voiceUsageCount(v))],
    ['Права',v=>v.voiceOrigin==='authorized-clone'?(v.rightsConfirmed?'Підтверджено':'Не підтверджено'):'не вимагає clone-confirmation']
  ];
  return `<section class="voice-compare-panel"><div class="voice-compare-head"><div><p class="eyebrow">ПОРІВНЯННЯ</p><h4>${voices.length} профілі</h4></div><button type="button" onclick="clearVoiceCompare()">Очистити</button></div><div class="voice-compare-table"><div class="voice-compare-row head"><span>Параметр</span>${voices.map(v=>`<strong>${esc(v.name)}</strong>`).join('')}</div>${rows.map(([title,get])=>`<div class="voice-compare-row"><span>${title}</span>${voices.map(v=>`<b>${esc(get(v))}</b>`).join('')}</div>`).join('')}</div></section>`;
}
function voiceLibraryPanel(){
  const items=voiceLibraryItems();
  return `<section class="voice-library-page">
    <header class="voice-library-head"><div><p class="eyebrow">БІБЛІОТЕКА ГОЛОСІВ</p><h3>Голоси поточного проєкту</h3><p>Пошук, порівняння, права використання та безпечне призначення персонажам.</p></div><button class="primary" type="button" onclick="openVoiceProfile()">＋ Новий профіль</button></header>
    <div class="voice-library-filters"><label>Пошук<input type="search" value="${esc(voiceLibraryQuery)}" placeholder="Назва, рушій, ліцензія…" oninput="setVoiceLibraryFilter('query',this.value)"></label><label>Сервіс<select onchange="setVoiceLibraryFilter('provider',this.value)"><option value="all">Усі</option><option value="local" ${voiceLibraryProvider==='local'?'selected':''}>Local</option><option value="elevenlabs" ${voiceLibraryProvider==='elevenlabs'?'selected':''}>ElevenLabs</option></select></label><label>Мова<select onchange="setVoiceLibraryFilter('language',this.value)"><option value="all">Усі</option><option value="uk" ${voiceLibraryLanguage==='uk'?'selected':''}>Українська</option><option value="en" ${voiceLibraryLanguage==='en'?'selected':''}>Англійська</option></select></label><label>Вік<select onchange="setVoiceLibraryFilter('age',this.value)"><option value="all">Усі</option>${['child','teen','young-adult','adult','elder'].map(age=>`<option value="${age}" ${voiceLibraryAge===age?'selected':''}>${esc(label('age',age))}</option>`).join('')}</select></label><label>Статус<select onchange="setVoiceLibraryFilter('status',this.value)"><option value="all">Усі</option><option value="draft" ${voiceLibraryStatus==='draft'?'selected':''}>Чернетка</option><option value="approved" ${voiceLibraryStatus==='approved'?'selected':''}>Затверджено</option><option value="retired" ${voiceLibraryStatus==='retired'?'selected':''}>Не використовувати</option></select></label></div>
    <div class="voice-library-summary"><span><b>${(active.voiceProfiles||[]).length}</b> профілів</span><span><b>${(active.voiceProfiles||[]).filter(v=>v.status==='approved').length}</b> затверджено</span><span><b>${(active.voiceProfiles||[]).filter(v=>voiceAssignedCharacter(v)).length}</b> призначено</span><span><b>${[...voiceLibraryCompare].length}</b> у порівнянні</span></div>
    ${voiceComparePanel()}
    <div class="voice-library-grid">${items.length?items.map(voiceLibraryCard).join(''):'<p class="global-empty">За цими фільтрами голосів немає.</p>'}</div>
    <p class="voice-library-rule">Призначення не змінює затверджений профіль і не перепризначає голос, який уже використовується в репліках. Для clone-origin потрібне окреме підтвердження прав.</p>
  </section>`;
}
function setVoiceLibraryFilter(kind,value){
  if(kind==='query')voiceLibraryQuery=value;
  if(kind==='provider')voiceLibraryProvider=value;
  if(kind==='language')voiceLibraryLanguage=value;
  if(kind==='age')voiceLibraryAge=value;
  if(kind==='status')voiceLibraryStatus=value;
  render();
}
function toggleVoiceCompare(id,checked){
  if(checked){
    if(voiceLibraryCompare.size>=3){window.alert('Одночасно можна порівнювати не більше трьох голосів.');render();return}
    voiceLibraryCompare.add(id);
  }else voiceLibraryCompare.delete(id);
  render();
}
function clearVoiceCompare(){voiceLibraryCompare.clear();render()}
function openVoiceAssignment(voiceId){
  const voice=(active.voiceProfiles||[]).find(item=>item.id===voiceId);if(!voice)return;
  const characters=(active.bibles?.characters||[]).filter(character=>character.identityKey);
  modal('Призначити голос персонажу',`<p class="muted">Призначення змінює identity цього чернеткового профілю на identity персонажа. Якщо профіль уже використовується в репліках або затверджений, сервер заблокує операцію.</p><label>Голос<input readonly value="${esc(voice.name)}"></label><label>Персонаж<select name="characterId" required><option value="">Оберіть персонажа…</option>${characters.map(character=>`<option value="${esc(character.id)}">${esc(character.name)} · ${esc(label('age',character.ageBand))}</option>`).join('')}</select></label>`,f=>api(`/api/projects/${encodeURIComponent(activeId)}/voice-profiles/${encodeURIComponent(voiceId)}/assign`,{method:'POST',body:JSON.stringify({characterId:f.get('characterId')})}));
}
function voiceRightsEditorSection(){
  const voice=voiceEditorState?.voiceId?(active.voiceProfiles||[]).find(item=>item.id===voiceEditorState.voiceId):null;
  const origin=voice?.voiceOrigin||((voice?.provider||'elevenlabs')==='elevenlabs'?'licensed-library':'system');
  const samples=(active.assets||[]).filter(asset=>asset.type==='audio');
  return `<section class="voice-editor-section voice-rights-section"><h4>4. Джерело та право використання</h4><label>Походження голосу<select name="voiceOrigin"><option value="synthetic" ${origin==='synthetic'?'selected':''}>Синтетичний голос</option><option value="system" ${origin==='system'?'selected':''}>Системний голос</option><option value="licensed-library" ${origin==='licensed-library'?'selected':''}>Ліцензована бібліотека</option><option value="self-recorded" ${origin==='self-recorded'?'selected':''}>Власний запис</option><option value="authorized-clone" ${origin==='authorized-clone'?'selected':''}>Авторизований клон</option></select></label><p class="voice-rights-warning">Вибір «Авторизований клон» лише фіксує походження і право використання. Цей екран сам по собі не створює клон голосу.</p><label class="check"><input type="checkbox" name="rightsConfirmed" ${voice?.rightsConfirmed?'checked':''}> Я підтверджую, що маю право та необхідну згоду на використання цього голосу</label><label>Підстава / примітка<textarea name="rightsNote" placeholder="Власний голос, письмова згода, ліцензія бібліотеки…">${esc(voice?.rightsNote||'')}</textarea></label><fieldset class="voice-samples"><legend>Зразки з медіабібліотеки</legend>${samples.length?samples.map(asset=>`<label class="check"><input type="checkbox" name="sampleAssetId" value="${esc(asset.id)}" ${(voice?.sampleAssetIds||[]).includes(asset.id)?'checked':''}> ${esc(asset.label)}</label>`).join(''):'<p class="muted">У проєкті ще немає аудіоресурсів, які можна позначити як зразок.</p>'}</fieldset></section>`;
}
if(typeof voiceEditorPanel==='function'){
  const baseVoiceEditorPanel=voiceEditorPanel;
  voiceEditorPanel=function(){
    let html=baseVoiceEditorPanel();
    const marker='</section></div>';
    const index=html.lastIndexOf(marker);
    if(index>=0)html=html.slice(0,index+10)+voiceRightsEditorSection()+html.slice(index+10);
    return html;
  };
}
const voiceLibraryBasePageContent=pageContent;
pageContent=function(){return view==='voiceLibrary'?voiceLibraryPanel():voiceLibraryBasePageContent()};
const voiceLibraryBaseTitle=viewTitle;
viewTitle=function(){return view==='voiceLibrary'?'Бібліотека голосів':voiceLibraryBaseTitle()};
const voiceLibraryBaseActions=viewActions;
viewActions=function(){return view==='voiceLibrary'?'<button class="primary" onclick="openVoiceProfile()">＋ Голосовий профіль</button>':voiceLibraryBaseActions()};
