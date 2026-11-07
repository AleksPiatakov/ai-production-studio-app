const test = require('node:test');
const assert = require('node:assert/strict');
const { safeSegment } = require('../server/local-voice');

test('uses a safe local path segment for generated audio', () => {
  assert.equal(safeSegment('scene_1-line-2'), 'scene_1-line-2');
  assert.equal(safeSegment('../scene id'), 'sceneid');
  assert.throws(() => safeSegment('...'), /Invalid audio output identifier/);
});
