const { allowedAgeBands, supportedLanguages, projectTypes, bibleStatuses, workflowStatuses } = require('../shared/schema');

class InputError extends Error {}

function nonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new InputError(`${field} is required`);
  return value.trim();
}

function optionalString(value, field) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new InputError(`${field} must be a string`);
  return value.trim();
}

function positiveNumber(value, field, fallback) {
  const candidate = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(candidate) || candidate <= 0) throw new InputError(`${field} must be a positive number`);
  return candidate;
}

function boundedNumber(value, field, minimum, maximum, fallback) {
  const candidate = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(candidate) || candidate < minimum || candidate > maximum) throw new InputError(`${field} must be between ${minimum} and ${maximum}`);
  return candidate;
}

function oneOf(value, allowed, field, fallback) {
  const candidate = value === undefined || value === null || value === '' ? fallback : value;
  if (!allowed.includes(candidate)) throw new InputError(`${field} must be one of: ${allowed.join(', ')}`);
  return candidate;
}

function stringArray(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) throw new InputError(`${field} must be an array of non-empty strings`);
  return [...new Set(value.map(item => item.trim()))];
}

function validateProjectInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  const defaultLanguage = oneOf(input.defaultLanguage, supportedLanguages, 'defaultLanguage', 'uk');
  const additionalLanguages = stringArray(input.additionalLanguages, 'additionalLanguages');
  if (additionalLanguages.some(code => !supportedLanguages.includes(code))) throw new InputError('additionalLanguages contains an unsupported language');
  return {
    name: nonEmptyString(input.name, 'name'),
    type: oneOf(input.type, projectTypes, 'type', 'general'),
    defaultLanguage,
    additionalLanguages: additionalLanguages.filter(code => code !== defaultLanguage),
    targetMinutes: positiveNumber(input.targetMinutes, 'targetMinutes', 10),
    description: optionalString(input.description, 'description'),
    resolution: oneOf(input.resolution, ['1280x720','1920x1080','3840x2160'], 'resolution', '1920x1080'),
    aspectRatio: oneOf(input.aspectRatio, ['16:9','9:16','1:1','4:3'], 'aspectRatio', '16:9'),
    fps: boundedNumber(input.fps, 'fps', 12, 60, 24),
    plannedEpisodes: boundedNumber(input.plannedEpisodes, 'plannedEpisodes', 1, 200, 1)
  };
}

function validateBibleInput(input, kind) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  const entry = {
    name: nonEmptyString(input.name, 'name'),
    version: nonEmptyString(input.version || '0.1.0', 'version'),
    status: oneOf(input.status, bibleStatuses, 'status', 'draft'),
    rules: optionalString(input.rules, 'rules'),
    references: stringArray(input.references, 'references')
  };
  if (kind === 'characters') {
    entry.ageBand = oneOf(input.ageBand, allowedAgeBands, 'ageBand', 'adult');
    entry.identityKey = optionalString(input.identityKey, 'identityKey');
    entry.role = optionalString(input.role, 'role');
    entry.appearance = optionalString(input.appearance, 'appearance');
    entry.voiceNotes = optionalString(input.voiceNotes, 'voiceNotes');
    entry.wardrobeAccessories = optionalString(input.wardrobeAccessories, 'wardrobeAccessories');
    entry.voiceProfileId = optionalString(input.voiceProfileId, 'voiceProfileId');
    entry.referenceAssetIds = stringArray(input.referenceAssetIds, 'referenceAssetIds');
  }
  return entry;
}

function validateSceneInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  const durationSeconds = positiveNumber(input.durationSeconds, 'durationSeconds', 10);
  const characterIds = stringArray(input.characterIds, 'characterIds');
  let shots;
  if (input.shots === undefined) {
    shots = [{ seconds: durationSeconds, prompt: optionalString(input.prompt, 'prompt'), camera: 'medium', imagePrompt: optionalString(input.prompt, 'prompt'), motionPrompt: '', lighting: '', referenceAssetIds: [], status: 'draft' }];
  } else {
    if (!Array.isArray(input.shots) || input.shots.length === 0) throw new InputError('shots must be a non-empty array');
    shots = input.shots.map((shot, index) => {
      if (!shot || typeof shot !== 'object' || Array.isArray(shot)) throw new InputError(`shots[${index}] must be an object`);
      return validateShotInput(shot, `shots[${index}]`);
    });
  }
  const dialogue = input.dialogue === undefined ? [] : input.dialogue;
  if (!Array.isArray(dialogue)) throw new InputError('dialogue must be an array');
  return { title: nonEmptyString(input.title, 'title'), episodeId: optionalString(input.episodeId, 'episodeId'), purpose: optionalString(input.purpose, 'purpose'), durationSeconds, order: positiveNumber(input.order, 'order', 1), status: oneOf(input.status, ['draft', 'in-review', 'approved', 'production'], 'status', 'draft'), characterIds, shots, dialogue, prompt: optionalString(input.prompt, 'prompt') };
}

function validateShotInput(input, prefix = '') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  const field = name => prefix ? `${prefix}.${name}` : name;
  const imagePrompt = optionalString(input.imagePrompt === undefined ? input.prompt : input.imagePrompt, field('imagePrompt'));
  return { seconds: positiveNumber(input.seconds, field('seconds')), order: positiveNumber(input.order, field('order'), 1), prompt: imagePrompt, imagePrompt, motionPrompt: optionalString(input.motionPrompt, field('motionPrompt')), camera: optionalString(input.camera, field('camera')) || 'medium', lighting: optionalString(input.lighting, field('lighting')), action: optionalString(input.action, field('action')), acceptanceCriteria: optionalString(input.acceptanceCriteria, field('acceptanceCriteria')), keyImageAssetId: optionalString(input.keyImageAssetId, field('keyImageAssetId')), referenceAssetIds: stringArray(input.referenceAssetIds, field('referenceAssetIds')), characterIds: stringArray(input.characterIds, field('characterIds')), status: oneOf(input.status, ['draft', 'ready', 'approved'], field('status'), 'draft') };
}

function validateDialogueInput(input, character) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  const characterId = nonEmptyString(input.characterId, 'characterId');
  if (!character || character.id !== characterId || character.status !== 'approved') throw new InputError('characterId must reference an approved character');
  const voiceAgeBand = oneOf(input.voiceAgeBand, allowedAgeBands, 'voiceAgeBand', character.ageBand);
  if (voiceAgeBand !== character.ageBand) throw new InputError('voiceAgeBand must match the character ageBand');
  const voiceIdentityKey = nonEmptyString(input.voiceIdentityKey, 'voiceIdentityKey');
  if (voiceIdentityKey !== character.identityKey) throw new InputError('voiceIdentityKey must match the approved character identity');
  const text = optionalString(input.text, 'text');
  const textUk = optionalString(input.textUk, 'textUk');
  const textEn = optionalString(input.textEn, 'textEn');
  if (!text && !textUk && !textEn) throw new InputError('text, textUk, or textEn is required');
  const language = oneOf(input.language, supportedLanguages, 'language', textEn && !textUk ? 'en' : 'uk');
  const settings = input.generationSettings;
  if (settings !== undefined && (!settings || typeof settings !== 'object' || Array.isArray(settings))) throw new InputError('generationSettings must be an object');
  const generationSettings = settings === undefined ? undefined : {
    stability: boundedNumber(settings.stability, 'generationSettings.stability', 0, 1, 0.5),
    similarityBoost: boundedNumber(settings.similarityBoost, 'generationSettings.similarityBoost', 0, 1, 0.75),
    style: boundedNumber(settings.style, 'generationSettings.style', 0, 1, 0),
    speed: boundedNumber(settings.speed, 'generationSettings.speed', 0.7, 1.2, 1),
    sentenceSilence: boundedNumber(settings.sentenceSilence, 'generationSettings.sentenceSilence', 0, 1.5, 0.2),
    volume: boundedNumber(settings.volume, 'generationSettings.volume', 0.5, 1.5, 1)
  };
  return { characterId, text: text || (language === 'en' ? textEn : textUk), textUk, textEn, language, voiceAgeBand, voiceIdentityKey, estimatedSeconds: positiveNumber(input.estimatedSeconds, 'estimatedSeconds', 1), emotion: optionalString(input.emotion, 'emotion'), performanceNote: optionalString(input.performanceNote, 'performanceNote'), generationSettings, status: oneOf(input.status, ['draft', 'in-review', 'approved'], 'status', 'draft') };
}

function validateAssetInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  const annotations = input.annotations === undefined ? [] : input.annotations;
  if (!Array.isArray(annotations) || annotations.some(annotation => !annotation || !['pencil', 'arrow'].includes(annotation.type) || !Array.isArray(annotation.points) || annotation.points.length < 2 || annotation.points.some(point => !Array.isArray(point) || point.length !== 2 || point.some(value => typeof value !== 'number' || value < 0 || value > 1)))) throw new InputError('annotations must contain normalized pencil or arrow points');
  const edit = input.audioEdit && typeof input.audioEdit === 'object' && !Array.isArray(input.audioEdit) ? input.audioEdit : {};
  return {
    type: oneOf(input.type, ['blender-rig', 'blender-scene', 'reference', 'image', 'video', 'audio', 'music', 'ambient', 'sfx', 'export'], 'type'),
    scope: oneOf(input.scope, ['character', 'location', 'object', 'style', 'scene', 'shot', 'audio', 'other'], 'scope', 'other'),
    linkedCharacterId: optionalString(input.linkedCharacterId, 'linkedCharacterId'),
    linkedSceneId: optionalString(input.linkedSceneId, 'linkedSceneId'),
    linkedShotId: optionalString(input.linkedShotId, 'linkedShotId'),
    label: nonEmptyString(input.label, 'label'),
    uri: nonEmptyString(input.uri, 'uri'),
    version: nonEmptyString(input.version || '0.1.0', 'version'),
    notes: optionalString(input.notes, 'notes'),
    annotations: annotations.map(annotation => ({ type: annotation.type, color: typeof annotation.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(annotation.color) ? annotation.color : '#ffcc66', points: annotation.points.map(point => [point[0], point[1]]) })),
    audioEdit: ['audio','music','ambient','sfx'].includes(input.type) ? {
      trimStart: boundedNumber(edit.trimStart, 'audioEdit.trimStart', 0, 36000, 0),
      trimEnd: boundedNumber(edit.trimEnd, 'audioEdit.trimEnd', 0, 36000, 0),
      fadeIn: boundedNumber(edit.fadeIn, 'audioEdit.fadeIn', 0, 60, 0),
      fadeOut: boundedNumber(edit.fadeOut, 'audioEdit.fadeOut', 0, 60, 0),
      volume: boundedNumber(edit.volume, 'audioEdit.volume', 0, 2, 1)
    } : undefined,
    status: oneOf(input.status, bibleStatuses, 'status', 'draft')
  };
}

function validateProfileInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  const fields = ['audience', 'format', 'tone', 'mission', 'gospelFoundation', 'creativeApproach', 'audiencePromise', 'editorialRules', 'exclusions', 'seasonArc', 'approvalOwner'];
  return Object.fromEntries(fields.map(field => [field, optionalString(input[field], field)]));
}

function validateWorkflowInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  return { status: oneOf(input.status, workflowStatuses, 'status', 'not-started'), note: optionalString(input.note, 'note') };
}

function validateScriptInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  return {
    title: nonEmptyString(input.title, 'title'),
    episodeId: optionalString(input.episodeId, 'episodeId'),
    logline: optionalString(input.logline, 'logline'),
    body: nonEmptyString(input.body, 'body'),
    status: oneOf(input.status, ['draft', 'in-review', 'approved'], 'status', 'draft')
  };
}

function validateVoiceProfileInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  const languages = stringArray(input.languages, 'languages').map(language => oneOf(language, supportedLanguages, 'languages'));
  if (!languages.length) throw new InputError('languages must contain at least one supported language');
  const settings = input.generationSettings || {};
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new InputError('generationSettings must be an object');
  const provider = oneOf(input.provider, ['local', 'elevenlabs'], 'provider', 'local');
  const providerVoiceId = optionalString(input.providerVoiceId, 'providerVoiceId');
  if (provider === 'elevenlabs' && !providerVoiceId) throw new InputError('providerVoiceId is required for ElevenLabs');
  const voiceOrigin = oneOf(input.voiceOrigin, ['synthetic','system','licensed-library','self-recorded','authorized-clone'], 'voiceOrigin', provider === 'elevenlabs' ? 'licensed-library' : 'system');
  const rightsConfirmed = input.rightsConfirmed === true || input.rightsConfirmed === 'true' || input.rightsConfirmed === 'on';
  if (voiceOrigin === 'authorized-clone' && !rightsConfirmed) throw new InputError('rightsConfirmed is required for an authorized cloned voice');
  return {
    name: nonEmptyString(input.name, 'name'),
    identityKey: nonEmptyString(input.identityKey, 'identityKey'),
    ageBand: oneOf(input.ageBand, allowedAgeBands, 'ageBand', 'adult'),
    languages,
    engine: nonEmptyString(input.engine, 'engine'),
    provider,
    providerVoiceId,
    modelId: optionalString(input.modelId, 'modelId') || (provider === 'elevenlabs' ? 'eleven_multilingual_v2' : ''),
    license: nonEmptyString(input.license, 'license'),
    voiceOrigin,
    rightsConfirmed,
    rightsNote: optionalString(input.rightsNote, 'rightsNote'),
    sampleAssetIds: stringArray(input.sampleAssetIds, 'sampleAssetIds'),
    notes: optionalString(input.notes, 'notes'),
    generationSettings: {
      stability: boundedNumber(settings.stability, 'generationSettings.stability', 0, 1, 0.5),
      similarityBoost: boundedNumber(settings.similarityBoost, 'generationSettings.similarityBoost', 0, 1, 0.75),
      style: boundedNumber(settings.style, 'generationSettings.style', 0, 1, 0),
      speed: boundedNumber(settings.speed, 'generationSettings.speed', 0.7, 1.2, 1),
      sentenceSilence: boundedNumber(settings.sentenceSilence, 'generationSettings.sentenceSilence', 0, 1.5, 0.2),
      volume: boundedNumber(settings.volume, 'generationSettings.volume', 0.5, 1.5, 1),
      outputFormat: oneOf(settings.outputFormat, ['wav', 'mp3'], 'generationSettings.outputFormat', provider === 'elevenlabs' ? 'mp3' : 'wav'),
      speakerBoost: settings.speakerBoost === undefined ? true : Boolean(settings.speakerBoost)
    },
    status: oneOf(input.status, ['draft', 'approved', 'retired'], 'status', 'draft')
  };
}

function validateLocalizationInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  return {
    language: oneOf(input.language, supportedLanguages, 'language'),
    status: oneOf(input.status, ['planned', 'in-progress', 'approved'], 'status', 'planned'),
    videoMasterUri: optionalString(input.videoMasterUri, 'videoMasterUri'),
    voiceStemUri: optionalString(input.voiceStemUri, 'voiceStemUri'),
    musicStemUri: optionalString(input.musicStemUri, 'musicStemUri'),
    sfxStemUri: optionalString(input.sfxStemUri, 'sfxStemUri'),
    subtitlesUri: optionalString(input.subtitlesUri, 'subtitlesUri'),
    notes: optionalString(input.notes, 'notes')
  };
}

function validateRenderJobInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  return {
    manifestId: nonEmptyString(input.manifestId, 'manifestId'),
    target: oneOf(input.target, ['preview-720p', 'master-1080p', 'master-4k'], 'target', 'preview-720p'),
    priority: oneOf(input.priority, ['normal', 'high'], 'priority', 'normal')
  };
}

function validateEpisodeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('request body must be an object');
  return {
    title: nonEmptyString(input.title, 'title'),
    logline: optionalString(input.logline, 'logline'),
    theme: optionalString(input.theme, 'theme'),
    seasonNumber: positiveNumber(input.seasonNumber, 'seasonNumber', 1),
    episodeNumber: positiveNumber(input.episodeNumber, 'episodeNumber', 1),
    targetMinutes: positiveNumber(input.targetMinutes, 'targetMinutes', 10),
    status: oneOf(input.status, ['idea', 'development', 'approved', 'production', 'released'], 'status', 'idea')
  };
}

function validateProject(project, scope = {}) {
  const errors = [];
  const productionCheck = Boolean(scope.sceneId || scope.episodeId);
  const approvedCharacters = new Map(project.bibles.characters.filter(x => x.status === 'approved').map(x => [x.id, x]));
  const approvedStyles = project.bibles.style.filter(x => x.status === 'approved');
  const assetsById = new Map((project.assets || []).map(asset => [asset.id, asset]));
  const voiceProfiles = project.voiceProfiles || [];
  if (approvedStyles.length === 0) errors.push(issue('STYLE_BIBLE_REQUIRED', 'Потрібна щонайменше одна затверджена Style Bible.'));
  const scenes = project.scenes.filter(scene => !scope.sceneId || scene.id === scope.sceneId).filter(scene => !scope.episodeId || scene.episodeId === scope.episodeId);
  if (scope.sceneId && !scenes.length) errors.push(issue('SCENE_NOT_FOUND', 'Вказану сцену не знайдено.'));
  if (scope.episodeId && !scenes.length) errors.push(issue('EPISODE_HAS_NO_SCENES', 'У випуску ще немає сцен.'));
  for (const scene of scenes) {
    if (productionCheck && !['approved', 'production'].includes(scene.status)) {
      errors.push(issue('SCENE_APPROVAL_REQUIRED', `Сцена «${scene.title}» має бути явно затверджена перед створенням production manifest або передачі випуску.`, scene.id));
      continue;
    }
    if (!Number.isFinite(Number(scene.durationSeconds)) || Number(scene.durationSeconds) <= 0) errors.push(issue('SCENE_DURATION_INVALID', `Сцена «${scene.title}» повинна мати додатну тривалість.`, scene.id));
    if (!scene.characterIds?.length) errors.push(issue('SCENE_CHARACTER_REQUIRED', `Сцена «${scene.title}» не містить персонажів.`, scene.id));
    for (const characterId of scene.characterIds || []) if (!approvedCharacters.has(characterId)) errors.push(issue('UNKNOWN_OR_UNAPPROVED_CHARACTER', `Персонаж ${characterId} не затверджений у Character Bible.`, scene.id));
    if (!scene.shots?.length || scene.shots.some(shot => !Number.isFinite(Number(shot.seconds)) || Number(shot.seconds) <= 0)) errors.push(issue('SHOT_DURATION_INVALID', `Кожен шот у сцені «${scene.title}» повинен мати додатну тривалість.`, scene.id));
    for (const shot of scene.shots || []) {
      for (const assetId of shot.referenceAssetIds || []) {
        const asset = assetsById.get(assetId);
        if (!asset) errors.push(issue('SHOT_REFERENCE_MISSING', `Шот посилається на відсутній ресурс ${assetId}.`, scene.id, shot.id));
        else if (productionCheck && asset.status !== 'approved') errors.push(issue('SHOT_REFERENCE_NOT_APPROVED', `Ресурс «${asset.label}» у шоті має бути затверджений.`, scene.id, shot.id));
      }
      if (productionCheck) {
        if (shot.status !== 'approved') errors.push(issue('SHOT_APPROVAL_REQUIRED', 'Кожен шот має бути затверджений перед production.', scene.id, shot.id));
        const keyImage = assetsById.get(shot.keyImageAssetId);
        if (!shot.keyImageAssetId) errors.push(issue('SHOT_KEY_IMAGE_REQUIRED', 'Для кожного шоту потрібен обраний ключовий кадр.', scene.id, shot.id));
        else if (!keyImage) errors.push(issue('SHOT_KEY_IMAGE_MISSING', `Ключовий кадр ${shot.keyImageAssetId} не знайдено.`, scene.id, shot.id));
        else if (!['image', 'reference'].includes(keyImage.type)) errors.push(issue('SHOT_KEY_IMAGE_TYPE_INVALID', 'Ключовий кадр має бути зображенням або візуальним референсом.', scene.id, shot.id));
        else if (keyImage.status !== 'approved') errors.push(issue('SHOT_KEY_IMAGE_NOT_APPROVED', `Ключовий кадр «${keyImage.label}» ще не затверджений.`, scene.id, shot.id));
      }
    }
    const shotSeconds = (scene.shots || []).reduce((total, shot) => total + Number(shot.seconds || 0), 0);
    if (Math.abs(shotSeconds - Number(scene.durationSeconds || 0)) > 0.01) errors.push(issue('SHOT_TIMING_MISMATCH', `Сума шотів (${shotSeconds} c) не збігається з тривалістю сцени (${scene.durationSeconds} c).`, scene.id));
    for (const line of scene.dialogue || []) {
      const character = approvedCharacters.get(line.characterId);
      if (!character) continue;
      if (!allowedAgeBands.includes(line.voiceAgeBand) || line.voiceAgeBand !== character.ageBand) errors.push(issue('VOICE_AGE_MISMATCH', `Голос для «${character.name}» має вікову категорію «${character.ageBand}».`, scene.id, line.id));
      if (!line.voiceIdentityKey) errors.push(issue('VOICE_IDENTITY_REQUIRED', `Для репліки «${character.name}» не задано стабільну voice identity.`, scene.id, line.id));
      if (line.voiceIdentityKey && line.voiceIdentityKey !== character.identityKey) errors.push(issue('VOICE_IDENTITY_MISMATCH', `Голос для «${character.name}» повинен використовувати затверджений identity key.`, scene.id, line.id));
      if (!line.language) errors.push(issue('DIALOGUE_LANGUAGE_REQUIRED', 'Репліка повинна мати мову.', scene.id, line.id));
      if (productionCheck) {
        if (line.status !== 'approved') errors.push(issue('DIALOGUE_APPROVAL_REQUIRED', `Репліка «${character.name}» має бути затверджена перед production.`, scene.id, line.id));
        const voice = voiceProfiles.find(profile => profile.id === character.voiceProfileId) || voiceProfiles.find(profile => profile.identityKey === line.voiceIdentityKey && profile.ageBand === character.ageBand);
        if (!voice) errors.push(issue('VOICE_PROFILE_REQUIRED', `Для репліки «${character.name}» потрібен призначений голосовий профіль або профіль з identity key «${line.voiceIdentityKey}».`, scene.id, line.id));
        else {
          if (voice.status !== 'approved') errors.push(issue('VOICE_PROFILE_NOT_APPROVED', `Профіль голосу «${voice.name}» ще не затверджений.`, scene.id, line.id));
          if (!voice.languages?.includes(line.language)) errors.push(issue('VOICE_LANGUAGE_UNSUPPORTED', `Профіль голосу «${voice.name}» не підтримує мову репліки.`, scene.id, line.id));
        }
        if (!(line.audioDrafts || []).some(audio => audio.language === line.language && audio.status === 'approved')) errors.push(issue('DIALOGUE_AUDIO_REQUIRED', `Для репліки «${character.name}» немає затвердженої озвучки.`, scene.id, line.id));
      }
    }
  }
  return { valid: errors.length === 0, errors, scope: { sceneId: scope.sceneId || null, episodeId: scope.episodeId || null, scenesChecked: scenes.length }, checkedAt: new Date().toISOString() };
}
function issue(code, message, sceneId, lineId) { return { code, message, sceneId, lineId, severity: 'error' }; }
module.exports = { InputError, validateProject, validateProjectInput, validateBibleInput, validateSceneInput, validateShotInput, validateDialogueInput, validateAssetInput, validateProfileInput, validateWorkflowInput, validateScriptInput, validateVoiceProfileInput, validateLocalizationInput, validateRenderJobInput, validateEpisodeInput };
