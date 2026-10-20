// Decoys leave targeting immediately when gameplay retires them. Only their
// existing drawing remains for a 400 ms fade, which never enters a battle save.

export function retireUmbralDecoy(scene, decoy) {
  const umbral = ['Umbramancer', 'Umbramancer'].includes(decoy.className);
  if (!umbral || scene.idleSimulating || scene.game?.backgroundProgress?.isReplaying) {
    decoy.container?.destroy();
    return;
  }
  const fades = scene.umbralDecoyFades ??= [];
  if (fades.some(effect => effect.decoy === decoy)) return;
  decoy.umbralVisualRetired = true;
  decoy.hitZone?.disableInteractive();
  fades.push({ decoy, elapsed: 0, alpha: decoy.container?.alpha ?? 0.6 });
}

// Combat delta is measured in milliseconds. Freeze both frame and opacity on
// Pause, and keep active images translucent so their decoy identity reads clearly.
export function updateUmbralDecoyEffects(scene, delta) {
  if (scene.battleOver) {
    scene.abilityDecoys = (scene.abilityDecoys ?? []).filter(decoy => {
      if (!['Umbramancer', 'Umbramancer'].includes(decoy.className)) return true;
      retireUmbralDecoy(scene, decoy);
      return false;
    });
  }
  for (const decoy of scene.abilityDecoys ?? []) {
    if (['Umbramancer', 'Umbramancer'].includes(decoy.className)) {
      decoy.container?.setAlpha(0.6);
      decoy.spriteVisual?.image?.setTint(0xb18ed9);
    }
  }
  const step = scene.combatPaused ? 0 : Math.max(0, delta);
  scene.umbralDecoyFades = (scene.umbralDecoyFades ?? []).filter(effect => {
    effect.elapsed += step;
    if (effect.elapsed >= 400) {
      effect.decoy.container?.destroy();
      return false;
    }
    effect.decoy.container?.setAlpha(effect.alpha * (1 - effect.elapsed / 400));
    return true;
  });
}

// Historical replay and scene shutdown can release cosmetic remnants immediately.
export function clearUmbralDecoyEffects(scene) {
  for (const effect of scene.umbralDecoyFades ?? []) effect.decoy.container?.destroy();
  scene.umbralDecoyFades = [];
}
