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
