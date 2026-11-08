/* P-12 Project Versions / rollback. */
function versionProjectCounts(project){
  const scenes=project?.scenes||[],scripts=(project?.scripts||[]).filter(item=>!item.deletedAt),assets=project?.assets||[];
  return {scripts:scripts.length,episodes:(project?.episodes||[]).length,scenes:scenes.length,shots:scenes.reduce((sum,scene)=>sum+(scene.shots||[]).length,0),dialogue:scenes.reduce((sum,scene)=>sum+(scene.dialogue||[]).length,0),assets:assets.length};
}
function versionDelta(saved,current,key){
  const delta=Number(current[key]||0)-Number(saved[key]||0);
  if(delta===0)return 'без змін';
  return (delta>0?'+':'')+delta;
}
function versionHistoryCard(version,index,total){
  const saved=versionProjectCounts(version.snapshot||{}),current=versionProjectCounts(active);
  return `<article class="project-version-card"><header><div><span>ВЕРСІЯ ${total-index}</span><strong>${esc(version.label||'Автоматичне збереження')}</strong></div><time>${esc(new Date(version.createdAt).toLocaleString('uk-UA'))}</time></header><div class="project-version-metrics">${[['scripts','Сценарії'],['episodes','Випуски'],['scenes','Сцени'],['shots','Кадри'],['dialogue','Репліки'],['assets','Ресурси']].map(([key,title])=>`<span><small>${title}</small><b>${saved[key]}</b><em>${esc(versionDelta(saved,current,key))}</em></span>`).join('')}</div><footer><small>Відновлення спочатку збереже поточний стан окремою резервною версією.</small><button type="button" onclick="restoreProjectVersion('${esc(version.id)}','${esc(String(version.label||'Версія').replace(/'/g,'&#39;'))}')">Відновити цю версію</button></footer></article>`;
}
function projectVersionsPanel(){
  const versions=[...(active.versionHistory||[])].reverse(),current=versionProjectCounts(active);
  return `<section class="project-versions-page"><header class="project-versions-head"><div><p class="eyebrow">ВЕРСІЇ ПРОЄКТУ</p><h3>Історія та безпечний відкат</h3><p>Автоматичні версії створюються перед змінами. Додатково можна створити ручну контрольну точку перед важливим етапом.</p></div><button class="primary" type="button" onclick="createProjectCheckpoint()">＋ Контрольна точка</button></header>
    <div class="project-current-state"><div><span>ПОТОЧНИЙ СТАН</span><strong>${esc(active.name)}</strong></div><div class="project-current-metrics"><span><b>${current.episodes}</b> випусків</span><span><b>${current.scripts}</b> сценаріїв</span><span><b>${current.scenes}</b> сцен</span><span><b>${current.shots}</b> кадрів</span><span><b>${current.assets}</b> ресурсів</span></div></div>
    <div class="project-version-toolbar"><span>${versions.length} збережених станів</span><span>Ліміт: ${esc(globalStudioSettings?.files?.versionHistoryLimit||30)}</span></div>
    <div class="project-version-list">${versions.length?versions.map((version,index)=>versionHistoryCard(version,index,versions.length)).join(''):'<p class="global-empty">Історія ще порожня. Вона почне заповнюватися після першої зміни або ручної контрольної точки.</p>'}</div>
    <p class="project-version-rule">Restore не видаляє поточний стан: перед відновленням він автоматично додається в історію. Це дає можливість повернутися назад.</p>
  </section>`;
}
function createProjectCheckpoint(){
  modal('Нова контрольна точка',`<p class="muted">Збережеться повний поточний стан проєкту без зміни його даних.</p><label>Назва<input name="label" required maxlength="160" value="Контрольна точка перед важливими змінами"></label>`,f=>api(`/api/projects/${encodeURIComponent(activeId)}/versions`,{method:'POST',body:JSON.stringify({label:String(f.get('label')||'').trim()})}));
}
async function restoreProjectVersion(versionId,labelText){
  if(!window.confirm(`Відновити «${labelText}»? Поточний стан спочатку буде збережено як окрему резервну версію.`))return;
  try{await api(`/api/projects/${encodeURIComponent(activeId)}/versions/${encodeURIComponent(versionId)}/restore`,{method:'POST'});await load(activeId)}
  catch(error){window.alert(error.message)}
}
const versionsBasePageContent=pageContent;pageContent=function(){return view==='versions'?projectVersionsPanel():versionsBasePageContent()};
const versionsBaseViewTitle=viewTitle;viewTitle=function(){return view==='versions'?'Версії проєкту':versionsBaseViewTitle()};
const versionsBaseViewActions=viewActions;viewActions=function(){return view==='versions'?'<button class="primary" onclick="createProjectCheckpoint()">＋ Контрольна точка</button>':versionsBaseViewActions()};
