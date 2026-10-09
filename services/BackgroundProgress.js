// We compare wall-clock time with the time the game has actually processed. The difference
// is pending work. Date.now measures real elapsed time; the Phaser clock measures gameplay
// time. Catch-up runs in short batches so the page can respond between them. Visibility
// changes come from the browser and Android, and the same callbacks must be removed during
// cleanup.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';

export const BACKGROUND_STEP_MS = 50;

// Account for suspended time through scene settlement, with a small-step fallback.
export default class BackgroundProgress {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
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
    this.isReplaying = false;
    this.replayDirty = false;
    this.catchUpTimer = null;
    this.catchUpTotalMs = 0;
    this.catchUpPercent = -1;
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

    // once registers a callback that removes itself after the first matching event.
    game.events.once('destroy', () => this.destroy());
  }

  // Add real elapsed time to the pending catch-up work and remember the new wall-clock
  // sample.
  account() {
    const wallTime = this.now();

    // Accumulate real time not yet processed. Clamp negative elapsed time to zero because
    // the device clock can move backward. Then remember this wall time as the starting
    // point for the next accounting pass.
    const elapsedMs = Math.max(0, wallTime - this.lastWallTime);
    this.pendingMs += elapsedMs;

    // Include time spent calculating in the displayed workload. The bar measures game
    // time processed, rather than guessing how many real seconds the phone needs.
    if (this.notice) this.catchUpTotalMs += elapsedMs;
    this.lastWallTime = wallTime;
  }

  // Restore the gameplay clock and calculate missed work from the saved timestamp and
  // pause state.
  restore(time, savedAtMs, paused = false) {
    this.showCatchUp(false);
    this.time = time;
    this.lastWallTime = this.now();

    // A paused save owes no simulated progress. Otherwise the gap between now and
    // savedAtMs is the work to catch up, including time when the OS completely suspended
    // the page.
    this.pendingMs = paused ? 0 : Math.max(0, this.lastWallTime - savedAtMs);
    this.showCatchUp(!this.hidden && this.pendingMs >= BACKGROUND_STEP_MS);
  }

  // Account for elapsed time, notify shared services of visibility and begin appropriate
  // catch-up work.
  setHidden(hidden) {
    this.account();
    this.hidden = hidden;
    this.onBackground(hidden || this.pendingMs > BACKGROUND_STEP_MS);
    this.onSettle();
    this.pump();

    if (!hidden) {

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. ?. only follows this link when the value exists; a missing optional value
      // gives undefined.
      for (const scene of this.game.scene.getScenes?.(true) ?? []) scene.onForeground?.();
    }
  }

  // Advance an ordinary visible frame or drain missed real time after a long gap.
  frame(time, delta) {

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
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

  // Check elapsed time outside normal visible frames and process queued background work.
  pump() {
    if (!this.hidden && this.pendingMs < BACKGROUND_STEP_MS) return;
    this.account();
    this.drain();
  }

  // Process pending time in bounded batches, preferring the active scene's own settlement
  // helper.
  drain() {

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
    this.time ??= this.game.loop.time || 0;
    this.onBackground(true);
    this.showCatchUp(!this.hidden && this.pendingMs >= BACKGROUND_STEP_MS);
    const started = this.budgetNow();

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. find returns the first matching entry, or undefined when none matches.
    // Check for that missing result before using its fields.
    const idleScene = this.game.scene.getScenes?.(true).find(scene => scene.advanceIdleProgress);
    let sceneSettlement = false;
    if (this.pendingMs >= BACKGROUND_STEP_MS && idleScene) {
      this.isReplaying = true;
      try {
        const result = idleScene.advanceIdleProgress(this.pendingMs, this.budgetNow);

        // The scene reports how many milliseconds it actually processed. Subtract that
        // from the debt, rather than assuming one call settled the whole gap. The next
        // batch continues from the updated live combat state.
        const consumedMs = result === true ? this.pendingMs : result?.consumedMs ?? 0;
        this.time += consumedMs;
        this.pendingMs -= consumedMs;

        // ||= assigns only when the current value is falsy, such as false, zero or
        // undefined.
        this.replayDirty ||= consumedMs > 0;
        sceneSettlement = result !== false;
      } finally {
        this.isReplaying = false;
      }
    }

    while (!sceneSettlement && this.pendingMs >= BACKGROUND_STEP_MS) {
      this.step(BACKGROUND_STEP_MS, true);
      this.pendingMs -= BACKGROUND_STEP_MS;

      // some stops with true as soon as one entry passes the check; an empty list gives
      // false.
      if (this.game.scene.getScenes?.(true).some(scene => scene.isWaitingForPlayer?.())) {
        this.pendingMs = 0;
        break;
      }

      // Stop this batch after about 24 milliseconds of computation. The remaining debt
      // stays queued; yielding gives input and the catch-up display a turn between
      // batches.
      if (this.budgetNow() - started >= 24) break;
    }

    this.showCatchUp(!this.hidden && this.pendingMs >= BACKGROUND_STEP_MS);
    if (this.pendingMs < BACKGROUND_STEP_MS) {
      if (this.replayDirty) {
        this.replayDirty = false;
        for (const scene of this.game.scene.getScenes?.(true) ?? []) scene.onCatchUpSettled?.();
      }
      this.onSettle();
      this.onBackground(this.hidden);
    } else if (!this.hidden && this.catchUpTimer === null) {
      this.catchUpTimer = this.host.setTimeout(() => {
        this.catchUpTimer = null;
        this.pump();
      }, 0);
    }
  }

  // Advance the normal scene manager by this elapsed duration while marking replay state
  // for its services.
  step(delta, catchUp) {
    this.time += delta;
    const restores = [];
    this.isReplaying = catchUp;

    if (catchUp) this.replayDirty = true;
    if (catchUp) {

      // Phaser tweens use Date.now internally, so replay must provide their simulation
      // delta.
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

      // call runs this function with the supplied first argument as its this value.
      this.originalUpdate.call(this.game.scene, this.time, delta);
    } finally {
      this.isReplaying = false;
      for (const restore of restores) restore();

      // SceneManager normally clears this during render; background steps have no render.
      this.game.scene.isProcessing = false;
    }
  }

  // Show or dismiss the input-blocking catch-up display while missed gameplay time is
  // processed.
  showCatchUp(show) {
    if (show && !this.notice) {
      this.catchUpTotalMs = this.pendingMs;
      this.notice = this.page.createElement('div');
      this.notice.id = 'idle-catch-up';

      // This overlay uses browser pixels, so its 24-pixel text stays readable without
      // Phaser's canvas scaling. Safe-area padding keeps it clear of Android system UI.
      this.notice.style.cssText = `position:fixed;inset:0;z-index:99999;display:grid;place-items:center;box-sizing:border-box;padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));background:#10131aee;color:#f5f5dc;font:${UI_FONT_WEIGHTS.bold} ${fontPx('compact24')} ${UI_FONT_FAMILIES.sans};touch-action:none`;
      const panel = this.page.createElement('div');
      panel.style.cssText = 'width:min(520px,100%);display:grid;gap:16px;text-align:center';
      const title = this.page.createElement('div');
      title.textContent = 'Resolving idle progress…';
      this.noticeProgress = this.page.createElement('div');
      this.noticeProgress.setAttribute('role', 'progressbar');
      this.noticeProgress.setAttribute('aria-label', 'Idle progress processed');
      this.noticeProgress.setAttribute('aria-valuemin', '0');
      this.noticeProgress.setAttribute('aria-valuemax', '100');
      this.noticeProgress.style.cssText = 'height:20px;border:2px solid #8e7955;border-radius:6px;background:#222936;overflow:hidden';
      this.noticeFill = this.page.createElement('div');
      this.noticeFill.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg,#96753d,#dfbe75)';
      this.noticePercent = this.page.createElement('div');
      this.noticePercent.setAttribute('aria-hidden', 'true');
      this.noticeProgress.appendChild(this.noticeFill);
      panel.appendChild(title);
      panel.appendChild(this.noticeProgress);
      panel.appendChild(this.noticePercent);
      this.notice.appendChild(panel);
      this.page.body.appendChild(this.notice);
    }

    if (show) {

      // Keep 100% for completed work: even a tiny remaining batch still needs to run.
      // Update only on whole percentage changes to keep DOM work out of the hot loop.
      const percent = Math.min(99, Math.max(0,
        Math.floor((1 - this.pendingMs / Math.max(1, this.catchUpTotalMs)) * 100)));
      if (percent === this.catchUpPercent) return;
      this.catchUpPercent = percent;
      this.noticeFill.style.width = `${percent}%`;
      this.noticePercent.textContent = `${percent}%`;
      this.noticeProgress.setAttribute('aria-valuenow', String(percent));
    } else {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      this.notice?.remove();
      this.notice = null;
      this.noticeProgress = null;
      this.noticeFill = null;
      this.noticePercent = null;
      this.catchUpTotalMs = 0;
      this.catchUpPercent = -1;
    }
  }

  // We release the objects and handlers owned here. Scene changes can happen more than
  // once, so cleanup must not leave a listener or timer operating on a screen that has
  // already gone away.
  destroy() {
    if (this.catchUpTimer !== null) this.host.clearTimeout(this.catchUpTimer);
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
