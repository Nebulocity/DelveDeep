import { UI_DOM_FONTS, UI_FONT_FAMILIES } from '../config/uiTypography.js';

document.documentElement.style.setProperty('--ui-sans-family', UI_FONT_FAMILIES.sans);
for (const [name, settings] of Object.entries(UI_DOM_FONTS)) {
  const key = { loadingTitle: 'loading-title', loadingStatus: 'loading-status', loadingBuild: 'loading-build' }[name];
  document.documentElement.style.setProperty(`--${key}-family`, settings.family);
  document.documentElement.style.setProperty(`--${key}-size`, settings.size);
  document.documentElement.style.setProperty(`--${key}-weight`, settings.weight);
}

const screen = () => document.getElementById('loading-screen');
let revealVersion = 0;
const initialLoadingStartedAt = performance.now();
const initialLoadingDuration = 5000;
const initialLoadingDeadline = initialLoadingStartedAt + initialLoadingDuration;
let initialLoadingPending = true;
let initialLoadProgress = 0;
let initialLoadComplete = false;
let initialDisplayedProgress = 0;
let initialLoadCompletedAt = 0;
let initialProgressAtCompletion = 0;

function revealTextAfterImage() {
  const element = screen();
  const art = element?.querySelector('.loading-art');
  if (!art) return;
  const version = ++revealVersion;
  const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (version !== revealVersion) return;
    element.classList.add('is-art-ready');
    element.dispatchEvent(new Event('loading-art-ready'));
  }));
  if (art.complete && art.naturalWidth) reveal();
  else art.addEventListener('load', reveal, { once: true });
}

revealTextAfterImage();

// Keep this DOM layer independent of Phaser assets so it can cover cold starts.
export function showLoadingScreen() {
  const element = screen();
  if (!element) return;
  updateLoadingProgress(0);
  element.classList.remove('is-art-ready');
  element.classList.remove('is-hidden');
  revealTextAfterImage();
}

function updateLoadingProgress(value) {
  const element = screen();
  if (!element) return;
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  element.querySelector('.loading-track').setAttribute('aria-valuenow', String(percent));
  element.querySelector('#loading-progress').style.width = `${percent}%`;
}

function animateInitialLoadingProgress() {
  if (!initialLoadingPending) return;
  const now = performance.now();
  const elapsed = Math.min(1, (now - initialLoadingStartedAt) / initialLoadingDuration);
  if (initialLoadComplete) {
    const remaining = Math.max(1, initialLoadingDeadline - initialLoadCompletedAt);
    const finishProgress = Math.min(1, (now - initialLoadCompletedAt) / remaining);
    initialDisplayedProgress = initialProgressAtCompletion + (1 - initialProgressAtCompletion) * finishProgress;
  } else {
    initialDisplayedProgress = Math.min(elapsed * 0.95, initialLoadProgress);
  }
  updateLoadingProgress(initialDisplayedProgress);
  requestAnimationFrame(animateInitialLoadingProgress);
}

requestAnimationFrame(animateInitialLoadingProgress);

export function trackLoading(scene) {
  const progress = (value) => {
    if (initialLoadingPending) initialLoadProgress = value;
    else updateLoadingProgress(value);
  };
  const complete = () => {
    scene.load.off('progress', progress);
    if (initialLoadingPending) {
      initialLoadComplete = true;
      initialLoadCompletedAt = performance.now();
      initialProgressAtCompletion = initialDisplayedProgress;
    }
    else updateLoadingProgress(1);
  };
  scene.load.on('progress', progress);
  scene.load.once('complete', complete);
}

// The canvas must render its first frame before the overlay is dismissed.
export function hideLoadingScreenAfterRender(scene) {
  scene.game.events.once('postrender', () => {
    const element = screen();
    if (!element) return;
    const hide = () => {
      const remaining = initialLoadingPending ? Math.max(0, initialLoadingDeadline - performance.now()) : 0;
      setTimeout(() => {
        updateLoadingProgress(1);
        element.classList.add('is-hidden');
        initialLoadingPending = false;
      }, remaining);
    };
    if (element.classList.contains('is-art-ready')) {
      hide();
    } else {
      element.addEventListener('loading-art-ready', () => {
        requestAnimationFrame(() => requestAnimationFrame(hide));
      }, { once: true });
    }
  });
}
