const test = require('node:test');
const assert = require('node:assert/strict');

const service = require('../services/storageService');

test('storage service exposes upload and signed-url helpers', () => {
  assert.ok(service, 'storage service should load');
  assert.equal(typeof service.storageReference, 'function');
  assert.equal(typeof service.removeStorageReference, 'function');
  assert.equal(typeof service.uploadFile, 'function');
  assert.equal(typeof service.deleteFile, 'function');
  assert.equal(typeof service.getSignedUrl, 'function');
  assert.equal(typeof service.fileExists, 'function');
});
