const A = (category, name, target, effect, value, unit, duration, cooldown) => ({ category, name, target, effect, value, unit, duration, cooldown });

// Six new class abilities per class. Potency is a rank 1 value.
export const NEW_CLASS_ABILITIES = {
  Gladiator: [
    A('Protect','Arena Guard','Single ally','Intercept the next hit on an ally; reduce redirected damage.',25,'% reduction',6,18),
    A('Protect','Champion’s Shelter','All allies within 2 cells','Grant a damage absorbing shield to nearby allies.',18,'shield HP',6,22),
    A('Assault','Gore Rush','Single enemy','Rush through a target and deal physical damage; generates extra threat.',24,'damage',0,12),
    A('Assault','Pitfall Sweep','Enemies within 2 cells','Sweep nearby enemies for physical damage and slow them for 3 seconds.',16,'damage',3,16),
    A('Restore','Second Wind','Self only','Restore own HP after surviving a hit.',24,'healing',0,24),
    A('Prepare','Crowd Favorite','Self only','Gain armor before engaging; first hit also generates extra threat.',15,'% damage reduction',8,25)
  ],
  Oathwarden: [
    A('Protect','Shield of Honor','Single ally','Redirect the next hit from an ally and reduce it.',30,'% reduction',6,18),
    A('Protect','Oathbound Circle','All allies within 2 cells','Reduce incoming damage for allies standing near the caster.',14,'% reduction',6,22),
    A('Assault','Judicator’s Blow','Single enemy','Deal physical damage and increase threat against the target.',22,'damage',0,9),
    A('Assault','Reckoning Arc','Enemies within 2 cells','Strike nearby enemies and gain threat for each hit.',16,'damage',0,14),
    A('Restore','Steadfast Heart','Self only','Restore own HP when below half health.',22,'healing',0,25),
    A('Prepare','Vigil Before Battle','Self only','Gain armor and empower the next protection ability.',12,'% damage reduction',8,24)
  ],
  Dawnwarden: [
    A('Protect','Sunlit Ward','Single ally','Place a shield on one ally; the caster may target self.',22,'shield HP',7,16),
    A('Protect','Dawnwall','All allies within 2 cells','Reduce incoming damage for nearby allies.',14,'% reduction',6,21),
    A('Assault','Dawn Hammer','Single enemy','Strike with holy damage and increased threat.',22,'damage',0,9),
    A('Assault','Corona Sweep','Enemies within 2 cells','Pulse holy damage around the caster.',15,'damage',0,15),
    A('Restore','Renewed Resolve','Self only','Restore own HP with a brief flash of dawn light.',23,'healing',0,24),
    A('Prepare','Consecrated Stance','Self only','Gain armor and empower the next holy strike.',12,'% damage reduction',8,23)
  ],
  Barmaid: [
    A('Assault','Tray Toss','Single enemy within 5 cells','Throw a serving tray for physical damage.',19,'damage',0,8),
    A('Assault','Barroom Scramble','Enemies within 2 cells','Hit nearby foes with improvised weapons.',15,'damage',0,14),
    A('Protect','Cover the Regulars','Single ally','Intercept one hit and reduce damage to the chosen ally.',18,'% reduction',5,20),
    A('Restore','Quick Sip','Self only','Restore own HP from a hidden restorative drink.',21,'healing',0,26),
    A('Prepare','Set the Table','Self only','Improve the next damaging ability and gain brief armor.',12,'% next-hit bonus',8,18),
    A('Prepare','Find an Opening','Self only','Gain movement speed and critical chance before entering melee.',10,'% critical chance',7,21)
  ],
  Scoundrel: [
    A('Assault','Back Alley Cut','Single enemy','Deal physical damage; stronger when attacking from behind.',23,'damage',0,7),
    A('Assault','Smoke Bomb','Enemies within 2 cells','Deal light damage and blind enemies for 2 seconds.',13,'damage',2,17),
    A('Protect','Slip Aside','Self or single ally','Grant one dodge attempt to the chosen ally.',25,'% dodge chance',5,17),
    A('Restore','Patch Up','Self only','Restore own HP with a stolen bandage.',19,'healing',0,25),
    A('Prepare','Coated Blades','Self only','Add poison damage to the next attack.',12,'poison damage',8,19),
    A('Prepare','False Trail','Self only','Reduce threat and gain movement speed.',20,'% threat reduction',8,21)
  ],
  Barbarian: [
    A('Assault','Skullsplitter','Single enemy','Deal heavy physical damage to one target.',27,'damage',0,10),
    A('Assault','Earthshaker','Enemies within 2 cells','Slam the ground for physical damage and a brief slow.',17,'damage',2,16),
    A('Protect','Unbroken','Self or single ally','Grant short damage reduction through sheer resolve.',18,'% reduction',6,21),
    A('Restore','Battle Breath','Self only','Restore own HP, stronger below half health.',22,'healing',0,26),
    A('Prepare','Blood Rush','Self only','Gain movement speed and attack power for the next engagement.',15,'% attack bonus',7,22),
    A('Prepare','War Cry','Self only','Increase critical chance and threat before charging.',10,'% critical chance',7,23)
  ],
  Ranger: [
    A('Assault','Pinning Shot','Single enemy','Deal physical damage and slow the target for 3 seconds.',21,'damage',3,9),
    A('Assault','Volley','Enemies in 2 by 2 cells','Fire multiple arrows across a small zone.',15,'damage',0,15),
    A('Protect','Covering Fire','Self or single ally','Grant the chosen ally a chance to evade the next ranged hit.',22,'% dodge chance',7,20),
    A('Restore','Field Dressing','Self only','Restore own HP using carried supplies.',20,'healing',0,26),
    A('Prepare','Steady Aim','Self only','Increase critical chance for the next ranged attack.',14,'% critical chance',8,18),
    A('Prepare','Scout’s Route','Self only','Gain movement speed and extend the next shot’s range.',18,'% movement speed',8,22)
  ],
  'Mage of the Umbral Veil': [
    A('Assault','Void Needle','Single enemy','Deal necrotic damage and reduce target healing briefly.',22,'damage',4,8),
    A('Assault','Eclipse Field','Enemies in 2 by 2 cells','Deal necrotic damage in a shadowed zone.',15,'damage',0,16),
    A('Protect','Veil Mantle','Self or single ally','Shield one ally and reduce their threat.',19,'shield HP',7,19),
    A('Restore','Siphon Breath','Self only','Restore own HP by drawing ambient shadow.',18,'healing',0,26),
    A('Prepare','Night Focus','Self only','Increase the next necrotic spell’s damage.',16,'% spell bonus',8,20),
    A('Prepare','Shrouded Steps','Self only','Gain movement speed and lower threat.',18,'% movement speed',8,21)
  ],
  'Mage of the Crimson Spire': [
    A('Assault','Crimson Lance','Single enemy','Deal focused force damage.',23,'damage',0,8),
    A('Assault','Shatter Pattern','Enemies in 2 by 2 cells','Explode a force sigil for area damage.',15,'damage',0,16),
    A('Protect','Rune Shell','Self or single ally','Grant a force shield to one ally.',20,'shield HP',7,19),
    A('Restore','Arcane Reweave','Self only','Restore own HP by stabilizing a broken ward.',18,'healing',0,26),
    A('Prepare','Overcharge Sigil','Self only','Increase the next damaging spell’s power.',18,'% spell bonus',8,21),
    A('Prepare','Measured Casting','Self only','Reduce the next spell’s windup and mana cost.',20,'% windup reduction',8,20)
  ],
  'Mage of the Luminous Archive': [
    A('Assault','Index of Light','Single enemy','Deal radiant damage; mark the target for allied focus.',21,'damage',6,9),
    A('Assault','Prism Script','Enemies in 2 by 2 cells','Deal radiant damage across a scripted pattern.',15,'damage',0,16),
    A('Protect','Margin Ward','Self or single ally','Grant a radiant shield to one ally.',20,'shield HP',7,19),
    A('Restore','Self Annotation','Self only','Restore own HP from a prepared healing inscription.',19,'healing',0,26),
    A('Prepare','Illuminated Thesis','Self only','Increase the next radiant spell’s damage and linked healing.',14,'% spell bonus',8,21),
    A('Prepare','Quick Reference','Self only','Reduce the next spell’s windup.',20,'% windup reduction',8,19)
  ],
  'Cleric of the Everbright': [
    A('Restore','Dawn Benediction','Single ally or self','Restore HP to one ally.',30,'healing',0,7),
    A('Restore','Morning Chorus','All allies in 2 by 2 cells','Restore HP to allies in a small area.',15,'healing',0,16),
    A('Protect','Halo Ward','Single ally or self','Place a holy shield on one ally.',23,'shield HP',7,17),
    A('Protect','Sanctuary Light','All allies within 2 cells','Reduce incoming damage to nearby allies.',13,'% reduction',6,23),
    A('Prepare','Prayer of Clarity','Self only','Increase the next heal’s potency.',16,'% next-heal bonus',8,20),
    A('Prepare','Kindled Faith','Self only','Reduce the next protective spell’s windup.',20,'% windup reduction',8,21)
  ],
  'Cleric of the Verdant Covenant': [
    A('Restore','Seedling Mend','Single ally or self','Restore HP to one ally.',29,'healing',0,7),
    A('Restore','Spring Canopy','All allies in 2 by 2 cells','Restore HP to allies in a small area.',15,'healing',0,16),
    A('Protect','Barkskin Oath','Single ally or self','Grant one ally temporary armor.',16,'% reduction',7,18),
    A('Protect','Grove Shelter','All allies within 2 cells','Grant a small shield to nearby allies.',16,'shield HP',7,23),
    A('Prepare','Living Sap','Self only','Increase the next heal’s potency.',16,'% next-heal bonus',8,20),
    A('Prepare','Rooted Patience','Self only','Increase protection duration on the next cast.',20,'% duration bonus',8,21)
  ],
  'Cleric of the Sanguine Song': [
    A('Restore','Pulse Exchange','Single ally or self','Restore HP to one ally; self targeting has no self damage.',30,'healing',0,7),
    A('Restore','Red Refrain','All allies in 2 by 2 cells','Restore HP to allies in a small area.',15,'healing',0,17),
    A('Protect','Vein Ward','Single ally or self','Grant one ally a blood shield.',23,'shield HP',7,18),
    A('Protect','Chorus of Shelter','All allies within 2 cells','Reduce incoming damage to nearby allies.',13,'% reduction',6,23),
    A('Prepare','Measured Pulse','Self only','Increase the next heal’s potency.',17,'% next-heal bonus',8,20),
    A('Prepare','Quiet Cadence','Self only','Lower the next spell’s windup and threat.',20,'% windup reduction',8,21)
  ]
};

export const STARTER_ABILITIES = {
  Gladiator: ['roar','cleave','Second Wind'],
  Oathwarden: ['vow','parry','Judicator’s Blow'],
  Dawnwarden: ['challenge','strike','Sunlit Ward'],
  Barmaid: ['pan','swing','Quick Sip'],
  Scoundrel: ['stealth','surprise','Patch Up'],
  Barbarian: ['enrage','strike','Battle Breath'],
  Ranger: ['mark','arrow','Field Dressing'],
  'Mage of the Umbral Veil': ['nightbolt','veilstep','Siphon Breath'],
  'Mage of the Crimson Spire': ['stabilization','arcflare','Arcane Reweave'],
  'Mage of the Luminous Archive': ['refuge','spear','Self Annotation'],
  'Cleric of the Everbright': ['blessing','pulse','Halo Ward'],
  'Cleric of the Verdant Covenant': ['touch','bloom','Barkskin Oath'],
  'Cleric of the Sanguine Song': ['beam','chorus','Vein Ward']
};

export const CATEGORY_OVERRIDES = {
  stealth:'Prepare', enrage:'Prepare', veilstep:'Prepare', stabilization:'Prepare', ascendance:'Prepare',
  aegis:'Prepare', refuge:'Protect', armor:'Protect', vow:'Protect', parry:'Protect', sacrifice:'Restore',
  mark:'Prepare', trap:'Prepare', challenge:'Protect', defiant:'Protect', defense:'Protect', roar:'Protect'
};
export const CLASS_CATEGORY_OVERRIDES = {
  'Mage of the Luminous Archive': { refuge:'Protect', touch:'Assault', spear:'Assault', libram:'Assault' },
  'Cleric of the Everbright': { aegis:'Prepare', judgement:'Assault' },
  'Cleric of the Verdant Covenant': { refuge:'Protect', thorn:'Assault' },
  'Cleric of the Sanguine Song': { rend:'Assault', ascendance:'Prepare' }
};

const abilityKey = (name) => name.normalize('NFKD').replace(/[^a-zA-Z0-9 ]/g, '').trim()
  .replace(/\s+(.)/g, (_, letter) => letter.toUpperCase()).replace(/^(.)/, (_, letter) => letter.toLowerCase());

const targetKind = (target) => target.includes('Self only') ? 'self'
  : target.includes('All allies') ? 'allies'
    : target.includes('Enemies within') || target.includes('Enemies in') ? 'enemies'
      : target.includes('ally') || target.includes('ally or self') || target.includes('Self or') ? 'ally' : 'enemy';

const targetRange = (role, target, category) => {
  const explicit = target.match(/within (\d+) cells?/);
  if (explicit) return Number(explicit[1]);
  if (target.includes('Self only')) return 0;
  if (category === 'Restore' || category === 'Protect') return 6;
  return role === 'Ranged DPS' || role === 'Healer' ? 6 : 1;
};

const specialEffects = {
  'Gore Rush': { threatMultiplier: 1.5 },
  'Judicator’s Blow': { threatMultiplier: 1.5 },
  'Reckoning Arc': { threatMultiplier: 1.5 },
  'Dawn Hammer': { threatMultiplier: 1.5 },
  'Vigil Before Battle': { nextProtectionBonus: 0.15 },
  'Crowd Favorite': { nextThreatBonus: 1.5 },
  'Set the Table': { selfReduction: 0.1 },
  'Find an Opening': { extraMoveBonus: 0.1 },
  'Back Alley Cut': { rearBonus: 0.25 },
  'False Trail': { extraMoveBonus: 0.1 },
  'Battle Breath': { lowHealthBoost: 0.4 },
  'Blood Rush': { extraMoveBonus: 0.15 },
  'War Cry': { nextThreatBonus: 1.25 },
  'Scout’s Route': { nextRangeBonus: 1 },
  'Steady Aim': { nextCritOnly: true },
  'Covering Fire': { rangedOnlyDodge: true },
  'Void Needle': { healingReduction: 0.2 },
  'Veil Mantle': { targetThreatReduction: 0.2 },
  'Shrouded Steps': { targetThreatReduction: 0.2 },
  'Index of Light': { damageTakenBoost: 0.1 },
  'Illuminated Thesis': { nextLinkedHealRatio: 0.25 },
  'Rooted Patience': { nextProtectionDurationBonus: 0.2 },
  'Kindled Faith': { protectiveOnlyWindup: true },
  'Quiet Cadence': { targetThreatReduction: 0.2 }
};

export function addAbilityProgression(classDefinitions) {
  for (const [className, definition] of Object.entries(classDefinitions)) {
    const starters = STARTER_ABILITIES[className];
    for (const [key, ability] of Object.entries(definition.abilities)) {
      ability.category = CLASS_CATEGORY_OVERRIDES[className]?.[key] ?? CATEGORY_OVERRIDES[key]
        ?? (ability.effect === 'heal' ? 'Restore' : 'Assault');
      ability.starter = starters.includes(key);
      ability.origin = 'Existing';
      ability.description ??= ability.name;
      ability.targetLabel = ability.zone || ability.radius || ability.targets === Infinity ? 'Area'
        : ability.effect === 'heal' || ability.effect === 'vow' ? 'Single ally or self'
          : ['damage', 'mark', 'taunt', 'trap'].includes(ability.effect) ? 'Single enemy' : 'Self only';
      if (Number.isFinite(ability.power) && ability.power > 0) {
        ability.power = Math.min(32, Math.max(4, Math.round(ability.power * (ability.effect === 'heal' ? 0.7 : 0.65))));
      }
      if (Number.isFinite(ability.highPower)) ability.highPower = Math.min(32, Math.max(4, Math.round(ability.highPower * 0.65)));
      if (Number.isFinite(ability.lowHealthPower)) ability.lowHealthPower = Math.min(32, Math.max(4, Math.round(ability.lowHealthPower * 0.7)));
      if (Number.isFinite(ability.retaliation)) ability.retaliation = Math.max(4, Math.round(ability.retaliation * 0.65));
      if (ability.effect === 'enrage') {
        ability.damageMultiplier = 1.3;
        ability.incomingMultiplier = 1.3;
        ability.recoveryMultiplier = 0.8;
      }
      if (ability.effect === 'stealth') ability.duration = 8000;
      if (ability.effect === 'aegis') ability.healBonus = 0.25;
      if (ability.effect === 'vow') ability.reduction = 0.35;
      if (ability.effect === 'armor') ability.armorMultiplier = 2.25;
      if (ability.effect === 'taunt') ability.threatBonus = 0.2;
      if (ability.poison) ability.poison = { ...ability.poison, power: Math.max(3, Math.round(ability.poison.power * 0.7)) };
      if (ability.duration) ability.duration = Math.min(10000, ability.duration);
      if (ability.stun) ability.stun = Math.min(2000, ability.stun);
      if (ability.root) ability.root = Math.min(3000, ability.root);
      if (ability.blind) ability.blind = Math.min(3000, ability.blind);
    }
    for (const entry of NEW_CLASS_ABILITIES[className]) {
      const key = abilityKey(entry.name);
      const kind = targetKind(entry.target);
      const ability = {
        name: entry.name,
        category: entry.category,
        starter: starters.includes(entry.name),
        origin: 'New',
        description: entry.effect,
        target: kind,
        targetLabel: entry.target === 'Single ally' ? 'Single ally or self' : entry.target,
        effect: entry.category === 'Assault' ? 'damage' : entry.category === 'Restore' ? 'heal'
          : entry.category === 'Protect' ? 'protect' : 'prepare',
        power: entry.value,
        powerUnit: entry.unit,
        duration: entry.duration * 1000,
        cooldown: entry.cooldown * 1000,
        range: targetRange(definition.role, entry.target, entry.category),
        windup: 300,
        damageType: className.includes('Umbral') ? 'necrotic'
          : className.includes('Crimson') ? 'force'
            : className.includes('Luminous') || className === 'Dawnwarden' ? 'radiant' : 'physical'
      };
      Object.assign(ability, specialEffects[entry.name] ?? {});
      if (entry.target.includes('2 by 2')) ability.zone = [2, 2];
      if (entry.target.includes('within 2 cells')) ability.radius = 2;
      if (entry.effect.includes('slow')) ability.slow = 0.2;
      if (entry.effect.includes('blind')) ability.blind = 2000;
      if (entry.effect.includes('rush')) ability.charge = true;
      if (entry.effect.includes('threat') && entry.category === 'Assault') ability.threatMultiplier = 1.5;
      if (entry.effect.includes('Intercept') || entry.effect.includes('intercept')) ability.intercept = true;
      if (entry.effect.includes('poison')) ability.poison = { power: entry.value, interval: 2000, duration: 6000 };
      definition.abilities[key] = ability;
    }
  }
  return classDefinitions;
}
