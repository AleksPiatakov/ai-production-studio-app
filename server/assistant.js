function asText(value, fallback = 'не задано') { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }

function buildAssistantContext(project, episodeId) {
  const episode = episodeId === 'all' ? null : (project.episodes || []).find(item => item.id === episodeId) || (project.episodes || [])[0] || null;
  const scenes = (project.scenes || []).filter(scene => !episode || scene.episodeId === episode.id).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  return {
    project: { name: project.name, type: project.type, defaultLanguage: project.defaultLanguage, targetMinutes: project.targetMinutes }, profile: project.profile || {},
    episode: episode && { id: episode.id, title: episode.title, logline: episode.logline, theme: episode.theme, targetMinutes: episode.targetMinutes, status: episode.status },
    characters: (project.bibles?.characters || []).map(character => ({ name: character.name, role: character.role, appearance: character.appearance, rules: character.rules, status: character.status })),
    styleRules: (project.bibles?.style || []).map(style => ({ name: style.name, rules: style.rules, status: style.status })),
    scenes: scenes.map(scene => ({ title: scene.title, purpose: scene.purpose, durationSeconds: scene.durationSeconds, status: scene.status, shots: (scene.shots || []).map(shot => ({ seconds: shot.seconds, camera: shot.camera, imagePrompt: shot.imagePrompt || shot.prompt, motionPrompt: shot.motionPrompt, lighting: shot.lighting, status: shot.status })), dialogue: (scene.dialogue || []).map(line => ({ characterId: line.characterId, textUk: line.textUk || (line.language === 'uk' ? line.text : ''), textEn: line.textEn || (line.language === 'en' ? line.text : ''), emotion: line.emotion, performanceNote: line.performanceNote, status: line.status })) })),
    existingScripts: (project.scripts || []).filter(script => !episode || !script.episodeId || script.episodeId === episode.id).map(script => ({ title: script.title, logline: script.logline, body: script.body, status: script.status })),
    assets: (project.assets || []).map(asset => ({ label: asset.label, type: asset.type, scope: asset.scope, status: asset.status, notes: asset.notes })),
    visualReferences: (project.assets || []).filter(asset => asset.type === 'reference' && typeof asset.uri === 'string' && asset.uri.startsWith('/')).map(asset => ({ label: asset.label, status: asset.status }))
  };
}

function buildProjectAdvisorContext(project, episodeId) {
  const selected = buildAssistantContext(project, episodeId);
  return {
    project: selected.project, profile: selected.profile,
    season: (project.episodes || []).sort((a, b) => Number(a.seasonNumber || 1) - Number(b.seasonNumber || 1) || Number(a.episodeNumber || 0) - Number(b.episodeNumber || 0)).map(episode => ({ number: episode.episodeNumber, title: episode.title, theme: episode.theme, logline: episode.logline, targetMinutes: episode.targetMinutes, status: episode.status })),
    selectedEpisode: selected.episode,
    selectedEpisodeWork: { scripts: selected.existingScripts, scenes: selected.scenes },
    characters: selected.characters, styleRules: selected.styleRules,
    production: { workflow: (project.workflow || []).map(stage => ({ title: stage.title, status: stage.status, note: stage.note })), assets: selected.assets, referenceCount: selected.visualReferences.length }
  };
}

function localScriptDraft(context, instruction = '') {
  const episodeTitle = asText(context.episode?.title, 'Новий випуск');
  const protagonist = context.characters.find(character => character.status === 'approved')?.name || context.characters[0]?.name || 'головний персонаж';
  const asksForPrelude = /передістор|передісторію|дізнав|дізнала|до того,? як|перед тим/i.test(instruction);
  const scenePlan = context.scenes.length ? context.scenes.map((scene, index) => `Сцена ${index + 1}. ${asText(scene.title)} (${scene.durationSeconds || '—'} с)\nМета: ${asText(scene.purpose)}.`).join('\n\n') : `Сцена 1. Зав’язка\nПокажіть героя та ситуацію, яка потребує зміни.\n\nСцена 2. Вибір\nГерой діє, стикається з перешкодою та робить важливий вибір.\n\nСцена 3. Наслідок\nПокажіть результат вибору й емоційне завершення.`;
  const brief = instruction.trim() ? `\n\nПобажання автора: ${instruction.trim()}` : '';
  const prelude = asksForPrelude ? `Нова передісторія — чернетка\nПеред сценою 1: на вечірній стежці Лума помічає, що звичний теплий відблиск ліхтарика зник. У тиші чути ледь помітний дзвін, і вона бачить друга поруч із згаслим ліхтариком. Лума не поспішає щось лагодити: вона підходить тихо й питає, чи все гаразд. Це природно підводить до наявної сцени «Згаслий ліхтарик».\n\n` : '';
  return { title: `${episodeTitle} — сценарна чернетка`, episodeId: context.episode?.id || '', logline: `${protagonist} проходить через невелику, але важливу подію, що рухає історію випуску вперед.`, body: `ЧЕРНЕТКА — потребує творчого редагування та ручного затвердження.\n\nНазва: ${episodeTitle}\n\nГоловний фокус: ${asText(context.profile?.tone, 'тон і правила проєкту')}\n\n${prelude}${scenePlan}${brief}\n\nРежисерська перевірка:\n• Чи зрозуміло, чого хоче ${protagonist}?\n• Чи кожна сцена змінює ситуацію?\n• Чи відповідають репліки затвердженим персонажам і правилам світу?`, note: 'Локальний планувальник використав дані поточного проєкту. Це не фінальний творчий текст.' };
}

function assistantConfiguration() {
  const endpoint = process.env.AI_STUDIO_ASSISTANT_URL, model = process.env.AI_STUDIO_ASSISTANT_MODEL;
  if (process.env.OPENAI_API_KEY) return { configured: true, engine: 'openai', provider: 'OpenAI', model: process.env.AI_STUDIO_ADVISER_MODEL || 'gpt-6-luna' };
  if (endpoint && model) return { configured: true, engine: 'connected-model', provider: 'custom', model };
  return { configured: false, engine: 'local-planner', provider: 'local', model: null };
}

function scriptSystemPrompt() { return 'Ти — сценарний помічник AI Video Studio. Працюй лише з наданим контекстом проєкту. Не вигадуй затверджені факти, не змінюй статуси, не називай творчі рішення остаточними. Якщо профіль містить духовну основу, бережи її: дозволені оригінальні алегорії, тварини й фантастичні світи, але не видавай вигадану подію за біблійний факт і не зводь головний зміст до абстрактної доброї поведінки. Поверни українською JSON-об’єкт з полями title, logline, body, note. body має бути сценарною чернеткою з чіткими сценами.'; }
function advisorSystemPrompt() { return 'Ти — Порадник проєкту AI Video Studio: уважний творчий продюсер, сценарний редактор і режисерський консультант. Відповідай українською, конкретно й доброзичливо. Бачиш лише переданий контекст локального проєкту. Не вигадуй факти про персонажів чи події, не оголошуй чернетки каноном і не роби жодних змін самостійно. Якщо даних бракує — прямо скажи це. Підтримуй визначений порядок: сезон → сценарій → ручне затвердження → аудіо/кадри/рух → перевірка → DaVinci. Для сімейного YouTube-серіалу 5–10 хвилин про «оживлені 3D-ілюстрації» оцінюй логіку, послідовність, виробничу реалістичність та ясність наступного кроку. Якщо профіль містить духовну основу, не підміняй її загальними моральними уроками: перевіряй, чи історія зрештою веде до надії, благодаті, спасіння через Ісуса Христа та особистого відповідального вибору. Оригінальні персонажі, тварини, фантастичні створіння й інші світи допустимі; не представляй їх як буквальний біблійний переказ і не використовуй прихований психологічний тиск. Для глядача без церковного досвіду радь ясну, людяну, ненав’язливу драматургію, а не внутрішню релігійну мову. Відповідь поверни винятково JSON-об’єкт: {"answer":"...","observations":["..."],"nextSteps":["..."]}. answer — коротка жива порада; observations і nextSteps — не більше трьох пунктів кожен.'; }

function extractJson(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); } catch { const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}'); if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1)); throw new Error('Модель повернула відповідь у несподіваному форматі. Спробуйте ще раз.'); }
}

async function openAIJsonResponse(instructions, input) {
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.AI_STUDIO_ADVISER_MODEL || 'gpt-6-luna', instructions, input: JSON.stringify(input) }) });
  if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail?.error?.message || `OpenAI повернув помилку ${response.status}.`); }
  const payload = await response.json(), text = payload.output_text || payload.output?.flatMap(item => item.content || []).map(part => part.text || '').join('');
  if (!text) throw new Error('OpenAI не повернув текстової відповіді. Спробуйте ще раз.');
  return extractJson(text);
}

async function connectedScriptDraft(context, instruction) {
  const endpoint = process.env.AI_STUDIO_ASSISTANT_URL, token = process.env.AI_STUDIO_ASSISTANT_TOKEN, model = process.env.AI_STUDIO_ASSISTANT_MODEL, headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ model, messages: [{ role: 'system', content: scriptSystemPrompt() }, { role: 'user', content: JSON.stringify({ context, instruction }) }], response_format: { type: 'json_object' } }) });
  if (!response.ok) throw new Error(`assistant model returned ${response.status}`);
  const payload = await response.json(), raw = payload?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('assistant model returned an empty draft');
  const draft = JSON.parse(raw); return { title: asText(draft.title), episodeId: context.episode?.id || '', logline: asText(draft.logline), body: asText(draft.body), note: asText(draft.note, 'Чернетка створена підключеною моделлю.') };
}
async function openAIScriptDraft(context, instruction) { const draft = await openAIJsonResponse(scriptSystemPrompt(), { context, instruction }); return { title: asText(draft.title), episodeId: context.episode?.id || '', logline: asText(draft.logline), body: asText(draft.body), note: asText(draft.note, 'Чернетка створена Порадником OpenAI.') }; }

async function generateAssistantDraft(project, { task, episodeId, instruction = '' } = {}) {
  if (task !== 'script') throw new Error('unsupported assistant task');
  const context = buildAssistantContext(project, episodeId), config = assistantConfiguration();
  const draft = config.engine === 'openai' ? await openAIScriptDraft(context, instruction) : config.engine === 'connected-model' ? await connectedScriptDraft(context, instruction) : localScriptDraft(context, instruction);
  return { task, engine: config.engine, context: { episode: context.episode?.title || null, characterCount: context.characters.length, sceneCount: context.scenes.length, styleRuleCount: context.styleRules.length, scriptCount: context.existingScripts.length, assetCount: context.assets.length, visualReferenceCount: context.visualReferences.length }, draft };
}

async function askProjectAdvisor(project, { message, episodeId } = {}) {
  const question = String(message || '').trim(); if (!question) throw new Error('Напишіть питання для Порадника.');
  const config = assistantConfiguration(); if (config.engine !== 'openai') throw new Error('Порадник OpenAI ще не підключено. Перевірте локальний ключ і перезапустіть студію.');
  const context = buildProjectAdvisorContext(project, episodeId), reply = await openAIJsonResponse(advisorSystemPrompt(), { question, context });
  return { engine: config.engine, model: config.model, context: { project: context.project.name, seasonEpisodes: context.season.length, selectedEpisode: context.selectedEpisode?.title || null, characterCount: context.characters.length, scriptCount: context.selectedEpisodeWork.scripts.length }, reply: { answer: asText(reply.answer), observations: Array.isArray(reply.observations) ? reply.observations.filter(Boolean).slice(0, 3) : [], nextSteps: Array.isArray(reply.nextSteps) ? reply.nextSteps.filter(Boolean).slice(0, 3) : [] } };
}

module.exports = { buildAssistantContext, buildProjectAdvisorContext, localScriptDraft, assistantConfiguration, generateAssistantDraft, askProjectAdvisor };
