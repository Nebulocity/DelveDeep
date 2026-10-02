const screen = () => document.getElementById('loading-screen');
let revealVersion = 0;

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
export function showLoadingScreen(mode = 'world', title = '') {
  const element = screen();
  if (!element) return;
  const isDelve = mode === 'delve';
  element.querySelector('#loading-message').textContent = isDelve
    ? `Preparing ${title || 'the battlefield'}`
    : 'Preparing the world map';
  updateLoadingProgress(0);
  element.classList.remove('is-art-ready');
  element.classList.remove('is-hidden');
  revealTextAfterImage();
}

function updateLoadingProgress(value) {
  const element = screen();
  if (!element) return;
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  element.querySelector('#loading-percent').textContent = `${percent}%`;
  element.querySelector('#loading-progress').style.width = `${percent}%`;
}

export function trackLoading(scene) {
  const progress = (value) => updateLoadingProgress(value);
  const complete = () => {
    scene.load.off('progress', progress);
    updateLoadingProgress(1);
    const message = screen()?.querySelector('#loading-message');
    if (message) message.textContent = 'Opening the scene';
  };
  scene.load.on('progress', progress);
  scene.load.once('complete', complete);
}

// The canvas must render its first frame before the overlay is dismissed.
export function hideLoadingScreenAfterRender(scene) {
  scene.game.events.once('postrender', () => {
    const element = screen();
    if (!element) return;
    if (element.classList.contains('is-art-ready')) {
      element.classList.add('is-hidden');
    } else {
      element.addEventListener('loading-art-ready', () => {
        requestAnimationFrame(() => requestAnimationFrame(() => element.classList.add('is-hidden')));
      }, { once: true });
    }
  });
}
