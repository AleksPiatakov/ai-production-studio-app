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

test('new project uses a real three-step wizard with storage preflight and verified package creation',()=>{
  assert.match(pages,/крок '\+projectWizard\.step\+' із 3/);
  assert.match(pages,/projectWizard\.step===1/);
  assert.match(pages,/projectWizard\.step===2/);
  assert.ok(pages.includes('/api/projects/preflight'));
  assert.ok(pages.includes("api('/api/projects'"));
  assert.match(pages,/storageVerified/);
  assert.match(pages,/workspaceMode='guided'/);
  assert.match(pages,/AI не створює сценарій/);
  assert.match(css,/\.wizard-storage-status/);
  assert.match(css,/\.wizard-directory-list/);
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
  assert.match(studio,/МАЙСТЕР МОДЕЛІ/);
  assert.match(studio,/Зберегти конфігурацію/);
  assert.match(studio,/Перевірити готовність зараз/);
  assert.match(studio,/Жодної автоматичної інсталяції/);
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


test('generation queue exposes status filter event logs retry cancel and result navigation',()=>{
  const studio=fs.readFileSync(path.join(root,'public/production-studio-ui.js'),'utf8');
  assert.match(studio,/studioQueueStatusFilter/);
  assert.match(studio,/queueJobCard/);
  assert.match(studio,/queue-events/);
  assert.match(studio,/retryStudioJob/);
  assert.match(studio,/cancelStudioJob/);
  assert.match(studio,/openQueueJobResult/);
  assert.match(studio,/\/retry/);
  assert.match(studio,/\/cancel/);
});


test('model setup persists configuration separately from readiness probes',()=>{
  const studio=fs.readFileSync(path.join(root,'public','production-studio-ui.js'),'utf8');
  const server=fs.readFileSync(path.join(root,'server','index.js'),'utf8');
  assert.ok(studio.includes("view === 'modelSetup'"));
  assert.ok(studio.includes('model-readiness-grid'));
  assert.ok(studio.includes('executionTarget'));
  assert.ok(studio.includes('/setup'));
  assert.ok(server.includes("parts[4] === 'setup'"));
  assert.ok(server.includes('item.lastProbe'));
  assert.ok(server.includes('hasPiperVoice()'));
  assert.ok(server.includes('onlineWorkers'));
});


test('new project API preflights storage and verifies manifest and SQLite package',()=>{
  const server=fs.readFileSync(path.join(root,'server','index.js'),'utf8');
  assert.ok(server.includes("url.pathname === '/api/projects/preflight'"));
  assert.ok(server.includes('projectCreationPreflight'));
  assert.ok(server.includes('verifyProjectPackage'));
  assert.ok(server.includes('storageVerified'));
});


test('storage keys migrate from the legacy product prefix',()=>{
  const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
  assert.match(app,/APS_STORAGE_PREFIX='ai-production-studio:'/);
  assert.match(app,/APS_LEGACY_STORAGE_PREFIX='ai-video-studio:'/);
  assert.match(app,/localStorage\.getItem\(nextKey\)===null/);
  assert.match(app,/localStorage\.setItem\(nextKey,localStorage\.getItem\(legacyKey\)\)/);
  assert.doesNotMatch(app,/localStorage\.setItem\('ai-video-studio:/);
});


test('P-04 storyboard cards show duration camera and status',()=>{
  const ui=fs.readFileSync(path.join(root,'public','p04-approved-storyboard.js'),'utf8');
  assert.match(ui,/item\.seconds/);
  assert.match(ui,/item\.camera/);
  assert.match(ui,/p04-shot-status/);
  assert.match(ui,/item\.status/);
});


test('P-06 image variants create real generation jobs',()=>{
  const ui=fs.readFileSync(path.join(root,'public','image-studio-integration.js'),'utf8');
  assert.match(ui,/for\(let n=1;n<=variantCount;n\+\+\)await api\('\/api\/studio\/generation-jobs'/);
  assert.match(ui,/type:'image'/);
  assert.match(ui,/variantIndex:n,variantCount/);
  assert.match(ui,/context:\{sceneId:scene\.id,shotId:shot\.id\}/);
  assert.match(ui,/inputAssetIds/);
});

test('P-05 shot workspace exposes emotion and model readiness',()=>{
  const ui=fs.readFileSync(path.join(root,'public','shot-workspace-p05.js'),'utf8');
  assert.match(ui,/Емоція/);
  assert.match(ui,/shot\?\.emotion/);
  assert.match(ui,/imageModel\?'<span class="p05-no-model ready"/);
  assert.match(ui,/Модель не підключена · генерація вимкнена/);
  assert.match(ui,/data-p05-route="imageStudio"/);
});


test('P-02 scene and AI columns collapse independently',()=>{
  const ui=fs.readFileSync(path.join(root,'public','script-editor-p02.js'),'utf8');
  assert.match(ui,/data-p02-toggle-scenes/);
  assert.match(ui,/data-p02-toggle-ai/);
  assert.match(ui,/scenesCollapsed/);
  assert.match(ui,/aiCollapsed/);
  assert.match(ui,/ai-production-studio:p02-scenes-collapsed/);
  assert.match(ui,/ai-production-studio:p02-ai-collapsed/);
  assert.match(ui,/scenes-collapsed/);
  assert.match(ui,/ai-collapsed/);
});


test('Pages preview mirrors P-04 statuses and P-12 document actions',()=>{
  const preview=fs.readFileSync(path.join(root,'preview','index.html'),'utf8');
  assert.match(preview,/p04-shot-status/);
  assert.match(preview,/advisor-document-card/);
  assert.match(preview,/advisor-document-open/);
  assert.match(preview,/advisor-document-delete/);
});


test('Pages preview mirrors P-02 independent side-panel controls',()=>{
  const preview=fs.readFileSync(path.join(root,'preview','index.html'),'utf8');
  const demo=fs.readFileSync(path.join(root,'preview','script-editor-demo.js'),'utf8');
  assert.match(preview,/id="demo-toggle-scenes"/);
  assert.match(preview,/id="demo-toggle-ai"/);
  assert.match(demo,/scenesCollapsed/);
  assert.match(demo,/aiCollapsed/);
  assert.match(demo,/scenes-collapsed/);
  assert.match(demo,/ai-collapsed/);
});


test('G-03 supports real engine choice and collapsible global context',()=>{
  const ui=fs.readFileSync(path.join(root,'public','assistant-workspaces.js'),'utf8');
  const server=fs.readFileSync(path.join(root,'server','index.js'),'utf8');
  const assistant=fs.readFileSync(path.join(root,'server','assistant.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'public','global-studio-pages.css'),'utf8');
  assert.match(ui,/setGlobalAssistantEngine/);
  assert.match(ui,/toggleGlobalAssistantContext/);
  assert.match(ui,/g03-engine-preference/);
  assert.match(ui,/g03-context-collapsed/);
  assert.match(ui,/enginePreference:globalAssistantState\.enginePreference/);
  assert.match(server,/enginePreference: input\.enginePreference/);
  assert.match(assistant,/enginePreference = 'auto'/);
  assert.match(assistant,/local-planner/);
  assert.match(assistant,/configured/);
  assert.match(css,/global-ai-layout\.context-collapsed/);
});
