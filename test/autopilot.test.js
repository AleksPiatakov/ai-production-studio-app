const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAutopilotBlueprint } = require('../server/autopilot');

const project = {
  bibles: {
    characters: [
      { id: 'luma', name: 'Лума', status: 'approved', ageBand: 'teen', identityKey: 'luma-test-v1' },
      { id: 'draft-character', name: 'Чернетка', status: 'draft' }
    ],
    style: [{ id: 'warm-3d', status: 'approved', rules: 'теплий 3D-анімаційний світ, м’яке вечірнє світло' }]
  }
};

test('autopilot creates an editable draft with scenes and one shot per scene', () => {
  const plan = buildAutopilotBlueprint(project, { brief: 'Лума допомагає другу знайти світло', targetMinutes: 1, motionMode: 'selected-shots' });
  assert.equal(plan.scenes.length, 3);
  assert.equal(plan.scenes.reduce((total, scene) => total + scene.durationSeconds, 0), 60);
  assert.equal(plan.scenes.every(scene => scene.status === 'draft' && scene.shots.length === 1), true);
  assert.deepEqual(plan.scenes[0].characterIds, ['luma']);
  assert.match(plan.scenes[0].shots[0].motionPrompt, /Кандидат на оживлення/);
  assert.equal(plan.scenes.every(scene => scene.dialogue.length === 1), true);
  assert.equal(plan.scenes[0].dialogue[0].textUk, 'Тихіше… Що це було?');
  assert.doesNotMatch(plan.scenes[0].shots[0].imagePrompt, /Лума допомагає другу знайти світло/);
  assert.notEqual(plan.scenes[0].shots[0].imagePrompt, plan.scenes[1].shots[0].imagePrompt);
  assert.match(plan.script.body, /ручного затвердження/);
});

test('autopilot rejects an empty idea and limits duration to a practical draft', () => {
  assert.throws(() => buildAutopilotBlueprint(project, { brief: '  ' }), /Опишіть/);
  const plan = buildAutopilotBlueprint(project, { brief: 'Коротка історія', targetMinutes: 99 });
  assert.equal(plan.targetMinutes, 20);
  assert.equal(plan.scenes.reduce((total, scene) => total + scene.durationSeconds, 0), 1200);
});
