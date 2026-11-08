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


test('G-08 export settings affect draft package without weakening final safety',()=>{
  const server=fs.readFileSync(path.join(__dirname,'../server/index.js'),'utf8');
  const handoff=fs.readFileSync(path.join(__dirname,'../server/davinci-handoff.js'),'utf8');
  const ui=fs.readFileSync(path.join(__dirname,'../public/davinci-export.js'),'utf8');
  assert.match(server,/const draftAllowed = exportSettings\.includeDrafts === true/);
  assert.match(server,/verifyFiles: exportSettings\.verifyFiles !== false/);
  assert.match(server,/mode === 'draft' && !draftAllowed/);
  assert.match(server,/Чернетковий пакет вимкнено у налаштуваннях експорту/);
  assert.match(handoff,/const verifyFiles = packageMode === 'final' \? true : options\.verifyFiles !== false/);
  assert.match(handoff,/const missingFiles = verifyFiles \?/);
  assert.match(ui,/const exportBlocked=Boolean\(report\)&&!report\.canExport/);
  assert.match(ui,/Чернетковий пакет вимкнено у Налаштуваннях → Експорт/);
  assert.match(ui,/вимкнена для draft/);
});


test('export default language drives P-15 localization readiness',()=>{
  const handoff=fs.readFileSync(path.join(__dirname,'../server/davinci-handoff.js'),'utf8');
  const server=fs.readFileSync(path.join(__dirname,'../server/index.js'),'utf8');
  const settings=fs.readFileSync(path.join(__dirname,'../public/global-studio-pages.js'),'utf8');
  assert.match(handoff,/const preferredLanguage = options\.defaultLanguage === 'en'/);
  assert.match(handoff,/a\.language===preferredLanguage/);
  assert.match(handoff,/item\.language === preferredLanguage && item\.subtitlesPath/);
  assert.match(handoff,/exportDefaultLanguage: preferredLanguage/);
  assert.match(server,/defaultLanguage: exportSettings\.defaultLanguage \|\| project\.defaultLanguage/);
  assert.match(settings,/основною для P-15 readiness/);
  assert.match(settings,/ZIP\/копіювання папок не імітується/);
});
