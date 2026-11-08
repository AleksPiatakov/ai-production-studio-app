/* G-03 Global AI Assistant + P-13 project AI change review.
   Global chat never receives project data automatically.
   Project changes remain typed proposals until explicit accept/reject. */
let globalAssistantState={history:[],configuration:null,busy:false,error:''};
let projectAssistantActions=[];
let projectAssistantActionsBusy=false;
let projectAssistantActionsError='';
let assistantChangesFilter='proposed';

async function refreshGlobalAssistant(){
  try{
    const state=await api('/api/studio/general-assistant');
    globalAssistantState.history=state.history||[];
    globalAssistantState.configuration=state.configuration||null;
    globalAssistantState.error='';
  }catch(error){globalAssistantState.error=error.message}
}
function globalAssistantMessage(item){
  const assistant=item.role==='assistant';
  return `<article class="global-ai-message ${assistant?'assistant':'user'}"><header><span>${assistant?'AI':'Ви'}</span><time>${item.createdAt?esc(new Date(item.createdAt).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'})):''}</time></header><p>${esc(assistant?item.answer:item.text)}</p>${assistant&&item.nextSteps?.length?`<div class="global-ai-next"><strong>Можливі наступні кроки</strong>${item.nextSteps.map(step=>`<span>${esc(step)}</span>`).join('')}</div>`:''}</article>`;
}
function globalAssistantPanel(){
  const cfg=globalAssistantState.configuration,configured=Boolean(cfg?.configured||cfg?.engine==='local-planner'),history=globalAssistantState.history||[];
  return `<section class="global-ai-page">
    <header class="global-ai-head"><div><p class="eyebrow">ЗАГАЛЬНИЙ AI ПОМІЧНИК</p><h3>Робочий чат студії</h3><p>Працює поза проєктами. Проєктні файли, сценарії, медіа та пам’ять проєктів не передаються автоматично.</p></div><div class="global-ai-model"><span>${configured?(cfg?.engine==='local-planner'?'● Локальний режим':'● Підключено'):'○ Не підключено'}</span><strong>${esc(cfg?.model||(cfg?.engine==='local-planner'?'Local Planner':cfg?.engine)||'Текстова модель не налаштована')}</strong></div></header>
    <div class="global-ai-layout">
      <aside class="global-ai-info"><div class="global-ai-info-card safe"><span>КОНТЕКСТ</span><strong>Глобальна зона</strong><p>Налаштування програми, моделі, черга та загальні виробничі питання.</p></div><div class="global-ai-info-card blocked"><span>ДОСТУП ДО ПРОЄКТІВ</span><strong>Відсутній</strong><p>Щоб працювати з конкретним проєктом, відкрийте його проєктний AI-помічник.</p></div><button type="button" onclick="goToView('projects')">Відкрити проєкти →</button></aside>
      <section class="global-ai-chat"><div id="global-ai-thread" class="global-ai-thread" aria-live="polite">${history.length?history.map(globalAssistantMessage).join(''):'<div class="global-ai-empty"><span>✧</span><strong>Окрема глобальна розмова</strong><p>Запитайте про роботу студії, AI-моделі, чергу, налаштування або загальний виробничий процес.</p></div>'}</div>
        <form class="global-ai-composer" onsubmit="askGlobalAssistant(event)"><textarea id="global-ai-question" required placeholder="Напишіть питання…" ${configured?'':'disabled'}></textarea><div><small>${configured?'Проєктні дані не додаються до запиту.':'Підключіть текстову модель, щоб активувати чат.'}</small><div><button type="button" onclick="clearGlobalAssistant()" ${history.length?'':'disabled'}>Очистити</button><button class="primary" type="submit" ${configured&&!globalAssistantState.busy?'':'disabled'}>${globalAssistantState.busy?'Відповідає…':'Надіслати'}</button></div></div></form>${globalAssistantState.error?`<p class="assistant-error">${esc(globalAssistantState.error)}</p>`:''}
      </section>
    </div>
  </section>`;
}
async function askGlobalAssistant(event){
  event.preventDefault();const field=document.getElementById('global-ai-question'),message=field?.value.trim();
  if(!message||globalAssistantState.busy)return;
  globalAssistantState.busy=true;globalAssistantState.error='';render();
  try{
    const result=await api('/api/studio/general-assistant/messages',{method:'POST',body:JSON.stringify({message})});
    globalAssistantState.history.push(...(result.messages||[]));field.value='';
  }catch(error){globalAssistantState.error=error.message}
  finally{globalAssistantState.busy=false;render();setTimeout(()=>document.getElementById('global-ai-thread')?.scrollTo({top:999999,behavior:'smooth'}),0)}
}
async function clearGlobalAssistant(){
  if(!globalAssistantState.history.length)return;
  if(!window.confirm('Очистити історію Загального AI Помічника? Проєктні дані це не зачіпає.'))return;
  try{await api('/api/studio/general-assistant/messages',{method:'DELETE'});globalAssistantState.history=[];globalAssistantState.error='';render()}catch(error){globalAssistantState.error=error.message;render()}
}

async function refreshProjectAssistantActions(){
  if(!activeId)return;
  projectAssistantActionsBusy=true;projectAssistantActionsError='';
  try{projectAssistantActions=await api(`/api/projects/${encodeURIComponent(activeId)}/assistant/actions`)}
  catch(error){projectAssistantActionsError=error.message}
  finally{projectAssistantActionsBusy=false}
}
function assistantActionTarget(action){
  if(action.kind==='project-description')return 'Опис проєкту';
  if(action.kind==='workflow-note')return 'Нотатка етапу · '+(active.workflow?.find(item=>item.id===action.targetId)?.id||action.targetId);
  return action.targetType||'Зміна';
}
function assistantDiffText(value){return String(value??'')||'—'}
function assistantChangeCard(action){
  return `<article class="assistant-change-card ${esc(action.status)}"><header><div><span class="assistant-change-kind">${esc(assistantActionTarget(action))}</span><strong>${esc(action.summary)}</strong></div><span class="tag">${esc(({proposed:'очікує рішення',accepted:'прийнято',rejected:'відхилено'})[action.status]||action.status)}</span></header><div class="assistant-diff"><section class="before"><span>ДО</span><pre>${esc(assistantDiffText(action.before))}</pre></section><section class="after"><span>ПІСЛЯ</span><pre>${esc(assistantDiffText(action.after))}</pre></section></div><footer><small>${esc(new Date(action.createdAt).toLocaleString('uk-UA'))}${action.decidedAt?' · рішення '+esc(new Date(action.decidedAt).toLocaleString('uk-UA')):''}</small>${action.status==='proposed'?'<div><button type="button" onclick="decideAssistantChange(\''+esc(action.id)+'\',\'reject\')">Відхилити</button><button class="primary" type="button" onclick="decideAssistantChange(\''+esc(action.id)+'\',\'accept\')">Прийняти цю зміну</button></div>':''}</footer></article>`;
}
function assistantChangesPanel(){
  const counts={proposed:projectAssistantActions.filter(x=>x.status==='proposed').length,accepted:projectAssistantActions.filter(x=>x.status==='accepted').length,rejected:projectAssistantActions.filter(x=>x.status==='rejected').length};
  const visible=assistantChangesFilter==='all'?projectAssistantActions:projectAssistantActions.filter(item=>item.status===assistantChangesFilter);
  return `<section class="assistant-changes-page"><header class="assistant-changes-head"><div><p class="eyebrow">ПЕРЕГЛЯД ЗМІН AI</p><h3>Кожна зміна — окреме рішення</h3><p>Пропозиції не змінюють проєкт самі. Прийнята зміна проходить через Application Core і створює версію проєкту для відкату.</p></div><button type="button" onclick="openAssistantChangeDraft()">＋ Підготувати пропозицію</button></header>
    <div class="assistant-change-filters"><button class="${assistantChangesFilter==='proposed'?'active':''}" onclick="setAssistantChangesFilter('proposed')">Очікують · ${counts.proposed}</button><button class="${assistantChangesFilter==='accepted'?'active':''}" onclick="setAssistantChangesFilter('accepted')">Прийнято · ${counts.accepted}</button><button class="${assistantChangesFilter==='rejected'?'active':''}" onclick="setAssistantChangesFilter('rejected')">Відхилено · ${counts.rejected}</button><button class="${assistantChangesFilter==='all'?'active':''}" onclick="setAssistantChangesFilter('all')">Усі · ${projectAssistantActions.length}</button></div>
    ${projectAssistantActionsBusy?'<div class="global-empty">Завантаження змін…</div>':projectAssistantActionsError?`<p class="assistant-error">${esc(projectAssistantActionsError)}</p>`:`<div class="assistant-change-list">${visible.length?visible.map(assistantChangeCard).join(''):'<p class="global-empty">У цьому розділі змін немає.</p>'}</div>`}
    <p class="assistant-change-rule">Якщо ціль була змінена після створення пропозиції, прийняття блокується як конфлікт. AI не має прямого запису в БД.</p>
  </section>`;
}
function setAssistantChangesFilter(value){assistantChangesFilter=value;render()}
function openAssistantChangeDraft(){
  const workflow=active.workflow||[];
  modal('Підготувати зміну для перегляду',`<p class="muted">Це створює лише пропозицію. Проєкт не зміниться, доки ви окремо не натиснете «Прийняти».</p><label>Тип зміни<select name="kind" onchange="toggleAssistantChangeTarget(this.value)"><option value="project-description">Опис проєкту</option><option value="workflow-note">Нотатка виробничого етапу</option></select></label><label id="assistant-change-stage" hidden>Етап<select name="targetId">${workflow.map(stage=>`<option value="${esc(stage.id)}">${esc(label('workflow',stage.id)||stage.id)}</option>`).join('')}</select></label><label>Короткий опис зміни<input name="summary" required placeholder="Що саме пропонується змінити"></label><label>Нове значення<textarea name="after" required placeholder="Новий текст"></textarea></label>`,f=>api(`/api/projects/${encodeURIComponent(activeId)}/assistant/actions`,{method:'POST',body:JSON.stringify({kind:f.get('kind'),targetId:f.get('targetId')||'',summary:f.get('summary'),after:f.get('after')})}).then(()=>refreshProjectAssistantActions()));
}
function toggleAssistantChangeTarget(kind){const row=document.getElementById('assistant-change-stage');if(row)row.hidden=kind!=='workflow-note'}
async function decideAssistantChange(id,decision){
  const labelText=decision==='accept'?'Прийняти саме цю зміну? Буде створено версію проєкту для можливого відкату.':'Відхилити цю пропозицію?';
  if(!window.confirm(labelText))return;
  try{
    await api(`/api/projects/${encodeURIComponent(activeId)}/assistant/actions/${encodeURIComponent(id)}/decision`,{method:'POST',body:JSON.stringify({decision})});
    if(decision==='accept')await load(activeId);else{await refreshProjectAssistantActions();render()}
  }catch(error){projectAssistantActionsError=error.message;await refreshProjectAssistantActions();render()}
}

const assistantWorkspaceBasePageContent=pageContent;
pageContent=function(){
  if(view==='assistants')return globalAssistantPanel();
  if(view==='assistantChanges')return assistantChangesPanel();
  return assistantWorkspaceBasePageContent();
};
const assistantWorkspaceBaseViewTitle=viewTitle;
viewTitle=function(){return ({assistants:'Загальний AI Помічник',assistantChanges:'Зміни AI'})[view]||assistantWorkspaceBaseViewTitle()};
const assistantWorkspaceBaseViewActions=viewActions;
viewActions=function(){if(view==='assistants'||view==='assistantChanges')return '';return assistantWorkspaceBaseViewActions()};
const assistantWorkspaceBaseGoToView=goToView;
goToView=function(nextView){
  if(nextView==='assistants'){view='assistants';workspaceMode='studio';Promise.all([refreshProductionStudio?.(),refreshGlobalAssistant()]).then(render);return}
  if(nextView==='assistantChanges'){view='assistantChanges';workspaceMode='studio';refreshProjectAssistantActions().then(render);return}
  assistantWorkspaceBaseGoToView(nextView);
};
