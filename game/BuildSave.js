// Each web build gets a unique ID from Vite. The first launch of a different build clears
// the old progress according to the existing game policy. Relaunching that same build
// keeps its saves. This is separate from the app version or the Git branch shown on the
// loading screen.

export const PROFILE_STORAGE_KEY = 'delveDeep.profile.v2';
export const LEADER_STORAGE_KEY = 'delveDeep.leaderProgression.v1';
const BUILD_STORAGE_KEY = 'delveDeep.buildId.v1';

// A new bundle starts with clean player progress, then saves normally until the next build
// is installed or loaded.
export function prepareBuildSave(buildId = typeof __DELVE_DEEP_BUILD_ID__ === 'string'
  ? __DELVE_DEEP_BUILD_ID__ : 'development') {

  try {
    if (localStorage.getItem(BUILD_STORAGE_KEY) === buildId) return;
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    localStorage.removeItem(LEADER_STORAGE_KEY);
    localStorage.setItem(BUILD_STORAGE_KEY, buildId);
  } catch (error) {
    console.warn('Could not reset Delve Deep progress for this build.', error);
  }
}
