import Phaser from 'phaser';
import { tutorialGuidance } from '../game/TutorialGuidance.js';
import { tutorialEvidenceContext } from '../game/TutorialProgress.js';

// Installed before scene create, so custom objects and raw scene input have the same
// permission boundary. Restart installs fresh dispatch wrappers after shutdown cleanup.
export default class TutorialScenePlugin extends Phaser.Plugins.ScenePlugin {
  boot() {
    const scene = this.scene, service = tutorialGuidance(scene.game);
    const start = () => {
      scene.gameplayObserverSessionId = crypto.randomUUID();
      service.gate.install(scene);
    };
    const create = () => {
      const origin = service.navigation;
      if (origin?.destination === scene.scene.key) service.navigation = null;
      service.sceneReady(scene, origin?.destination === scene.scene.key ? origin : null);
      if (service.opening.active() && !service.storyActive) scene.cameras.cameras.forEach(camera => camera.fadeIn(160));
    };
    const navigate = scene.scene.start;
    scene.scene.start = function(destination, ...args) {
      if (service.transitioning) return this;
      const origin = { destination, tutorial: tutorialEvidenceContext(service.controller.state),
        token: service.controller.capture() };
      const start = () => {
        service.transitioning = false;
        const progress = service.controller.progress;
        const expected = service.controller.definitions[progress.lessonId]?.checkpoints[progress.checkpointId]?.scene;
        // A committed Party Save may advance its checkpoint during the fade. Its
        // already-requested destination remains valid within this same active attempt.
        const committedHandoff = service.opening.active() && origin.tutorial?.attemptId === progress.attemptId
          && origin.token.profileEpoch === service.controller.state.gameplay?.epoch && (destination === expected
            || progress.checkpointId === 'ready-map' && origin.tutorial?.checkpointId === 'party-save' && destination === 'HeroesScene');
        // Exit preserves an already accepted gameplay navigation. Its obsolete tutorial
        // authority cannot advance a lesson, but must not strand the source's Back latch.
        const exitedHandoff = ['skipped', 'paused'].includes(progress.status)
          && origin.tutorial?.attemptId === progress.attemptId
          && origin.token.profileEpoch === service.controller.state.gameplay?.epoch;
        if (origin.tutorial && !service.controller.authorized(origin.token) && !committedHandoff && !exitedHandoff) {
          scene.cameras.cameras.forEach(camera => camera.fadeIn(140));
          service.refresh(); return;
        }
        service.navigation = origin;
        if (service.guiding()) service.releaseScope();
        return navigate.call(this, destination, ...args);
      };
      if (service.opening.active() && !service.storyActive && !['BattleScene', 'RewardScene', 'EncounterSummaryScene'].includes(scene.scene.key)) {
        service.transitioning = true;
        scene.cameras.cameras.forEach(camera => camera.fadeOut(160));
        scene.time.delayedCall(170, start);
        return this;
      }
      return start();
    };
    scene.events.on('start', start);
    scene.events.on('create', create);
    scene.events.once('destroy', () => {
      scene.events.off('start', start); scene.events.off('create', create);
      scene.scene.start = navigate;
    });
  }
}
