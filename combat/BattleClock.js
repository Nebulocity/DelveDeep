// Phaser pauses timer elapsed values but still assigns its global frame timestamp to
// Clock.now. Battle statuses need the same paused timeline as those delayed callbacks.

export function installBattleClock(scene) {
  const clock = scene.time;
  if (clock.battleClockInstalled) return;
  const update = clock.update;
  scene.sys.events.off('update', update, clock);

  // Keep milliseconds relative to the saved clock. Loading can assign Clock.now directly;
  // the following frame then continues from that value instead of the browser uptime.
  clock.update = function (frameTime, delta) {
    const elapsed = this.paused ? 0 : delta * this.timeScale;
    update.call(this, this.now + elapsed, delta);
  };
  clock.battleClockInstalled = true;
  scene.sys.events.on('update', clock.update, clock);

  // Clock.start and Clock.shutdown use this same method reference on later scene visits,
  // so Phaser still removes its listener and cannot accumulate a second update handler.
}
