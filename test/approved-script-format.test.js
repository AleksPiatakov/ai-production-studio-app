const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public','approved-script-format.js'),'utf8'),sandbox);
const format=sandbox.window.APSApprovedScriptFormat;

test('approved screenplay formatting retains scene and dialogue hierarchy',()=>{
 const html=format.renderLines('СЦЕНА 2. МОСТ — ДЕНЬ\n\nМИРА: Це він?\n\nГОЛОС: Не бійся.');
 assert.equal((html.match(/aps-screenplay-scene/g)||[]).length,1);
 assert.equal((html.match(/aps-screenplay-dialogue/g)||[]).length,2);
 assert.match(html,/is-narrator/);
 assert.match(html,/Це він\?/);
});
test('approved screenplay never interprets user script HTML as markup',()=>{
 const html=format.renderLines('СЦЕНА 1. <img src=x onerror=alert(1)>\n\nМИРА: <script>bad()</script>');
 assert.ok(!html.includes('<img'));
 assert.ok(!html.includes('<script>bad()'));
 assert.ok(html.includes('&lt;img'));
 assert.ok(html.includes('&lt;script&gt;'));
});
test('empty script renders safe reader prompt',()=>{
 assert.match(format.renderLines(''),/aps-screenplay-empty/);
});
test('scene line and notes remain distinguishable without altering source',()=>{
 const script='СЦЕНА 1. ПОЛЕ\nЛОКАЦІЯ: Поле\n(тихо, у голові)\nДІЯ: Героїня йде';
 const html=format.renderLines(script);
 assert.match(html,/aps-screenplay-detail/);
 assert.match(html,/aps-screenplay-direction/);
 assert.match(html,/aps-screenplay-action/);
 assert.equal(script.split('\n').length,4);
});
