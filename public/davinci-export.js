/* P-15 DaVinci Export.
   Builds a verifiable package plan; it never claims to create a finished Resolve project. */
let davinciExportMode='draft';
let davinciEpisodeId='';
let davinciPackageReport=null;
let davinciPackageBusy=false;
let davinciPackageError='';

function davinciEpisode(){
  const episodes=active.episodes||[];
  return episodes.find(item=>item.id===davinciEpisodeId)||episodes.find(item=>item.id===activeEpisodeId)||episodes[0]||null;
}
async function refreshDaVinciPackage(){
  const episode=davinciEpisode();davinciPackageError='';
  if(!episode){davinciPackageReport=null;render();return}
  davinciEpisodeId=episode.id;davinciPackageBusy=true;render();
  try{davinciPackageReport=await api(`/api/projects/${encodeURIComponent(activeId)}/episodes/${encodeURIComponent(episode.id)}/davinci-package/report?mode=${encodeURIComponent(davinciExportMode)}`)}
  catch(error){davinciPackageReport=null;davinciPackageError=error.message}
  finally{davinciPackageBusy=false;render()}
}
function setDaVinciEpisode(id){davinciEpisodeId=id;refreshDaVinciPackage()}
function setDaVinciMode(mode){davinciExportMode=mode==='final'?'final':'draft';refreshDaVinciPackage()}
function davinciFolderTree(report){
  const folders=report?.folders||{};
  const order=['Video','Dialogue/UK','Dialogue/EN','Music','Atmosphere','SFX','Subtitles','Edit_Data','Manifest','Reports'];
  return `<div class="davinci-tree">${order.map(folder=>{const files=folders[folder]||[];return `<details open><summary><span>▾</span><strong>${folder}</strong><em>${files.length}</em></summary><div>${files.length?files.map(file=>`<div class="davinci-file ${file.exists?'exists':'missing'}"><span>${file.virtual?'◇':file.exists?'✓':'!'}</span><code>${esc(file.destination)}</code><small>${file.virtual?'створюється програмою':file.exists?'файл знайдено':'файл відсутній'}</small></div>`).join(''):'<p>Порожньо</p>'}</div></details>`}).join('')}</div>`;
}
function davinciIssues(report){
  const issues=report?.issues||[];
  if(!issues.length)return '<div class="davinci-ready"><strong>✓ Фінальний пакет готовий за поточними перевірками</strong><span>Перед монтажем все одно перевірте імпорт у вашій версії DaVinci Resolve.</span></div>';
  return `<div class="davinci-issues"><strong>${davinciExportMode==='draft'?'Чернетковий пакет можна сформувати з попередженнями':'Фінальний пакет заблоковано'}</strong><ul>${issues.map(issue=>`<li>${esc(issue)}</li>`).join('')}</ul></div>`;
}
function davinciDownloadUrl(file){
 const episode=davinciEpisode();if(!episode)return '#';
 return `/api/projects/${encodeURIComponent(activeId)}/episodes/${encodeURIComponent(episode.id)}/davinci-package/${file}?mode=${encodeURIComponent(davinciExportMode)}`;
}
function downloadDaVinciPackageFile(file){
  if(davinciExportMode==='final'&&!davinciPackageReport?.canExport){window.alert('Фінальний пакет заблоковано: спочатку усуньте помилки перевірки.');return}
  window.location.href=davinciDownloadUrl(file);
}
function davinciExportPanel(){
 const episodes=active.episodes||[],episode=davinciEpisode(),report=davinciPackageReport;
 if(!episodes.length)return '<section class="davinci-export"><p class="global-empty">Спочатку створіть випуск. Експортний пакет формується для конкретного випуску.</p></section>';
 const summary=report?.summary||{files:0,existingFiles:0,missingFiles:0,approvedVideoClips:0,totalShots:0};
 const finalBlocked=davinciExportMode==='final'&&!report?.canExport;
 return `<section class="davinci-export">
  <header class="davinci-export-head"><div><p class="eyebrow">ЕКСПОРТ ДЛЯ DAVINCI RESOLVE</p><h3>Монтажний пакет</h3><p>AI Production Studio готує й перевіряє матеріали. Монтаж, синхронізація, переходи, колір, мікс і фінальний рендер виконуються в DaVinci Resolve.</p></div><button type="button" onclick="refreshDaVinciPackage()">↻ Оновити перевірку</button></header>
  <div class="davinci-controls"><label>Випуск<select onchange="setDaVinciEpisode(this.value)">${episodes.map(item=>`<option value="${esc(item.id)}" ${episode?.id===item.id?'selected':''}>${esc(item.title||'Без назви')}</option>`).join('')}</select></label><div class="davinci-mode" role="group" aria-label="Режим пакета"><button type="button" class="${davinciExportMode==='draft'?'active':''}" onclick="setDaVinciMode('draft')">Чернетковий пакет</button><button type="button" class="${davinciExportMode==='final'?'active':''}" onclick="setDaVinciMode('final')">Фінальний пакет</button></div><span class="davinci-fps">${esc(active.productionSettings?.fps||24)} FPS</span></div>
  ${davinciPackageBusy?'<div class="davinci-loading">Перевіряємо файли та статуси…</div>':davinciPackageError?`<p class="error">${esc(davinciPackageError)}</p>`:''}
  ${report?`<div class="davinci-summary"><span><b>${summary.existingFiles}/${summary.files}</b> файлів знайдено</span><span><b>${summary.approvedVideoClips}/${summary.totalShots}</b> відеокліпів затверджено</span><span><b>${summary.missingFiles}</b> файлів відсутні</span><span><b>${report.finalReady?'так':'ні'}</b> готово для final</span></div>
  <div class="davinci-layout"><section class="davinci-package-tree"><div class="davinci-section-title"><span>СТРУКТУРА ПАКЕТА</span><strong>Папки та файли</strong></div>${davinciFolderTree(report)}</section><section class="davinci-readiness"><div class="davinci-section-title"><span>ПЕРЕВІРКА</span><strong>${davinciExportMode==='draft'?'Чернетковий пакет':'Фінальний пакет'}</strong></div>${davinciIssues(report)}<div class="davinci-actions"><button type="button" onclick="downloadDaVinciPackageFile('manifest.json')" ${finalBlocked?'disabled':''}>Manifest JSON</button><button type="button" onclick="downloadDaVinciPackageFile('timeline.csv')" ${finalBlocked?'disabled':''}>Timeline CSV</button><button type="button" onclick="downloadDaVinciPackageFile('handoff.md')" ${finalBlocked?'disabled':''}>Монтажний лист</button></div><p class="davinci-format-note">Ці файли описують порядок і джерела матеріалів. Автоматичне створення готового DaVinci-проєкту не заявляється, доки формат імпорту не пройде окремий реальний тест.</p></section></div>`:''}
 </section>`;
}
const davinciBasePageContent=pageContent;pageContent=function(){return view==='davinci'?davinciExportPanel():davinciBasePageContent()};
const davinciBaseViewTitle=viewTitle;viewTitle=function(){return view==='davinci'?'Експорт DaVinci':davinciBaseViewTitle()};
const davinciBaseViewActions=viewActions;viewActions=function(){return view==='davinci'?'<button onclick="refreshDaVinciPackage()">↻ Перевірити</button>':davinciBaseViewActions()};
const davinciBaseGoToView=goToView;goToView=function(nextView){if(nextView==='davinci'){view='davinci';workspaceMode='studio';refreshDaVinciPackage();return}davinciBaseGoToView(nextView)};
