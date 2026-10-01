const screen = () => document.getElementById('loading-screen');

// Keep this DOM layer independent of Phaser assets so it can cover cold starts.
export function showLoadingScreen(mode = 'world', title = '') {
  const element = screen();
  if (!element) return;
  const isDelve = mode === 'delve';
  element.dataset.mode = isDelve ? 'delve' : 'world';
  element.querySelector('#loading-kicker').textContent = isDelve ? 'THE PARTY DESCENDS' : 'THE JOURNEY BEGINS';
  element.querySelector('#loading-title').textContent = isDelve ? 'INTO THE DEEP' : 'DELVE DEEP';
  element.querySelector('#loading-subtitle').textContent = isDelve ? title : 'Charting the world beyond Pineshire';
  element.querySelector('#loading-message').textContent = isDelve ? 'Preparing the battlefield' : 'Preparing the world map';
  updateLoadingProgress(0);
  element.classList.remove('is-hidden');
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
  scene.game.events.once('postrender', () => screen()?.classList.add('is-hidden'));
}
