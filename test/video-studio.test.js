const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validateAssetInput}=require('../server/validation');
const {createGenerationJob,registerWorkerOutputs}=require('../server/production-studio');

test('video assets preserve scene and shot links',()=>{
  const asset=validateAssetInput({type:'video',scope:'shot',linkedSceneId:'scene-1',linkedShotId:'shot-1',label:'Clip 1',uri:'asset://clip.mov',status:'draft'});
  assert.equal(asset.linkedSceneId,'scene-1');
  assert.equal(asset.linkedShotId,'shot-1');
});

test('video generation keeps input keyframes, duration and shot context',()=>{
  const model={id:'video-worker',name:'Video worker',capability:'video',status:'running'};
  const job=createGenerationJob({projectId:'p-1',type:'video',modelId:model.id,prompt:'slow camera move',inputAssetIds:['img-1'],parameters:{durationSeconds:5,variantIndex:1,variantCount:2,camera:'medium'},context:{sceneId:'scene-1',shotId:'shot-1'}},[model]);
  assert.equal(job.status,'queued');
  assert.deepEqual(job.inputAssetIds,['img-1']);
  assert.equal(job.parameters.durationSeconds,5);
  assert.equal(job.context.shotId,'shot-1');
});

test('completed video output registers as a draft linked to the source shot',()=>{
  const project={assets:[],assetVersions:[]};
  const out=registerWorkerOutputs(project,{id:'job-video-12345678',projectId:'p-1',type:'video',modelId:'video-worker',status:'completed',prompt:'motion',context:{sceneId:'scene-1',shotId:'shot-1'},outputs:[{kind:'video',uri:'asset://clip.mov',checksum:'sha256:v'}]});
  assert.equal(out.assets[0].type,'video');
  assert.equal(out.assets[0].scope,'shot');
  assert.equal(out.assets[0].linkedSceneId,'scene-1');
  assert.equal(out.assets[0].linkedShotId,'shot-1');
  assert.equal(out.assets[0].status,'draft');
});

test('Video Studio creates separate clips and a simple animatic without final editor controls',()=>{
  const js=fs.readFileSync(path.join(__dirname,'..','public','video-studio.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'..','public','global-studio-pages.css'),'utf8');
  const dashboard=fs.readFileSync(path.join(__dirname,'..','public','project-dashboard.js'),'utf8');
  const rail=fs.readFileSync(path.join(__dirname,'..','public','approved-editor-shell.js'),'utf8');
  assert.match(js,/queueVideoVariants/);
  assert.match(js,/videoStudioAnimatic/);
  assert.match(js,/Затвердити кліп/);
  assert.match(js,/DaVinci Resolve/);
  assert.doesNotMatch(js,/<(?:section|div|nav)[^>]+(?:multitrack|editing-timeline|color-grading)/i);
  assert.match(css,/\.video-studio-grid/);
  assert.match(dashboard,/view:'videoStudio'/);
  assert.match(rail,/\['videoStudio','▶','Video Studio'\]/);
  assert.match(rail,/\['preview','✓','Перевірка готовності'\]/);
});


test('P-10 requires a keyframe before queuing video variants',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','public','video-studio.js'),'utf8');
  assert.match(ui,/models\.length&&key/);
  assert.match(ui,/Спочатку додайте ключовий кадр/);
  assert.match(ui,/const key=shotKeyImage\(shot\);if\(!key\)/);
});
