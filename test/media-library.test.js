const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('Media Library exposes project-scoped search filters versions and usage',()=>{
  const js=fs.readFileSync(path.join(root,'public/media-library.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'public/global-studio-pages.css'),'utf8');
  const rail=fs.readFileSync(path.join(root,'public/approved-editor-shell.js'),'utf8');
  const dashboard=fs.readFileSync(path.join(root,'public/project-dashboard.js'),'utf8');
  assert.match(js,/mediaLibraryPanel/);
  assert.match(js,/mediaLibraryFiltered/);
  assert.match(js,/mediaUsage/);
  assert.match(js,/openMediaVersionHistory/);
  assert.match(js,/openNewAssetVersion/);
  assert.match(js,/\/assets\/\$\{encodeURIComponent\(asset\.id\)\}\/versions/);
  assert.match(css,/\.media-grid/);
  assert.match(rail,/\['mediaLibrary','▤','Медіабібліотека'\]/);
  assert.match(dashboard,/goToView\('mediaLibrary'\)/);
});

test('approved assets stay immutable and new draft versions do not replace their pointer',()=>{
  const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
  const server=fs.readFileSync(path.join(root,'server/index.js'),'utf8');
  assert.match(app,/assetId&&asset\?\.status==='approved'/);
  assert.match(app,/Затверджений ресурс не можна змінити напряму/);
  assert.match(server,/targetAsset\.status !== 'approved'/);
});

test('library never exposes cross-project data sources',()=>{
  const js=fs.readFileSync(path.join(root,'public/media-library.js'),'utf8');
  assert.match(js,/active\.assets/);
  assert.match(js,/active\.assetVersions/);
  assert.doesNotMatch(js,/projects\.flatMap/);
});
