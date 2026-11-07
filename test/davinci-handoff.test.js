const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDaVinciHandoff, handoffMarkdown, handoffTimelineCsv } = require('../server/davinci-handoff');

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
