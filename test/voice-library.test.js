const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validateVoiceProfileInput}=require('../server/validation');
const root=path.resolve(__dirname,'..');

function baseVoice(extra={}){
  return {
    name:'Test voice',identityKey:'voice-test',ageBand:'adult',languages:['uk'],
    engine:'Local test',provider:'local',providerVoiceId:'',modelId:'',license:'Test license',
    generationSettings:{},status:'draft',...extra
  };
}

test('authorized cloned voice requires explicit rights confirmation',()=>{
  assert.throws(()=>validateVoiceProfileInput(baseVoice({voiceOrigin:'authorized-clone',rightsConfirmed:false})),/rightsConfirmed/);
  const voice=validateVoiceProfileInput(baseVoice({voiceOrigin:'authorized-clone',rightsConfirmed:true,rightsNote:'Written consent',sampleAssetIds:['audio-1']}));
  assert.equal(voice.voiceOrigin,'authorized-clone');
  assert.equal(voice.rightsConfirmed,true);
  assert.equal(voice.rightsNote,'Written consent');
  assert.deepEqual(voice.sampleAssetIds,['audio-1']);
});

test('ordinary library and system voices do not require clone consent',()=>{
  const local=validateVoiceProfileInput(baseVoice({voiceOrigin:'system'}));
  assert.equal(local.rightsConfirmed,false);
  const licensed=validateVoiceProfileInput(baseVoice({provider:'elevenlabs',providerVoiceId:'voice-123',voiceOrigin:'licensed-library'}));
  assert.equal(licensed.voiceOrigin,'licensed-library');
});

test('Voice Library exposes filters compare assignment and rights metadata',()=>{
  const ui=fs.readFileSync(path.join(root,'public','voice-library.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'public','global-studio-pages.css'),'utf8');
  const rail=fs.readFileSync(path.join(root,'public','approved-editor-shell.js'),'utf8');
  assert.match(ui,/voiceLibraryQuery/);
  assert.match(ui,/voiceLibraryProvider/);
  assert.match(ui,/voiceLibraryLanguage/);
  assert.match(ui,/voiceLibraryAge/);
  assert.match(ui,/voiceLibraryStatus/);
  assert.match(ui,/voiceComparePanel/);
  assert.match(ui,/openVoiceAssignment/);
  assert.match(ui,/Авторизований клон/);
  assert.match(ui,/не створює клон голосу/);
  assert.match(css,/\.voice-library-grid/);
  assert.match(rail,/\['voiceLibrary','◉','Бібліотека голосів'\]/);
});

test('server protects voice assignment and sample isolation',()=>{
  const server=fs.readFileSync(path.join(root,'server','index.js'),'utf8');
  assert.match(server,/sampleAssetIds must reference audio assets in this project/);
  assert.match(server,/voiceProfileId: existing\.id/);
  assert.match(server,/voice profile is already assigned to another character/);
  assert.match(server,/retired voice profile cannot be assigned/);
  assert.doesNotMatch(server,/approved voice profile cannot be reassigned/);
});
