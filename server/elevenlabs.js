const fs = require('node:fs');
const path = require('node:path');
const { safeSegment, durationSeconds } = require('./local-voice');

const publicRoot = path.join(__dirname, '..', 'public');
const apiRoot = 'https://api.elevenlabs.io/v1';

function configuration() {
  return { configured: Boolean(process.env.ELEVENLABS_API_KEY), provider: 'ElevenLabs', defaultModel: 'eleven_multilingual_v2' };
}

function headers() {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('ElevenLabs ще не підключено. Додайте ELEVENLABS_API_KEY у .env.local і перезапустіть студію.');
  return { 'xi-api-key': process.env.ELEVENLABS_API_KEY };
}

async function api(pathname, options = {}) {
  const response = await fetch(`${apiRoot}${pathname}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  if (response.ok) return response;
  const error = await response.json().catch(() => ({}));
  const message = error?.detail?.message || error?.detail?.[0]?.msg || error?.message || `ElevenLabs повернув помилку ${response.status}.`;
  throw new Error(message);
}

async function listVoices() {
  const response = await api('/voices');
  const payload = await response.json();
  return (payload.voices || []).map(voice => ({ id: voice.voice_id, name: voice.name, description: voice.description || '', category: voice.category || '', labels: voice.labels || {}, previewUrl: voice.preview_url || '' }));
}

async function synthesizeElevenLabsVoice({ projectId, dialogueId, text, voiceId, modelId = 'eleven_multilingual_v2', stability = .5, similarityBoost = .75, style = 0, speed = 1, speakerBoost = true }) {
  const spoken = String(text || '').trim();
  if (!spoken) throw new Error('Для озвучення потрібен текст репліки.');
  if (!voiceId) throw new Error('Для ElevenLabs потрібно вибрати голос у профілі персонажа.');
  if (spoken.length > 5000) throw new Error('Одна репліка для ElevenLabs не може бути довшою за 5000 символів.');
  const safeProject = safeSegment(projectId), safeDialogue = safeSegment(dialogueId);
  const folder = path.join(publicRoot, 'assets', 'generated-audio', safeProject);
  fs.mkdirSync(folder, { recursive: true });
  const filename = `${safeDialogue}-elevenlabs-${Date.now()}.mp3`;
  const output = path.join(folder, filename);
  const body = { text: spoken, model_id: modelId, voice_settings: { stability: Math.max(0, Math.min(1, Number(stability) || .5)), similarity_boost: Math.max(0, Math.min(1, Number(similarityBoost) || .75)), style: Math.max(0, Math.min(1, Number(style) || 0)), use_speaker_boost: Boolean(speakerBoost), speed: Math.max(.7, Math.min(1.2, Number(speed) || 1)) } };
  try {
    const response = await api(`/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'audio/mpeg' }, body: JSON.stringify(body) });
    const audio = Buffer.from(await response.arrayBuffer());
    if (!audio.length) throw new Error('ElevenLabs повернув порожній аудіофайл.');
    fs.writeFileSync(output, audio);
    const duration = await durationSeconds(output);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Створений файл ElevenLabs не містить звуку.');
    return { uri: `/assets/generated-audio/${safeProject}/${filename}`, durationSeconds: Math.round(duration * 100) / 100, engine: `ElevenLabs · ${modelId}`, provider: 'elevenlabs', voiceId };
  } catch (error) {
    if (fs.existsSync(output)) fs.unlinkSync(output);
    throw new Error(`Не вдалося створити озвучку ElevenLabs: ${error.message}`);
  }
}

module.exports = { configuration, listVoices, synthesizeElevenLabsVoice };
