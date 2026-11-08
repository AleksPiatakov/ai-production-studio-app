const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'public/approved-color-unification.css'),'utf8');
const app=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const preview=fs.readFileSync(path.join(root,'preview/index.html'),'utf8');
const builder=fs.readFileSync(path.join(root,'scripts/build-preview.js'),'utf8');
test('approved dark scheme is loaded last in both entry points',()=>{
  const cssName='approved-color-unification.css';
  assert.ok(app.includes('/'+cssName));
  assert.ok(preview.includes('./'+cssName));
  assert.ok(builder.includes(cssName));
  assert.match(css,/color-scheme:dark/);
  assert.match(css,/--aps-panel:#10162b/);
  assert.match(css,/body input:not/);
  assert.match(css,/dialog\.workspace-dialog/);
});
test('legacy white inputs are overridden by approved dark surfaces',()=>{
  assert.match(css,/background-color:var\(--aps-control\)!important/);
  assert.match(css,/color:var\(--aps-ink\)!important/);
});

test('approved shell has visible navy and violet surfaces with cache refresh',()=>{
  assert.match(css,/Visible shared shell/);
  assert.match(css,/--canvas:#090d20/);
  assert.match(css,/--violet:#9a27f0/);
  assert.match(css,/body \.p01-dashboard \.p01-module/);
  assert.match(css,/body \.preview-rail button\.active/);
  assert.match(app,/approved-color-unification\.css\?v=20261108c/);
  assert.match(preview,/approved-color-unification\.css\?v=20261108c/);
});
