const { randomUUID } = require('node:crypto');

const jobStates = ['queued', 'preparing', 'running', 'paused', 'completed', 'failed', 'cancelled'];
const terminalStates = new Set(['completed', 'cancelled']);

function defaultStudioSettings() {
  return {
    general: { interfaceLanguage: 'uk', startView: 'overview', confirmDestructive: true },
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
  next.general.startView = ['home','projects','overview'].includes(next.general.startView) ? next.general.startView : 'overview';
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

function defaultModelCatalog() {
  return [
    { id: 'local-planner', name: 'Local Planner', capability: 'planning', category: 'Текст і планування', license: 'Built-in', installMode: 'built-in', requirements: 'CPU', sizeNote: 'Вбудований', description: 'Локальний планувальник для безпечних текстових чернеток і службових задач.' },
    { id: 'macos-tts', name: 'macOS Speech', capability: 'voice', category: 'Голос', license: 'macOS system voices', installMode: 'system', requirements: 'macOS', sizeNote: 'Системний', description: 'Системний TTS для локальних тестових озвучок. Не є клонуванням голосу.' },
    { id: 'piper', name: 'Piper', capability: 'voice', category: 'Голос', license: 'Залежить від голосової моделі', installMode: 'manual-local', requirements: 'CPU / Apple Silicon', sizeNote: 'Залежить від голосу', description: 'Локальний TTS. Потрібна окрема сумісна голосова модель.' },
    { id: 'gpu-worker', name: 'GPU Worker', capability: 'image-video', category: 'Зображення і відео', license: 'Залежить від підключеної моделі', installMode: 'remote-worker', requirements: 'Окремий GPU worker', sizeNote: 'Віддалено', description: 'Контракт віддаленого виконавця для image/video моделей. Сам по собі не є генеративною моделлю.' }
  ];
}
function defaultModelProfiles() {
  return { planning: 'local-planner', voice: 'macos-tts', image: '', video: '', music: '', ambient: '', sfx: '' };
}
function modelSupports(model, task) {
  const capability=String(model?.capability||'');
  if(task==='planning')return capability==='planning';
  if(task==='voice')return capability==='voice';
  if(task==='image'||task==='video')return capability===task||capability==='image-video';
  if(task==='music'||task==='ambient'||task==='sfx')return capability===task||capability==='audio'||capability==='music-sfx';
  return false;
}
function updateModelProfiles(current, input, models) {
  const next={...defaultModelProfiles(),...(current||{})};
  for(const task of Object.keys(next)){
    if(input?.[task]===undefined)continue;
    const id=String(input[task]||'');
    if(!id){next[task]='';continue}
    const model=models.find(item=>item.id===id);
    if(!model||!modelSupports(model,task))throw new Error(`model ${id} does not support ${task}`);
    next[task]=id;
  }
  return next;
}
function normalizeModelSetup(model, input = {}) {
  const catalogMode = String(input.mode || model?.setup?.mode || 'simple');
  const mode = ['simple','advanced'].includes(catalogMode) ? catalogMode : 'simple';
  const targetRaw = String(input.executionTarget || model?.setup?.executionTarget || model?.execution || 'local');
  const executionTarget = targetRaw === 'remote' ? 'remote' : 'local';
  const storagePath = String(input.storagePath ?? model?.setup?.storagePath ?? '').trim().slice(0, 500);
  const endpoint = String(input.endpoint ?? model?.setup?.endpoint ?? '').trim().slice(0, 500);
  const connectionLabel = String(input.connectionLabel ?? model?.setup?.connectionLabel ?? '').trim().slice(0, 160);
  const technicalNotes = String(input.technicalNotes ?? model?.setup?.technicalNotes ?? '').trim().slice(0, 2000);
  if (executionTarget === 'remote' && endpoint && !/^https?:\/\//i.test(endpoint)) throw new Error('remote endpoint must start with http:// or https://');
  return { mode, executionTarget, storagePath, endpoint, connectionLabel, technicalNotes, savedAt: new Date().toISOString() };
}

function probeStudioModel(model, facts={}) {
  if(!model)return { ok:false, status:'missing', message:'Модель не знайдена в реєстрі.' };
  let ok=false,message='';
  if(model.id==='local-planner'){ok=true;message='Вбудований локальний планувальник доступний.'}
  else if(model.id==='macos-tts'){ok=facts.platform==='darwin';message=ok?'Системний macOS TTS доступний.':'Системний macOS TTS доступний лише на Mac.'}
  else if(model.id==='piper'){ok=facts.piperReady===true;message=ok?'Piper і локальна голосова модель доступні.':'Piper або голосова модель не встановлені.'}
  else if(model.id==='gpu-worker'){ok=Number(facts.onlineWorkers||0)>0;message=ok?'Підключено сумісний online GPU worker.':'Немає підключеного online GPU worker.'}
  else {ok=['ready','available','running'].includes(model.status);message=ok?'Конфігурація моделі позначена як доступна.':'Модель ще не готова до виконання.'}
  return { ok, status:ok?'ready':model.status, message, checkedAt:new Date().toISOString() };
}

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
  data.studio.modelRegistry = data.studio.modelRegistry.map(model => ({ ...model, setup: normalizeModelSetup(model, model.setup || {}), lastProbe: model.lastProbe || null }));
  data.studio.generationJobs = Array.isArray(data.studio.generationJobs) ? data.studio.generationJobs : [];
  data.studio.workers = Array.isArray(data.studio.workers) ? data.studio.workers : [];
  data.studio.modelProfiles = updateModelProfiles(data.studio.modelProfiles, {}, data.studio.modelRegistry);
  data.studio.settings = normalizeStudioSettings(data.studio.settings);
  data.studio.generalAssistant = { id: 'general-assistant', scope: 'studio-only', autonomy: 'suggestions-only', memory: [], ...(data.studio.generalAssistant || {}) };
  data.studio.generalAssistant.memory = Array.isArray(data.studio.generalAssistant.memory) ? data.studio.generalAssistant.memory : [];
  for (const project of data.projects || []) {
    project.productionSettings = { resolution: '1920x1080', aspectRatio: '16:9', fps: 24, plannedEpisodes: 1, ...(project.productionSettings || {}) };
    project.assetVersions = Array.isArray(project.assetVersions) ? project.assetVersions : [];
    project.assistantWorkspace = { id: `project-assistant-${project.id}`, scope: 'project-only', autonomy: 'suggestions-only', memory: [], actions: [], tasks: [], documents: [], ...(project.assistantWorkspace || {}) };
    project.assistantWorkspace.memory = Array.isArray(project.assistantWorkspace.memory) ? project.assistantWorkspace.memory : [];
    project.assistantWorkspace.actions = Array.isArray(project.assistantWorkspace.actions) ? project.assistantWorkspace.actions : [];
    project.assistantWorkspace.tasks = Array.isArray(project.assistantWorkspace.tasks) ? project.assistantWorkspace.tasks : [];
    project.assistantWorkspace.documents = Array.isArray(project.assistantWorkspace.documents) ? project.assistantWorkspace.documents : [];
    project.storage = { layoutVersion: 2, root: `data/projects/${project.id}`, manifest: `data/projects/${project.id}/Project_Data/project.json`, database: `data/projects/${project.id}/Project_Data/project.sqlite`, assetDirectories: ['Assets/Images', 'Assets/Video', 'Assets/Voices', 'Assets/Music', 'Assets/SFX'], exportDirectory: 'Exports', backupDirectory: 'Backups', ...(project.storage || {}) };
  }
  return data;
}

function createProjectAssistantAction(project, input = {}) {
  const kind = String(input.kind || '');
  const summary = String(input.summary || '').trim();
  if (!summary) throw new Error('assistant action summary is required');
  let targetType='', targetId='', field='', beforeValue='', afterValue='';
  if (kind === 'project-description') {
    targetType='project'; targetId=project.id; field='description';
    beforeValue=String(project.description || ''); afterValue=String(input.after || '').trim();
  } else if (kind === 'workflow-note') {
    const stage=project.workflow?.find(item=>item.id===input.targetId);
    if (!stage) throw new Error('workflow stage not found');
    targetType='workflow'; targetId=stage.id; field='note';
    beforeValue=String(stage.note || ''); afterValue=String(input.after || '').trim();
  } else throw new Error('unsupported assistant action kind');
  if (beforeValue === afterValue) throw new Error('assistant action does not change the target');
  return { id: randomUUID(), kind, targetType, targetId, field, summary, before: beforeValue, after: afterValue, status: 'proposed', createdAt: new Date().toISOString(), decidedAt: null, decisionNote: '' };
}
function decideProjectAssistantAction(project, actionId, decision, note = '') {
  const actions=project.assistantWorkspace?.actions || [], action=actions.find(item=>item.id===actionId);
  if (!action) throw new Error('assistant action not found');
  if (action.status !== 'proposed') throw new Error('assistant action has already been decided');
  if (!['accept','reject'].includes(decision)) throw new Error('decision must be accept or reject');
  if (decision === 'reject') {
    action.status='rejected'; action.decidedAt=new Date().toISOString(); action.decisionNote=String(note||'');
    return action;
  }
  let current='';
  if (action.kind === 'project-description') current=String(project.description || '');
  else if (action.kind === 'workflow-note') {
    const stage=project.workflow?.find(item=>item.id===action.targetId); if(!stage)throw new Error('workflow stage not found');
    current=String(stage.note || '');
  } else throw new Error('unsupported assistant action kind');
  if (current !== String(action.before || '')) throw new Error('assistant action is stale because the target changed after the proposal');
  if (action.kind === 'project-description') project.description=String(action.after || '');
  else {
    const stage=project.workflow.find(item=>item.id===action.targetId);
    stage.note=String(action.after || ''); stage.updatedAt=new Date().toISOString();
  }
  action.status='accepted'; action.decidedAt=new Date().toISOString(); action.decisionNote=String(note||'');
  return action;
}

function publicModel(model) { return { ...model, configured: ['ready', 'available', 'connected', 'running'].includes(model.status) }; }
function generationEvent(status, message) { return { id: randomUUID(), at: new Date().toISOString(), status, message: String(message || '') }; }
function createGenerationJob(input, models) {
  const type = String(input.type || '');
  if (!['image', 'video', 'voice', 'music', 'ambient', 'sfx'].includes(type)) throw new Error('generation type must be image, video, voice, music, ambient, or sfx');
  const projectId = String(input.projectId || '').trim();
  if (!projectId) throw new Error('projectId is required');
  const model = models.find(item => item.id === input.modelId);
  if (!model) throw new Error('selected model is not registered');
  if (!modelSupports(model, type)) throw new Error(`selected model does not support ${type}`);
  const status = ['ready','available','running'].includes(model.status) ? 'queued' : 'blocked';
  const note = 'Завдання зареєстровано. Виконання почнеться лише після підключення сумісного локального або GPU worker.';
  const error = status === 'blocked' ? `Модель «${model.name}» не готова до виконання.` : null;
  return { id: randomUUID(), projectId, type, modelId: model.id, status, priority: ['low', 'normal', 'high'].includes(input.priority) ? input.priority : 'normal', prompt: String(input.prompt || '').trim(), parameters: input.parameters && typeof input.parameters === 'object' && !Array.isArray(input.parameters) ? { ...input.parameters } : {}, context: input.context && typeof input.context === 'object' && !Array.isArray(input.context) ? { ...input.context } : {}, inputAssetIds: Array.isArray(input.inputAssetIds) ? input.inputAssetIds : [], outputAssetId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), executor: null, error, note, attempt: Math.max(1, Number(input.attempt) || 1), retryOf: input.retryOf ? String(input.retryOf) : null, cancelRequestedAt: null, events: [generationEvent(status, error || note)] };
}
function transitionGenerationJob(job, nextStatus, note = '') {
  if (!jobStates.includes(nextStatus)) throw new Error('unsupported generation job status');
  if (!transitions[job.status]?.includes(nextStatus)) throw new Error(`cannot transition job from ${job.status} to ${nextStatus}`);
  if (terminalStates.has(job.status)) throw new Error('completed or cancelled jobs cannot be changed');
  const message = String(note || job.note || `Статус змінено на ${nextStatus}.`);
  return { ...job, status: nextStatus, note: message, updatedAt: new Date().toISOString(), events: [...(job.events || []), generationEvent(nextStatus, message)] };
}
function retryGenerationJob(job, models) {
  if (!['failed','blocked','cancelled'].includes(job.status)) throw new Error('only failed, blocked, or cancelled jobs can be retried');
  const next = createGenerationJob({ projectId: job.projectId, type: job.type, modelId: job.modelId, priority: job.priority, prompt: job.prompt, parameters: job.parameters, context: job.context, inputAssetIds: job.inputAssetIds, attempt: Number(job.attempt || 1) + 1, retryOf: job.id }, models);
  next.events[0].message = `Повторна спроба #${next.attempt} для задачі ${job.id.slice(0, 8)}. ${next.events[0].message}`;
  return next;
}
function cancelGenerationJob(job, note = '') {
  if (job.status === 'completed') throw new Error('completed job cannot be cancelled');
  if (job.status === 'cancelled') throw new Error('job is already cancelled');
  const message = String(note || (['preparing','running'].includes(job.status) ? 'Скасування запитано. Worker може завершувати поточний крок, але результат не буде прийнятий.' : 'Завдання скасовано до виконання.'));
  return { ...job, status: 'cancelled', note: message, cancelRequestedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), events: [...(job.events || []), generationEvent('cancelled', message)] };
}
function createAssetVersion(asset, input) {
  const version = String(input.version || '').trim() || `v${Date.now()}`;
  const source = String(input.source || 'manual');
  const model = String(input.model || '');
  const checksum = String(input.checksum || input.parameters?.checksum || '');
  const generationJobId = String(input.generationJobId || '');
  const parameters = { ...(input.parameters || {}), ...(checksum ? { checksum } : {}) };
  return { id: randomUUID(), assetId: asset.id, version, status: 'draft', createdAt: new Date().toISOString(), source, uri: input.uri || asset.uri || '', prompt: input.prompt || '', model, seed: input.seed || '', checksum, provenance: { source, model, generationJobId }, parameters, parentVersionId: input.parentVersionId || asset.currentVersionId || null, notes: input.notes || '', approvedAt: null, generationJobId: generationJobId || undefined };
}
function registerWorker(input) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('worker name is required');
  const capabilities = Array.isArray(input.capabilities) ? [...new Set(input.capabilities.map(String).filter(value => ['image', 'video', 'voice', 'music', 'ambient', 'sfx'].includes(value)))] : [];
  if (!capabilities.length) throw new Error('worker must declare at least one supported capability');
  return { id: randomUUID(), name, capabilities, modelIds: Array.isArray(input.modelIds) ? input.modelIds.map(String).slice(0, 20) : [], status: 'online', registeredAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), runtime: String(input.runtime || 'unspecified') };
}
function claimGenerationJob(job, worker) {
  if (job.status !== 'queued' || !worker.capabilities.includes(job.type)) return null;
  const message = `Завдання передано worker «${worker.name}».`;
  return { ...job, status: 'preparing', executor: { workerId: worker.id, workerName: worker.name, claimedAt: new Date().toISOString() }, updatedAt: new Date().toISOString(), note: message, events: [...(job.events || []), generationEvent('preparing', message)] };
}
function workerJobUpdate(job, worker, input) {
  if (job.executor?.workerId !== worker.id) throw new Error('job is not assigned to this worker');
  const updated = transitionGenerationJob(job, input.status, input.note);
  const outputs = Array.isArray(input.outputs) ? input.outputs.slice(0, 50).map(output => ({ kind: String(output.kind || 'asset'), uri: String(output.uri || ''), checksum: String(output.checksum || ''), assetId: output.assetId ? String(output.assetId) : '' })) : job.outputs || [];
  return { ...updated, outputs, logsUri: input.logsUri ? String(input.logsUri) : job.logsUri || '', error: input.error ? String(input.error) : updated.status === 'failed' ? String(input.note || 'Worker повідомив про помилку.') : null };
}
function registerWorkerOutputs(project, job) {
  if (job.status !== 'completed') return { assets: [], versions: [], outputAssetIds: [] };
  const assets = [], versions = [], outputAssetIds = [];
  const typeFor = kind => ({ image: 'image', video: 'video', voice: 'audio', audio: 'audio', music: 'music', ambient: 'ambient', sfx: 'sfx' }[kind] || 'reference');
  for (const output of job.outputs || []) {
    if (!output.uri) continue;
    const existing = output.assetId && project.assets.find(asset => asset.id === output.assetId);
    const assetType = typeFor(output.kind || job.type);
    const isSound = ['audio','music','ambient','sfx'].includes(assetType);
    const linkedSceneId = String(job.context?.sceneId || '');
    const linkedShotId = String(job.context?.shotId || '');
    const asset = existing || { id: randomUUID(), type: assetType, scope: linkedShotId ? 'shot' : (linkedSceneId ? 'scene' : (isSound ? 'audio' : 'other')), linkedCharacterId: '', linkedSceneId, linkedShotId, label: `${job.type} · ${job.id.slice(0, 8)}`, uri: output.uri, version: '1.0.0', notes: 'Чернетковий результат, зареєстрований GPU Worker.', annotations: [], audioEdit: isSound ? { trimStart:0, trimEnd:0, fadeIn:0, fadeOut:0, volume:1 } : undefined, status: 'draft', currentVersionId: null, generatedByJobId: job.id };
    const version = { id: randomUUID(), assetId: asset.id, version: `worker-${job.id.slice(0, 8)}-${versions.length + 1}`, status: 'draft', createdAt: new Date().toISOString(), source: 'worker', uri: output.uri, prompt: job.prompt || '', model: job.modelId, seed: '', parameters: { checksum: output.checksum || '' }, parentVersionId: existing?.currentVersionId || null, notes: 'Результат worker-а. Потребує ручного перегляду й затвердження.', approvedAt: null, generationJobId: job.id };
    if (!existing) { asset.currentVersionId = version.id; assets.push(asset); }
    outputAssetIds.push(asset.id);
    versions.push(version);
  }
  return { assets, versions, outputAssetIds };
}

module.exports = { normalizeStudio, defaultModelRegistry, defaultModelCatalog, defaultModelProfiles, modelSupports, updateModelProfiles, normalizeModelSetup, probeStudioModel, defaultStudioSettings, normalizeStudioSettings, updateStudioSettings, createProjectAssistantAction, decideProjectAssistantAction, publicModel, generationEvent, createGenerationJob, transitionGenerationJob, retryGenerationJob, cancelGenerationJob, createAssetVersion, registerWorker, claimGenerationJob, workerJobUpdate, registerWorkerOutputs };
