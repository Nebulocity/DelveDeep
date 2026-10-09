// Each web build gets a unique ID from Vite. Record that ID for diagnostics while keeping
// player progress across rebuilt bundles and installed updates. Existing profile and
// leader storage keys stay unchanged so earlier builds can still load their saves.

export const PROFILE_STORAGE_KEY = 'delveDeep.profile.v2';
export const LEADER_STORAGE_KEY = 'delveDeep.leaderProgression.v1';
const BUILD_STORAGE_KEY = 'delveDeep.buildId.v1';

// Build changes update only this metadata. GameStorage handles normal save migrations;
// the explicit Reset Progress control remains the way to intentionally start over.
export function prepareBuildSave(buildId = typeof __DELVE_DEEP_BUILD_ID__ === 'string'
  ? __DELVE_DEEP_BUILD_ID__ : 'development') {

  try {
    if (localStorage.getItem(BUILD_STORAGE_KEY) === buildId) return;
    localStorage.setItem(BUILD_STORAGE_KEY, buildId);
  } catch (error) {
    console.warn('Could not record the Delve Deep build ID.', error);
  }
}
