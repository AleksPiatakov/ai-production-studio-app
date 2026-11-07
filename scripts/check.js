const fs = require('node:fs');
const path = require('node:path');
const required = ['README.md','docs/TECHNICAL-SPEC-v0.1.md','docs/WORKER-CONTRACT.md','server/index.js','server/validation.js','public/index.html','public/app.js'];
for (const file of required) if (!fs.existsSync(path.join(process.cwd(), file))) throw new Error(`Missing ${file}`);
const spec = fs.readFileSync('docs/TECHNICAL-SPEC-v0.1.md','utf8');
for (const phrase of ['MacBook Air M2', 'GPU worker', 'ElevenLabs']) if (!spec.includes(phrase)) throw new Error(`Specification misses: ${phrase}`);
const html = fs.readFileSync('public/index.html', 'utf8');
if (!html.includes('id="modal-cancel"') || !html.includes('type="button" id="modal-cancel"')) throw new Error('Modal cancel control must not submit a form');
console.log(`Structure check passed (${required.length} required files).`);
