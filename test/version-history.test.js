const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../server/store');

test('keeps the previous project state automatically before an update', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-video-studio-history-'));
  const file = path.join(directory, 'studio.json');
  const store = createStore(file);
  store.write({ version: 1, projects: [{ id: 'project-1', name: 'До зміни', workflow: [], profile: {}, scripts: [], episodes: [], voiceProfiles: [], localizations: [], renderJobs: [], assets: [], scenes: [], bibles: { style: [], characters: [] } }] });
  store.update(data => { data.projects[0].name = 'Після зміни'; });
  const project = store.read().projects[0];
  assert.equal(project.name, 'Після зміни');
  assert.equal(project.versionHistory.length, 1);
  assert.equal(project.versionHistory[0].snapshot.name, 'До зміни');
  assert.equal(project.versionHistory[0].snapshot.versionHistory, undefined);
});
