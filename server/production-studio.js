const { randomUUID } = require('node:crypto');

const jobStates = ['queued', 'preparing', 'running', 'paused', 'completed', 'failed', 'cancelled'];
const terminalStates = new Set(['completed', 'cancelled']);

function defaultStudioSettings() {
  return {
    general: { interfaceLanguage: 'uk', startView: 'home', confirmDestructive: true },
    files: { projectRoot: 'data/projects', versionHistoryLimit: 30, verifyWrites: true },
    performance: { preferLocal: true, releaseModelsAfterTask: true, maxConcurrentJobs: 1 },
    assistants: { generalAutonomy: 'suggestions-only', projectAutonomy: 'suggestions-only', confirmExpensive: true, keepActionLog: true },
    export: { packageMode: 'folders-manifest', includeDrafts: false, defaultLanguage: 'uk', verifyFiles: true }
  };
}
function normalizeStudioSettings(value = {}) {
  const base = defaultStudioSettings();
  const next = {
    general: { ...base.general, ...(value.general || {}) },
    files: { ...base.files, ...(value.files || {}) },
    performance: { ...base.performance, ...(value.performance || {}) },
    assistants: { ...base.assistants, ...(value.assistants || {}) },
    export: { ...base.export, ...(value.export || {}) }
  };
  next.general.interfaceLanguage = next.general.interfaceLanguage === 'en' ? 'en' : 'uk';
  next.general.startView = ['home','projects','overview'].includes(next.general.startView) ? next.general.startView : 'home';
  next.general.confirmDestructive = next.general.confirmDestructive !== false;
  next.files.projectRoot = String(next.files.projectRoot || 'data/projects');
  next.files.versionHistoryLimit = Math.max(5, Math.min(100, Number(next.files.versionHistoryLimit) || 30));
  next.files.verifyWrites = next.files.verifyWrites !== false;
  next.performance.preferLocal = next.performance.preferLocal !== false;
  next.performance.releaseModelsAfterTask = next.performance.releaseModelsAfterTask !== false;
  next.performance.maxConcurrentJobs = Math.max(1, Math.min(4, Number(next.performance.maxConcurrentJobs) || 1));
  const autonomy = value => ['suggestions-only','safe-actions','extended'].includes(value) ? value : 'suggestions-only';
  next.assistants.generalAutonomy = autonomy(next.assistants.generalAutonomy);
  next.assistants.projectAutonomy = autonomy(next.assistants.projectAutonomy);
  next.assistants.confirmExpensive = next.assistants.confirmExpensive !== false;
  next.assistants.keepActionLog = next.assistants.keepActionLog !== false;
  next.export.packageMode = ['folders-manifest','manifest-only'].includes(next.export.packageMode) ? next.export.packageMode : 'folders-manifest';
  next.export.includeDrafts = next.export.includeDrafts === true;
  next.export.defaultLanguage = next.export.defaultLanguage === 'en' ? 'en' : 'uk';
  next.export.verifyFiles = next.export.verifyFiles !== false;
  return next;
}
function updateStudioSettings(current, input) {
  const merged = normalizeStudioSettings(current);
  for (const section of ['general','files','performance','assistants','export']) {
    if (input?.[section] && typeof input[section] === 'object' && !Array.isArray(input[section])) merged[section] = { ...merged[section], ...input[section] };
  }
  return normalizeStudioSettings(merged);
}
const transitions = {
  queued: ['preparing', 'paused', 'cancelled'],
  preparing: ['running', 'paused', 'failed', 'cancelled'],
  running: ['paused', 'completed', 'failed', 'cancelled'],
  paused: ['queued', 'cancelled'],
  failed: ['queued', 'cancelled'],
  blocked: ['queued', 'cancelled'],
  completed: [], cancelled: []
};

function defaultModelRegistry() {
  return [
    { id: 'local-planner', name: 'Local Planner', capability: 'planning', runtime: 'built-in', version: '1.0', status: 'ready', execution: 'local', notes: 'Створює лише текстові чернетки та не генерує медіа.' },
    { id: 'macos-tts', name: 'macOS Speech', capability: 'voice', runtime: 'macOS', version: 'system', status: 'available', execution: 'local', notes: 'Локальне тестове озвучування; не є клонуванням голосу.' },
    { id: 'piper', name: 'Piper', capability: 'voice', runtime: 'Piper', version: 'detected at runtime', status: 'not-installed', execution: 'local', notes: 'Потрібне окреме встановлення голосової моделі.' },
    { id: 'gpu-worker', name: 'GPU Worker', capability: 'image-video', runtime: 'worker-contract', version: 'unconfigured', status: 'not-connected', execution: 'remote', notes: 'Контракт готовий; виконавець і моделі не підключені.' }
  ];
}

function normalizeStudio(data) {
  data.studio = data.studio || {};
  data.studio.modelRegistry = Array.isArray(data.studio.modelRegistry) && data.studio.modelRegistry.length ? data.studio.modelRegistry : defaultModelRegistry();
  data.studio.generationJobs = Array.isArray(data.studio.generationJobs) ? data.studio.generationJobs : [];
  data.studio.workers = Array.isArray(data.studio.workers) ? data.studio.workers : [];
  data.studio.settings = normalizeStudioSettings(data.studio.settings);
  data.studio.generalAssistant = data.studio.generalAssistant || { id: 'general-assistant', scope: 'studio-only', autonomy: 'suggestions-only', memory: [] };
  for (const project of data.projects || []) {
    project.assetVersions = Array.isArray(project.assetVersions) ? project.assetVersions : [];
    project.assistantWorkspace = project.assistantWorkspace || { id: `project-assistant-${project.id}`, scope: 'project-only', autonomy: 'suggestions-only', memory: [], actions: [] };
    project.storage = { layoutVersion: 2, root: `data/projects/${project.id}`, manifest: `data/projects/${project.id}/Project_Data/project.json`, database: `data/projects/${project.id}/Project_Data/project.sqlite`, assetDirectories: ['Assets/Images', 'Assets/Video', 'Assets/Voices', 'Assets/Music', 'Assets/SFX'], exportDirectory: 'Exports', backupDirectory: 'Backups', ...(project.storage || {}) };
  }
  return data;
}

function publicModel(model) { return { ...model, configured: ['ready', 'available'].includes(model.status) }; }
function createGenerationJob(input, models) {
  const type = String(input.type || '');
  if (!['image', 'video', 'voice', 'music', 'sfx'].includes(type)) throw new Error('generation type must be image, video, voice, music, or sfx');
  const projectId = String(input.projectId || '').trim();
  if (!projectId) throw new Error('projectId is required');
  const model = models.find(item => item.id === input.modelId);
  if (!model) throw new Error('selected model is not registered');
  const status = model.status === 'ready' || model.status === 'available' ? 'queued' : 'blocked';
  return { id: randomUUID(), projectId, type, modelId: model.id, status, priority: ['low', 'normal', 'high'].includes(input.priority) ? input.priority : 'normal', prompt: String(input.prompt || '').trim(), inputAssetIds: Array.isArray(input.inputAssetIds) ? input.inputAssetIds : [], outputAssetId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), executor: null, error: status === 'blocked' ? `Модель «${model.name}» не готова до виконання.` : null, note: 'Завдання зареєстровано. Виконання почнеться лише після підключення сумісного локального або GPU worker.' };
}
function transitionGenerationJob(job, nextStatus, note = '') {
  if (!jobStates.includes(nextStatus)) throw new Error('unsupported generation job status');
  if (!transitions[job.status]?.includes(nextStatus)) throw new Error(`cannot transition job from ${job.status} to ${nextStatus}`);
  if (terminalStates.has(job.status)) throw new Error('completed or cancelled jobs cannot be changed');
  return { ...job, status: nextStatus, note: String(note || job.note), updatedAt: new Date().toISOString() };
}
function createAssetVersion(asset, input) {
  const version = String(input.version || '').trim() || `v${Date.now()}`;
  return { id: randomUUID(), assetId: asset.id, version, status: 'draft', createdAt: new Date().toISOString(), source: input.source || 'manual', uri: input.uri || asset.uri || '', prompt: input.prompt || '', model: input.model || '', seed: input.seed || '', parameters: input.parameters || {}, parentVersionId: input.parentVersionId || asset.currentVersionId || null, notes: input.notes || '', approvedAt: null };
}
function registerWorker(input) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('worker name is required');
  const capabilities = Array.isArray(input.capabilities) ? [...new Set(input.capabilities.map(String).filter(value => ['image', 'video', 'voice', 'music', 'sfx'].includes(value)))] : [];
  if (!capabilities.length) throw new Error('worker must declare at least one supported capability');
  return { id: randomUUID(), name, capabilities, modelIds: Array.isArray(input.modelIds) ? input.modelIds.map(String).slice(0, 20) : [], status: 'online', registeredAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), runtime: String(input.runtime || 'unspecified') };
}
function claimGenerationJob(job, worker) {
  if (job.status !== 'queued' || !worker.capabilities.includes(job.type)) return null;
  return { ...job, status: 'preparing', executor: { workerId: worker.id, workerName: worker.name, claimedAt: new Date().toISOString() }, updatedAt: new Date().toISOString(), note: `Завдання передано worker «${worker.name}».` };
}
function workerJobUpdate(job, worker, input) {
  if (job.executor?.workerId !== worker.id) throw new Error('job is not assigned to this worker');
  const updated = transitionGenerationJob(job, input.status, input.note);
  const outputs = Array.isArray(input.outputs) ? input.outputs.slice(0, 50).map(output => ({ kind: String(output.kind || 'asset'), uri: String(output.uri || ''), checksum: String(output.checksum || ''), assetId: output.assetId ? String(output.assetId) : '' })) : job.outputs || [];
  return { ...updated, outputs, logsUri: input.logsUri ? String(input.logsUri) : job.logsUri || '', error: input.error ? String(input.error) : updated.status === 'failed' ? String(input.note || 'Worker повідомив про помилку.') : null };
}
function registerWorkerOutputs(project, job) {
  if (job.status !== 'completed') return { assets: [], versions: [] };
  const assets = [], versions = [];
  const typeFor = kind => ({ image: 'image', video: 'video', voice: 'audio', audio: 'audio', music: 'music', sfx: 'sfx' }[kind] || 'reference');
  for (const output of job.outputs || []) {
    if (!output.uri) continue;
    const existing = output.assetId && project.assets.find(asset => asset.id === output.assetId);
    const asset = existing || { id: randomUUID(), type: typeFor(output.kind || job.type), scope: 'other', linkedCharacterId: '', label: `${job.type} · ${job.id.slice(0, 8)}`, uri: output.uri, version: '1.0.0', notes: 'Чернетковий результат, зареєстрований GPU Worker.', annotations: [], status: 'draft', currentVersionId: null, generatedByJobId: job.id };
    const version = { id: randomUUID(), assetId: asset.id, version: `worker-${job.id.slice(0, 8)}-${versions.length + 1}`, status: 'draft', createdAt: new Date().toISOString(), source: 'worker', uri: output.uri, prompt: job.prompt || '', model: job.modelId, seed: '', parameters: { checksum: output.checksum || '' }, parentVersionId: existing?.currentVersionId || null, notes: 'Результат worker-а. Потребує ручного перегляду й затвердження.', approvedAt: null, generationJobId: job.id };
    if (!existing) { asset.currentVersionId = version.id; assets.push(asset); }
    versions.push(version);
  }
  return { assets, versions };
}

module.exports = { normalizeStudio, defaultModelRegistry, defaultStudioSettings, normalizeStudioSettings, updateStudioSettings, publicModel, createGenerationJob, transitionGenerationJob, createAssetVersion, registerWorker, claimGenerationJob, workerJobUpdate, registerWorkerOutputs };
