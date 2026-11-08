const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'preview', 'index.html'), 'utf8');

test('approved preview has no internal P-number demo toolbar', () => {
  assert.doesNotMatch(html, /class="preview-controls"/);
  assert.doesNotMatch(html, /aria-label="Демо-екрани"/);
  assert.doesNotMatch(html, /<button[^>]*>[^<]*P-0[24567]<\/button>/);
});

test('approved compact navigation exposes real demo destinations without changing assets', () => {
  for (const id of ['home','projects','project','projectAssistant','aiChanges','script','storyboard','images','voice','voiceLibrary','sound','video','media','versions','davinci','models','modelSetup','queue','assistant','settings']) {
    assert.match(html, new RegExp('data-screen="'+id+'"'));
    assert.match(html, new RegExp('id="screen-'+id+'"'));
  }
  assert.match(html, /window\.previewNavigate=select/);
  assert.match(html, /window\.goToView=function\(name\)/);
  assert.match(html, /window\.previewNavigate\(name\)/);
  assert.match(html, /aria-current/);
  assert.match(html, /global-studio-pages\.css/);
  assert.match(html, /preview-global-zone/);
  assert.match(html, /data-preview-settings-tab/);
  assert.match(html, /data-preview-model-tab/);
  assert.match(html, /data-preview-sound-kind/);
  assert.match(html, /data-preview-video-mode/);
  assert.match(html, /id="screen-media"/);
  assert.match(html, /data-preview-davinci-mode/);
  assert.match(html, /ВЕРСІЇ ПРОЄКТУ/);
  assert.match(html, /БІБЛІОТЕКА ГОЛОСІВ/);
  assert.match(html, /Права підтверджено/);
  assert.match(html, /Журнал · 3/);
  assert.match(html, /Повторити/);
  assert.match(html, /Відкрити результат/);
  assert.match(html, /МАЙСТЕР МОДЕЛІ/);
  assert.match(html, /Жодної автоматичної інсталяції/);
  assert.match(html, /ПЕРЕГЛЯД ЗМІН AI/);
  assert.match(html, /ДОСТУП ДО ПРОЄКТІВ/);
});
