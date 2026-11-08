const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validateAssetInput}=require('../server/validation');
const {defaultModelRegistry,createGenerationJob,registerWorkerOutputs,updateModelProfiles}=require('../server/production-studio');

test('sound assets keep scene link and non-destructive edit instructions',()=>{
  const asset=validateAssetInput({
    type:'ambient',scope:'scene',linkedSceneId:'scene-1',label:'Лісова атмосфера',uri:'asset://ambient.wav',
    audioEdit:{trimStart:1.2,trimEnd:18.5,fadeIn:.8,fadeOut:1.5,volume:.85},status:'draft'
  });
  assert.equal(asset.type,'ambient');
  assert.equal(asset.linkedSceneId,'scene-1');
  assert.deepEqual(asset.audioEdit,{trimStart:1.2,trimEnd:18.5,fadeIn:.8,fadeOut:1.5,volume:.85});
  assert.throws(()=>validateAssetInput({type:'music',label:'Bad',uri:'asset://x.wav',audioEdit:{volume:3}}),/audioEdit.volume/);
});

test('sound generation jobs preserve variant parameters and scene context',()=>{
  const model={id:'sound-worker',name:'Sound worker',capability:'music-sfx',status:'running'};
  const job=createGenerationJob({
    projectId:'p-1',type:'ambient',modelId:model.id,prompt:'нічний ліс',
    parameters:{durationSeconds:30,variantIndex:2,variantCount:3},context:{sceneId:'scene-1'}
  },[model]);
  assert.equal(job.status,'queued');
  assert.equal(job.parameters.variantIndex,2);
  assert.equal(job.context.sceneId,'scene-1');
});

test('completed ambient output becomes a linked draft sound asset without overwriting approval',()=>{
  const project={assets:[],assetVersions:[]};
  const registered=registerWorkerOutputs(project,{
    id:'job-ambient-12345678',projectId:'p-1',type:'ambient',modelId:'sound-worker',status:'completed',
    prompt:'forest',context:{sceneId:'scene-1'},outputs:[{kind:'ambient',uri:'asset://forest.wav',checksum:'sha256:a'}]
  });
  assert.equal(registered.assets[0].type,'ambient');
  assert.equal(registered.assets[0].linkedSceneId,'scene-1');
  assert.equal(registered.assets[0].scope,'scene');
  assert.equal(registered.assets[0].status,'draft');
  assert.equal(registered.assets[0].audioEdit.volume,1);
});

test('model profiles support atmosphere separately from music and SFX',()=>{
  const model={id:'sound-worker',name:'Sound worker',capability:'music-sfx',status:'connected'};
  const profiles=updateModelProfiles({}, {music:model.id,ambient:model.id,sfx:model.id}, [model]);
  assert.equal(profiles.music,model.id);
  assert.equal(profiles.ambient,model.id);
  assert.equal(profiles.sfx,model.id);
});

test('Sound & Music UI is a simple project module, not a multitrack editor',()=>{
  const js=fs.readFileSync(path.join(__dirname,'..','public','sound-music-studio.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'..','public','global-studio-pages.css'),'utf8');
  const rail=fs.readFileSync(path.join(__dirname,'..','public','approved-editor-shell.js'),'utf8');
  assert.match(js,/Музика/);
  assert.match(js,/Атмосфера/);
  assert.match(js,/SFX/);
  assert.match(js,/queueSoundVariants/);
  assert.match(js,/openSoundAssetEditor/);
  assert.match(js,/Оригінальний аудіофайл не перезаписується/);
  assert.doesNotMatch(js,/multitrack|timeline/i);
  assert.match(css,/\.sound-workspace/);
  assert.match(rail,/\['sound','♫','Звук і музика'\]/);
});
