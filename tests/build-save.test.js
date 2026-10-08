// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import { prepareBuildSave, PROFILE_STORAGE_KEY, LEADER_STORAGE_KEY } from '../game/BuildSave.js';

// A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
// object; get/set read and write that same key.
const saved = new Map([
  [PROFILE_STORAGE_KEY, 'old party'],
  [LEADER_STORAGE_KEY, 'old tactics'],
  ['other.app.preference', 'keep']
]);
globalThis.localStorage = {

  // We work out item here so callers can use the result. Keep the calculation together
  // with the checks below that decide which inputs are usable.
  getItem: (key) => saved.get(key) ?? null,

  // We bring item up to date here. The assignments below are the new values other code
  // will read after this step.
  setItem: (key, value) => saved.set(key, value),

  // We handle remove item here, keeping this operation in one place for its callers.
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
