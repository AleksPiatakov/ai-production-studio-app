const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const localEnvFile = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(localEnvFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(localEnvFile);
const { createStore } = require('./store');
const { inspectContinuity } = require('./continuity');
const { assistantConfiguration, generateAssistantDraft, askGeneralAssistant, askProjectAdvisor } = require('./assistant');
const { buildAutopilotBlueprint } = require('./autopilot');
const { buildDaVinciHandoff, buildDaVinciPackage, packageManifestJson, handoffMarkdown, handoffTimelineCsv } = require('./davinci-handoff');
const { synthesizeMacVoice, synthesizePiperVoice, hasPiperVoice } = require('./local-voice');
const { configuration: elevenLabsConfiguration, listVoices: listElevenLabsVoices, synthesizeElevenLabsVoice } = require('./elevenlabs');
const { validateProject, validateProjectInput, validateBibleInput, validateSceneInput, validateShotInput, validateDialogueInput, validateAssetInput, validateProfileInput, validateWorkflowInput, validateScriptInput, validateVoiceProfileInput, validateLocalizationInput, validateRenderJobInput, validateEpisodeInput } = require('./validation');
const { projectTemplate, allowedAgeBands, supportedLanguages, workflowStages } = require('../shared/schema');
const { publicModel, updateStudioSettings, defaultModelCatalog, updateModelProfiles, probeStudioModel, createProjectAssistantAction, decideProjectAssistantAction, createGenerationJob, transitionGenerationJob, retryGenerationJob, cancelGenerationJob, createAssetVersion, registerWorker, claimGenerationJob, workerJobUpdate, registerWorkerOutputs } = require('./production-studio');
const store = createStore();

function send(res, status, payload) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); }
function authenticateWorker(req) {
  const token = process.env.AI_STUDIO_WORKER_TOKEN;
  if (!token) throw new Error('GPU Worker is not enabled. Set AI_STUDIO_WORKER_TOKEN locally first.');
  if (req.headers['x-ai-studio-worker-token'] !== token) { const error = new Error('worker authentication failed'); error.status = 401; throw error; }
}
function staticFile(res, url) {
  const requested = url === '/' ? '/index.html' : url;
  const file = path.join(__dirname, '..', 'public', path.normalize(requested).replace(/^\.+/, ''));
  if (!file.startsWith(path.join(__dirname, '..', 'public')) || !fs.existsSync(file)) return false;
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.aiff': 'audio/aiff', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.srt': 'text/plain' };
  // The studio is edited locally while it is open in the browser. Do not let a
  // stale interface remain visible after a refresh.
  res.writeHead(200, {
    'content-type': `${types[path.extname(file)] || 'application/octet-stream'}; charset=utf-8`,
    'cache-control': 'no-store, max-age=0, must-revalidate'
  }); fs.createReadStream(file).pipe(res); return true;
}
function body(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', c => raw += c); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } }); }); }
function findProject(id) { return store.read().projects.find(x => x.id === id); }
function buildShotImageBrief(project, scene, shot) {
  const characterIds = [...new Set([...(scene.characterIds || []), ...(shot.characterIds || [])])];
  const characters = project.bibles.characters.filter(character => characterIds.includes(character.id));
  const references = (shot.referenceAssetIds || []).map(id => project.assets.find(asset => asset.id === id)).filter(Boolean);
  const characterFacts = characters.length ? characters.map(character => `- ${character.name}: ${character.appearance || 'опис зовнішності ще не заповнено'}${character.rules ? `; незмінні правила: ${character.rules}` : ''}`).join('\n') : '- Персонажа для цього шота ще не вибрано.';
  const styleFacts = project.bibles.style.length ? project.bibles.style.map(style => `- ${style.name}${style.rules ? `: ${style.rules}` : ''}`).join('\n') : '- Правила стилю ще не додано.';
  const referenceFacts = references.length ? references.map(asset => `- ${asset.label}${asset.notes ? `: ${asset.notes}` : ''}${asset.uri ? ` (${asset.uri})` : ''}`).join('\n') : '- Окремі референси не прив’язані.';
  const prompt = `Use case: stylized-concept\nAsset type: draft storyboard keyframe for an animated video\n\nProject context: ${project.name}\nScene: ${scene.title}\nShot duration: ${shot.seconds} seconds\n\nCharacter identity — preserve these facts:\n${characterFacts}\n\nStyle rules:\n${styleFacts}\n\nShot request:\n${shot.imagePrompt || shot.prompt || 'Опис ключового кадру ще не задано.'}\n\nAction / required change:\n${shot.action || 'Виконайте опис ключового кадру без додаткових сюжетних рішень.'}\n\nCamera and composition:\n${shot.camera || 'Камера ще не задана.'}\n\nLighting:\n${shot.lighting || 'Світло ще не задано.'}\n\nMotion reference for later video generation:\n${shot.motionPrompt || 'Рух ще не задано.'}\n\nLinked visual references:\n${referenceFacts}\n\nAcceptance criteria:\n${shot.acceptanceCriteria || 'Кадр має чітко передавати дію, світло та емоцію, описані вище.'}\n\nConstraints: preserve the established character identity and style; treat this as a draft, not approved canon; do not add text, logos, watermarks, extra characters, or unrequested story elements.`;
  return { prompt, characters: characters.map(character => ({ id: character.id, name: character.name })), references: references.map(asset => ({ id: asset.id, label: asset.label, uri: asset.uri })), status: 'draft', provider: 'not-connected' };
}
function saveImageUpload(projectId, input) {
  const match = String(input.dataUrl || '').match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Підтримуються лише зображення PNG, JPEG або WebP.');
  const content = Buffer.from(match[2], 'base64');
  if (!content.length || content.length > 10 * 1024 * 1024) throw new Error('Розмір зображення має бути від 1 байта до 10 МБ.');
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const safeProject = String(projectId).replace(/[^a-zA-Z0-9_-]/g, '');
  const folder = path.join(__dirname, '..', 'public', 'assets', 'uploads', safeProject);
  fs.mkdirSync(folder, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(folder, filename), content);
  return `/assets/uploads/${safeProject}/${filename}`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'); const parts = url.pathname.split('/').filter(Boolean);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { status: 'ok', mode: 'local-control-plane', piper: hasPiperVoice() ? 'ready' : 'not-installed', elevenLabs: elevenLabsConfiguration() });
    if (req.method === 'GET' && url.pathname === '/api/studio/settings') return send(res, 200, store.read().studio.settings);
    if (req.method === 'PUT' && url.pathname === '/api/studio/settings') {
      const input = await body(req);
      let updated;
      store.update(data => { data.studio.settings = updateStudioSettings(data.studio.settings, input); updated = data.studio.settings; }, { noSnapshot: true });
      return send(res, 200, updated);
    }
    if (req.method === 'GET' && url.pathname === '/api/studio/model-catalog') {
      const data = store.read(), registry = new Map(data.studio.modelRegistry.map(model => [model.id, model]));
      return send(res, 200, defaultModelCatalog().map(entry => ({ ...entry, registry: registry.has(entry.id) ? publicModel(registry.get(entry.id)) : null })));
    }
    if (req.method === 'GET' && url.pathname === '/api/studio/model-profiles') return send(res, 200, store.read().studio.modelProfiles);
    if (req.method === 'PUT' && url.pathname === '/api/studio/model-profiles') {
      const input = await body(req); let updated;
      store.update(data => { data.studio.modelProfiles = updateModelProfiles(data.studio.modelProfiles, input, data.studio.modelRegistry); updated = data.studio.modelProfiles; }, { noSnapshot: true });
      return send(res, 200, updated);
    }
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'studio' && parts[2] === 'models' && parts[3] && parts[4] === 'probe') {
      const data = store.read(), model = data.studio.modelRegistry.find(item => item.id === parts[3]);
      if (!model) return send(res, 404, { error: 'model not found' });
      return send(res, 200, probeStudioModel(model, { platform: process.platform, piperReady: hasPiperVoice(), onlineWorkers: data.studio.workers.filter(worker => worker.status === 'online').length }));
    }
    if (req.method === 'GET' && url.pathname === '/api/studio/models') return send(res, 200, store.read().studio.modelRegistry.map(publicModel));
    if (req.method === 'POST' && url.pathname === '/api/studio/models') {
      const input = await body(req);
      const name = String(input.name || '').trim(), capability = String(input.capability || '').trim();
      if (!name || !capability) throw new Error('name and capability are required');
      const model = { id: randomUUID(), name, capability, runtime: String(input.runtime || 'external'), version: String(input.version || 'unknown'), status: 'not-connected', execution: input.execution === 'local' ? 'local' : 'remote', notes: String(input.notes || 'Підключення ще не налаштовано.') };
      store.update(data => data.studio.modelRegistry.push(model));
      return send(res, 201, publicModel(model));
    }
    if (req.method === 'PUT' && parts[0] === 'api' && parts[1] === 'studio' && parts[2] === 'models' && parts[3]) {
      const input = await body(req), current = store.read().studio.modelRegistry.find(item => item.id === parts[3]);
      if (!current) return send(res, 404, { error: 'model not found' });
      const allowed = ['name', 'capability', 'runtime', 'version', 'status', 'execution', 'notes'];
      const next = { ...current };
      for (const key of allowed) if (input[key] !== undefined) next[key] = String(input[key]).trim();
      if (!['ready','available','installed','connected','running','failed','not-installed','not-connected','disabled'].includes(next.status)) throw new Error('invalid model status');
      store.update(data => { const models = data.studio.modelRegistry; models[models.findIndex(item => item.id === current.id)] = next; });
      return send(res, 200, publicModel(next));
    }
    if (req.method === 'GET' && url.pathname === '/api/studio/generation-jobs') return send(res, 200, store.read().studio.generationJobs);
    if (req.method === 'GET' && url.pathname === '/api/studio/workers') return send(res, 200, store.read().studio.workers);
    if (req.method === 'POST' && url.pathname === '/api/studio/worker/register') {
      authenticateWorker(req); const worker = registerWorker(await body(req));
      store.update(data => data.studio.workers.push(worker)); return send(res, 201, worker);
    }
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'studio' && parts[2] === 'worker' && parts[3] && parts[4] === 'claim') {
      authenticateWorker(req); const data = store.read(), worker = data.studio.workers.find(item => item.id === parts[3] && item.status === 'online');
      if (!worker) return send(res, 404, { error: 'online worker not found' });
      const job = data.studio.generationJobs.filter(item => item.status === 'queued').sort((a, b) => ({ high: 0, normal: 1, low: 2 }[a.priority] - ({ high: 0, normal: 1, low: 2 }[b.priority]))).map(item => claimGenerationJob(item, worker)).find(Boolean);
      store.update(next => { const current = next.studio.workers.find(item => item.id === worker.id); current.lastSeenAt = new Date().toISOString(); if (job) next.studio.generationJobs[next.studio.generationJobs.findIndex(item => item.id === job.id)] = job; });
      return send(res, 200, { job: job || null });
    }
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'studio' && parts[2] === 'worker' && parts[3] && parts[4] === 'jobs' && parts[5]) {
      authenticateWorker(req); const data = store.read(), worker = data.studio.workers.find(item => item.id === parts[3] && item.status === 'online'), job = data.studio.generationJobs.find(item => item.id === parts[5]);
      if (!worker) return send(res, 404, { error: 'online worker not found' }); if (!job) return send(res, 404, { error: 'generation job not found' });
      let updated = workerJobUpdate(job, worker, await body(req));
      store.update(next => {
        const current = next.studio.workers.find(item => item.id === worker.id); current.lastSeenAt = new Date().toISOString();
        const targetProject = next.projects.find(item => item.id === updated.projectId);
        if (targetProject) {
          const registered = registerWorkerOutputs(targetProject, updated);
          targetProject.assets.push(...registered.assets); targetProject.assetVersions.push(...registered.versions);
          if (registered.outputAssetIds?.length) updated = { ...updated, outputAssetId: registered.outputAssetIds[0] };
        }
        next.studio.generationJobs[next.studio.generationJobs.findIndex(item => item.id === job.id)] = updated;
      });
      return send(res, 200, updated);
    }
    if (req.method === 'POST' && url.pathname === '/api/studio/generation-jobs') {
      const input = await body(req), data = store.read();
      if (!data.projects.some(project => project.id === input.projectId)) return send(res, 404, { error: 'project not found' });
      const job = createGenerationJob(input, data.studio.modelRegistry);
      store.update(next => next.studio.generationJobs.push(job)); return send(res, 201, job);
    }
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'studio' && parts[2] === 'generation-jobs' && parts[3] && parts[4] === 'transition') {
      const input = await body(req), job = store.read().studio.generationJobs.find(item => item.id === parts[3]);
      if (!job) return send(res, 404, { error: 'generation job not found' });
      const updated = transitionGenerationJob(job, input.status, input.note);
      store.update(data => { const jobs = data.studio.generationJobs; jobs[jobs.findIndex(item => item.id === job.id)] = updated; }); return send(res, 200, updated);
    }
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'studio' && parts[2] === 'generation-jobs' && parts[3] && parts[4] === 'retry') {
      const data = store.read(), job = data.studio.generationJobs.find(item => item.id === parts[3]);
      if (!job) return send(res, 404, { error: 'generation job not found' });
      const retried = retryGenerationJob(job, data.studio.modelRegistry);
      store.update(next => next.studio.generationJobs.push(retried), { noSnapshot: true });
      return send(res, 201, retried);
    }
    if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'studio' && parts[2] === 'generation-jobs' && parts[3] && parts[4] === 'cancel') {
      const input = await body(req), job = store.read().studio.generationJobs.find(item => item.id === parts[3]);
      if (!job) return send(res, 404, { error: 'generation job not found' });
      const cancelled = cancelGenerationJob(job, input.note);
      store.update(next => { const jobs=next.studio.generationJobs; jobs[jobs.findIndex(item => item.id === job.id)] = cancelled; }, { noSnapshot: true });
      return send(res, 200, cancelled);
    }
    if (req.method === 'GET' && url.pathname === '/api/studio/general-assistant') {
      const data = store.read(), config = assistantConfiguration();
      return send(res, 200, { assistant: { ...data.studio.generalAssistant, projectAccess: 'none' }, configuration: config, history: (data.studio.generalAssistant.memory || []).slice(-100) });
    }
    if (req.method === 'POST' && url.pathname === '/api/studio/general-assistant/messages') {
      const input = await body(req), data = store.read(), memory = (data.studio.generalAssistant.memory || []).slice(-100);
      const result = await askGeneralAssistant({ message: input.message, history: memory });
      const now = new Date().toISOString();
      const userMessage = { id: randomUUID(), role: 'user', text: String(input.message || '').trim(), createdAt: now };
      const assistantMessage = { id: randomUUID(), role: 'assistant', answer: result.reply.answer, nextSteps: result.reply.nextSteps, engine: result.engine, model: result.model, createdAt: new Date().toISOString() };
      store.update(next => {
        const target = next.studio.generalAssistant;
        target.memory = [...(target.memory || []), userMessage, assistantMessage].slice(-100);
      }, { noSnapshot: true });
      return send(res, 200, { ...result, messages: [userMessage, assistantMessage] });
    }
    if (req.method === 'DELETE' && url.pathname === '/api/studio/general-assistant/messages') {
      store.update(data => { data.studio.generalAssistant.memory = []; }, { noSnapshot: true });
      return send(res, 200, { cleared: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/studio/assistants') {
      const data = store.read();
      return send(res, 200, { general: { ...data.studio.generalAssistant, projectAccess: 'none' }, projectAssistants: data.projects.map(project => ({ projectId: project.id, projectName: project.name, ...project.assistantWorkspace, generalAccess: 'none' })) });
    }
    if (req.method === 'GET' && url.pathname === '/api/projects') return send(res, 200, store.read().projects);
    if (req.method === 'POST' && url.pathname === '/api/projects') {
      const input = validateProjectInput(await body(req));
      const project = projectTemplate({ id: randomUUID(), ...input });
      store.update(data => data.projects.push(project)); return send(res, 201, project);
    }
    if (parts[0] === 'api' && parts[1] === 'projects' && parts[2]) {
      const projectId = parts[2]; const project = findProject(projectId); if (!project) return send(res, 404, { error: 'project not found' });
      if (req.method === 'GET' && parts.length === 3) return send(res, 200, project);
      if (req.method === 'GET' && parts[3] === 'studio-architecture') return send(res, 200, { storage: project.storage, assetVersionCount: project.assetVersions.length, assistant: { ...project.assistantWorkspace, generalAccess: 'none' }, generationJobs: store.read().studio.generationJobs.filter(job => job.projectId === project.id) });
      if (req.method === 'GET' && parts[3] === 'elevenlabs' && parts[4] === 'status') return send(res, 200, elevenLabsConfiguration());
      if (req.method === 'GET' && parts[3] === 'elevenlabs' && parts[4] === 'voices') return send(res, 200, { voices: await listElevenLabsVoices() });
      if (req.method === 'GET' && parts[3] === 'versions') return send(res, 200, (project.versionHistory || []).map(version => ({ id: version.id, createdAt: version.createdAt, label: version.label, snapshot: version.snapshot })));
      if (req.method === 'POST' && parts[3] === 'versions' && parts.length === 4) {
        const input = await body(req), label = String(input.label || 'Ручна контрольна точка').trim().slice(0, 160) || 'Ручна контрольна точка';
        let created;
        store.update(data => {
          const target = data.projects.find(item => item.id === projectId);
          const snapshot = JSON.parse(JSON.stringify({ ...target, versionHistory: undefined }));
          created = { id: randomUUID(), createdAt: new Date().toISOString(), label, snapshot };
          const limit = Math.max(5, Math.min(100, Number(data.studio?.settings?.files?.versionHistoryLimit) || 30));
          target.versionHistory = [...(target.versionHistory || []), created].slice(-limit);
        }, { noSnapshot: true });
        return send(res, 201, created);
      }
      if (req.method === 'POST' && parts[3] === 'versions' && parts[4] && parts[5] === 'restore') {
        const version = (project.versionHistory || []).find(item => item.id === parts[4]);
        if (!version) return send(res, 404, { error: 'version not found' });
        store.update(data => {
          const index = data.projects.findIndex(item => item.id === projectId); const current = data.projects[index];
          const limit = Math.max(5, Math.min(100, Number(data.studio?.settings?.files?.versionHistoryLimit) || 30));
          const history = [...(current.versionHistory || []), { id: randomUUID(), createdAt: new Date().toISOString(), label: 'Автоматично збережено перед відновленням', snapshot: JSON.parse(JSON.stringify({ ...current, versionHistory: undefined })) }].slice(-limit);
          data.projects[index] = { ...JSON.parse(JSON.stringify(version.snapshot)), versionHistory: history };
        }, { noSnapshot: true });
        return send(res, 200, { restoredVersionId: version.id });
      }
      if (req.method === 'GET' && parts[3] === 'continuity') return send(res, 200, inspectContinuity(project));
      if (req.method === 'GET' && parts[3] === 'assistant' && parts[4] === 'status') return send(res, 200, assistantConfiguration());
      if (req.method === 'POST' && parts[3] === 'assistant' && parts[4] === 'draft') return send(res, 200, await generateAssistantDraft(project, await body(req)));
      if (req.method === 'GET' && parts[3] === 'assistant' && parts[4] === 'actions') return send(res, 200, project.assistantWorkspace?.actions || []);
      if (req.method === 'POST' && parts[3] === 'assistant' && parts[4] === 'actions' && parts.length === 5) {
        const action = createProjectAssistantAction(project, await body(req));
        store.update(data => { const target=data.projects.find(item=>item.id===projectId); target.assistantWorkspace.actions.push(action); }, { noSnapshot: true });
        return send(res, 201, action);
      }
      if (req.method === 'POST' && parts[3] === 'assistant' && parts[4] === 'actions' && parts[5] && parts[6] === 'decision') {
        const input = await body(req); let updated;
        const apply = input.decision === 'accept';
        store.update(data => { const target=data.projects.find(item=>item.id===projectId); updated=decideProjectAssistantAction(target, parts[5], input.decision, input.note); }, apply ? {} : { noSnapshot: true });
        return send(res, 200, updated);
      }
      if (req.method === 'POST' && parts[3] === 'assistant' && parts[4] === 'advice') return send(res, 200, await askProjectAdvisor(project, await body(req)));
      if (req.method === 'POST' && parts[3] === 'autopilot' && parts[4] === 'episode') {
        const blueprint = buildAutopilotBlueprint(project, await body(req));
        const baseSeason = Number(project.episodes[0]?.seasonNumber || 1);
        const episodeNumber = project.episodes.filter(item => Number(item.seasonNumber) === baseSeason).reduce((maximum, item) => Math.max(maximum, Number(item.episodeNumber || 0)), 0) + 1;
        const createdAt = new Date().toISOString();
        const episode = { id: randomUUID(), title: blueprint.title, logline: blueprint.logline, theme: '', seasonNumber: baseSeason, episodeNumber, targetMinutes: blueprint.targetMinutes, status: 'development', createdAt, updatedAt: createdAt };
        const scriptOrder = project.scripts.filter(item => !item.deletedAt).reduce((maximum, item) => Math.max(maximum, Number(item.order || 0)), 0) + 1;
        const script = { id: randomUUID(), version: '0.1.0', episodeId: episode.id, ...blueprint.script, order: scriptOrder, visibility: 'visible', createdAt, updatedAt: createdAt };
        const scenes = blueprint.scenes.map(scene => ({ id: randomUUID(), ...scene, episodeId: episode.id, shots: scene.shots.map(shot => ({ id: randomUUID(), ...shot })), dialogue: scene.dialogue.map(line => ({ id: randomUUID(), ...line, audioDrafts: [] })) }));
        store.update(data => {
          const target = data.projects.find(item => item.id === projectId);
          target.episodes.push(episode);
          target.scripts.push(script);
          target.scenes.push(...scenes);
          ['strategy', 'script', 'storyboard'].forEach(id => {
            const stage = target.workflow.find(item => item.id === id);
            if (stage && stage.status === 'not-started') { stage.status = 'in-progress'; stage.note = 'Автопілот створив чернетку; потрібне ручне редагування.'; stage.updatedAt = createdAt; }
          });
        });
        return send(res, 201, { episode, script, scenes, format: blueprint.format, motionMode: blueprint.motionMode, notice: 'Створено лише редаговану чернетку. Звук, зображення та відеорух не генерувалися.' });
      }
      if (req.method === 'GET' && parts[3] === 'episodes' && parts[4] && parts[5] === 'export') {
        const episode = project.episodes.find(item => item.id === parts[4]);
        if (!episode) return send(res, 404, { error: 'episode not found' });
        const scenes = project.scenes.filter(scene => scene.episodeId === episode.id).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
        const sceneIds = new Set(scenes.map(scene => scene.id));
        const packageData = { schemaVersion: 1, exportedAt: new Date().toISOString(), project: { id: project.id, name: project.name, defaultLanguage: project.defaultLanguage }, episode, scripts: project.scripts.filter(script => script.episodeId === episode.id), scenes, manifests: project.productions.filter(manifest => sceneIds.has(manifest.sceneId)), localizations: project.localizations };
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="episode-package-${episode.id}.json"` });
        return res.end(JSON.stringify(packageData, null, 2));
      }
      if (req.method === 'GET' && parts[3] === 'episodes' && parts[4] && parts[5] === 'davinci-package') {
        const episode = project.episodes.find(item => item.id === parts[4]);
        if (!episode) return send(res, 404, { error: 'episode not found' });
        const mode = url.searchParams.get('mode') === 'final' ? 'final' : 'draft';
        const packagePlan = buildDaVinciPackage(project, episode, mode);
        const file = parts[6] || 'report';
        if (file === 'report') return send(res, 200, packagePlan);
        if (mode === 'final' && !packagePlan.canExport) return send(res, 409, { error: 'Фінальний пакет ще не готовий.', report: packagePlan });
        if (file === 'manifest.json') {
          res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="davinci-package-manifest-${episode.id}-${mode}.json"` });
          return res.end(packageManifestJson(packagePlan));
        }
        if (file === 'timeline.csv') {
          res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="davinci-timeline-${episode.id}-${mode}.csv"` });
          return res.end(handoffTimelineCsv(packagePlan.handoff, Number(project.productionSettings?.fps) || 24));
        }
        if (file === 'handoff.md') {
          res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'content-disposition': `attachment; filename="davinci-handoff-${episode.id}-${mode}.md"` });
          return res.end(handoffMarkdown(packagePlan.handoff));
        }
        return send(res, 404, { error: 'package file not found' });
      }
      if (req.method === 'GET' && parts[3] === 'episodes' && parts[4] && parts[5] === 'davinci-handoff' && parts[6] === 'timeline.csv') {
        const episode = project.episodes.find(item => item.id === parts[4]);
        if (!episode) return send(res, 404, { error: 'episode not found' });
        if (!['approved', 'production', 'released'].includes(episode.status)) return send(res, 409, { error: 'Випуск потрібно явно затвердити перед передачею у DaVinci Resolve.' });
        const validation = validateProject(project, { episodeId: episode.id });
        if (!validation.valid) return send(res, 409, { error: 'Випуск ще не готовий для DaVinci Resolve.', validation });
        const handoff = buildDaVinciHandoff(project, episode);
        res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="davinci-timeline-${episode.id}.csv"` });
        return res.end(handoffTimelineCsv(handoff));
      }
      if (req.method === 'GET' && parts[3] === 'episodes' && parts[4] && parts[5] === 'davinci-handoff') {
        const episode = project.episodes.find(item => item.id === parts[4]);
        if (!episode) return send(res, 404, { error: 'episode not found' });
        if (!['approved', 'production', 'released'].includes(episode.status)) return send(res, 409, { error: 'Випуск потрібно явно затвердити перед передачею у DaVinci Resolve.' });
        const validation = validateProject(project, { episodeId: episode.id });
        if (!validation.valid) return send(res, 409, { error: 'Випуск ще не готовий для DaVinci Resolve.', validation });
        const handoff = buildDaVinciHandoff(project, episode);
        res.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'content-disposition': `attachment; filename="davinci-handoff-${episode.id}.md"` });
        return res.end(handoffMarkdown(handoff));
      }
      if (req.method === 'GET' && parts[3] === 'productions' && parts[4] && parts[5] === 'export') {
        const manifest = project.productions.find(item => item.id === parts[4]);
        if (!manifest) return send(res, 404, { error: 'production manifest not found' });
        const exportData = { schemaVersion: 1, exportedAt: new Date().toISOString(), project: { id: project.id, name: project.name, defaultLanguage: project.defaultLanguage, profile: project.profile }, manifest };
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="production-manifest-${manifest.id}.json"` });
        return res.end(JSON.stringify(exportData, null, 2));
      }
      if (req.method === 'POST' && parts[3] === 'episodes') {
        const episode = { id: randomUUID(), ...validateEpisodeInput(await body(req)), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        if (project.episodes.some(item => item.seasonNumber === episode.seasonNumber && item.episodeNumber === episode.episodeNumber)) return send(res, 409, { error: 'an episode with this season and number already exists' });
        store.update(data => data.projects.find(item => item.id === projectId).episodes.push(episode)); return send(res, 201, episode);
      }
      if (req.method === 'PUT' && parts[3] === 'episodes' && parts[4]) {
        const existing = project.episodes.find(item => item.id === parts[4]);
        if (!existing) return send(res, 404, { error: 'episode not found' });
        const episode = { ...existing, ...validateEpisodeInput(await body(req)), updatedAt: new Date().toISOString() };
        if (project.episodes.some(item => item.id !== existing.id && item.seasonNumber === episode.seasonNumber && item.episodeNumber === episode.episodeNumber)) return send(res, 409, { error: 'an episode with this season and number already exists' });
        store.update(data => { const items = data.projects.find(item => item.id === projectId).episodes; items[items.findIndex(item => item.id === existing.id)] = episode; }); return send(res, 200, episode);
      }
      if (req.method === 'DELETE' && parts[3] === 'episodes' && parts[4]) {
        const existing = project.episodes.find(item => item.id === parts[4]);
        if (!existing) return send(res, 404, { error: 'episode not found' });
        const deletedAt = new Date().toISOString(), purgeAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        store.update(data => {
          const target = data.projects.find(item => item.id === projectId);
          target.scripts.forEach(script => { if (script.episodeId === existing.id && !script.deletedAt) { script.deletedAt = deletedAt; script.purgeAfter = purgeAfter; script.visibility = 'hidden'; script.updatedAt = deletedAt; } });
          target.scenes = target.scenes.filter(scene => scene.episodeId !== existing.id);
          target.productions = target.productions.filter(manifest => !project.scenes.some(scene => scene.episodeId === existing.id && manifest.sceneId === scene.id));
          target.renderJobs = target.renderJobs.filter(job => !project.scenes.some(scene => scene.episodeId === existing.id && job.sceneId === scene.id));
          target.episodes = target.episodes.filter(item => item.id !== existing.id);
        });
        return send(res, 200, { id: existing.id, deletedAt, scriptsMovedToTrashUntil: purgeAfter });
      }
      if (req.method === 'PUT' && parts[3] === 'profile') {
        const profile = validateProfileInput(await body(req));
        store.update(data => { data.projects.find(item => item.id === projectId).profile = profile; });
        return send(res, 200, profile);
      }
      if (req.method === 'POST' && parts[3] === 'workflow' && workflowStages.includes(parts[4])) {
        const input = validateWorkflowInput(await body(req));
        const stage = { id: parts[4], ...input, updatedAt: new Date().toISOString() };
        store.update(data => { const stages = data.projects.find(item => item.id === projectId).workflow; const index = stages.findIndex(item => item.id === stage.id); stages[index] = stage; });
        return send(res, 200, stage);
      }
      if (req.method === 'POST' && parts[3] === 'uploads' && parts.length === 4) {
        const input = await body(req);
        const uri = saveImageUpload(projectId, input);
        const asset = { id: randomUUID(), ...validateAssetInput({ label: input.label, type: 'reference', scope: input.scope || 'other', linkedCharacterId: input.linkedCharacterId || '', uri, version: '0.1.0', notes: input.notes || '', status: 'draft' }) };
        if (asset.linkedCharacterId && !project.bibles.characters.some(item => item.id === asset.linkedCharacterId)) return send(res, 400, { error: 'linkedCharacterId must reference a character in this project' });
        store.update(data => data.projects.find(item => item.id === projectId).assets.push(asset));
        return send(res, 201, asset);
      }
      if (req.method === 'POST' && parts[3] === 'scripts' && parts[4] === 'reorder') {
        const input = await body(req);
        const scriptIds = Array.isArray(input.scriptIds) ? input.scriptIds : [];
        const visible = project.scripts.filter(item => !item.deletedAt && item.visibility !== 'hidden');
        if (scriptIds.length !== visible.length || new Set(scriptIds).size !== scriptIds.length || scriptIds.some(id => !visible.some(script => script.id === id))) return send(res, 400, { error: 'scriptIds must contain every visible script exactly once' });
        store.update(data => {
          const scripts = data.projects.find(item => item.id === projectId).scripts;
          scriptIds.forEach((id, index) => { const script = scripts.find(item => item.id === id); script.order = index + 1; script.updatedAt = new Date().toISOString(); });
        });
        return send(res, 200, { scriptIds });
      }
      if (req.method === 'POST' && parts[3] === 'scripts' && parts[4] && parts[5] === 'visibility') {
        const script = project.scripts.find(item => item.id === parts[4]);
        const input = await body(req);
        if (!script || script.deletedAt) return send(res, 404, { error: 'script not found' });
        if (!['visible', 'hidden'].includes(input.visibility)) return send(res, 400, { error: 'visibility must be visible or hidden' });
        store.update(data => { const item = data.projects.find(project => project.id === projectId).scripts.find(item => item.id === script.id); item.visibility = input.visibility; item.updatedAt = new Date().toISOString(); });
        return send(res, 200, { id: script.id, visibility: input.visibility });
      }
      if (req.method === 'POST' && parts[3] === 'scripts' && parts[4] && parts[5] === 'restore') {
        const script = project.scripts.find(item => item.id === parts[4]);
        if (!script || !script.deletedAt) return send(res, 404, { error: 'script not found in trash' });
        store.update(data => { const item = data.projects.find(project => project.id === projectId).scripts.find(item => item.id === script.id); item.deletedAt = null; item.purgeAfter = null; item.visibility = 'visible'; item.order = data.projects.find(project => project.id === projectId).scripts.filter(other => !other.deletedAt && other.visibility !== 'hidden').length + 1; item.updatedAt = new Date().toISOString(); });
        return send(res, 200, { id: script.id, restored: true });
      }
      if (req.method === 'POST' && parts[3] === 'scripts') {
        const input = validateScriptInput(await body(req)); if (input.episodeId && !project.episodes.some(item => item.id === input.episodeId)) return send(res, 400, { error: 'episodeId must reference an episode in this project' });
        const order = project.scripts.filter(item => !item.deletedAt).reduce((maximum, item) => Math.max(maximum, Number(item.order || 0)), 0) + 1;
        const script = { id: randomUUID(), version: '0.1.0', ...input, order, visibility: 'visible', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        store.update(data => data.projects.find(item => item.id === projectId).scripts.push(script)); return send(res, 201, script);
      }
      if (req.method === 'DELETE' && parts[3] === 'scripts' && parts[4]) {
        const script = project.scripts.find(item => item.id === parts[4]);
        if (!script || script.deletedAt) return send(res, 404, { error: 'script not found' });
        const deletedAt = new Date().toISOString(), purgeAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        store.update(data => { const item = data.projects.find(project => project.id === projectId).scripts.find(item => item.id === script.id); item.deletedAt = deletedAt; item.purgeAfter = purgeAfter; item.visibility = 'hidden'; item.updatedAt = deletedAt; });
        return send(res, 200, { id: script.id, deletedAt, purgeAfter });
      }
      if (req.method === 'PUT' && parts[3] === 'scripts' && parts[4]) {
        const existing = project.scripts.find(item => item.id === parts[4]);
        if (!existing) return send(res, 404, { error: 'script not found' });
        const input = validateScriptInput(await body(req)); if (input.episodeId && !project.episodes.some(item => item.id === input.episodeId)) return send(res, 400, { error: 'episodeId must reference an episode in this project' });
        const script = { ...existing, ...input, updatedAt: new Date().toISOString() };
        store.update(data => { const scripts = data.projects.find(item => item.id === projectId).scripts; scripts[scripts.findIndex(item => item.id === existing.id)] = script; }); return send(res, 200, script);
      }
      if (req.method === 'POST' && parts[3] === 'voice-profiles') {
        const input = validateVoiceProfileInput(await body(req));
        if (project.voiceProfiles.some(item => item.identityKey === input.identityKey)) return send(res, 409, { error: 'voice identity key already exists in this project' });
        if ((input.sampleAssetIds || []).some(id => !project.assets.some(asset => asset.id === id && asset.type === 'audio'))) return send(res, 400, { error: 'sampleAssetIds must reference audio assets in this project' });
        const profile = { id: randomUUID(), ...input, createdAt: new Date().toISOString() };
        store.update(data => data.projects.find(item => item.id === projectId).voiceProfiles.push(profile)); return send(res, 201, profile);
      }
      if (req.method === 'PUT' && parts[3] === 'voice-profiles' && parts[4] && parts.length === 5) {
        const existing = project.voiceProfiles.find(item => item.id === parts[4]);
        if (!existing) return send(res, 404, { error: 'voice profile not found' });
        const input = validateVoiceProfileInput(await body(req));
        if (project.voiceProfiles.some(item => item.id !== existing.id && item.identityKey === input.identityKey)) return send(res, 409, { error: 'voice identity key already exists in this project' });
        if ((input.sampleAssetIds || []).some(id => !project.assets.some(asset => asset.id === id && asset.type === 'audio'))) return send(res, 400, { error: 'sampleAssetIds must reference audio assets in this project' });
        const updated = { ...existing, ...input, updatedAt: new Date().toISOString() };
        store.update(data => { const items = data.projects.find(item => item.id === projectId).voiceProfiles; items[items.findIndex(item => item.id === existing.id)] = updated; }); return send(res, 200, updated);
      }
      if (req.method === 'POST' && parts[3] === 'voice-profiles' && parts[4] && parts[5] === 'assign') {
        const existing = project.voiceProfiles.find(item => item.id === parts[4]);
        if (!existing) return send(res, 404, { error: 'voice profile not found' });
        if (existing.status === 'approved') return send(res, 409, { error: 'approved voice profile cannot be reassigned; create or edit a draft profile instead' });
        const input = await body(req), character = project.bibles.characters.find(item => item.id === input.characterId);
        if (!character) return send(res, 404, { error: 'character not found' });
        if (!character.identityKey) return send(res, 409, { error: 'character needs an identityKey before voice assignment' });
        const used = project.scenes.some(scene => (scene.dialogue || []).some(line => line.voiceIdentityKey === existing.identityKey));
        if (used && existing.identityKey !== character.identityKey) return send(res, 409, { error: 'voice profile is already used by dialogue and cannot be reassigned safely' });
        if (project.voiceProfiles.some(item => item.id !== existing.id && item.identityKey === character.identityKey)) return send(res, 409, { error: 'this character already has a voice profile' });
        const updated = { ...existing, identityKey: character.identityKey, ageBand: character.ageBand, updatedAt: new Date().toISOString() };
        store.update(data => { const items = data.projects.find(item => item.id === projectId).voiceProfiles; items[items.findIndex(item => item.id === existing.id)] = updated; });
        return send(res, 200, updated);
      }
      if (req.method === 'POST' && parts[3] === 'localizations') {
        const localization = { id: randomUUID(), ...validateLocalizationInput(await body(req)), updatedAt: new Date().toISOString() };
        if (project.localizations.some(item => item.language === localization.language)) return send(res, 409, { error: 'this language version already exists in this project' });
        store.update(data => data.projects.find(item => item.id === projectId).localizations.push(localization)); return send(res, 201, localization);
      }
      if (req.method === 'PUT' && parts[3] === 'localizations' && parts[4]) {
        const existing = project.localizations.find(item => item.id === parts[4]);
        if (!existing) return send(res, 404, { error: 'language version not found' });
        const localization = { ...existing, ...validateLocalizationInput(await body(req)), updatedAt: new Date().toISOString() };
        if (project.localizations.some(item => item.id !== existing.id && item.language === localization.language)) return send(res, 409, { error: 'this language version already exists in this project' });
        store.update(data => { const items = data.projects.find(item => item.id === projectId).localizations; items[items.findIndex(item => item.id === existing.id)] = localization; }); return send(res, 200, localization);
      }
      if (req.method === 'POST' && parts[3] === 'render-jobs') {
        const input = validateRenderJobInput(await body(req));
        const manifest = project.productions.find(item => item.id === input.manifestId && item.status === 'approved-for-worker');
        if (!manifest) return send(res, 409, { error: 'an approved production manifest is required before queuing a render' });
        const job = { id: randomUUID(), ...input, sceneId: manifest.sceneId, status: 'queued', worker: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), note: 'Очікує підключення GPU worker. Локальний MacBook не виконує цей рендер.' };
        store.update(data => data.projects.find(item => item.id === projectId).renderJobs.push(job)); return send(res, 201, job);
      }
      if (req.method === 'POST' && parts[3] === 'validate') return send(res, 200, validateProject(project, { sceneId: url.searchParams.get('sceneId') || undefined, episodeId: url.searchParams.get('episodeId') || undefined }));
      if (req.method === 'POST' && parts[3] === 'scenes' && parts.length === 4) {
        const input = validateSceneInput(await body(req)); if (input.episodeId && !project.episodes.some(item => item.id === input.episodeId)) return send(res, 400, { error: 'episodeId must reference an episode in this project' }); const scene = { id: randomUUID(), title: input.title, episodeId: input.episodeId, purpose: input.purpose, durationSeconds: input.durationSeconds, order: input.order, characterIds: input.characterIds, shots: input.shots.map(shot => ({ id: randomUUID(), ...shot })), dialogue: input.dialogue, status: input.status, prompts: input.prompt ? [{ kind: 'storyboard', text: input.prompt, createdAt: new Date().toISOString() }] : [], renderJobs: [] };
        store.update(data => data.projects.find(x => x.id === projectId).scenes.push(scene)); return send(res, 201, scene);
      }
      if (parts[3] === 'scenes' && parts[4]) {
        const scene = project.scenes.find(item => item.id === parts[4]);
        if (!scene) return send(res, 404, { error: 'scene not found' });
        if (req.method === 'PUT' && parts.length === 5) {
          const input = validateSceneInput(await body(req));
          if (input.episodeId && !project.episodes.some(item => item.id === input.episodeId)) return send(res, 400, { error: 'episodeId must reference an episode in this project' });
          const updated = { ...scene, ...input, shots: scene.shots, dialogue: scene.dialogue };
          store.update(data => { const scenes = data.projects.find(item => item.id === projectId).scenes; scenes[scenes.findIndex(item => item.id === scene.id)] = updated; }); return send(res, 200, updated);
        }
        if (req.method === 'POST' && parts[5] === 'shots' && parts[6] && parts[7] === 'image-brief') {
          const shot = scene.shots.find(item => item.id === parts[6]);
          if (!shot) return send(res, 404, { error: 'shot not found' });
          return send(res, 200, buildShotImageBrief(project, scene, shot));
        }
        if (req.method === 'POST' && parts[5] === 'shots') {
          const shot = { id: randomUUID(), ...validateShotInput(await body(req)) };
          store.update(data => data.projects.find(item => item.id === projectId).scenes.find(item => item.id === scene.id).shots.push(shot)); return send(res, 201, shot);
        }
        if (req.method === 'PUT' && parts[5] === 'shots' && parts[6]) {
          const shot = scene.shots.find(item => item.id === parts[6]);
          if (!shot) return send(res, 404, { error: 'shot not found' });
          const updated = { id: shot.id, ...validateShotInput(await body(req)) };
          store.update(data => { const target = data.projects.find(item => item.id === projectId).scenes.find(item => item.id === scene.id).shots; target[target.findIndex(item => item.id === shot.id)] = updated; }); return send(res, 200, updated);
        }
        if (req.method === 'POST' && parts[5] === 'dialogue' && parts[6] && parts[7] === 'synthesize') {
          const line = scene.dialogue.find(item => item.id === parts[6]);
          if (!line) return send(res, 404, { error: 'dialogue line not found' });
          const input = await body(req); const language = input.language === 'en' ? 'en' : 'uk';
          const text = language === 'en' ? line.textEn : (line.textUk || (line.language === 'uk' ? line.text : ''));
          const profile = project.voiceProfiles.find(item => item.identityKey === line.voiceIdentityKey);
          const settings = { stability: 0.5, similarityBoost: 0.75, style: 0, speed: 1, sentenceSilence: 0.2, volume: 1, outputFormat: 'wav', speakerBoost: true, ...(profile?.generationSettings || {}), ...(line.generationSettings || {}) };
          const generated = profile?.provider === 'elevenlabs'
            ? await synthesizeElevenLabsVoice({ projectId, dialogueId: line.id, text, voiceId: profile.providerVoiceId, modelId: profile.modelId || 'eleven_multilingual_v2', ...settings })
            : hasPiperVoice() ? await synthesizePiperVoice({ projectId, dialogueId: line.id, language, text, ...settings }) : await synthesizeMacVoice({ projectId, dialogueId: line.id, language, text, rate: Math.round(165 * settings.speed) });
          const draft = { id: randomUUID(), language, text, ...generated, generationSettings: settings, createdAt: new Date().toISOString(), status: 'draft' };
          store.update(data => { const target = data.projects.find(item => item.id === projectId).scenes.find(item => item.id === scene.id).dialogue.find(item => item.id === line.id); target.audioDrafts = [...(target.audioDrafts || []), draft]; });
          return send(res, 201, draft);
        }
        if (req.method === 'POST' && parts[5] === 'dialogue') {
          const input = await body(req); const character = project.bibles.characters.find(item => item.id === input.characterId);
          const line = { id: randomUUID(), ...validateDialogueInput(input, character) };
          store.update(data => data.projects.find(item => item.id === projectId).scenes.find(item => item.id === scene.id).dialogue.push(line)); return send(res, 201, line);
        }
        if (req.method === 'PUT' && parts[5] === 'dialogue' && parts[6]) {
          const line = scene.dialogue.find(item => item.id === parts[6]);
          if (!line) return send(res, 404, { error: 'dialogue line not found' });
          const input = await body(req); const character = project.bibles.characters.find(item => item.id === input.characterId);
          const validated = validateDialogueInput(input, character);
          const updated = { id: line.id, ...validated, generationSettings: validated.generationSettings === undefined ? line.generationSettings : validated.generationSettings, audioDrafts: line.audioDrafts || [] };
          store.update(data => { const lines = data.projects.find(item => item.id === projectId).scenes.find(item => item.id === scene.id).dialogue; lines[lines.findIndex(item => item.id === line.id)] = updated; }); return send(res, 200, updated);
        }
      }
      if (req.method === 'POST' && parts[3] === 'assets' && parts.length === 4) {
        const asset = { id: randomUUID(), ...validateAssetInput(await body(req)) };
        if (asset.linkedCharacterId && !project.bibles.characters.some(item => item.id === asset.linkedCharacterId)) return send(res, 400, { error: 'linkedCharacterId must reference a character in this project' });
        if (asset.linkedSceneId && !project.scenes.some(item => item.id === asset.linkedSceneId)) return send(res, 400, { error: 'linkedSceneId must reference a scene in this project' });
        if (asset.linkedShotId && !project.scenes.some(scene => (scene.shots || []).some(shot => shot.id === asset.linkedShotId) && (!asset.linkedSceneId || scene.id === asset.linkedSceneId))) return send(res, 400, { error: 'linkedShotId must reference a shot in the linked scene' });
        store.update(data => data.projects.find(item => item.id === projectId).assets.push(asset)); return send(res, 201, asset);
      }
      if (req.method === 'POST' && parts[3] === 'assets' && parts[4] && parts[5] === 'versions') {
        const asset = project.assets.find(item => item.id === parts[4]);
        if (!asset) return send(res, 404, { error: 'asset not found' });
        const version = createAssetVersion(asset, await body(req));
        store.update(data => {
          const target = data.projects.find(item => item.id === projectId);
          target.assetVersions.push(version);
          const targetAsset = target.assets.find(item => item.id === asset.id);
          if (!targetAsset.currentVersionId || targetAsset.status !== 'approved') targetAsset.currentVersionId = version.id;
        });
        return send(res, 201, version);
      }
      if (req.method === 'PUT' && parts[3] === 'assets' && parts[4]) {
        const existing = project.assets.find(item => item.id === parts[4]);
        if (!existing) return send(res, 404, { error: 'asset not found' });
        const asset = { id: existing.id, ...validateAssetInput(await body(req)), currentVersionId: existing.currentVersionId || null };
        if (asset.linkedCharacterId && !project.bibles.characters.some(item => item.id === asset.linkedCharacterId)) return send(res, 400, { error: 'linkedCharacterId must reference a character in this project' });
        if (asset.linkedSceneId && !project.scenes.some(item => item.id === asset.linkedSceneId)) return send(res, 400, { error: 'linkedSceneId must reference a scene in this project' });
        if (asset.linkedShotId && !project.scenes.some(scene => (scene.shots || []).some(shot => shot.id === asset.linkedShotId) && (!asset.linkedSceneId || scene.id === asset.linkedSceneId))) return send(res, 400, { error: 'linkedShotId must reference a shot in the linked scene' });
        store.update(data => { const items = data.projects.find(item => item.id === projectId).assets; items[items.findIndex(item => item.id === existing.id)] = asset; }); return send(res, 200, asset);
      }
      if (req.method === 'POST' && parts[3] === 'productions') {
        const input = await body(req); const scene = project.scenes.find(item => item.id === input.sceneId);
        if (!scene) return send(res, 404, { error: 'scene not found' });
        const approval = typeof input.approvedBy === 'string' && input.approvedBy.trim();
        if (!approval) return send(res, 400, { error: 'approvedBy is required to create a production manifest' });
        const validation = validateProject(project, { sceneId: scene.id }); if (!validation.valid) return send(res, 409, { error: 'scene is not production-ready', validation });
        const characterBible = project.bibles.characters.filter(item => scene.characterIds.includes(item.id) && item.status === 'approved');
        const assetIds = new Set(scene.shots.flatMap(shot => shot.referenceAssetIds || []));
        const manifest = { id: randomUUID(), schemaVersion: 1, status: 'approved-for-worker', sceneId: scene.id, approvedBy: input.approvedBy.trim(), approvedAt: new Date().toISOString(), scene: { title: scene.title, durationSeconds: scene.durationSeconds, purpose: scene.purpose }, approvedBibleVersions: { style: project.bibles.style.filter(item => item.status === 'approved').map(item => item.version), characters: characterBible.map(item => item.version) }, styleBible: project.bibles.style.filter(item => item.status === 'approved'), characterBible, assets: project.assets.filter(item => assetIds.has(item.id)), shots: scene.shots, dialogue: scene.dialogue, promptAudit: scene.prompts };
        store.update(data => data.projects.find(item => item.id === projectId).productions.push(manifest)); return send(res, 201, manifest);
      }
      if (req.method === 'POST' && parts[3] === 'bibles' && ['style', 'characters'].includes(parts[4])) {
        const input = validateBibleInput(await body(req), parts[4]); const entry = { id: randomUUID(), ...input };
        store.update(data => data.projects.find(x => x.id === projectId).bibles[parts[4]].push(entry)); return send(res, 201, entry);
      }
      if (req.method === 'PUT' && parts[3] === 'bibles' && ['style', 'characters'].includes(parts[4]) && parts[5]) {
        const entries = project.bibles[parts[4]]; const existing = entries.find(item => item.id === parts[5]);
        if (!existing) return send(res, 404, { error: 'bible entry not found' });
        const updated = { id: existing.id, ...validateBibleInput(await body(req), parts[4]) };
        store.update(data => { const target = data.projects.find(item => item.id === projectId).bibles[parts[4]]; target[target.findIndex(item => item.id === existing.id)] = updated; }); return send(res, 200, updated);
      }
    }
    if (staticFile(res, url.pathname)) return;
    send(res, 404, { error: 'not found' });
  } catch (error) { send(res, error.status || 400, { error: error.message }); }
});
if (require.main === module) server.listen(process.env.PORT || 4173, () => console.log('AI Video Studio: http://localhost:4173'));
module.exports = { server, findProject, allowedAgeBands, supportedLanguages };
