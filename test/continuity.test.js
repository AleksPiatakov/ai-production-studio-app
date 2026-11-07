const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectContinuity } = require('../server/continuity');

test('reports when a scene does not use its linked character reference', () => {
  const report = inspectContinuity({
    bibles: { characters: [{ id: 'luma', name: 'Лума' }] },
    assets: [{ id: 'luma-rig', linkedCharacterId: 'luma', status: 'approved' }],
    scenes: [{ id: 'scene-1', title: 'Початок', characterIds: ['luma'], shots: [{ referenceAssetIds: [] }] }]
  });
  assert.equal(report.issues[0].code, 'CHARACTER_REFERENCE_NOT_USED');
});

test('passes continuity when linked approved character asset is used by a shot', () => {
  const report = inspectContinuity({
    bibles: { characters: [{ id: 'luma', name: 'Лума' }] },
    assets: [{ id: 'luma-rig', linkedCharacterId: 'luma', status: 'approved' }],
    scenes: [{ id: 'scene-1', title: 'Початок', characterIds: ['luma'], shots: [{ referenceAssetIds: ['luma-rig'] }] }]
  });
  assert.equal(report.issues.length, 0);
});
