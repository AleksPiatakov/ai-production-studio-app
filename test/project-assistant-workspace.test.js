const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const { projectTemplate }=require('../shared/schema');
const { createProjectAssistantAction, decideProjectAssistantAction }=require('../server/production-studio');

test('Project AI Assistant memory is isolated per project',()=>{
  const a=projectTemplate({id:'p-a',name:'A',type:'general',defaultLanguage:'uk',targetMinutes:5});
  const b=projectTemplate({id:'p-b',name:'B',type:'general',defaultLanguage:'uk',targetMinutes:5});
  a.assistantWorkspace.memory.push({id:'m1',role:'user',text:'hello'});
  assert.equal(a.assistantWorkspace.scope,'project-only');
  assert.equal(a.assistantWorkspace.memory.length,1);
  assert.equal(b.assistantWorkspace.memory.length,0);
});

test('Project AI Assistant changes stay proposed until explicit P-13 decision',()=>{
  const project=projectTemplate({id:'p-a',name:'A',type:'general',defaultLanguage:'uk',targetMinutes:5,description:'Before'});
  const action=createProjectAssistantAction(project,{kind:'project-description',summary:'Update description',after:'After'});
  project.assistantWorkspace.actions.push(action);
  assert.equal(project.description,'Before');
  assert.equal(action.status,'proposed');
  decideProjectAssistantAction(project,action.id,'accept');
  assert.equal(project.description,'After');
  assert.equal(action.status,'accepted');
});

test('project assistant API persists memory and supports clearing it',()=>{
  const server=fs.readFileSync(path.join(__dirname,'../server/index.js'),'utf8');
  assert.match(server,/target\.assistantWorkspace\.memory = \[\.\.\.\(target\.assistantWorkspace\.memory \|\| \[\]\), userMessage, assistantMessage\]\.slice\(-100\)/);
  assert.match(server,/req\.method === 'DELETE'.*parts\[4\] === 'messages'/s);
  assert.match(server,/target\.assistantWorkspace\.memory = \[\]/);
});


test('P-13 decision note is retained in assistant audit history',()=>{
  const project=projectTemplate({id:'p-note',name:'Note',type:'general',defaultLanguage:'uk',targetMinutes:5,description:'Before'});
  const action=createProjectAssistantAction(project,{kind:'project-description',summary:'Update',after:'After'});
  project.assistantWorkspace.actions.push(action);
  decideProjectAssistantAction(project,action.id,'reject','Потрібне додаткове узгодження');
  assert.equal(action.status,'rejected');
  assert.equal(action.decisionNote,'Потрібне додаткове узгодження');
});


test('P-12 document cards expose edit and delete actions',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
  assert.match(ui,/advisor-document-open/);
  assert.match(ui,/advisor-document-delete/);
  assert.match(ui,/deleteAdvisorDocument/);
  assert.match(ui,/assistant\/documents\/\$\{encodeURIComponent\(id\)\}.*method:'DELETE'/s);
});


test('P-13 accepted action exposes its exact rollback snapshot',()=>{
  const server=fs.readFileSync(path.join(__dirname,'../server/index.js'),'utf8');
  const ui=fs.readFileSync(path.join(__dirname,'../public/assistant-workspaces.js'),'utf8');
  assert.match(server,/rollbackVersionId=rollbackVersion\.id/);
  assert.match(server,/rollbackVersionCreatedAt=rollbackVersion\.createdAt/);
  assert.match(server,/parts\[6\] === 'rollback'/);
  assert.match(server,/rollbackLog/);
  assert.match(server,/status:'rolled-back'/);
  assert.match(server,/rollbackAuditId:audit\.id/);
  assert.match(ui,/rollbackAssistantChange/);
  assert.match(ui,/assistant\/actions\/\$\{encodeURIComponent\(id\)\}\/rollback/);
  assert.match(ui,/action\.rollbackVersionId/);
  assert.match(ui,/Відкотити цю зміну/);
});


test('P-12 stores autonomy per project and keeps critical actions gated',()=>{
  const server=fs.readFileSync(path.join(__dirname,'../server/index.js'),'utf8');
  const ui=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
  assert.match(server,/assistant' && parts\[4\] === 'autonomy'/);
  assert.match(server,/suggestions-only','safe-actions','extended/);
  assert.match(server,/target\.assistantWorkspace\.autonomy=autonomy/);
  assert.match(server,/noSnapshot: true/);
  assert.match(ui,/setProjectAssistantAutonomy/);
  assert.match(ui,/Безпечні внутрішні дії/);
  assert.match(ui,/критичні зміни, видалення, дорогі генерації та зовнішня передача все одно потребують підтвердження/);
  assert.match(ui,/assistant\/autonomy/);
});


test('Pages preview mirrors P-12 project autonomy controls',()=>{
  const preview=fs.readFileSync(path.join(__dirname,'../preview/index.html'),'utf8');
  assert.match(preview,/advisor-autonomy/);
  assert.match(preview,/Тільки пропозиції/);
  assert.match(preview,/Безпечні внутрішні дії/);
  assert.match(preview,/Розширена/);
  assert.match(preview,/Критичні зміни, видалення, дорогі генерації та зовнішня передача потребують підтвердження/);
});
