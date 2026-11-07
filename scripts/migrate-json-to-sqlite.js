#!/usr/bin/env node
const path = require('node:path');
const { migrateJsonToSqlite } = require('../server/project-storage');

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node scripts/migrate-json-to-sqlite.js [--apply] [--source path/to/studio.json]');
  console.log('Without --apply, validates a temporary SQLite migration and leaves project files unchanged.');
  process.exit(0);
}
const sourceIndex = args.indexOf('--source');
if (sourceIndex !== -1 && !args[sourceIndex + 1]) throw new Error('--source requires a file path');
const source = sourceIndex === -1 ? path.join(process.cwd(), 'data', 'studio.json') : path.resolve(args[sourceIndex + 1]);
const report = migrateJsonToSqlite(source, { apply: args.includes('--apply') });
console.log(JSON.stringify(report, null, 2));
