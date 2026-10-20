import GameState from '../game/GameState.js';
import HapticsService from '../services/HapticsService.js';
import { PARTY_LEADER_TAP as tuning } from '../config/partyLeaderTap.js';

export default class PartyLeaderTapFeedback {
  constructor(scene) {
    this.scene = scene;
    this.impacts = [];
    this.voices = new Set();
    this.update = () => {
      if (scene.game.backgroundProgress?.isReplaying || scene.game.backgroundProgress?.hidden) return this.clear();
      for (const impact of [...this.impacts]) {
        const progress = Math.min(1, (scene.time.now - impact.at) / tuning.impactDurationMs);
        impact.art.setAlpha(1 - progress).setScale(0.7 + progress * 0.5);
        if (progress >= 1) { impact.art.destroy(); this.impacts.splice(this.impacts.indexOf(impact), 1); }
      }
      if (scene.combatPaused || scene.time.paused) this.stopAudio();
    };
    scene.events.on('update', this.update);
    scene.events.once('shutdown', () => { scene.events.off('update', this.update); this.clear(); });
  }

  play(enemy) {
    const scene = this.scene;
    const art = scene.add.graphics().setPosition(enemy.x, enemy.y - 65).setDepth(4190);

    // Four short golden rays form a local impact, without covering the enemy's body.
    art.lineStyle(4, 0xfbbf24, 1);
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + i * Math.PI / 2;
      art.lineBetween(Math.cos(angle) * 7, Math.sin(angle) * 7, Math.cos(angle) * 22, Math.sin(angle) * 22);
    }
    this.impacts.push({ art, at: scene.time.now });
    void HapticsService.tap();
    this.sound();
  }

  sound() {
    const scene = this.scene, sound = scene.sound, preferences = GameState.preferences;
    const context = sound?.context;
    if (!context || sound.locked || sound.mute || context.state !== 'running'
      || preferences.sfxMuted || preferences.sfxVolume <= 0) return;
    try {

      // Filtered air and a soft low body give the hit a wet squash without a sharp
      // pitched chirp. Reuse the noise buffer; never consume the gameplay random stream.
      if (!this.squishBuffer || this.squishBuffer.sampleRate !== context.sampleRate) {
        this.squishBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.13), context.sampleRate);
        const samples = this.squishBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      const noise = context.createBufferSource(), filter = context.createBiquadFilter();
      const gain = context.createGain(), body = context.createOscillator(), bodyGain = context.createGain();
      const now = context.currentTime;
      const volume = preferences.sfxVolume ?? 1;
      noise.buffer = this.squishBuffer;
      filter.type = 'bandpass';
      filter.Q.value = 0.8;
      filter.frequency.setValueAtTime(1100, now);
      filter.frequency.exponentialRampToValueAtTime(280, now + 0.09);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.28 * volume, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(sound.destination);

      body.type = 'sine';
      body.frequency.setValueAtTime(160, now);
      body.frequency.exponentialRampToValueAtTime(85, now + 0.065);
      bodyGain.gain.setValueAtTime(0.0001, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.07 * volume, now + 0.009);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
      body.connect(bodyGain);
      bodyGain.connect(sound.destination);

      this.voices.add(noise);
      this.voices.add(body);
      noise.onended = () => { this.voices.delete(noise); noise.disconnect(); filter.disconnect(); gain.disconnect(); };
      body.onended = () => { this.voices.delete(body); body.disconnect(); bodyGain.disconnect(); };
      noise.start(now);
      noise.stop(now + 0.13);
      body.start(now);
      body.stop(now + 0.1);
    } catch {

      // Audio device loss must never interrupt damage or haptic feedback.
    }
  }

  stopAudio() {
    for (const voice of this.voices) { try { voice.stop(); } catch {} }
    this.voices.clear();
  }

  clear() {
    this.impacts.forEach(({ art }) => art.destroy());
    this.impacts.length = 0;
    this.stopAudio();
  }
}
