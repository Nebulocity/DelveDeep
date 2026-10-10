// One music service follows the active scene and saved music preference. It selects only
// assigned tracks, loops the current track and stops or pauses it when appropriate. Audio
// loading is asynchronous, so a late result must still match the current request before it
// is allowed to play.

import GameState from '../game/GameState.js';
import slimeCaveUrl from '../sounds/the_slime_cave/delve_bg1.m4a?url';
import pineshireUrl from '../sounds/pineshire_region/region_bg1.m4a?url';
import bossUrl from '../sounds/the_slime_cave/delve_boss_bg1.m4a?url';

const MUSIC_TRACKS = {
  'music-slime-cave': slimeCaveUrl,
  'music-pineshire': pineshireUrl,
  'music-boss': bossUrl
};

// Queue the bundled tracks used by assigned map, Delve and boss contexts. scene is the
// Phaser screen that owns the objects, clock and input used here.
export function preloadMusic(scene) {

  // Object.entries turns own fields into [key, value] pairs so we can visit or transform
  // them.
  for (const [key, url] of Object.entries(MUSIC_TRACKS)) {
    if (!scene.cache.audio.exists(key)) scene.load.audio(key, { url, type: 'm4a' });
  }
}

export default class MusicService {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods.
  constructor(game) {
    this.game = game;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.background = globalThis.document?.hidden === true;
    this.track = null;

    // bind makes a function with a fixed this value, so a later callback still uses the
    // intended owner.
    this.update = this.update.bind(this);

    // on registers a callback for later events; it does not call that callback now.
    // Long-lived emitters need matching listener cleanup.
    game.events.on('poststep', this.update);

    // once registers a callback that removes itself after the first matching event.
    game.events.once('destroy', () => {
      game.events.off('poststep', this.update);
      this.stop();
    });
  }

  // Match audio playback to host visibility and catch-up state.
  setBackground(background) {
    this.background = background;
    this.update();
  }

  // Apply the saved music preference and refresh playback for the current context.
  setEnabled(enabled) {
    GameState.development.musicEnabled = enabled === true;
    this.update();
  }

  // Choose the assigned track for the current active scene and wave.
  desiredTrack() {

    // find returns the first matching entry, or undefined when none matches. Check for
    // that missing result before using its fields.
    const scene = this.game.scene.getScenes(true).find(active =>
      ['TitleScene', 'BattleScene'].includes(active.scene.key));
    if (!scene) return null;

    if (scene.scene.key === 'TitleScene') return 'music-pineshire';
    if (scene.battleOver) return null;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (scene.waves?.[scene.currentWaveIndex]?.boss) return 'music-boss';

    // The condition before ? chooses the first value when true and the value after : when
    // false. ?? uses the fallback only for null or undefined. A real zero or false stays
    // intact.
    return (GameState.currentDelve?.encounterId ?? GameState.currentDelve?.id) === 'slime-cave'
      ? 'music-slime-cave' : null;
  }

  // Select only the current visible state, without playing historical idle wave
  // transitions.
  update() {
    if (GameState.development.musicEnabled !== true) {
      this.stop();
      return;
    }

    if (this.background) {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      if (this.track?.isPlaying) this.track.pause();
      return;
    }
    const key = this.desiredTrack();

    if (this.track?.key !== key) this.stop();
    const sound = this.game.sound;
    if (!key || !sound || sound.locked || !this.game.cache.audio.exists(key)) return;

    // ??= fills a missing value once. It leaves an existing value, including zero or
    // false, alone.
    this.track ??= sound.add(key, { loop: true, volume: 0.4 });
    if (this.track.isPaused) this.track.resume();
    else if (!this.track.isPlaying) this.track.play();
  }

  // Release the current music instance so a later context can start the appropriate track.
  stop() {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.track?.destroy();
    this.track = null;
  }
}
