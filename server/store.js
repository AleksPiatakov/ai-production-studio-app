const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { seed } = require('../shared/seed');
const { defaultProfile, defaultWorkflow } = require('../shared/schema');
const { normalizeStudio } = require('./production-studio');
const { syncAllProjectPackages } = require('./project-storage');

function createStore(file = path.join(process.cwd(), 'data', 'studio.json')) {
  const snapshot = project => { const copy = JSON.parse(JSON.stringify(project)); delete copy.versionHistory; return copy; };
  const sameSnapshot = (left, right) => JSON.stringify(snapshot(left)) === JSON.stringify(snapshot(right));
  function read() {
    if (!fs.existsSync(file)) { fs.mkdirSync(path.dirname(file), { recursive: true }); write(seed()); }
    const data = normalizeStudio(JSON.parse(fs.readFileSync(file, 'utf8')));
    for (const project of data.projects || []) {
      project.profile = { ...defaultProfile(), ...(project.profile || {}) };
      project.scripts = Array.isArray(project.scripts) ? project.scripts : [];
      project.episodes = Array.isArray(project.episodes) ? project.episodes : [];
      project.voiceProfiles = Array.isArray(project.voiceProfiles) ? project.voiceProfiles : [];
      project.localizations = Array.isArray(project.localizations) ? project.localizations : [];
      project.renderJobs = Array.isArray(project.renderJobs) ? project.renderJobs : [];
      project.versionHistory = Array.isArray(project.versionHistory) ? project.versionHistory : [];
      const previous = new Map((project.workflow || []).map(stage => [stage.id, stage]));
      project.workflow = defaultWorkflow().map(stage => ({ ...stage, ...(previous.get(stage.id) || {}) }));
    }
    return data;
  }
  function write(value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
    // JSON remains the canonical source during the safe SQLite migration.
    // Each package has a queryable SQLite index and a portable JSON manifest.
    syncAllProjectPackages(normalizeStudio(value), file);
  }
  function update(mutator, options = {}) {
    const data = read();
    const before = new Map((data.projects || []).map(project => [project.id, snapshot(project)]));
    mutator(data);
    const historyLimit = Math.max(5, Math.min(100, Number(data.studio?.settings?.files?.versionHistoryLimit) || 30));
    if (!options.noSnapshot) for (const project of data.projects || []) {
      const previous = before.get(project.id);
      if (previous && !sameSnapshot(previous, project)) {
        const history = Array.isArray(project.versionHistory) ? project.versionHistory : [];
        history.push({ id: randomUUID(), createdAt: new Date().toISOString(), label: 'Автоматично збережено перед зміною', snapshot: previous });
        project.versionHistory = history.slice(-historyLimit);
      }
    }
    write(data); return data;
  }
  return { read, write, update };
}
module.exports = { createStore };
