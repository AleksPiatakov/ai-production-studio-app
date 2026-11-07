function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function minutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(20, Math.max(0.5, parsed));
}

function countScenes(duration) {
  if (duration <= 1.5) return 3;
  if (duration <= 3) return 5;
  return Math.min(12, Math.max(6, Math.ceil(duration * 2)));
}

function dialogueDraft(index, character) {
  if (!character?.identityKey || !character?.ageBand || character.status !== 'approved') return [];
  const lines = [
    ['Тихіше… Що це було?', 'Quiet… What was that?', 'зацікавлено, тихо', 'Коротка пауза після «Тихіше». Питання має звучати як справжня цікавість, не як тривога.', { stability: 0.48, similarityBoost: 0.75, style: 0.28, speed: 0.9, sentenceSilence: 0.25, volume: 0.92 }],
    ['Твій ліхтарик згас. Я поруч.', 'Your lantern went out. I’m here.', 'турботливо, спокійно', 'Не поспішати; другу фразу сказати тихіше, як підтримку.', { stability: 0.52, similarityBoost: 0.75, style: 0.22, speed: 0.9, sentenceSilence: 0.3, volume: 0.94 }],
    ['Я не поспішатиму. Покажи мені, що сталося.', 'I won’t rush. Show me what happened.', 'уважно, м’яко', 'Після першого речення — коротка пауза. Це запрошення висловитися, а не наказ.', { stability: 0.5, similarityBoost: 0.75, style: 0.34, speed: 0.88, sentenceSilence: 0.34, volume: 0.94 }]
  ];
  const [textUk, textEn, emotion, performanceNote, generationSettings] = lines[Math.min(index, lines.length - 1)];
  return [{ characterId: character.id, text: textUk, textUk, textEn, language: 'uk', voiceAgeBand: character.ageBand, voiceIdentityKey: character.identityKey, estimatedSeconds: index === 2 ? 4 : 3, emotion, performanceNote, generationSettings, status: 'draft' }];
}

function sceneBlueprint(index, seconds, protagonist, characterIds, styleHint, motionMode, isLast) {
  const characterName = protagonist?.name;
  const hero = characterName || 'Герой';
  const phases = [
    {
      title: 'Зав’язка',
      purpose: 'Показати місце, настрій і маленьку подію, яка привертає увагу героя.',
      action: `${hero} зупиняється на стежці після тихого клацу й помічає ледь видимий відблиск попереду.`,
      image: `Широкий план: ${hero} на вечірній лісовій стежці. Попереду, внизу кадру, — маленький згаслий ліхтарик; погляд героя спрямований саме на нього.`
    },
    {
      title: 'Перший крок',
      purpose: 'Показати, як герой обережно наближається до проблеми, не поспішаючи її вирішувати.',
      action: `${hero} підходить до згаслого ліхтарика й обережно придивляється до нього.`,
      image: `Середній план: ${hero} присідає поруч зі згаслим ліхтариком. Увага героя і композиційний центр кадру — ліхтарик.`
    },
    {
      title: 'Вибір',
      purpose: 'Показати паузу перед дією: герой спершу слухає та помічає важливу підказку.',
      action: `${hero} зупиняється, уважно слухає й помічає маленький блиск у траві.`,
      image: `Крупний план: погляд ${hero} переходить від ліхтарика до маленького блиску кременю в траві. Ліхтарик лишається в кадрі як важливий орієнтир.`
    },
    {
      title: 'Дія',
      purpose: 'Показати одну просту дію, що змінює ситуацію.',
      action: `${hero} обережно робить наступний крок до вирішення проблеми.`,
      image: `Детальний план: руки або лапки героя виконують одну зрозумілу дію з важливим предметом історії.`
    },
    {
      title: 'Наслідок',
      purpose: 'Показати результат дії та новий емоційний стан героя.',
      action: `${hero} бачить результат і м’яко на нього реагує.`,
      image: `Середній план: важливий предмет історії змінився, а реакція ${hero} чітко читається в кадрі.`
    },
    {
      title: 'Завершення',
      purpose: 'Тепло завершити історію та залишити чітке враження.',
      action: `${hero} зупиняється, усвідомлює результат і м’яко реагує.`,
      image: `Теплий фінальний план: ${hero} поруч із результатом своєї маленької пригоди; у кадрі тиха вдячність і спокій.`
    }
  ];
  const phase = phases[Math.min(index, phases.length - 1)];
  const motion = motionMode === 'selected-shots'
    ? 'Кандидат на оживлення після ручного вибору: короткий природний рух персонажа й повільний рух камери.'
    : 'Аніматичний рух для перевірки ритму: повільне наближення камери, без складної анімації персонажа.';
  return {
    title: `${index + 1}. ${phase.title}`,
    purpose: phase.purpose,
    durationSeconds: seconds,
    order: index + 1,
    status: 'draft',
    characterIds,
    dialogue: dialogueDraft(index, protagonist),
    prompt: phase.action,
    shots: [{
      seconds,
      order: 1,
      prompt: phase.action,
      imagePrompt: `${phase.image} ${styleHint}`,
      motionPrompt: motion,
      camera: index === 0 ? 'широкий план' : index % 2 ? 'середній план' : 'крупний план',
      lighting: 'Світло має підтримувати настрій історії та зберігати цілісність зі стильовою біблією.',
      action: phase.action,
      acceptanceCriteria: 'Чітко видно головну дію, емоцію та композиційний центр кадру; нові сюжетні факти не додаються.',
      referenceAssetIds: [],
      characterIds,
      status: 'draft'
    }]
  };
}

function buildAutopilotBlueprint(project, input = {}) {
  const brief = text(input.brief);
  if (!brief) throw new Error('Опишіть, що має відбутися у випуску.');
  const targetMinutes = minutes(input.targetMinutes);
  const approvedCharacter = (project.bibles?.characters || []).find(item => item.status === 'approved');
  const fallbackCharacter = (project.bibles?.characters || [])[0];
  const protagonist = approvedCharacter || fallbackCharacter;
  const characterIds = protagonist ? [protagonist.id] : [];
  const styleRule = (project.bibles?.style || []).find(item => item.status === 'approved') || (project.bibles?.style || [])[0];
  const styleHint = styleRule?.rules ? `Використати правило стилю: ${styleRule.rules}` : 'Зберегти візуальний стиль проєкту; не вигадувати новий канон.';
  const sceneCount = countScenes(targetMinutes);
  const totalSeconds = Math.round(targetMinutes * 60);
  let allocated = 0;
  const scenes = Array.from({ length: sceneCount }, (_, index) => {
    const seconds = index === sceneCount - 1 ? totalSeconds - allocated : Math.floor(totalSeconds / sceneCount);
    allocated += seconds;
    return sceneBlueprint(index, seconds, protagonist, characterIds, styleHint, input.motionMode, index === sceneCount - 1);
  });
  const title = text(input.title, protagonist ? `${protagonist.name} — нова історія` : 'Новий випуск — чернетка');
  const logline = protagonist
    ? `${protagonist.name} проходить через подію: ${brief}`
    : `Історія про подію: ${brief}`;
  const scriptBody = [
    'ЧЕРНЕТКА АВТОПІЛОТА — потребує творчого редагування та ручного затвердження.',
    '',
    `Назва: ${title}`,
    `Формат кадру: ${text(input.format, '16:9')}`,
    `Орієнтовна тривалість: ${targetMinutes} хв`,
    '',
    `Задум автора: ${brief}`,
    '',
    ...scenes.map(scene => `${scene.title} (${scene.durationSeconds} с)\nМета: ${scene.purpose}\nШот: ${scene.shots[0].action}${scene.dialogue.length ? `\nЧернетка репліки: ${scene.dialogue[0].textUk}` : ''}`).flatMap(item => [item, '']),
    'Стиль для всіх кадрів: тепла кінематографічна 3D-казка; без написів у кадрі та без нового канону.',
    'Наступне рішення режисера: відредагувати текст і репліки, перевірити персонажів та лише потім обирати шоти для генерації руху.'
  ].join('\n');
  return { title, logline, targetMinutes, format: text(input.format, '16:9'), motionMode: input.motionMode === 'selected-shots' ? 'selected-shots' : 'animatic', scenes, script: { title: `${title} — сценарна чернетка`, logline, body: scriptBody, status: 'draft' } };
}

module.exports = { buildAutopilotBlueprint };
