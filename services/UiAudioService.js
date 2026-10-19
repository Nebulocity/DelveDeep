import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { UI_SOUNDS } from '../data/uiSounds.js';

export function playUiSound(scene, event) {
  scene?.game?.uiAudio?.request(event);
}

export function runUiAction(scene, action, event = 'click') {
  return scene?.game?.uiAudio ? scene.game.uiAudio.run(action, event) : action(() => {});
}

// UI audio owns only its short voices and reuses Phaser's existing sound manager.
// No manager-wide mute or volume change can interrupt music or combat audio.
export default class UiAudioService {
  constructor(game) {
    this.game = game;
    this.voices = new Set();
    this.current = null;
    this.pending = null;
    this.background = false;
    game.events.once('destroy', () => { this.stop(); this.game = null; });
  }

  select(context, event) {
    if (UI_SOUNDS[event] && (!context.event || UI_SOUNDS[event].priority > UI_SOUNDS[context.event].priority)) context.event = event;
  }

  request(event) {
    if (!UI_SOUNDS[event]) return;
    if (this.current) return this.select(this.current, event);

    // Coalesce synchronous dialog and action notifications from the same input turn.
    if (!this.pending) {
      const context = this.pending = { event: null };
      queueMicrotask(() => {
        if (this.pending === context) this.pending = null;
        this.play(context.event);
      });
    }
    this.select(this.pending, event);
  }

  // Outcome events replace the fallback click. Async callers receive a report closure
  // bound to this interaction, so a later result cannot join another finger's action.
  run(action, fallback = 'click') {
    if (this.current) {
      const context = this.current;
      return action(event => this.select(context, event));
    }
    const context = { event: fallback };
    const report = event => this.select(context, event);
    this.current = context;
    let result;
    try { result = action(report); }
    catch (error) { report('failure'); this.current = null; this.request(context.event); throw error; }
    this.current = null;
    if (result?.then) return result.then(value => {
      this.request(context.event);
      return value;
    }, error => { report('failure'); this.request(context.event); throw error; });
    this.request(context.event);
    return result;
  }

  play(event) {
    const asset = UI_SOUNDS[event];
    const preferences = GameState.preferences;
    const game = this.game;
    if (!asset?.url || asset.license?.verified !== true || !game || this.background
      || globalThis.document?.hidden || preferences.sfxMuted || preferences.sfxVolume <= 0
      || game.sound?.locked || !game.cache.audio.exists(`ui-${event}`)) return;
    try {
      if (this.voices.size >= 4) [...this.voices][0].destroy();
      const sound = game.sound.add(`ui-${event}`, { volume: preferences.sfxVolume, loop: false });
      this.voices.add(sound);
      sound.once('destroy', () => this.voices.delete(sound));
      sound.once('complete', () => sound.destroy());
      if (!sound.play()) sound.destroy();
    } catch {

      // An unavailable audio device must never block the associated UI action.
    }
  }

  setMuted(muted) {
    GameState.preferences.sfxMuted = muted === true;
    if (muted) this.stop();
    saveProfile();
  }

  setVolume(volume) {
    if (!Number.isFinite(volume)) return;
    GameState.preferences.sfxVolume = Math.max(0, Math.min(1, volume));
    for (const sound of this.voices) sound.setVolume(GameState.preferences.sfxVolume);
    saveProfile();
  }

  setBackground(background) {
    this.background = background;
    if (background) this.stop();
  }

  stop() {
    for (const sound of [...this.voices]) sound.destroy();
    this.voices.clear();
  }
}
