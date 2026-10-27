import { MUSIC_TRACKS } from '../services/MusicService.js';
import { UI_SOUNDS } from '../data/uiSounds.js';
import imports from '../data/tutorialAudioImports.json' with { type: 'json' };
import { observeGameplay } from './GameplayEvents.js';
import { AUDIO_EVENTS, clonePresentation } from './TutorialPresentation.js';
import GameState from './GameState.js';

const importedUrls = import.meta.glob('../sounds/tutorial-studio/*', { query: '?url', import: 'default', eager: true });
export function tutorialAudioCatalog() {
  return [...Object.entries(MUSIC_TRACKS).map(([id, url]) => ({ id, url, kind: 'music', available: true })),
    ...Object.entries(UI_SOUNDS).map(([id, a]) => ({ id: 'ui-' + id, url: a.url, kind: 'sfx', available: !!a.url && a.license?.verified === true })),
    ...imports.map(a => ({ ...a, url: importedUrls['../sounds/tutorial-studio/' + a.filename], available: !!importedUrls['../sounds/tutorial-studio/' + a.filename] }))];
}

// This owner never changes the game's music manager or global mute state. Every
// timer, listener and voice is leased to a beat and is disposed on background/leave.
export class TutorialCuePlayer {
  constructor(scene, report = () => {}) {
    this.scene = scene; this.report = report; this.timers = new Set(); this.voices = new Set(); this.fired = new Set();
    this.tailTimers = new Set(); this.tailVoices = new Set();
    this.stop = this.stop.bind(this);
    for (const event of ['blur', 'hidden']) scene.game.events.on(event, this.stop);
    scene.events.once('shutdown', () => this.destroy());
  }
  enter(step, context = {}) {
    // A new speaker retires speech tails while same-scene music and ambience may continue.
    const speakerChanged = !!this.step && (step.portraitId !== this.step.portraitId || step.speaker !== this.step.speaker);
    this.trigger('onLeave');
    this.stop({ preserveTails: context.sceneSessionId === this.context?.sceneSessionId && context.attemptId === this.context?.attemptId,
      retireSpeech: speakerChanged });
    this.step = step; this.context = context;
    this.key = context.key ?? step.id;
    this.unsubscribe = observeGameplay(event => {
      if (event.sceneSessionId !== context.sceneSessionId || context.attemptId && event.tutorial?.attemptId !== context.attemptId
        || context.valid && !context.valid()) return;
      for (const [index, cue] of step.audio.entries()) if (cue.trigger === 'event' && AUDIO_EVENTS.includes(cue.event) && cue.event === event.type) this.schedule(cue, index);
    });
    this.trigger('onEnter'); this.trigger('afterMs');
  }
  trigger(trigger) {
    for (const [index, cue] of this.step?.audio?.entries() ?? []) if (cue.trigger === trigger) this.schedule(cue, index, ['onAdvance', 'onLeave'].includes(trigger));
  }
  schedule(cue, index, tail = false) {
    const key = `${this.key}:${index}`;
    if (this.fired.has(key)) return;
    this.fired.add(key);
    const context = this.context;
    const timer = this.scene.time.delayedCall(cue.delayMs, () => {
      this.timers.delete(timer); this.tailTimers.delete(timer);
      if (context?.valid && !context.valid()) return;
      this.play(cue, tail);
    });
    timer.tutorialSpeech = cue.kind === 'voice'
      || tutorialAudioCatalog().some(asset => asset.id === cue.assetId && asset.kind === 'voice');
    this.timers.add(timer);
    if (tail) this.tailTimers.add(timer);
  }
  async unlock() {
    try { if (this.scene.sound.context) await this.scene.sound.context.resume(); }
    catch { this.report('Audio is blocked. Click Play audio again after allowing sound in this browser.'); }
  }
  play(cue, tail = false) {
    const asset = tutorialAudioCatalog().find(a => a.id === cue.assetId && a.available);
    const preferences = GameState.preferences;
    if (!asset) return this.report(`Audio unavailable: ${cue.assetId}`);
    if (this.scene.sound.context ? this.scene.sound.context.state !== 'running' : this.scene.sound.locked) return this.report('Audio blocked by autoplay. Use Play audio after a real click.');
    const music = cue.kind === 'music' || asset.kind === 'music';
    if (this.scene.game.sound.mute || music && GameState.development.musicEnabled !== true
      || !music && (preferences.sfxMuted || preferences.sfxVolume <= 0)) return this.report('Cue muted by current game audio preferences.');
    if (!this.scene.cache.audio.exists(asset.id)) return this.report('Audio is still loading. Try Play audio again.');
    try {
      const volume = cue.volume * (music ? .4 : preferences.sfxVolume);
      const sound = this.scene.sound.add(asset.id, { volume: cue.fadeMs ? 0 : volume, loop: cue.kind === 'ambience' });
      sound.tutorialSpeech = cue.kind === 'voice' || asset.kind === 'voice';
      this.voices.add(sound);
      if (tail) this.tailVoices.add(sound);
      let timer;
      const finish = () => {
        if (timer) { timer.remove(false); this.timers.delete(timer); this.tailTimers.delete(timer); }
        this.scene.tweens.killTweensOf(sound); this.voices.delete(sound); this.tailVoices.delete(sound); sound.destroy();
      };
      sound.once('complete', finish);
      if (!sound.play()) { finish(); return this.report('The audio device refused playback.'); }
      if (cue.fadeMs) this.scene.tweens.add({ targets: sound, volume, duration: cue.fadeMs });
      timer = this.scene.time.delayedCall(cue.durationMs, finish);
      timer.tutorialSpeech = sound.tutorialSpeech;
      this.timers.add(timer); this.report(`Playing ${cue.assetId}`);
      if (tail) this.tailTimers.add(timer);
    } catch (error) { this.report('Audio could not play: ' + error.message); }
  }
  stop(options = {}) {
    this.unsubscribe?.(); this.unsubscribe = null;
    for (const timer of this.timers) {
      if (options?.preserveTails === true && this.tailTimers.has(timer)
        && !(options.retireSpeech && timer.tutorialSpeech)) continue;
      timer.remove(false); this.timers.delete(timer); this.tailTimers.delete(timer);
    }
    for (const voice of this.voices) {
      if (options?.preserveTails === true && this.tailVoices.has(voice)
        && !(options.retireSpeech && voice.tutorialSpeech)) continue;
      this.scene.tweens.killTweensOf(voice); voice.destroy(); this.voices.delete(voice); this.tailVoices.delete(voice);
    }
    this.step = null; this.context = null;
  }
  destroy() {
    this.stop();
    for (const event of ['blur', 'hidden']) this.scene.game.events.off(event, this.stop);
  }
}

export function preloadTutorialAudio(scene, publishedOnly = false) {
  const references = new Set(clonePresentation().steps.flatMap(s => Array.isArray(s.audio) ? s.audio.map(cue => cue.assetId) : []));
  for (const a of tutorialAudioCatalog()) if (a.available && (!publishedOnly || references.has(a.id)) && !scene.cache.audio.exists(a.id)) scene.load.audio(a.id, a.url);
}
