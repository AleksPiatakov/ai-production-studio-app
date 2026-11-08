const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStudio, defaultModelRegistry, defaultModelCatalog, updateModelProfiles, probeStudioModel, updateStudioSettings, createProjectAssistantAction, decideProjectAssistantAction, createGenerationJob, transitionGenerationJob, retryGenerationJob, cancelGenerationJob, createAssetVersion, registerWorker, claimGenerationJob, workerJobUpdate, registerWorkerOutputs } = require('../server/production-studio');

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


test('project assistant changes remain proposals until explicitly accepted', () => {
  const data = normalizeStudio({ projects: [{ id:'p-ai', description:'Old', workflow:[{id:'script',note:'Before'}] }] });
  const project = data.projects[0];
  const action = createProjectAssistantAction(project,{kind:'project-description',summary:'Clarify project',after:'New'});
  assert.equal(action.status,'proposed');
  project.assistantWorkspace.actions.push(action);
  assert.equal(project.description,'Old');
  const accepted = decideProjectAssistantAction(project,action.id,'accept');
  assert.equal(accepted.status,'accepted');
  assert.equal(project.description,'New');
});

test('project assistant rejects stale proposals instead of overwriting newer edits', () => {
  const data = normalizeStudio({ projects: [{ id:'p-stale', description:'Original', workflow:[{id:'script',note:'Before'}] }] });
  const project = data.projects[0];
  const action = createProjectAssistantAction(project,{kind:'project-description',summary:'Change description',after:'AI proposal'});
  project.assistantWorkspace.actions.push(action);
  project.description='Human edit';
  assert.throws(()=>decideProjectAssistantAction(project,action.id,'accept'),/stale/);
  assert.equal(project.description,'Human edit');
  assert.equal(action.status,'proposed');
});

test('rejected assistant proposals do not mutate project data', () => {
  const data = normalizeStudio({ projects: [{ id:'p-reject', description:'Keep', workflow:[{id:'script',note:'Before'}] }] });
  const project = data.projects[0];
  const action = createProjectAssistantAction(project,{kind:'workflow-note',targetId:'script',summary:'Rewrite note',after:'After'});
  project.assistantWorkspace.actions.push(action);
  decideProjectAssistantAction(project,action.id,'reject','Not now');
  assert.equal(project.workflow[0].note,'Before');
  assert.equal(action.status,'rejected');
});


test('generation jobs keep an append-only event history across transitions', () => {
  const models = defaultModelRegistry();
  const job = createGenerationJob({ projectId:'p-1', type:'voice', modelId:'macos-tts', prompt:'hello' }, models);
  assert.equal(job.events.length,1);
  assert.equal(job.events[0].status,'queued');
  const paused = transitionGenerationJob(job,'paused','Paused by user');
  assert.equal(paused.events.length,2);
  assert.equal(paused.events[1].status,'paused');
  const resumed = transitionGenerationJob(paused,'queued','Resume');
  assert.equal(resumed.events.length,3);
  assert.equal(resumed.events[2].message,'Resume');
});

test('retry creates a new attempt instead of rewriting failed history', () => {
  const models = defaultModelRegistry();
  const original = { ...createGenerationJob({ projectId:'p-1', type:'voice', modelId:'macos-tts', prompt:'hello' }, models), status:'failed', error:'boom' };
  const retry = retryGenerationJob(original, models);
  assert.notEqual(retry.id, original.id);
  assert.equal(retry.retryOf, original.id);
  assert.equal(retry.attempt, 2);
  assert.match(retry.events[0].message,/Повторна спроба #2/);
  assert.equal(original.status,'failed');
});

test('safe cancellation preserves job history and prevents later transition', () => {
  const models = defaultModelRegistry();
  const queued = createGenerationJob({ projectId:'p-1', type:'voice', modelId:'macos-tts' }, models);
  const cancelled = cancelGenerationJob(queued,'Cancelled by user');
  assert.equal(cancelled.status,'cancelled');
  assert.equal(cancelled.events.at(-1).status,'cancelled');
  assert.throws(()=>transitionGenerationJob(cancelled,'completed'),/cannot transition|completed or cancelled/);
});

test('registered worker outputs report result asset ids back to the queue', () => {
  const project={assets:[],assetVersions:[]};
  const registered=registerWorkerOutputs(project,{id:'job-output-12345678',projectId:'p-1',type:'image',modelId:'gpu-worker',status:'completed',prompt:'x',outputs:[{kind:'image',uri:'asset://x.png',checksum:'sha256:x'}]});
  assert.equal(registered.outputAssetIds.length,1);
  assert.equal(registered.outputAssetIds[0],registered.assets[0].id);
});
