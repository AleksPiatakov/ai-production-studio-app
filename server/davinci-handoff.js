const path = require('node:path');

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
    return {
      sceneId: scene.id, sceneNumber: scene.order, sceneTitle: scene.title, sceneDurationSeconds: scene.durationSeconds,
      shotId: shot.id || '', shotNumber: index + 1, shotDurationSeconds: shot.seconds, status: shot.status || 'draft',
      camera: shot.camera || '', imagePrompt: shot.imagePrompt || shot.prompt || '', motionPrompt: shot.motionPrompt || '', lighting: shot.lighting || '',
      keyImage: keyImage ? { id: keyImage.id, label: keyImage.label, status: keyImage.status, filePath: assetPath(keyImage.uri) } : null,
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
    return [timecode(start, fps), timecode(cursor, fps), duration, 'V1', `Scene ${clip.sceneNumber} Shot ${clip.shotNumber}`, clip.keyImage?.filePath || '', clip.sceneTitle, clip.shotNumber, clip.status, clip.camera, clip.motionPrompt || clip.imagePrompt];
  });
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n') + '\n';
}

module.exports = { buildDaVinciHandoff, handoffMarkdown, handoffTimelineCsv, timecode };
