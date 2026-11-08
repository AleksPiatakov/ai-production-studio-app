const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('project versions workspace exposes manual checkpoints and safe restore',()=>{
  const ui=fs.readFileSync(path.join(root,'public','project-versions.js'),'utf8');
  const rail=fs.readFileSync(path.join(root,'public','approved-editor-shell.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'public','global-studio-pages.css'),'utf8');
  assert.match(ui,/createProjectCheckpoint/);
  assert.match(ui,/restoreProjectVersion/);
  assert.match(ui,/Поточний стан спочатку буде збережено/);
  assert.ok(ui.includes('/versions'));
  assert.ok(ui.includes('/restore'));
  assert.match(rail,/\['versions','↶','Версії проєкту'\]/);
  assert.match(css,/\.project-version-card/);
});

test('version API supports manual checkpoints and configured history limits',()=>{
  const server=fs.readFileSync(path.join(root,'server','index.js'),'utf8');
  assert.match(server,/Ручна контрольна точка/);
  assert.match(server,/versionHistoryLimit/);
  assert.match(server,/Автоматично збережено перед відновленням/);
  assert.doesNotMatch(server,/slice\(-30\)/);
});

test('restore remains explicit and never silently deletes the current state',()=>{
  const ui=fs.readFileSync(path.join(root,'public','project-versions.js'),'utf8');
  assert.match(ui,/window\.confirm/);
  assert.match(ui,/Відновити/);
  assert.match(ui,/резервну версію/);
});
