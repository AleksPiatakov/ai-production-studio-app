// Standalone static preview. Never imports local project data, secrets, media, or APIs.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'preview-dist');
const requiredStyles = [
  'styles.css', 'editor.css', 'actions.css', 'contrast.css',
  'voice-editor.css', 'workspace-dialog.css', 'studio-theme.css'
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(path.join(root, 'preview', 'index.html'), path.join(output, 'index.html'));

for (const name of requiredStyles) {
  const source = path.join(root, 'public', name);
  if (!fs.existsSync(source)) throw new Error('Missing preview CSS: ' + source);
  fs.copyFileSync(source, path.join(output, name));
}
fs.copyFileSync(path.join(root, 'public', 'project-dashboard.js'), path.join(output, 'project-dashboard.js'));
fs.writeFileSync(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log('Preview built with synthetic data. Static files:', fs.readdirSync(output).length);
