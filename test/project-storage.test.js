const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { projectCreationPreflight, syncProjectPackage, migrateJsonToSqlite } = require('../server/project-storage');

test('creates a portable project package and queryable SQLite index', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-production-storage-'));
  const project = { id: 'project_1', name: 'Test project', assets: [{ id: 'asset_1', label: 'Keyframe' }], assetVersions: [{ id: 'asset_version_1', assetId: 'asset_1' }], episodes: [], scenes: [], scripts: [], voiceProfiles: [], productions: [], renderJobs: [], bibles: { characters: [], style: [] } };
  const layout = syncProjectPackage(project, dataDirectory);
  assert.ok(fs.existsSync(layout.manifest));
  assert.ok(fs.existsSync(layout.database));
  assert.ok(fs.existsSync(path.join(layout.root, 'Assets', 'Video')));
  const db = new DatabaseSync(layout.database);
  try { assert.equal(db.prepare("SELECT COUNT(*) AS count FROM entity_index WHERE kind = 'asset-version'").get().count, 1); } finally { db.close(); }
});

test('dry-runs a JSON to SQLite migration without changing the canonical JSON store', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-production-migration-'));
  const source = path.join(directory, 'studio.json');
  const data = { projects: [{ id: 'project_1', name: 'Test project', assets: [{ id: 'asset_1', projectId: 'project_1' }], assetVersions: [{ id: 'asset_version_1', assetId: 'asset_1' }], episodes: [], scenes: [], scripts: [], voiceProfiles: [], productions: [], renderJobs: [], bibles: { characters: [], style: [] } }] };
  fs.writeFileSync(source, JSON.stringify(data, null, 2));
  const before = fs.readFileSync(source, 'utf8');
  const report = migrateJsonToSqlite(source);
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.backup, null);
  assert.equal(report.projects[0].verified, true);
  assert.equal(report.projects[0].entities.total, 3);
  assert.equal(fs.readFileSync(source, 'utf8'), before);
  assert.equal(fs.existsSync(path.join(directory, 'projects')), false);
});

test('applies a JSON to SQLite migration with an immutable source backup', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-production-migration-'));
  const source = path.join(directory, 'studio.json');
  fs.writeFileSync(source, JSON.stringify({ projects: [{ id: 'project_1', name: 'Test project', assets: [], assetVersions: [], episodes: [], scenes: [], scripts: [], voiceProfiles: [], productions: [], renderJobs: [], bibles: { characters: [], style: [] } }] }, null, 2));
  const before = fs.readFileSync(source, 'utf8');
  const report = migrateJsonToSqlite(source, { apply: true });
  assert.equal(report.mode, 'apply');
  assert.ok(report.backup);
  assert.equal(fs.readFileSync(report.backup, 'utf8'), before);
  assert.equal(fs.readFileSync(source, 'utf8'), before);
  assert.ok(fs.existsSync(path.join(directory, 'projects', 'project_1', 'Project_Data', 'project.sqlite')));
});


test('new-project storage preflight reports writability, free space and required package folders', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-production-preflight-'));
  const report = projectCreationPreflight(directory);
  assert.equal(report.ok, true);
  assert.equal(report.writable, true);
  assert.ok(report.projectsRoot.endsWith(path.join('projects')));
  assert.ok(report.requiredDirectories.includes('Project_Data'));
  assert.ok(report.requiredDirectories.includes('Assets/Video'));
  assert.ok(report.requiredDirectories.includes('Backups'));
  assert.ok(report.freeBytes === null || report.freeBytes > 0);
});
