/* Global program pages: G-01 Home, G-02 Projects, G-08 Settings, G-09 New Project.
   Uses local APIs only. Example project story content is not part of this layer. */
let globalStudioSettings=null;
let globalSettingsTab='general';
let globalSettingsNotice='';
let projectGallerySearch='';
let projectGalleryType='all';
let projectWizard={step:1,data:{
  name:'',type:'animated-series',defaultLanguage:'uk',additionalLanguages:['en'],
  targetMinutes:10,description:'',resolution:'1920x1080',aspectRatio:'16:9',fps:24,plannedEpisodes:1
}};

async function refreshGlobalStudioSettings(){
  try{
    globalStudioSettings=await api('/api/studio/settings');
    if(!sessionStorage.getItem('ai-production-studio:start-view-applied')&&view==='overview'){
      sessionStorage.setItem('ai-production-studio:start-view-applied','true');
      const start=globalStudioSettings?.general?.startView;
      if(['home','projects','overview'].includes(start))view=start;
    }
  }catch(error){globalSettingsNotice='Не вдалося завантажити налаштування: '+error.message}
}
function projectStats(project){
  const shots=(project.scenes||[]).reduce((sum,scene)=>sum+(scene.shots||[]).length,0);
  return {episodes:(project.episodes||[]).length,scenes:(project.scenes||[]).length,shots,assets:(project.assets||[]).length};
}
function globalHomePanel(){
  const recent=[...(projects||[])].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,4);
  const allAssets=(projects||[]).flatMap(project=>(project.assets||[]).map(asset=>({project,asset}))).slice(-6).reverse();
  return `<section class="global-home">
    <div class="global-home-hero">
      <div><p class="eyebrow">AI PRODUCTION STUDIO</p><h3>Виробничий центр</h3><p>Проєкти, AI-моделі, черга генерацій і загальний помічник — окремо від робочого простору конкретного проєкту.</p></div>
      <div class="global-home-actions"><button class="primary" type="button" onclick="openProjectWizard()">＋ Новий проєкт</button><button type="button" onclick="goToView('projects')">Усі проєкти</button></div>
    </div>
    <div class="global-section-head"><div><p class="eyebrow">ОСТАННІ ПРОЄКТИ</p><h4>Продовжити роботу</h4></div><button type="button" onclick="goToView('projects')">Відкрити каталог →</button></div>
    <div class="global-project-grid">${recent.length?recent.map(project=>globalProjectCard(project)).join(''):'<div class="global-empty">Проєктів ще немає. Створіть перший локальний проєкт.</div>'}</div>
    <div class="global-home-lower">
      <section class="global-panel"><div class="global-section-head"><div><p class="eyebrow">ОСТАННІ МАТЕРІАЛИ</p><h4>Локальні ресурси</h4></div></div>
        ${allAssets.length?allAssets.map(({project,asset})=>`<button class="global-list-row" type="button" onclick="openGlobalProject('${esc(project.id)}','assets')"><span><strong>${esc(asset.label||'Ресурс')}</strong><small>${esc(project.name)}</small></span><em>${esc(label('asset',asset.type)||asset.type)}</em></button>`).join(''):'<p class="global-empty">Матеріали з’являться тут після додавання ресурсів у проєкти.</p>'}
      </section>
      <section class="global-panel global-assistant-entry"><p class="eyebrow">ЗАГАЛЬНИЙ AI ПОМІЧНИК</p><h4>Окремий від проєктів</h4><p>Глобальний помічник не отримує автоматичного доступу до файлів проєктів.</p><button type="button" onclick="goToView('assistants')">Відкрити AI Помічники →</button></section>
    </div>
  </section>`;
}
function globalProjectCard(project){
  const stats=projectStats(project);
  const typeLabel=label('type',project.type)||project.type;
  const production=project.productionSettings||{};
  return `<article class="global-project-card">
    <button class="global-project-open" type="button" onclick="openGlobalProject('${esc(project.id)}')">
      <span class="global-project-icon" aria-hidden="true">▣</span>
      <span class="global-project-copy"><strong>${esc(project.name)}</strong><small>${esc(typeLabel)} · ${esc(project.defaultLanguage?.toUpperCase?.()||'UK')}</small></span>
    </button>
    <div class="global-project-meta"><span>${stats.episodes} випусків</span><span>${stats.assets} ресурсів</span><span>${esc(production.resolution||'1920x1080')}</span></div>
  </article>`;
}
function globalProjectsPanel(){
  const q=projectGallerySearch.trim().toLowerCase();
  const items=(projects||[]).filter(project=>(projectGalleryType==='all'||project.type===projectGalleryType)&&(!q||[project.name,project.description,label('type',project.type)].some(value=>String(value||'').toLowerCase().includes(q))));
  return `<section class="global-projects-page">
    <div class="global-toolbar"><div><p class="eyebrow">ПРОЄКТИ</p><h3>Каталог проєктів</h3><p>Кожен проєкт має окремі дані, ресурси, пам’ять помічника та історію версій.</p></div><button class="primary" type="button" onclick="openProjectWizard()">＋ Новий проєкт</button></div>
    <div class="global-project-filters"><label>Пошук<input type="search" value="${esc(projectGallerySearch)}" placeholder="Назва або опис…" oninput="setProjectGallerySearch(this.value)"></label><label>Тип<select onchange="setProjectGalleryType(this.value)"><option value="all">Усі типи</option><option value="animated-series" ${projectGalleryType==='animated-series'?'selected':''}>Анімаційний серіал</option><option value="general" ${projectGalleryType==='general'?'selected':''}>Універсальне відео</option><option value="science" ${projectGalleryType==='science'?'selected':''}>Наукове відео</option></select></label></div>
    <div class="global-project-grid global-project-grid-large">${items.length?items.map(project=>globalProjectCard(project)).join(''):'<div class="global-empty">За цим фільтром проєктів немає.</div>'}</div>
  </section>`;
}
function setProjectGallerySearch(value){projectGallerySearch=value;render()}
function setProjectGalleryType(value){projectGalleryType=value;render()}
function openGlobalProject(id,nextView='overview'){view=nextView;selectProject(id)}
function settingsTabs(){
  const tabs=[['general','Загальні'],['files','Файли та сховище'],['performance','Продуктивність'],['assistants','AI Помічники'],['export','Експорт']];
  return '<nav class="settings-tabs" aria-label="Розділи налаштувань">'+tabs.map(([id,title])=>`<button type="button" class="${globalSettingsTab===id?'active':''}" onclick="setGlobalSettingsTab('${id}')">${title}</button>`).join('')+'</nav>';
}
function setGlobalSettingsTab(id){globalSettingsTab=id;globalSettingsNotice='';render()}
function checked(value){return value?'checked':''}
function settingsFields(){
  const settings=globalStudioSettings;
  if(!settings)return '<p class="global-empty">Завантаження налаштувань…</p>';
  if(globalSettingsTab==='general')return `
    <label>Мова інтерфейсу<select name="interfaceLanguage"><option value="uk" ${settings.general.interfaceLanguage==='uk'?'selected':''}>Українська</option><option value="en" ${settings.general.interfaceLanguage==='en'?'selected':''}>English</option></select></label>
    <label>Початковий екран<select name="startView"><option value="home" ${settings.general.startView==='home'?'selected':''}>Головна</option><option value="projects" ${settings.general.startView==='projects'?'selected':''}>Проєкти</option><option value="overview" ${settings.general.startView==='overview'?'selected':''}>Останній проєкт</option></select></label>
    <label class="settings-check"><input type="checkbox" name="confirmDestructive" ${checked(settings.general.confirmDestructive)}> Підтверджувати руйнівні дії</label>`;
  if(globalSettingsTab==='files')return `
    <label>Коренева папка проєктів<input name="projectRoot" value="${esc(settings.files.projectRoot)}" readonly><small>Поточне безпечне локальне сховище. Перенесення каталогу буде окремою операцією з перевіркою файлів.</small></label>
    <label>Кількість автоматичних версій<input name="versionHistoryLimit" type="number" min="5" max="100" value="${esc(settings.files.versionHistoryLimit)}"><small>Цей параметр реально визначає ліміт історії станів проєкту.</small></label>
    <label class="settings-check"><input type="checkbox" name="verifyWrites" ${checked(settings.files.verifyWrites)}> Перевіряти записи й пакети проєкту</label>`;
  if(globalSettingsTab==='performance')return `
    <label class="settings-check"><input type="checkbox" name="preferLocal" ${checked(settings.performance.preferLocal)}> Надавати перевагу локальним моделям</label>
    <label class="settings-check"><input type="checkbox" name="releaseModelsAfterTask" ${checked(settings.performance.releaseModelsAfterTask)}> Звільняти пам’ять моделі після завдання</label>
    <label>Максимум паралельних генерацій<select name="maxConcurrentJobs">${[1,2,3,4].map(n=>`<option value="${n}" ${Number(settings.performance.maxConcurrentJobs)===n?'selected':''}>${n}</option>`).join('')}</select></label>`;
  if(globalSettingsTab==='assistants')return `
    <label>Загальний помічник<select name="generalAutonomy">${autonomyOptions(settings.assistants.generalAutonomy)}</select></label>
    <label>Помічник проєкту<select name="projectAutonomy">${autonomyOptions(settings.assistants.projectAutonomy)}</select></label>
    <label class="settings-check"><input type="checkbox" name="confirmExpensive" ${checked(settings.assistants.confirmExpensive)}> Підтверджувати дорогі генерації</label>
    <label class="settings-check"><input type="checkbox" name="keepActionLog" ${checked(settings.assistants.keepActionLog)}> Зберігати журнал дій помічників</label>`;
  return `
    <label>Пакет DaVinci<select name="packageMode"><option value="folders-manifest" ${settings.export.packageMode==='folders-manifest'?'selected':''}>Папки + manifest</option><option value="manifest-only" ${settings.export.packageMode==='manifest-only'?'selected':''}>Тільки manifest</option></select></label>
    <label>Мова за замовчуванням<select name="defaultLanguage"><option value="uk" ${settings.export.defaultLanguage==='uk'?'selected':''}>Українська</option><option value="en" ${settings.export.defaultLanguage==='en'?'selected':''}>English</option></select></label>
    <label class="settings-check"><input type="checkbox" name="includeDrafts" ${checked(settings.export.includeDrafts)}> Дозволяти чернетковий пакет із незавершеними матеріалами</label>
    <label class="settings-check"><input type="checkbox" name="verifyFiles" ${checked(settings.export.verifyFiles)}> Перевіряти файли перед експортом</label>`;
}
function autonomyOptions(current){
  return [['suggestions-only','Тільки пропозиції'],['safe-actions','Автоматичні безпечні дії'],['extended','Розширена автономність']].map(([id,title])=>`<option value="${id}" ${current===id?'selected':''}>${title}</option>`).join('');
}
function globalSettingsPanel(){
  return `<section class="global-settings-page"><div class="global-toolbar"><div><p class="eyebrow">НАЛАШТУВАННЯ</p><h3>Налаштування AI Production Studio</h3><p>Глобальні параметри не змінюють затверджені матеріали проєктів.</p></div></div>
    ${settingsTabs()}<form class="settings-form" onsubmit="saveGlobalSettings(event)">${settingsFields()}<div class="settings-actions"><span>${esc(globalSettingsNotice)}</span><button class="primary" type="submit" ${globalStudioSettings?'':'disabled'}>Зберегти</button></div></form>
  </section>`;
}
async function saveGlobalSettings(event){
  event.preventDefault();
  const form=event.currentTarget,values=Object.fromEntries(new FormData(form)),section={};
  for(const [key,value] of Object.entries(values))section[key]=value;
  for(const input of form.querySelectorAll('input[type="checkbox"]'))section[input.name]=input.checked;
  for(const input of form.querySelectorAll('input[type="number"]'))section[input.name]=Number(input.value);
  globalSettingsNotice='Збереження…';render();
  try{
    globalStudioSettings=await api('/api/studio/settings',{method:'PUT',body:JSON.stringify({[globalSettingsTab]:section})});
    globalSettingsNotice='Збережено локально.';
  }catch(error){globalSettingsNotice='Помилка: '+error.message}
  render();
}
function resetProjectWizard(){
  projectWizard={step:1,data:{name:'',type:'animated-series',defaultLanguage:'uk',additionalLanguages:['en'],targetMinutes:10,description:'',resolution:'1920x1080',aspectRatio:'16:9',fps:24,plannedEpisodes:1}};
}
function openProjectWizard(step){
  if(step===undefined)resetProjectWizard(); else projectWizard.step=step;
  const dlg=document.getElementById('modal'),form=document.getElementById('modal-form'),fields=document.getElementById('modal-fields'),title=document.getElementById('modal-title'),submit=form.querySelector('button[type="submit"]');
  dlg.classList.remove('focus-dialog','reference-dialog');title.textContent='Новий проєкт · крок '+projectWizard.step+' із 3';
  fields.innerHTML=projectWizardFields();submit.textContent=projectWizard.step<3?'Далі':'Створити проєкт';
  document.getElementById('modal-cancel').textContent=projectWizard.step>1?'Назад':'Скасувати';
  document.getElementById('modal-cancel').onclick=()=>{if(projectWizard.step>1){projectWizard.step--;openProjectWizard(projectWizard.step)}else{dlg.close();document.getElementById('modal-cancel').onclick=closeModal}};
  form.onsubmit=handleProjectWizardSubmit;dlg.showModal();
}
function projectWizardFields(){
  const d=projectWizard.data;
  if(projectWizard.step===1)return `<div class="wizard-progress"><i class="active"></i><i></i><i></i></div><p class="wizard-lead">Основне</p>
    <label>Назва проєкту<input name="name" required value="${esc(d.name)}" autofocus></label>
    <label>Тип<select name="type"><option value="animated-series" ${d.type==='animated-series'?'selected':''}>Анімаційний серіал</option><option value="general" ${d.type==='general'?'selected':''}>Універсальне відео</option><option value="science" ${d.type==='science'?'selected':''}>Наукове відео</option></select></label>
    <label>Основна мова<select name="defaultLanguage"><option value="uk" ${d.defaultLanguage==='uk'?'selected':''}>Українська</option><option value="en" ${d.defaultLanguage==='en'?'selected':''}>English</option></select></label>
    <label class="settings-check"><input type="checkbox" name="addOtherLanguage" ${d.additionalLanguages.length?'checked':''}> Додаткова друга мовна версія</label>
    <label>Опис<textarea name="description" placeholder="Короткий опис проєкту">${esc(d.description)}</textarea></label>`;
  if(projectWizard.step===2)return `<div class="wizard-progress"><i class="done"></i><i class="active"></i><i></i></div><p class="wizard-lead">Параметри виробництва</p>
    <div class="wizard-grid"><label>Роздільна здатність<select name="resolution"><option>1920x1080</option><option ${d.resolution==='3840x2160'?'selected':''}>3840x2160</option><option ${d.resolution==='1280x720'?'selected':''}>1280x720</option></select></label>
    <label>Співвідношення<select name="aspectRatio">${['16:9','9:16','1:1','4:3'].map(v=>`<option ${d.aspectRatio===v?'selected':''}>${v}</option>`).join('')}</select></label>
    <label>FPS<input name="fps" type="number" min="12" max="60" value="${esc(d.fps)}"></label>
    <label>Планова кількість епізодів<input name="plannedEpisodes" type="number" min="1" max="200" value="${esc(d.plannedEpisodes)}"></label>
    <label>Цільова тривалість, хв<input name="targetMinutes" type="number" min="1" value="${esc(d.targetMinutes)}"></label></div>
    <div class="wizard-storage"><strong>Локальне сховище</strong><span>data/projects/&lt;project-id&gt;</span><small>Програма створить окремі Project_Data, Assets, Generated, Exports і Backups.</small></div>`;
  return `<div class="wizard-progress"><i class="done"></i><i class="done"></i><i class="active"></i></div><p class="wizard-lead">Перевірка й створення</p>
    <div class="wizard-summary"><div><span>Проєкт</span><strong>${esc(d.name)}</strong></div><div><span>Тип</span><strong>${esc(label('type',d.type))}</strong></div><div><span>Мова</span><strong>${esc(d.defaultLanguage.toUpperCase())}${d.additionalLanguages.length?' + '+d.additionalLanguages.map(x=>x.toUpperCase()).join(', '):''}</strong></div><div><span>Формат</span><strong>${esc(d.resolution)} · ${esc(d.aspectRatio)} · ${esc(d.fps)} FPS</strong></div><div><span>План</span><strong>${esc(d.plannedEpisodes)} епізодів · ${esc(d.targetMinutes)} хв</strong></div></div>
    <p class="wizard-note">Будуть створені порожні структури програми. AI не створює сценарій, персонажів або медіа автоматично.</p>`;
}
async function handleProjectWizardSubmit(event){
  event.preventDefault();
  const form=event.currentTarget,fd=new FormData(form);
  if(projectWizard.step===1){
    projectWizard.data.name=String(fd.get('name')||'').trim();
    projectWizard.data.type=fd.get('type')||'general';
    projectWizard.data.defaultLanguage=fd.get('defaultLanguage')||'uk';
    projectWizard.data.additionalLanguages=fd.get('addOtherLanguage')?[projectWizard.data.defaultLanguage==='uk'?'en':'uk']:[];
    projectWizard.data.description=String(fd.get('description')||'').trim();
    projectWizard.step=2;openProjectWizard(2);return;
  }
  if(projectWizard.step===2){
    projectWizard.data.resolution=fd.get('resolution')||'1920x1080';
    projectWizard.data.aspectRatio=fd.get('aspectRatio')||'16:9';
    projectWizard.data.fps=Number(fd.get('fps'))||24;
    projectWizard.data.plannedEpisodes=Number(fd.get('plannedEpisodes'))||1;
    projectWizard.data.targetMinutes=Number(fd.get('targetMinutes'))||10;
    projectWizard.step=3;openProjectWizard(3);return;
  }
  const submit=form.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='Створення…';
  try{
    const created=await api('/api/projects',{method:'POST',body:JSON.stringify(projectWizard.data)});
    document.getElementById('modal').close();document.getElementById('modal-cancel').onclick=closeModal;view='overview';await load(created.id);
  }catch(error){submit.disabled=false;submit.textContent='Створити проєкт';window.alert(error.message)}
}

const baseGlobalPageContent=pageContent;
pageContent=function(){
  if(view==='home')return globalHomePanel();
  if(view==='projects')return globalProjectsPanel();
  if(view==='settings')return globalSettingsPanel();
  return baseGlobalPageContent();
};
const baseGlobalViewTitle=viewTitle;
viewTitle=function(){return ({home:'Головна',projects:'Проєкти',settings:'Налаштування'})[view]||baseGlobalViewTitle()};
const baseGlobalViewActions=viewActions;
viewActions=function(){if(view==='home'||view==='projects'||view==='settings')return '';return baseGlobalViewActions()};
const oldOpenProject=openProject;
openProject=function(){openProjectWizard()};
if(document.getElementById('new-project'))document.getElementById('new-project').onclick=openProjectWizard;
setTimeout(()=>refreshGlobalStudioSettings().then(()=>render()),0);
