const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('approved global rail is available for all studio views', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'approved-editor-shell.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'approved-editor-shell.css'), 'utf8');
  assert.match(js, /classList\.add\('aps-approved-studio-shell'\)/);
  assert.doesNotMatch(js, /if\(view!=='editor'\)return/);
  assert.match(js, /aria-current=/);
  assert.match(css, /body\.aps-approved-studio-shell #aps-approved-nav/);
  assert.match(css, /body\.aps-global-zone \.aps-nav-project-picker/);
  assert.match(css, /body\.aps-approved-studio-shell \.aps-nav-main button\.active/);
});

test('approved rail retains working project and module navigation', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'approved-editor-shell.js'), 'utf8');
  assert.match(js, /goToView\(destination\)/);
  assert.match(js, /selectProject\(event\.target\.value\)/);
});
