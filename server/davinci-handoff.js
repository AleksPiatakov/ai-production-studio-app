const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const projectRoot = path.join(__dirname, '..');

function assetPath(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('/assets/')) return '';
  return path.join(projectRoot, 'public', uri);
}

function sourceForLocalization(localization) {
  if (!localization) return null;
  return {
    language: localization.language,
    status: localization.status,
    videoMasterPath: assetPath(localization.videoMasterUri),
    voiceStemPath: assetPath(localization.voiceStemUri),
    musicStemPath: assetPath(localization.musicStemUri),
    sfxStemPath: assetPath(localization.sfxStemUri),
    subtitlesPath: assetPath(localization.subtitlesUri)
  };
}

function buildDaVinciHandoff(project, episode) {
  const scenes = project.scenes.filter(scene => scene.episodeId === episode.id).sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  const assetsById = new Map((project.assets || []).map(asset => [asset.id, asset]));
  const clips = scenes.flatMap(scene => (scene.shots || []).map((shot, index) => {
    const keyImage = assetsById.get(shot.keyImageAssetId || scene.keyImageAssetId);
    const references = (shot.referenceAssetIds || []).map(id => assetsById.get(id)).filter(Boolean);
    const localReferences = references.filter(asset => assetPath(asset.uri));
    const videoVariants = (project.assets || []).filter(asset => asset.type === 'video' && asset.linkedShotId === shot.id);
    const videoAsset = videoVariants.find(asset => asset.status === 'approved') || videoVariants[0] || null;
    return {
      sceneId: scene.id, sceneNumber: scene.order, sceneTitle: scene.title, sceneDurationSeconds: scene.durationSeconds,
      shotId: shot.id || '', shotNumber: index + 1, shotDurationSeconds: shot.seconds, status: shot.status || 'draft',
      camera: shot.camera || '', imagePrompt: shot.imagePrompt || shot.prompt || '', motionPrompt: shot.motionPrompt || '', lighting: shot.lighting || '',
      keyImage: keyImage ? { id: keyImage.id, label: keyImage.label, status: keyImage.status, filePath: assetPath(keyImage.uri) } : null,
      videoClip: videoAsset ? { id: videoAsset.id, label: videoAsset.label, status: videoAsset.status, filePath: assetPath(videoAsset.uri) } : null,
      localReferencePaths: localReferences.map(asset => assetPath(asset.uri)), localReferenceLabels: localReferences.map(asset => asset.label)
    };
  }));
  const dialogue = scenes.flatMap(scene => (scene.dialogue || []).map(line => ({
    sceneId: scene.id, sceneNumber: scene.order, sceneTitle: scene.title,
    ukrainian: line.textUk || (line.language === 'uk' ? line.text : ''), english: line.textEn || (line.language === 'en' ? line.text : ''),
    estimatedSeconds: line.estimatedSeconds || 0, status: line.status || 'draft', performanceNote: line.performanceNote || '',
    audioDrafts: (line.audioDrafts || []).map(audio => ({ language: audio.language, status: audio.status || 'draft', filePath: assetPath(audio.uri) }))
  })));
  const localizations = (project.localizations || []).map(sourceForLocalization).filter(Boolean);
  const blockers = [];
  if (!scenes.length) blockers.push('У випуску ще немає сцен для монтажу.');
  if (clips.some(clip => !clip.keyImage?.filePath)) blockers.push('Не для кожного шоту обрано локальний ключовий кадр.');
  if (clips.some(clip => !clip.videoClip?.filePath)) blockers.push('Не для кожного шоту підготовлено локальний відеокліп.');
  if (clips.some(clip => clip.status !== 'approved')) blockers.push('Частина шотів ще не затверджена.');
  if (clips.some(clip => clip.keyImage && clip.keyImage.status !== 'approved')) blockers.push('Частина ключових кадрів ще не затверджена.');
  if (dialogue.some(line => line.status !== 'approved')) blockers.push('Репліки ще не затверджені.');
  if (dialogue.some(line => !line.audioDrafts.some(audio => audio.status === 'approved' && audio.filePath))) blockers.push('Для частини реплік немає затвердженої локальної озвучки.');
  if (!localizations.some(item => item.language === 'uk' && item.subtitlesPath)) blockers.push('Для української версії не підготовлено локальні субтитри.');
  blockers.push('Це чернетковий монтажний лист: він не створює фінального відео та не змінює статуси у студії.');
  return { schemaVersion: 2, kind: 'davinci-resolve-handoff-draft', generatedAt: new Date().toISOString(), project: { id: project.id, name: project.name, defaultLanguage: project.defaultLanguage }, episode: { id: episode.id, title: episode.title, status: episode.status, targetMinutes: episode.targetMinutes }, sources: { localizations }, clips, dialogue, blockers };
}

function handoffMarkdown(handoff) {
  const clipRows = handoff.clips.map(clip => `| ${clip.sceneNumber}.${clip.shotNumber} | ${clip.shotDurationSeconds} с | ${clip.status} | ${clip.camera || '—'} | ${clip.keyImage?.filePath || 'не обрано'} |`).join('\n');
  const dialogueRows = handoff.dialogue.map(line => `| ${line.sceneNumber} | ${line.estimatedSeconds} с | ${line.status} | ${line.ukrainian || '—'} | ${line.english || '—'} |`).join('\n');
  const sourceRows = handoff.sources.localizations.map(source => `- ${source.language.toUpperCase()}: субтитри — ${source.subtitlesPath || 'відсутні'}; голос — ${source.voiceStemPath || 'відсутній'}; музика — ${source.musicStemPath || 'відсутня'}; SFX — ${source.sfxStemPath || 'відсутні'}`).join('\n');
  return `# Монтажний лист для DaVinci Resolve — чернетка\n\n` +
    `Проєкт: ${handoff.project.name}\n\nВипуск: ${handoff.episode.title}\n\n` +
    `Цей файл збирає фактичні матеріали вибраного випуску. Він потрібен для ручного монтажу тестового аніматика у DaVinci Resolve.\n\n` +
    `## Локалізації та звукові доріжки\n\n${sourceRows || '- Мовні версії ще не підготовлено.'}\n\n` +
    `## План таймлайна\n\n| Сцена / шот | Тривалість | Стан | Камера | Ключовий кадр |\n| --- | ---: | --- | --- | --- |\n${clipRows || '| — | — | — | — | — |'}\n\n` +
    `## Репліки\n\n| Сцена | Орієнтир | Стан | Українська | English |\n| --- | ---: | --- | --- | --- |\n${dialogueRows || '| — | — | — | — | — |'}\n\n` +
    `## Перед монтажем\n\n${handoff.blockers.map(item => `- ${item}`).join('\n')}\n`;
}

function csvCell(value) { return `"${String(value ?? '').replace(/"/g, '""')}"`; }
function timecode(seconds, fps = 24) {
  const frames = Math.max(0, Math.round(Number(seconds || 0) * fps));
  const hh = Math.floor(frames / (fps * 3600)); const mm = Math.floor(frames / (fps * 60)) % 60;
  const ss = Math.floor(frames / fps) % 60; const ff = frames % fps;
  return [hh, mm, ss, ff].map(value => String(value).padStart(2, '0')).join(':');
}
function handoffTimelineCsv(handoff, fps = 24) {
  const header = ['timeline_start', 'timeline_end', 'duration_seconds', 'track', 'clip_name', 'source_path', 'scene', 'shot', 'status', 'camera', 'notes'];
  let cursor = 0;
  const rows = handoff.clips.map(clip => {
    const duration = Number(clip.shotDurationSeconds || 0), start = cursor; cursor += duration;
    return [timecode(start, fps), timecode(cursor, fps), duration, 'V1', `Scene ${clip.sceneNumber} Shot ${clip.shotNumber}`, clip.videoClip?.filePath || clip.keyImage?.filePath || '', clip.sceneTitle, clip.shotNumber, clip.status, clip.camera, clip.motionPrompt || clip.imagePrompt];
  });
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n') + '\n';
}


function packageFileChecksum(sourcePath) {
  if (!sourcePath || !fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) return '';
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(sourcePath));
  return hash.digest('hex');
}
function packageFileRecord(sourcePath, destination, meta = {}) {
  const exists = Boolean(sourcePath && fs.existsSync(sourcePath));
  const checksum = exists ? packageFileChecksum(sourcePath) : '';
  return { sourcePath: sourcePath || '', destination, exists, checksum, ...meta };
}
function buildDaVinciPackage(project, episode, mode = 'draft') {
  const packageMode = mode === 'final' ? 'final' : 'draft';
  const handoff = buildDaVinciHandoff(project, episode);
  const sceneIds = new Set(project.scenes.filter(scene => scene.episodeId === episode.id).map(scene => scene.id));
  const includeAsset = asset => sceneIds.has(asset.linkedSceneId) && (packageMode === 'draft' || asset.status === 'approved');
  const soundAssets = (project.assets || []).filter(asset => ['music','ambient','sfx'].includes(asset.type) && includeAsset(asset));
  const folders = {
    Video: handoff.clips.map(clip => packageFileRecord(clip.videoClip?.filePath, `Video/scene-${clip.sceneNumber}-shot-${clip.shotNumber}${clip.videoClip?.filePath ? path.extname(clip.videoClip.filePath) : '.mov'}`, { sceneId: clip.sceneId, shotId: clip.shotId, status: clip.videoClip?.status || 'missing', kind: 'video' })).filter(record => packageMode === 'draft' || record.status === 'approved'),
    'Dialogue/UK': [],
    'Dialogue/EN': [],
    Music: soundAssets.filter(asset => asset.type === 'music').map((asset,index) => packageFileRecord(assetPath(asset.uri), `Music/music-${index+1}${path.extname(asset.uri || '') || '.wav'}`, { assetId: asset.id, status: asset.status, kind: 'music' })),
    Atmosphere: soundAssets.filter(asset => asset.type === 'ambient').map((asset,index) => packageFileRecord(assetPath(asset.uri), `Atmosphere/ambient-${index+1}${path.extname(asset.uri || '') || '.wav'}`, { assetId: asset.id, status: asset.status, kind: 'ambient' })),
    SFX: soundAssets.filter(asset => asset.type === 'sfx').map((asset,index) => packageFileRecord(assetPath(asset.uri), `SFX/sfx-${index+1}${path.extname(asset.uri || '') || '.wav'}`, { assetId: asset.id, status: asset.status, kind: 'sfx' })),
    Subtitles: [],
    Edit_Data: [{ sourcePath: '', destination: 'Edit_Data/timeline.csv', exists: true, virtual: true, kind: 'timeline' }],
    Manifest: [{ sourcePath: '', destination: 'Manifest/package-manifest.json', exists: true, virtual: true, kind: 'manifest' }],
    Reports: [{ sourcePath: '', destination: 'Reports/readiness.json', exists: true, virtual: true, kind: 'report' }]
  };
  handoff.dialogue.forEach((line,lineIndex) => {
    for (const draft of line.audioDrafts || []) {
      if (packageMode === 'final' && draft.status !== 'approved') continue;
      const language = draft.language === 'en' ? 'EN' : 'UK';
      folders[`Dialogue/${language}`].push(packageFileRecord(draft.filePath, `Dialogue/${language}/line-${lineIndex+1}${path.extname(draft.filePath || '') || '.wav'}`, { status: draft.status, sceneId: line.sceneId, kind: 'dialogue' }));
    }
  });
  for (const source of handoff.sources.localizations || []) {
    if (source.subtitlesPath) folders.Subtitles.push(packageFileRecord(source.subtitlesPath, `Subtitles/${String(source.language || 'uk').toUpperCase()}${path.extname(source.subtitlesPath) || '.srt'}`, { status: source.status, language: source.language, kind: 'subtitles' }));
  }
  const physical = Object.values(folders).flat().filter(file => !file.virtual);
  const missingFiles = physical.filter(file => !file.exists).map(file => `Файл відсутній: ${file.destination}`);
  const readinessIssues = handoff.blockers.filter(item => !item.startsWith('Це чернетковий монтажний лист'));
  if (!['approved','production','released'].includes(episode.status)) readinessIssues.unshift('Випуск не має затвердженого production-статусу.');
  const issues = [...new Set([...readinessIssues, ...missingFiles])];
  const finalReady = issues.length === 0;
  return {
    schemaVersion: 1,
    kind: 'davinci-package-plan',
    mode: packageMode,
    generatedAt: new Date().toISOString(),
    project: handoff.project,
    episode: handoff.episode,
    canExport: packageMode === 'draft' ? true : finalReady,
    finalReady,
    issues,
    folders,
    summary: {
      files: physical.length,
      existingFiles: physical.filter(file => file.exists).length,
      missingFiles: physical.filter(file => !file.exists).length,
      approvedVideoClips: handoff.clips.filter(clip => clip.videoClip?.status === 'approved' && clip.videoClip.filePath).length,
      totalShots: handoff.clips.length
    },
    handoff
  };
}
function packageManifestJson(packagePlan) {
  const manifest = {
    schemaVersion: packagePlan.schemaVersion,
    kind: packagePlan.kind,
    mode: packagePlan.mode,
    generatedAt: packagePlan.generatedAt,
    project: packagePlan.project,
    episode: packagePlan.episode,
    canExport: packagePlan.canExport,
    finalReady: packagePlan.finalReady,
    issues: packagePlan.issues,
    files: Object.entries(packagePlan.folders).flatMap(([folder,files]) => files.map(file => ({ folder, destination: file.destination, sourcePath: file.sourcePath, exists: file.exists, virtual: Boolean(file.virtual), status: file.status || '', kind: file.kind || '', checksum: file.checksum || '' })))
  };
  return JSON.stringify(manifest, null, 2);
}

module.exports = { buildDaVinciHandoff, buildDaVinciPackage, packageManifestJson, handoffMarkdown, handoffTimelineCsv, timecode };
