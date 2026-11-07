const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAssistantContext, localScriptDraft } = require('../server/assistant');

test('assistant context keeps project facts and local draft remains explicitly unapproved', () => {
  const project = {
    name: 'Demo', type: 'animated-series', defaultLanguage: 'uk', targetMinutes: 1,
    profile: { tone: 'теплий пригодницький' },
    episodes: [{ id: 'episode-1', title: 'Перший вогник', targetMinutes: 1, status: 'development' }],
    bibles: { characters: [{ name: 'Лума', role: 'герой', rules: 'добра', status: 'approved' }], style: [{ name: 'Світ', rules: 'м’яке світло', status: 'approved' }] },
    scenes: [{ id: 'scene-1', episodeId: 'episode-1', title: 'Зав’язка', purpose: 'Показати вибір', durationSeconds: 12, status: 'draft', shots: [{}], dialogue: [] }],
    scripts: [{ title: 'Наявний сценарій', body: 'Лума бачить згаслий ліхтарик.', status: 'in-review' }],
    assets: [{ label: 'Розкадрування', type: 'reference', scope: 'style', status: 'draft', uri: '/assets/storyboards/test.png' }]
  };
  const context = buildAssistantContext(project, 'episode-1');
  const draft = localScriptDraft(context, 'створи маленьку передісторію, як Лума дізналася про згаслий вогник');
  assert.equal(context.episode.title, 'Перший вогник');
  assert.equal(context.scenes.length, 1);
  assert.equal(context.existingScripts[0].body, 'Лума бачить згаслий ліхтарик.');
  assert.equal(context.visualReferences[0].label, 'Розкадрування');
  assert.match(draft.body, /ЧЕРНЕТКА/);
  assert.match(draft.body, /Лума/);
  assert.match(draft.body, /Нова передісторія/);
});
