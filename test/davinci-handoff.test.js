const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDaVinciHandoff, buildDaVinciPackage, packageManifestJson, handoffMarkdown, handoffTimelineCsv } = require('../server/davinci-handoff');

test('builds a DaVinci handoff without treating draft material as production-ready', () => {
  const project = {
    id: 'project-1', name: 'Тест', defaultLanguage: 'uk',
    assets: [{ id: 'frame', label: 'Ключовий кадр', uri: '/assets/test-animatic/luma-prelude-draft-v1.png', status: 'draft', type: 'image' }],
    localizations: [{ language: 'uk', status: 'in-progress', subtitlesUri: '/assets/test-animatic/subtitles-uk.srt' }],
    scenes: [{
      id: 'scene-1', episodeId: 'episode-1', order: 1, title: 'Сцена', durationSeconds: 12,
      shots: [{ seconds: 12, status: 'draft', camera: 'wide', imagePrompt: 'Кадр', keyImageAssetId: 'frame', referenceAssetIds: ['frame'] }],
      dialogue: [{ textUk: 'Репліка', textEn: 'Line', estimatedSeconds: 2, status: 'draft' }]
    }]
  };
  const handoff = buildDaVinciHandoff(project, { id: 'episode-1', title: 'Випуск', status: 'development', targetMinutes: 1 });
  const markdown = handoffMarkdown(handoff);
  assert.equal(handoff.kind, 'davinci-resolve-handoff-draft');
  assert.equal(handoff.clips.length, 1);
  assert.match(handoff.clips[0].keyImage.filePath, /luma-prelude-draft-v1\.png$/);
  assert.equal(handoff.sources.localizations[0].language, 'uk');
  assert.ok(handoff.blockers.some(item => item.includes('Репліки ще не затверджені')));
  assert.match(markdown, /Монтажний лист для DaVinci Resolve — чернетка/);
  assert.match(markdown, /Ключовий кадр/);
  const csv = handoffTimelineCsv(handoff);
  assert.match(csv, /timeline_start/);
  assert.match(csv, /00:00:00:00/);
  assert.match(csv, /luma-prelude-draft-v1\.png/);
});


test('draft DaVinci package is exportable with warnings while final is blocked until ready', () => {
  const project = {
    id: 'project-package', name: 'Package Test', defaultLanguage: 'uk', productionSettings: { fps: 25 },
    assets: [],
    localizations: [],
    scenes: [{
      id: 'scene-package', episodeId: 'episode-package', order: 1, title: 'Scene', durationSeconds: 5,
      shots: [{ id: 'shot-package', seconds: 5, status: 'draft', camera: 'wide', keyImageAssetId: '', referenceAssetIds: [] }],
      dialogue: []
    }]
  };
  const episode = { id: 'episode-package', title: 'Episode', status: 'development', targetMinutes: 1 };
  const draft = buildDaVinciPackage(project, episode, 'draft');
  const final = buildDaVinciPackage(project, episode, 'final');
  assert.equal(draft.mode, 'draft');
  assert.equal(draft.canExport, true);
  assert.equal(draft.finalReady, false);
  assert.equal(final.mode, 'final');
  assert.equal(final.canExport, false);
  assert.ok(final.issues.some(item => item.includes('Випуск не має затвердженого')));
  assert.ok(final.issues.some(item => item.includes('відеокліп')));
  assert.equal(draft.folders.Edit_Data[0].destination, 'Edit_Data/timeline.csv');
  assert.equal(draft.folders.Manifest[0].destination, 'Manifest/package-manifest.json');
  const manifest = JSON.parse(packageManifestJson(draft));
  assert.equal(manifest.kind, 'davinci-package-plan');
  assert.ok(manifest.files.some(file => file.destination === 'Manifest/package-manifest.json'));
});

test('timeline prefers generated video clip when a shot has one', () => {
  const project = {
    id: 'p-video', name: 'Video Package', defaultLanguage: 'uk',
    assets: [
      { id: 'key', label: 'Key', type: 'image', uri: '/assets/test-animatic/luma-prelude-draft-v1.png', status: 'approved' },
      { id: 'clip', label: 'Clip', type: 'video', uri: '/assets/test-animatic/luma-prelude-draft-v1.png', status: 'approved', linkedShotId: 'shot-1' }
    ],
    localizations: [],
    scenes: [{ id:'scene-1',episodeId:'episode-1',order:1,title:'S',durationSeconds:4,shots:[{id:'shot-1',seconds:4,status:'approved',camera:'wide',keyImageAssetId:'key',referenceAssetIds:[]}],dialogue:[] }]
  };
  const handoff=buildDaVinciHandoff(project,{id:'episode-1',title:'E',status:'approved',targetMinutes:1});
  assert.equal(handoff.clips[0].videoClip.id,'clip');
  const csv=handoffTimelineCsv(handoff,24);
  assert.match(csv,/luma-prelude-draft-v1\.png/);
});


test('DaVinci manifest includes checksum field for package files', () => {
  const { packageManifestJson } = require('../server/davinci-handoff');
  const plan = {
    schemaVersion:1,kind:'davinci-package-plan',mode:'draft',generatedAt:new Date().toISOString(),
    project:{id:'p1',name:'Demo'},episode:{id:'e1',title:'Episode'},canExport:true,finalReady:true,issues:[],
    folders:{Video:[{destination:'Video/a.mov',sourcePath:'/tmp/a.mov',exists:true,virtual:false,status:'approved',kind:'video',checksum:'abc123'}]}
  };
  const manifest=JSON.parse(packageManifestJson(plan));
  assert.equal(manifest.files[0].checksum,'abc123');
});


test('DaVinci handoff blocks stale approved shots and assets',()=>{
  const project={
    id:'p-stale',name:'Stale Package',defaultLanguage:'uk',
    assets:[
      {id:'key',label:'Key',type:'image',uri:'/assets/test-animatic/luma-prelude-draft-v1.png',status:'approved',dependencyStatus:'needs-review'},
      {id:'clip',label:'Clip',type:'video',uri:'/assets/test-animatic/luma-prelude-draft-v1.png',status:'approved',dependencyStatus:'needs-review',linkedSceneId:'scene-1',linkedShotId:'shot-1'}
    ],
    localizations:[],
    scenes:[{id:'scene-1',episodeId:'episode-1',order:1,title:'S',durationSeconds:4,shots:[{id:'shot-1',seconds:4,status:'approved',dependencyStatus:'needs-review',camera:'wide',keyImageAssetId:'key',referenceAssetIds:[]}],dialogue:[]}]
  };
  const episode={id:'episode-1',title:'E',status:'approved',targetMinutes:1};
  const handoff=buildDaVinciHandoff(project,episode);
  assert.ok(handoff.blockers.some(item=>item.includes('шотів потребує повторної перевірки')));
  assert.ok(handoff.blockers.some(item=>item.includes('ключових кадрів потребує повторної перевірки')));
  assert.ok(handoff.blockers.some(item=>item.includes('відеокліпів потребує повторної перевірки')));
  const final=buildDaVinciPackage(project,episode,'final');
  assert.equal(final.canExport,false);
});
