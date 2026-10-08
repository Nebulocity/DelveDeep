import GameState from '../game/GameState.js';
import slimeCaveUrl from '../sounds/the_slime_cave/delve_bg1.m4a?url';
import pineshireUrl from '../sounds/pineshire_region/region_bg1.m4a?url';
import bossUrl from '../sounds/the_slime_cave/delve_boss_bg1.m4a?url';

const MUSIC_TRACKS = {
  'music-slime-cave': slimeCaveUrl,
  'music-pineshire': pineshireUrl,
  'music-boss': bossUrl
};

export function preloadMusic(scene) {
  for (const [key, url] of Object.entries(MUSIC_TRACKS)) {
    if (!scene.cache.audio.exists(key)) scene.load.audio(key, { url, type: 'm4a' });
  }
}

export default class MusicService {
  constructor(game) {
    this.game = game;
    this.background = globalThis.document?.hidden === true;
    this.track = null;
    this.update = this.update.bind(this);
    game.events.on('poststep', this.update);
    game.events.once('destroy', () => {
      game.events.off('poststep', this.update);
      this.stop();
    });
  }

  setBackground(background) {
    this.background = background;
    this.update();
  }

  setEnabled(enabled) {
    GameState.development.musicEnabled = enabled === true;
    this.update();
  }

  desiredTrack() {
    const scene = this.game.scene.getScenes(true).find(active =>
      ['TitleScene', 'BattleScene'].includes(active.scene.key));
    if (!scene) return null;
    if (scene.scene.key === 'TitleScene') return 'music-pineshire';
    if (scene.battleOver) return null;
    if (scene.waves?.[scene.currentWaveIndex]?.boss) return 'music-boss';
    return (GameState.currentDelve?.encounterId ?? GameState.currentDelve?.id) === 'slime-cave'
      ? 'music-slime-cave' : null;
  }

  // Select only the current visible state, without playing historical idle wave transitions.
  update() {
    if (GameState.development.musicEnabled !== true) {
      this.stop();
      return;
    }
    if (this.background) {
      if (this.track?.isPlaying) this.track.pause();
      return;
    }
    const key = this.desiredTrack();
    if (this.track?.key !== key) this.stop();
    const sound = this.game.sound;
    if (!key || !sound || sound.locked || !this.game.cache.audio.exists(key)) return;
    this.track ??= sound.add(key, { loop: true, volume: 0.4 });
    if (this.track.isPaused) this.track.resume();
    else if (!this.track.isPlaying) this.track.play();
  }

  stop() {
    this.track?.destroy();
    this.track = null;
  }
}
