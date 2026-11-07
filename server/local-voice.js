const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const publicRoot = path.join(__dirname, '..', 'public');
const workspaceRoot = path.join(__dirname, '..');
const piperPython = path.join(workspaceRoot, '.runtime', 'piper-venv', 'bin', 'python');
const piperModel = path.join(workspaceRoot, '.runtime', 'piper-voices', 'uk_UA-tetiana-high.onnx');

function safeSegment(value) {
  const result = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!result) throw new Error('Invalid audio output identifier');
  return result;
}

function run(command, args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', chunk => { error += chunk; });
    child.stdin.end(input);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(error.trim() || `${path.basename(command)} exited with code ${code}`)));
  });
}

async function durationSeconds(file) {
  const chunks = [];
  await new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/afinfo', [file], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => chunks.push(chunk));
    child.stderr.on('data', chunk => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error('Cannot inspect generated audio')));
  });
  const match = Buffer.concat(chunks).toString('utf8').match(/estimated duration:\s*([\d.]+)/i);
  return match ? Number(match[1]) : 0;
}

async function synthesizeMacVoice({ projectId, dialogueId, language, text, rate = 165 }) {
  if (process.platform !== 'darwin') throw new Error('Локальне озвучення доступне лише на macOS.');
  const spoken = String(text || '').trim();
  if (!spoken) throw new Error('Для озвучення потрібен текст репліки.');
  if (spoken.length > 1200) throw new Error('Одна репліка для локальної озвучки не може бути довшою за 1200 символів.');
  const safeProject = safeSegment(projectId), safeDialogue = safeSegment(dialogueId);
  const folder = path.join(publicRoot, 'assets', 'generated-audio', safeProject);
  fs.mkdirSync(folder, { recursive: true });
  const fileName = `${safeDialogue}-${language}-${Date.now()}.aiff`;
  const output = path.join(folder, fileName);
  const voice = language === 'uk' ? 'Lesya' : 'Samantha';
  try {
    await run('/usr/bin/say', ['-v', voice, '-r', String(rate), '-o', output, spoken]);
    const duration = await durationSeconds(output);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Створений системою файл не містить звуку.');
    return { uri: `/assets/generated-audio/${safeProject}/${fileName}`, durationSeconds: Math.round(duration * 100) / 100, engine: `macOS say · ${voice}` };
  } catch (error) {
    if (fs.existsSync(output)) fs.unlinkSync(output);
    throw new Error(`Не вдалося створити локальну озвучку: ${error.message}`);
  }
}

function hasPiperVoice() { return fs.existsSync(piperPython) && fs.existsSync(piperModel); }

async function synthesizePiperVoice({ projectId, dialogueId, language, text, speed = 1, stability = 0.5, style = 0, sentenceSilence = 0.2, volume = 1 }) {
  if (language !== 'uk') throw new Error('Перший локальний Piper-голос налаштовано лише для української.');
  if (!hasPiperVoice()) throw new Error('Локальний Piper і українська модель ще не встановлені.');
  const spoken = String(text || '').trim();
  if (!spoken) throw new Error('Для озвучення потрібен текст репліки.');
  if (spoken.length > 1200) throw new Error('Одна репліка для локальної озвучки не може бути довшою за 1200 символів.');
  const safeProject = safeSegment(projectId), safeDialogue = safeSegment(dialogueId);
  const folder = path.join(publicRoot, 'assets', 'generated-audio', safeProject);
  fs.mkdirSync(folder, { recursive: true });
  const fileName = `${safeDialogue}-${language}-${Date.now()}.wav`;
  const output = path.join(folder, fileName);
  try {
    const safeSpeed = Math.max(.7, Math.min(1.2, Number(speed) || 1));
    const safeStability = Math.max(0, Math.min(1, Number(stability) || 0));
    const safeStyle = Math.max(0, Math.min(1, Number(style) || 0));
    const safeSilence = Math.max(0, Math.min(1.5, Number(sentenceSilence) || 0));
    const safeVolume = Math.max(.5, Math.min(1.5, Number(volume) || 1));
    // Piper exposes natural variation as generator and phoneme-width noise. Higher stability intentionally reduces it.
    const noiseScale = .95 - (.6 * safeStability);
    const noiseWScale = .65 + (.45 * safeStyle);
    await run(piperPython, ['-m', 'piper', '-m', piperModel, '-f', output, '--length-scale', String(1 / safeSpeed), '--noise-scale', String(noiseScale), '--noise-w-scale', String(noiseWScale), '--sentence-silence', String(safeSilence), '--volume', String(safeVolume)], spoken);
    const duration = await durationSeconds(output);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Piper створив файл без звуку.');
    return { uri: `/assets/generated-audio/${safeProject}/${fileName}`, durationSeconds: Math.round(duration * 100) / 100, engine: 'Piper · uk_UA-tetiana-high' };
  } catch (error) {
    if (fs.existsSync(output)) fs.unlinkSync(output);
    throw new Error(`Не вдалося створити озвучку Piper: ${error.message}`);
  }
}

module.exports = { safeSegment, durationSeconds, synthesizeMacVoice, synthesizePiperVoice, hasPiperVoice };
