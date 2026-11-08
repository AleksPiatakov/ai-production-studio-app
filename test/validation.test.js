const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProject, validateProjectInput, validateBibleInput, validateSceneInput, validateShotInput, validateDialogueInput, validateProfileInput, validateWorkflowInput, validateScriptInput, validateVoiceProfileInput, validateLocalizationInput, validateRenderJobInput, validateAssetInput, validateEpisodeInput } = require('../server/validation');

function project(scene) { return { bibles: { style: [{ status: 'approved' }], characters: [{ id: 'luma', status: 'approved', name: 'Лума', ageBand: 'teen', identityKey: 'luma-v1' }] }, scenes: [scene] }; }
test('accepts a scene with approved character, matching timing and age-appropriate voice', () => {
  const result = validateProject(project({ id:'s', title:'test', durationSeconds:10, characterIds:['luma'], shots:[{seconds:10}], dialogue:[{id:'d',characterId:'luma',voiceAgeBand:'teen',voiceIdentityKey:'luma-v1',language:'uk'}] }));
  assert.equal(result.valid, true);
});
test('detects character, timing and voice-age violations', () => {
  const result = validateProject(project({ id:'s', title:'test', durationSeconds:10, characterIds:['unknown'], shots:[{seconds:8}], dialogue:[{id:'d',characterId:'luma',voiceAgeBand:'adult',language:'uk'}] }));
  assert.equal(result.valid, false); assert.deepEqual(result.errors.map(e=>e.code).sort(), ['SHOT_TIMING_MISMATCH','UNKNOWN_OR_UNAPPROVED_CHARACTER','VOICE_AGE_MISMATCH','VOICE_IDENTITY_REQUIRED'].sort());
});

test('rejects invalid project and bible metadata before persistence', () => {
  assert.throws(() => validateProjectInput({ name: 'Episode', targetMinutes: 0 }), /positive number/);
  assert.throws(() => validateProjectInput({ name: 'Episode', defaultLanguage: 'fr' }), /defaultLanguage/);
  assert.throws(() => validateBibleInput({ name: 'Luma', ageBand: 'unknown' }, 'characters'), /ageBand/);
  assert.throws(() => validateBibleInput({ name: 'Style', status: 'publish-now' }, 'style'), /status/);
});

test('rejects invalid scene durations and malformed shot data', () => {
  assert.throws(() => validateSceneInput({ title: 'Broken', durationSeconds: 'not-a-number' }), /positive number/);
  assert.throws(() => validateSceneInput({ title: 'Broken', durationSeconds: 10, shots: [{ seconds: 0 }] }), /positive number/);
  assert.throws(() => validateSceneInput({ title: 'Broken', durationSeconds: 10, characterIds: 'luma' }), /characterIds/);
});

test('does not approve a persisted scene with zero or invalid timing', () => {
  const result = validateProject(project({ id:'s', title:'broken', durationSeconds:null, characterIds:['luma'], shots:[{seconds:null}], dialogue:[] }));
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map(error => error.code).sort(), ['SCENE_DURATION_INVALID', 'SHOT_DURATION_INVALID'].sort());
});

test('accepts a project passport and constrains workflow states', () => {
  const passport = validateProfileInput({ audience: 'Сімейна аудиторія', tone: 'Теплий', approvalOwner: 'Продюсер' });
  assert.equal(passport.audience, 'Сімейна аудиторія');
  assert.equal(passport.seasonArc, '');
  assert.deepEqual(validateWorkflowInput({ status: 'in-progress', note: 'Чернетка готова' }), { status: 'in-progress', note: 'Чернетка готова' });
  assert.throws(() => validateWorkflowInput({ status: 'published' }), /status/);
});

test('keeps individual delivery settings with a dialogue line', () => {
  const character = { id: 'luma', status: 'approved', ageBand: 'teen', identityKey: 'luma-v1' };
  const line = validateDialogueInput({ characterId: 'luma', voiceAgeBand: 'teen', voiceIdentityKey: 'luma-v1', textUk: 'Почекай хвилинку.', estimatedSeconds: 2, generationSettings: { speed: .9, stability: .6, similarityBoost: .75, style: .3, sentenceSilence: .25, volume: 1.05 } }, character);
  assert.equal(line.generationSettings.speed, .9);
  assert.equal(line.generationSettings.style, .3);
  assert.equal(line.generationSettings.sentenceSilence, .25);
});

test('keeps complete storyboard metadata with each shot', () => {
  const shot = validateShotInput({ seconds: 8, camera: 'close-up', imagePrompt: 'Лума біля ліхтаря', motionPrompt: 'повільний наїзд', lighting: 'тепле вечірнє', action: 'Зробити ліхтар головним акцентом.', acceptanceCriteria: 'Емоцію Луми видно до кінця кадру.', keyImageAssetId: 'luma-keyframe', referenceAssetIds: ['luma-rig', 'village-ref'], status: 'ready' });
  assert.deepEqual(shot.referenceAssetIds, ['luma-rig', 'village-ref']);
  assert.equal(shot.imagePrompt, 'Лума біля ліхтаря');
  assert.equal(shot.action, 'Зробити ліхтар головним акцентом.');
  assert.equal(shot.acceptanceCriteria, 'Емоцію Луми видно до кінця кадру.');
  assert.equal(shot.keyImageAssetId, 'luma-keyframe');
  assert.equal(shot.status, 'ready');
  assert.throws(() => validateShotInput({ seconds: 4, status: 'in-progress' }), /status/);
});

test('requires a real script body and permits an approval lifecycle', () => {
  const script = validateScriptInput({ title: 'Епізод 1', logline: 'Герой вчиться просити допомоги.', body: 'Сцена 1. Лума знаходить згаслий вогонь.', status: 'in-review' });
  assert.equal(script.status, 'in-review');
  assert.throws(() => validateScriptInput({ title: 'Порожній', body: '   ' }), /body is required/);
});

test('records a multilingual voice profile with stable identity and generation settings', () => {
  const voice = validateVoiceProfileInput({ name: 'Лума', identityKey: 'luma-uk-v1', ageBand: 'teen', languages: ['uk', 'en'], engine: 'self-hosted worker', license: 'internal review', generationSettings: { stability: 0.5, similarityBoost: 0.75, style: 0, speed: 1, sentenceSilence: 0.2, volume: 1, outputFormat: 'wav', speakerBoost: true }, status: 'approved' });
  assert.deepEqual(voice.languages, ['uk', 'en']);
  assert.equal(voice.identityKey, 'luma-uk-v1');
  assert.equal(voice.generationSettings.similarityBoost, 0.75);
  assert.equal(voice.generationSettings.sentenceSilence, 0.2);
  assert.equal(voice.generationSettings.outputFormat, 'wav');
  assert.equal(voice.generationSettings.speakerBoost, true);
  assert.throws(() => validateVoiceProfileInput({ name: 'Broken', identityKey: 'x', languages: ['fr'], engine: 'engine', license: 'unknown' }), /languages/);
  assert.throws(() => validateVoiceProfileInput({ name: 'Broken', identityKey: 'x', languages: ['uk'], engine: 'engine', license: 'unknown', generationSettings: { stability: 2 } }), /generationSettings.stability/);
});

test('keeps one language version with separate stems and subtitles', () => {
  const version = validateLocalizationInput({ language: 'uk', status: 'in-progress', videoMasterUri: 'asset://video/master.mov', voiceStemUri: 'asset://audio/uk/voice.wav', musicStemUri: 'asset://audio/music.wav', sfxStemUri: 'asset://audio/sfx.wav', subtitlesUri: 'asset://subtitles/uk.vtt' });
  assert.equal(version.language, 'uk');
  assert.equal(version.voiceStemUri, 'asset://audio/uk/voice.wav');
  assert.throws(() => validateLocalizationInput({ language: 'fr' }), /language/);
});

test('permits only explicit worker-ready render targets', () => {
  assert.deepEqual(validateRenderJobInput({ manifestId: 'manifest-1', target: 'master-1080p', priority: 'high' }), { manifestId: 'manifest-1', target: 'master-1080p', priority: 'high' });
  assert.throws(() => validateRenderJobInput({ manifestId: 'manifest-1', target: 'local-m2' }), /target/);
});

test('records asset scope and optional link to a project character', () => {
  const asset = validateAssetInput({ type: 'blender-rig', scope: 'character', linkedCharacterId: 'luma', label: 'Ріг Луми', uri: 'asset://luma.blend', status: 'approved' });
  assert.equal(asset.scope, 'character');
  assert.equal(asset.linkedCharacterId, 'luma');
});

test('accepts a scene image asset as a first-class production resource', () => {
  const asset = validateAssetInput({ type: 'image', scope: 'scene', label: 'Ключовий кадр сцени', uri: '/assets/scene-01.png', status: 'draft' });
  assert.equal(asset.type, 'image');
  assert.equal(asset.scope, 'scene');
});

test('keeps an editing note with an asset reference', () => {
  const asset = validateAssetInput({ type: 'reference', scope: 'style', label: 'Кадр', uri: '/assets/frame.png', version: '0.1.0', notes: 'Зробити світло теплішим', status: 'draft' });
  assert.equal(asset.notes, 'Зробити світло теплішим');
});

test('keeps normalized pencil and arrow annotations with an image reference', () => {
  const asset = validateAssetInput({ type: 'reference', scope: 'style', label: 'Кадр', uri: '/assets/frame.png', annotations: [{ type: 'arrow', color: '#ffcc66', points: [[0.1, 0.2], [0.8, 0.7]] }, { type: 'pencil', color: '#ffcc66', points: [[0.2, 0.2], [0.3, 0.4], [0.5, 0.5]] }], status: 'draft' });
  assert.equal(asset.annotations.length, 2);
  assert.equal(asset.annotations[0].type, 'arrow');
});

test('organizes a serialized project by season and episode', () => {
  const episode = validateEpisodeInput({ title: 'Вогонь, який не купити', logline: 'Лума шукає короткий шлях і вчиться довіряти друзям.', theme: 'Підтримку можна попросити вчасно.', seasonNumber: 1, episodeNumber: 1, targetMinutes: 10, status: 'development' });
  assert.equal(episode.seasonNumber, 1);
  assert.equal(episode.episodeNumber, 1);
  assert.equal(episode.status, 'development');
  assert.equal(episode.theme, 'Підтримку можна попросити вчасно.');
  assert.throws(() => validateEpisodeInput({ title: 'Broken', episodeNumber: 0 }), /positive number/);
});

test('accepts paired Ukrainian and English dialogue with audio direction without forcing a creative translation', () => {
  const line = require('../server/validation').validateDialogueInput({ characterId: 'luma', textUk: 'Я тут.', textEn: 'I am here.', voiceAgeBand: 'teen', voiceIdentityKey: 'luma-v1', estimatedSeconds: 4, emotion: 'тихо, з надією', performanceNote: 'Коротка пауза перед останнім словом.', status: 'in-review' }, { id: 'luma', status: 'approved', ageBand: 'teen', identityKey: 'luma-v1' });
  assert.equal(line.textUk, 'Я тут.');
  assert.equal(line.textEn, 'I am here.');
  assert.equal(line.estimatedSeconds, 4);
  assert.equal(line.emotion, 'тихо, з надією');
  assert.equal(line.performanceNote, 'Коротка пауза перед останнім словом.');
  assert.equal(line.status, 'in-review');
});

test('can validate one production scene without blocking on another episode', () => {
  const ready = { id:'ready', title:'ready', status:'approved', durationSeconds:10, characterIds:['luma'], shots:[{seconds:10, status:'approved', keyImageAssetId:'frame', referenceAssetIds:['frame']}], dialogue:[] };
  const unfinished = { id:'later', title:'later', durationSeconds:10, characterIds:['missing'], shots:[{seconds:8}], dialogue:[] };
  const result = validateProject({ bibles: { style: [{ status: 'approved' }], characters: [{ id: 'luma', status: 'approved', name: 'Лума', ageBand: 'teen', identityKey: 'luma-v1' }] }, assets: [{ id: 'frame', type: 'image', status: 'approved', label: 'Кадр' }], scenes: [ready, unfinished] }, { sceneId: 'ready' });
  assert.equal(result.valid, true);
  assert.equal(result.scope.scenesChecked, 1);
});

test('requires explicit scene approval for a scoped production check', () => {
  const scene = { id:'draft', title:'draft', status:'draft', durationSeconds:10, characterIds:['luma'], shots:[{seconds:10}], dialogue:[] };
  const result = validateProject(project(scene), { sceneId: 'draft' });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, 'SCENE_APPROVAL_REQUIRED');
});

test('blocks production when key art, voice profile, or approved audio is missing', () => {
  const scene = {
    id: 'production-draft', title: 'production draft', status: 'approved', durationSeconds: 10, characterIds: ['luma'],
    shots: [{ id: 'shot-1', seconds: 10, status: 'approved', keyImageAssetId: 'draft-frame', referenceAssetIds: ['draft-frame'] }],
    dialogue: [{ id: 'line-1', characterId: 'luma', voiceAgeBand: 'teen', voiceIdentityKey: 'luma-v1', language: 'uk', status: 'approved', audioDrafts: [] }]
  };
  const result = validateProject({
    bibles: { style: [{ status: 'approved' }], characters: [{ id: 'luma', status: 'approved', name: 'Лума', ageBand: 'teen', identityKey: 'luma-v1' }] },
    assets: [{ id: 'draft-frame', type: 'image', status: 'draft', label: 'Чернетковий кадр' }],
    voiceProfiles: [{ name: 'Лума', identityKey: 'luma-v1', ageBand: 'teen', languages: ['uk'], status: 'draft' }],
    scenes: [scene]
  }, { sceneId: scene.id });
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map(error => error.code).sort(), ['DIALOGUE_AUDIO_REQUIRED', 'SHOT_KEY_IMAGE_NOT_APPROVED', 'SHOT_REFERENCE_NOT_APPROVED', 'VOICE_PROFILE_NOT_APPROVED'].sort());
});


test('validates production parameters from the three-step project wizard', () => {
  const project = validateProjectInput({
    name: 'Studio test',
    type: 'animated-series',
    defaultLanguage: 'uk',
    additionalLanguages: ['en'],
    targetMinutes: 8,
    resolution: '3840x2160',
    aspectRatio: '16:9',
    fps: 25,
    plannedEpisodes: 12
  });
  assert.deepEqual(project.additionalLanguages, ['en']);
  assert.equal(project.resolution, '3840x2160');
  assert.equal(project.fps, 25);
  assert.equal(project.plannedEpisodes, 12);
  assert.throws(() => validateProjectInput({ name: 'Broken', fps: 120 }), /fps/);
  assert.throws(() => validateProjectInput({ name: 'Broken', resolution: '800x600' }), /resolution/);
});


test('Character Bible keeps approved visual and voice links',()=>{
  const { validateBibleInput }=require('../server/validation');
  const entry=validateBibleInput({
    name:'Mira',version:'1.0.0',status:'approved',rules:'Keep design stable',
    ageBand:'young-adult',identityKey:'mira-v1',role:'Lead',appearance:'Fennec engineer',
    wardrobeAccessories:'Blue utility scarf',voiceNotes:'Warm precise delivery',
    voiceProfileId:'voice-mira',referenceAssetIds:['asset-front','asset-side']
  },'characters');
  assert.equal(entry.voiceProfileId,'voice-mira');
  assert.equal(entry.wardrobeAccessories,'Blue utility scarf');
  assert.deepEqual(entry.referenceAssetIds,['asset-front','asset-side']);
});


test('blocks production while approved script dependencies still need review',()=>{
  const scene={
    id:'stale-scene',title:'Stale',status:'approved',dependencyStatus:'needs-review',durationSeconds:5,characterIds:['luma'],
    shots:[{id:'stale-shot',seconds:5,status:'approved',dependencyStatus:'needs-review',keyImageAssetId:'stale-frame',referenceAssetIds:['stale-frame']}],
    dialogue:[]
  };
  const result=validateProject({
    bibles:{style:[{status:'approved'}],characters:[{id:'luma',status:'approved',name:'Лума',ageBand:'teen',identityKey:'luma-v1'}]},
    assets:[{id:'stale-frame',type:'image',status:'approved',label:'Stale frame',dependencyStatus:'needs-review'}],
    voiceProfiles:[],
    scenes:[scene]
  },{sceneId:scene.id});
  const codes=result.errors.map(error=>error.code);
  assert.equal(result.valid,false);
  assert.ok(codes.includes('SCENE_DEPENDENCY_REVIEW_REQUIRED'));
  assert.ok(codes.includes('SHOT_DEPENDENCY_REVIEW_REQUIRED'));
  assert.ok(codes.includes('SHOT_REFERENCE_DEPENDENCY_REVIEW_REQUIRED'));
  assert.ok(codes.includes('SHOT_KEY_IMAGE_DEPENDENCY_REVIEW_REQUIRED'));
});
