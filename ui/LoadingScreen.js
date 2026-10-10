// The HTML splash exists before Phaser loads. This module updates its progress and
// visibility, then hides it when the next screen is ready. It also publishes font settings
// as CSS variables so browser text uses the same central typography choices.

import { UI_DOM_FONTS, UI_FONT_FAMILIES } from '../config/uiTypography.js';

document.documentElement.style.setProperty('--ui-sans-family', UI_FONT_FAMILIES.sans);

// Object.entries turns own fields into [key, value] pairs so we can visit or transform
// them.
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

// Wait for the splash artwork before revealing its overlaid loading text.
function revealTextAfterImage() {
  const element = screen();

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
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

// Update the progress fill and its accessible value together.
function updateLoadingProgress(value) {
  const element = screen();
  if (!element) return;

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  element.querySelector('.loading-track').setAttribute('aria-valuenow', String(percent));
  element.querySelector('#loading-progress').style.width = `${percent}%`;
}

// Give the initial splash visible progress while Phaser startup is getting ready.
function animateInitialLoadingProgress() {
  if (!initialLoadingPending) return;
  const now = performance.now();

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound.
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

// Connect the scene loader's progress and completion events to the splash display. scene
// is the Phaser screen that owns the objects, clock and input used here.
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

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  scene.load.on('progress', progress);

  // once registers a callback that removes itself after the first matching event.
  scene.load.once('complete', complete);
}

// The canvas must render its first frame before the overlay is dismissed.
export function hideLoadingScreenAfterRender(scene) {

  // once registers a callback that removes itself after the first matching event.
  scene.game.events.once('postrender', () => {
    const element = screen();
    if (!element) return;
    const hide = () => {

      // The condition before ? chooses the first value when true and the value after :
      // when false. Math.max chooses the largest value; pairing it with Math.min can keep
      // a result inside both a lower and an upper bound.
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
