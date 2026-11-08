const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const pages=fs.readFileSync(path.join(root,'public/global-studio-pages.js'),'utf8');
const rail=fs.readFileSync(path.join(root,'public/approved-editor-shell.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/global-studio-pages.css'),'utf8');

test('global program pages are wired into the approved shell',()=>{
  assert.match(html,/global-studio-pages\.css/);
  assert.match(html,/global-studio-pages\.js/);
  for(const route of ['home','projects','settings']) assert.match(rail,new RegExp("\\['"+route+"'"));
  assert.match(pages,/globalHomePanel/);
  assert.match(pages,/globalProjectsPanel/);
  assert.match(pages,/globalSettingsPanel/);
});

test('new project uses a real three-step wizard and local projects API',()=>{
  assert.match(pages,/крок '\+projectWizard\.step\+' із 3/);
  assert.match(pages,/projectWizard\.step===1/);
  assert.match(pages,/projectWizard\.step===2/);
  assert.match(pages,/api\('\/api\/projects'/);
  assert.match(pages,/AI не створює сценарій/);
});

test('settings expose five approved tabs without adding a second navigation system',()=>{
  for(const label of ['Загальні','Файли та сховище','Продуктивність','AI Помічники','Експорт'])assert.match(pages,new RegExp(label));
  assert.match(pages,/\/api\/studio\/settings/);
  assert.match(css,/\.settings-tabs/);
});


test('generation queue is global and can filter or target a project',()=>{
  const studio=fs.readFileSync(path.join(root,'public/production-studio-ui.js'),'utf8');
  assert.match(studio,/studioQueueProjectFilter/);
  assert.match(studio,/Усі проєкти/);
  assert.match(studio,/name="projectId"/);
  assert.match(studio,/setStudioQueueProjectFilter/);
  assert.doesNotMatch(studio,/const current = productionStudioState\.jobs\.filter\(job => job\.projectId === activeId\)/);
});

test('internal G screen identifiers are not shown in program page markup',()=>{
  assert.doesNotMatch(pages,/>G-0[1289]/);
});


test('model center separates my models catalog profiles archive and probes readiness',()=>{
  const studio=fs.readFileSync(path.join(root,'public/production-studio-ui.js'),'utf8');
  for(const tab of ['mine','catalog','profiles','archive'])assert.match(studio,new RegExp("setModelCenterTab\\('"+tab+"'\\)"));
  assert.match(studio,/\/api\/studio\/model-catalog/);
  assert.match(studio,/\/api\/studio\/model-profiles/);
  assert.match(studio,/\/probe/);
  assert.match(studio,/Перевірити готовність/);
  assert.match(studio,/БЕЗ УДАВАНОГО ВСТАНОВЛЕННЯ/);
});


test('global assistant has isolated server history and no automatic project context',()=>{
  const ui=fs.readFileSync(path.join(root,'public','assistant-workspaces.js'),'utf8');
  assert.match(ui,/\/api\/studio\/general-assistant/);
  assert.match(ui,/projectAccess/);
  assert.match(ui,/Проєктні файли, сценарії, медіа та пам’ять проєктів не передаються автоматично/);
  assert.match(ui,/local-planner/);
});

test('project AI changes render a two-column diff and require explicit decisions',()=>{
  const ui=fs.readFileSync(path.join(root,'public','assistant-workspaces.js'),'utf8');
  assert.match(ui,/assistant-diff/);
  assert.match(ui,/Прийняти цю зміну/);
  assert.match(ui,/Відхилити/);
  assert.match(ui,/assistant\/actions/);
  assert.match(ui,/decision/);
  assert.match(css,/\.assistant-diff/);
});


test('approved project rail exposes project assistant and AI change review separately',()=>{
  assert.match(rail,/\['advisor','✧','AI Помічник проєкту'\]/);
  assert.match(rail,/\['assistantChanges','≠','Зміни AI'\]/);
});
