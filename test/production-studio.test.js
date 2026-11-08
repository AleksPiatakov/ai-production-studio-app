const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStudio, defaultModelRegistry, defaultModelCatalog, updateModelProfiles, probeStudioModel, updateStudioSettings, createGenerationJob, transitionGenerationJob, createAssetVersion, registerWorker, claimGenerationJob, workerJobUpdate, registerWorkerOutputs } = require('../server/production-studio');

test('migrates existing projects to the production-studio architecture without losing their data', () => {
  const data = normalizeStudio({ projects: [{ id: 'p-1', name: 'Existing project', assets: [{ id: 'a-1' }] }] });
  assert.equal(data.projects[0].assets[0].id, 'a-1');
  assert.equal(data.projects[0].assistantWorkspace.scope, 'project-only');
  assert.equal(data.projects[0].storage.root, 'data/projects/p-1');
  assert.ok(data.studio.modelRegistry.length >= 4);
});

test('records work as queued or blocked and never pretends a disconnected worker ran it', () => {
  const models = defaultModelRegistry();
  const blocked = createGenerationJob({ projectId: 'p-1', type: 'video', modelId: 'gpu-worker' }, models);
  assert.equal(blocked.status, 'blocked');
  assert.match(blocked.note, /лише після підключення/);
  const queued = createGenerationJob({ projectId: 'p-1', type: 'voice', modelId: 'macos-tts' }, models);
  assert.equal(queued.status, 'queued');
  assert.equal(transitionGenerationJob(queued, 'preparing').status, 'preparing');
});

test('adds a new asset version instead of overwriting the approved asset', () => {
  const asset = { id: 'asset-1', uri: '/assets/approved.png', currentVersionId: 'v-approved', status: 'approved' };
  const version = createAssetVersion(asset, { source: 'generation', prompt: 'new lighting' });
  assert.equal(asset.currentVersionId, 'v-approved');
  assert.equal(version.status, 'draft');
  assert.equal(version.parentVersionId, 'v-approved');
});

test('only a compatible worker can claim a queued job and report its result', () => {
  const worker = registerWorker({ name: 'Render node A', capabilities: ['video'], runtime: 'Linux + CUDA' });
  const job = { id: 'job-1', type: 'video', status: 'queued', priority: 'normal', note: '' };
  const claimed = claimGenerationJob(job, worker);
  assert.equal(claimed.status, 'preparing');
  assert.equal(claimed.executor.workerId, worker.id);
  const running = workerJobUpdate(claimed, worker, { status: 'running' });
  const completed = workerJobUpdate(running, worker, { status: 'completed', outputs: [{ kind: 'video', uri: 'asset://clip.mp4', checksum: 'abc' }] });
  assert.equal(completed.outputs[0].uri, 'asset://clip.mp4');
  assert.throws(() => workerJobUpdate(claimed, { id: 'another-worker' }, { status: 'running' }), /not assigned/);
});

test('registers a completed worker result as a draft asset and a separate draft version', () => {
  const project = { assets: [], assetVersions: [] };
  const registered = registerWorkerOutputs(project, { id: 'job-12345678', projectId: 'p-1', type: 'image', modelId: 'gpu-worker', status: 'completed', prompt: 'soft light', outputs: [{ kind: 'image', uri: 'asset://image.png', checksum: 'sha256:x' }] });
  assert.equal(registered.assets[0].status, 'draft');
  assert.equal(registered.versions[0].status, 'draft');
  assert.equal(registered.versions[0].parentVersionId, null);
});


test('normalizes and updates five persistent studio settings sections', () => {
  const data = normalizeStudio({ projects: [] });
  assert.equal(data.studio.settings.general.startView, 'overview');
  assert.equal(data.studio.settings.files.versionHistoryLimit, 30);
  const next = updateStudioSettings(data.studio.settings, {
    general: { startView: 'projects' },
    files: { versionHistoryLimit: 48 },
    assistants: { projectAutonomy: 'safe-actions' },
    export: { includeDrafts: true }
  });
  assert.equal(next.general.startView, 'projects');
  assert.equal(next.files.versionHistoryLimit, 48);
  assert.equal(next.assistants.projectAutonomy, 'safe-actions');
  assert.equal(next.export.includeDrafts, true);
  assert.equal(next.performance.maxConcurrentJobs, 1);
});

test('normalizes production settings for pre-existing projects', () => {
  const data = normalizeStudio({ projects: [{ id: 'p-old' }] });
  assert.deepEqual(data.projects[0].productionSettings, { resolution: '1920x1080', aspectRatio: '16:9', fps: 24, plannedEpisodes: 1 });
});


test('model center catalog and profiles keep task compatibility explicit', () => {
  const models = defaultModelRegistry();
  const catalog = defaultModelCatalog();
  assert.ok(catalog.some(item => item.id === 'piper' && item.installMode === 'manual-local'));
  const profiles = updateModelProfiles({}, { planning: 'local-planner', voice: 'macos-tts', image: 'gpu-worker' }, models);
  assert.equal(profiles.planning, 'local-planner');
  assert.equal(profiles.image, 'gpu-worker');
  assert.throws(() => updateModelProfiles(profiles, { voice: 'gpu-worker' }, models), /does not support voice/);
});

test('model readiness probe reports runtime facts without pretending inference ran', () => {
  const models = defaultModelRegistry();
  assert.equal(probeStudioModel(models.find(m => m.id === 'local-planner'), {}).ok, true);
  assert.equal(probeStudioModel(models.find(m => m.id === 'piper'), { piperReady: false }).ok, false);
  assert.equal(probeStudioModel(models.find(m => m.id === 'piper'), { piperReady: true }).ok, true);
  assert.equal(probeStudioModel(models.find(m => m.id === 'gpu-worker'), { onlineWorkers: 0 }).ok, false);
  assert.equal(probeStudioModel(models.find(m => m.id === 'gpu-worker'), { onlineWorkers: 1 }).ok, true);
});


test('connected and running model states remain distinct from execution readiness', () => {
  const models = defaultModelRegistry();
  const connected = { ...models.find(model => model.id === 'gpu-worker'), status: 'connected' };
  const running = { ...connected, status: 'running' };
  assert.equal(require('../server/production-studio').publicModel(connected).configured, true);
  assert.equal(createGenerationJob({ projectId: 'p-1', type: 'video', modelId: connected.id }, [connected]).status, 'blocked');
  assert.equal(createGenerationJob({ projectId: 'p-1', type: 'video', modelId: running.id }, [running]).status, 'queued');
});
