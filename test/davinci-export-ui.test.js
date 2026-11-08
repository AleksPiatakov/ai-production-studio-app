const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('DaVinci export UI separates draft and final package readiness',()=>{
  const js=fs.readFileSync(path.join(root,'public/davinci-export.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'public/global-studio-pages.css'),'utf8');
  assert.match(js,/davinciExportMode='draft'/);
  assert.match(js,/setDaVinciMode/);
  assert.match(js,/Фінальний пакет заблоковано/);
  assert.match(js,/Manifest JSON/);
  assert.match(js,/Timeline CSV/);
  assert.match(js,/Монтажний лист/);
  assert.match(js,/Автоматичне створення готового DaVinci-проєкту не заявляється/);
  assert.match(css,/\.davinci-tree/);
  assert.match(css,/\.davinci-issues/);
});

test('DaVinci package routes expose report and files without replacing Resolve',()=>{
  const server=fs.readFileSync(path.join(root,'server/index.js'),'utf8');
  assert.match(server,/davinci-package/);
  assert.match(server,/manifest\.json/);
  assert.match(server,/timeline\.csv/);
  assert.match(server,/handoff\.md/);
  assert.match(server,/mode === 'final' && !packagePlan\.canExport/);
});
