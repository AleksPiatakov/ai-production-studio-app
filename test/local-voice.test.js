const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { safeSegment } = require('../server/local-voice');

test('uses a safe local path segment for generated audio', () => {
  assert.equal(safeSegment('scene_1-line-2'), 'scene_1-line-2');
  assert.equal(safeSegment('../scene id'), 'sceneid');
  assert.throws(() => safeSegment('...'), /Invalid audio output identifier/);
});


test('P-07 voice takes keep reproducibility metadata',()=>{
  const server=fs.readFileSync(path.join(__dirname,'..','server','index.js'),'utf8');
  const ui=fs.readFileSync(path.join(__dirname,'..','public','p07-voice-takes.js'),'utf8');
  assert.match(server,/voiceProfileId: profile\?\.id \|\| ''/);
  assert.match(server,/voiceProvider:/);
  assert.match(server,/providerVoiceId:/);
  assert.match(server,/modelId:/);
  assert.match(server,/generationSettings: settings/);
  assert.match(ui,/Профіль:/);
  assert.match(ui,/модель:/);
});


test('P-07 Pages preview shows reproducibility metadata without real voice IDs',()=>{
  const preview=fs.readFileSync(path.join(__dirname,'..','preview','index.html'),'utf8');
  assert.match(preview,/metadata demo/);
  assert.match(preview,/preview-only engine/);
  assert.match(preview,/Профіль: demo-profile · модель: system-demo/);
  assert.match(preview,/Settings: synthetic metadata · без реального voice ID/);
});
