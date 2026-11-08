const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

function safeProjectId(id) {
  const value = String(id || '');
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error('invalid project storage id');
  return value;
}
function projectCreationPreflight(dataDirectory) {
  const root = path.resolve(dataDirectory);
  const projectsRoot = path.join(root, 'projects');
  let probeTarget = fs.existsSync(projectsRoot) ? projectsRoot : root;
  while (!fs.existsSync(probeTarget)) {
    const parent = path.dirname(probeTarget);
    if (parent === probeTarget) break;
    probeTarget = parent;
  }
  let writable = false, error = '';
  try {
    fs.accessSync(probeTarget, fs.constants.W_OK);
    writable = true;
  } catch (cause) {
    error = cause.message;
  }
  let freeBytes = null;
  try {
    const stats = fs.statfsSync(probeTarget);
    freeBytes = Number(stats.bavail) * Number(stats.bsize);
  } catch {}
  return {
    ok: writable,
    dataDirectory: root,
    projectsRoot,
    projectsRootExists: fs.existsSync(projectsRoot),
    checkedDirectory: probeTarget,
    writable,
    freeBytes,
    requiredDirectories: ['Project_Data','Scripts','Character_Bible','Style_Bible','Storyboards','Assets/Images','Assets/Video','Assets/Voices','Assets/Music','Assets/SFX','Generated','Exports','Backups'],
    error: writable ? '' : error || 'Project storage is not writable.'
  };
}

function projectLayout(dataDirectory, id) {
  const root = path.join(dataDirectory, 'projects', safeProjectId(id));
  return {
    root,
    manifest: path.join(root, 'Project_Data', 'project.json'),
    database: path.join(root, 'Project_Data', 'project.sqlite'),
    directories: [
      path.join(root, 'Project_Data'), path.join(root, 'Scripts'), path.join(root, 'Character_Bible'), path.join(root, 'Style_Bible'), path.join(root, 'Storyboards'),
      path.join(root, 'Assets', 'Images'), path.join(root, 'Assets', 'Video'), path.join(root, 'Assets', 'Voices'), path.join(root, 'Assets', 'Music'), path.join(root, 'Assets', 'SFX'),
      path.join(root, 'Generated'), path.join(root, 'Exports'), path.join(root, 'Backups')
    ]
  };
}
function entities(project) {
  const records = [{ id: project.id, kind: 'project', parentId: null, payload: project }];
  const add = (kind, items, parentKey) => (items || []).forEach(item => records.push({ id: item.id, kind, parentId: item[parentKey] || project.id, payload: item }));
  add('episode', project.episodes, 'projectId'); add('scene', project.scenes, 'episodeId'); add('script', project.scripts, 'episodeId');
  add('asset', project.assets, 'projectId'); add('asset-version', project.assetVersions, 'assetId'); add('voice-profile', project.voiceProfiles, 'projectId');
  add('production-manifest', project.productions, 'sceneId'); add('render-job', project.renderJobs, 'sceneId');
  add('character', project.bibles?.characters, 'projectId'); add('style-profile', project.bibles?.style, 'projectId');
  return records;
}
function summarizeEntities(project) {
  const records = entities(project);
  const ids = new Set();
  const kinds = {};
  const softDeletedOrphans = [];
  for (const record of records) {
    if (!record.id) throw new Error(`missing ${record.kind} id in project ${project.id}`);
    if (ids.has(record.id)) throw new Error(`duplicate entity id ${record.id} in project ${project.id}`);
    ids.add(record.id);
    kinds[record.kind] = (kinds[record.kind] || 0) + 1;
  }
  for (const record of records.filter(record => record.parentId)) {
    if (!ids.has(record.parentId)) {
      if (record.payload?.deletedAt) softDeletedOrphans.push({ id: record.id, kind: record.kind, parentId: record.parentId, deletedAt: record.payload.deletedAt });
      else throw new Error(`unresolved parent ${record.parentId} for ${record.kind} ${record.id} in project ${project.id}`);
    }
  }
  return { total: records.length, kinds, softDeletedOrphans };
}
function syncSqlite(project, file) {
  const db = new DatabaseSync(file);
  try {
    db.exec(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS entity_index (id TEXT PRIMARY KEY, kind TEXT NOT NULL, parent_id TEXT, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS entity_index_kind_parent ON entity_index(kind, parent_id);`);
    const meta = db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
    const clear = db.prepare('DELETE FROM entity_index');
    const insert = db.prepare('INSERT INTO entity_index (id, kind, parent_id, payload_json, updated_at) VALUES (?, ?, ?, ?, ?)');
    clear.run();
    const now = new Date().toISOString();
    for (const entity of entities(project)) insert.run(entity.id, entity.kind, entity.parentId, JSON.stringify(entity.payload), now);
    meta.run('schema_version', '1'); meta.run('project_id', project.id); meta.run('synced_at', now); meta.run('canonical_store', 'data/studio.json');
  } finally { db.close(); }
}
function syncProjectPackage(project, dataDirectory) {
  const layout = projectLayout(dataDirectory, project.id);
  for (const directory of layout.directories) fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(layout.manifest, JSON.stringify({ schemaVersion: 1, projectId: project.id, exportedAt: new Date().toISOString(), project }, null, 2));
  syncSqlite(project, layout.database);
  return layout;
}
function syncAllProjectPackages(data, storeFile) {
  const dataDirectory = path.dirname(storeFile);
  return (data.projects || []).map(project => syncProjectPackage(project, dataDirectory));
}
function verifyProjectPackage(project, layout) {
  const expected = summarizeEntities(project);
  const db = new DatabaseSync(layout.database, { readOnly: true });
  try {
    const total = db.prepare('SELECT COUNT(*) AS count FROM entity_index').get().count;
    const rows = db.prepare('SELECT kind, COUNT(*) AS count FROM entity_index GROUP BY kind').all();
    const kinds = Object.fromEntries(rows.map(row => [row.kind, row.count]));
    const metadata = Object.fromEntries(db.prepare('SELECT key, value FROM metadata').all().map(row => [row.key, row.value]));
    if (total !== expected.total) throw new Error(`SQLite count mismatch for project ${project.id}: expected ${expected.total}, got ${total}`);
    const kindsMatch = Object.keys(expected.kinds).length === Object.keys(kinds).length && Object.entries(expected.kinds).every(([kind, count]) => kinds[kind] === count);
    if (!kindsMatch) throw new Error(`SQLite entity kinds mismatch for project ${project.id}`);
    if (metadata.project_id !== project.id || metadata.schema_version !== '1') throw new Error(`SQLite metadata mismatch for project ${project.id}`);
    return { projectId: project.id, verified: true, entities: expected, database: layout.database, manifest: layout.manifest };
  } finally { db.close(); }
}
function checksum(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function migrationBackupPath(sourceFile) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${sourceFile}.before-sqlite-migration-${stamp}.bak`;
}
function migrateJsonToSqlite(sourceFile, options = {}) {
  const apply = options.apply === true;
  const resolvedSource = path.resolve(sourceFile);
  if (!fs.existsSync(resolvedSource)) throw new Error(`source store not found: ${resolvedSource}`);
  const data = JSON.parse(fs.readFileSync(resolvedSource, 'utf8'));
  if (!Array.isArray(data.projects)) throw new Error('source store must contain a projects array');
  const projectIds = new Set();
  for (const project of data.projects) {
    if (!project?.id) throw new Error('project id is required for migration');
    if (projectIds.has(project.id)) throw new Error(`duplicate project id ${project.id}`);
    projectIds.add(project.id);
    summarizeEntities(project);
  }
  const temporaryDirectory = apply ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'ai-production-studio-migration-'));
  const targetStore = apply ? resolvedSource : path.join(temporaryDirectory, 'studio.json');
  let backup = null;
  try {
    if (apply) {
      backup = migrationBackupPath(resolvedSource);
      fs.copyFileSync(resolvedSource, backup, fs.constants.COPYFILE_EXCL);
    } else {
      fs.writeFileSync(targetStore, JSON.stringify(data, null, 2));
    }
    const layouts = syncAllProjectPackages(data, targetStore);
    const projects = data.projects.map((project, index) => verifyProjectPackage(project, layouts[index]));
    return { mode: apply ? 'apply' : 'dry-run', source: resolvedSource, sourceSha256: checksum(resolvedSource), backup, projects };
  } finally {
    if (temporaryDirectory) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}
module.exports = { projectCreationPreflight, projectLayout, syncProjectPackage, syncAllProjectPackages, summarizeEntities, verifyProjectPackage, migrateJsonToSqlite };
