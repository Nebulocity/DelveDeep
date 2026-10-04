import assert from 'node:assert/strict';
import { prepareBuildSave, PROFILE_STORAGE_KEY, LEADER_STORAGE_KEY } from '../game/BuildSave.js';

const saved = new Map([
  [PROFILE_STORAGE_KEY, 'old party'],
  [LEADER_STORAGE_KEY, 'old tactics'],
  ['other.app.preference', 'keep']
]);
globalThis.localStorage = {
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value),
  removeItem: (key) => saved.delete(key)
};

prepareBuildSave('build-one');
assert.equal(saved.has(PROFILE_STORAGE_KEY), false);
assert.equal(saved.has(LEADER_STORAGE_KEY), false);
assert.equal(saved.get('other.app.preference'), 'keep');

saved.set(PROFILE_STORAGE_KEY, 'current party');
saved.set(LEADER_STORAGE_KEY, 'current tactics');
prepareBuildSave('build-one');
assert.equal(saved.get(PROFILE_STORAGE_KEY), 'current party');
assert.equal(saved.get(LEADER_STORAGE_KEY), 'current tactics');

prepareBuildSave('build-two');
assert.equal(saved.has(PROFILE_STORAGE_KEY), false);
assert.equal(saved.has(LEADER_STORAGE_KEY), false);
assert.equal(saved.get('other.app.preference'), 'keep');

console.log('Build save generation reset passed.');
