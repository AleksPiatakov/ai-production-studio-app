const test = require('node:test');
const assert = require('node:assert/strict');
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
