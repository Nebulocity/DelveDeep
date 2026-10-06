export const BACKGROUND_STEP_MS = 50;

// Account for suspended time in small combat steps without rendering hidden frames.
export default class BackgroundProgress {
  constructor(game, { now = () => Date.now(), budgetNow = () => performance.now(),
    document: page = globalThis.document, window: host = globalThis.window,
    onBackground = () => {}, onSettle = () => {} } = {}) {
    this.game = game;
    this.now = now;
    this.budgetNow = budgetNow;
    this.page = page;
    this.host = host;
    this.onBackground = onBackground;
    this.onSettle = onSettle;
    this.lastWallTime = now();
    this.time = null;
    this.pendingMs = 0;
    this.hidden = page.hidden;
    this.originalUpdate = game.scene.update;
    game.scene.update = (time, delta) => this.frame(time, delta);
    this.visibilityChanged = () => this.setHidden(page.hidden);
    this.pageHidden = () => this.setHidden(true);
    this.pageShown = () => this.setHidden(page.hidden);
    this.nativeStateChanged = (event) => this.setHidden(!event.isActive);
    page.addEventListener('visibilitychange', this.visibilityChanged);
    page.addEventListener('freeze', this.pageHidden);
    page.addEventListener('resume', this.pageShown);
    host.addEventListener('pagehide', this.pageHidden);
    host.addEventListener('pageshow', this.pageShown);
    host.addEventListener('delveAppState', this.nativeStateChanged);
    this.timer = host.setInterval(() => this.pump(), 250);
    game.events.once('destroy', () => this.destroy());
  }

  account() {
    const wallTime = this.now();
    this.pendingMs += Math.max(0, wallTime - this.lastWallTime);
    this.lastWallTime = wallTime;
  }

  restore(time, savedAtMs, paused = false) {
    this.time = time;
    this.lastWallTime = this.now();
    this.pendingMs = paused ? 0 : Math.max(0, this.lastWallTime - savedAtMs);
    this.showCatchUp(!this.hidden && this.pendingMs >= BACKGROUND_STEP_MS);
  }

  setHidden(hidden) {
    this.account();
    this.hidden = hidden;
    this.onBackground(hidden || this.pendingMs > BACKGROUND_STEP_MS);
    this.onSettle();
    this.pump();
  }

  frame(time, delta) {
    this.time ??= time - delta;
    if (this.hidden) return;
    const previousDebt = this.pendingMs;
    this.account();

    // Ordinary frames retain Phaser's smooth delta; a long gap uses elapsed real time.
    if (previousDebt < BACKGROUND_STEP_MS && this.pendingMs < 250) {
      this.pendingMs = 0;
      this.step(delta, false);
      return;
    }
    this.drain();
  }

  pump() {
    if (!this.hidden && this.pendingMs < BACKGROUND_STEP_MS) return;
    this.account();
    this.drain();
  }

  drain() {
    this.time ??= this.game.loop.time || 0;
    this.onBackground(true);
    const started = this.budgetNow();
    while (this.pendingMs >= BACKGROUND_STEP_MS) {
      this.step(BACKGROUND_STEP_MS, true);
      this.pendingMs -= BACKGROUND_STEP_MS;
      if (this.game.scene.getScenes?.(true).some(scene => scene.isWaitingForPlayer?.())) {
        this.pendingMs = 0;
        break;
      }
      if (this.budgetNow() - started >= 12) break;
    }
    this.showCatchUp(!this.hidden && this.pendingMs >= BACKGROUND_STEP_MS);
    if (this.pendingMs < BACKGROUND_STEP_MS) {
      this.onSettle();
      this.onBackground(this.hidden);
    }
  }

  step(delta, catchUp) {
    this.time += delta;
    const restores = [];
    if (catchUp) {

      // Phaser tweens use Date.now internally, so replay must provide their simulation delta.
      for (const scene of this.game.scene.scenes) {
        if (!scene.tweens) continue;
        const manager = scene.tweens;
        const getDelta = manager.getDelta;
        manager.getDelta = () => delta;
        restores.push(() => {
          manager.getDelta = getDelta;
          const wallTime = Date.now();
          manager.startTime += wallTime - manager.prevTime;
          manager.prevTime = wallTime;
        });
      }
    }
    try {
      this.originalUpdate.call(this.game.scene, this.time, delta);
    } finally {
      for (const restore of restores) restore();

      // SceneManager normally clears this during render; background steps have no render.
      this.game.scene.isProcessing = false;
    }
  }

  showCatchUp(show) {
    if (show && !this.notice) {
      this.notice = this.page.createElement('div');
      this.notice.setAttribute('role', 'status');
      this.notice.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#10131aee;color:#f5f5dc;font:bold 24px Arial;touch-action:none';
      this.page.body.appendChild(this.notice);
    }
    if (show) this.notice.textContent = 'Resolving idle progress…';
    else {
      this.notice?.remove();
      this.notice = null;
    }
  }

  destroy() {
    this.host.clearInterval(this.timer);
    this.page.removeEventListener('visibilitychange', this.visibilityChanged);
    this.page.removeEventListener('freeze', this.pageHidden);
    this.page.removeEventListener('resume', this.pageShown);
    this.host.removeEventListener('pagehide', this.pageHidden);
    this.host.removeEventListener('pageshow', this.pageShown);
    this.host.removeEventListener('delveAppState', this.nativeStateChanged);
    this.game.scene.update = this.originalUpdate;
    this.showCatchUp(false);
    this.onBackground(false);
  }
}
