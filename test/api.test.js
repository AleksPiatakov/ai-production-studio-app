const test = require('node:test');
const assert = require('node:assert/strict');
const { server, allowedAgeBands, supportedLanguages } = require('../server');
test('local API server composition exposes supported production metadata', () => {
  assert.equal(typeof server.emit, 'function');
  assert.deepEqual(allowedAgeBands, ['child', 'teen', 'young-adult', 'adult', 'elder']);
  assert.deepEqual(supportedLanguages, ['uk', 'en']);
});
