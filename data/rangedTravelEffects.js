// Delivery describes how a spell or object reaches its target, not how far it can
// be cast. Curses, sky strikes, ground eruptions and buffs stay at their recipients.
const profiles = {};
function family(names, type, color, extra = {}) {
  for (const name of names) profiles[name] = { type, color, ...extra };
}

family(['Piercing Shot', 'Pinning Arrow', 'Crippling Shot', 'Aimed Shot', 'Covering Shot',
  'Pinning Shot', 'Covering Fire', 'Dagger Throw'], 'arrow', 0xe5dcc2);
family(['Volley', 'Arrow Rain', 'Rain of Arrows'], 'arrow', 0xe5dcc2, { arc: true, ground: true, volley: true });
family(['Throw Net', 'Tray Toss'], 'flask', 0xcda469, { arc: true });
family(['Magic Missile'], 'bolt', 0xcda8ff, { curve: true });
family(['Radiant Bolt', 'Judgement Spark'], 'bolt', 0xffe6a0);
family(['Purifying Flame'], 'bolt', 0xffe6a0);
family(['Wrath'], 'bolt', 0x8bc66a);
family(['Radiant Spear', 'Lumenspear'], 'lance', 0xffe6a0);
family(['Briar Bolt', 'Root Lance', 'Crystal Lance', 'Void Lance', 'Void Bolt', 'Dark Bolt', 'Thornlance'], 'bolt', 0x96d69c);
family(['Void Lance', 'Void Bolt', 'Dark Bolt'], 'bolt', 0xbb82ee);
family(['Crystal Lance'], 'lance', 0x79e3e5);
family(['Void Needle', 'Crimson Lance', 'Arcflare'], 'bolt', 0xb887dd);
family(['Stone Spit', 'Rock Throw', 'Boulder Throw'], 'rock', 0xb9aa91, { arc: true });
family(['Toxic Glob', 'Venom Spit', 'Poison Spit', 'Acid Spit'], 'glob', 0x93bd47, { arc: true });
family(['Seaspray Orb'], 'bolt', 0x87d8e5, { arc: true });
family(['Refraction Beam', 'Judgement Ray', 'Stasis Beam', 'Ray of Benediction', 'Hemoflow Beam'], 'beam', 0xc9ecff);
family(['Blood Lance', 'Crimson Lance'], 'lance', 0xdf7081);
family(['Siphon', 'Siphon Life', 'Essence Drain'], 'tether', 0xcb78b6);
family(['Whip Lash', 'Vine Lash'], 'whip', 0xb2c875);

// These named Thornbriar skills use their own art while retaining their delivery paths.
profiles['Whip Lash'].sheet = 'thorn-whip';
profiles['Briar Bolt'].sheet = 'briar';

export const RANGED_TRAVEL_PROFILES = profiles;

// Existing Nightbolt and Exploding Arrow sheets already have their own cast flights.
// Keep those authored clips; all other delivery choices live in this small table.
export function rangedTravelProfile(caster, ability = {}) {

  // Shadow Bolt flies straight. Draining spells extend a textured connection;
  // fields, echoes, healing and summoned images form locally at their recipients.
  if (ability.id?.startsWith('ability_v2_umbramancer_')) {
    const sheets = { shadow_bolt: 'umbral-bolt', siphon: 'umbral-siphon', essence_drain: 'umbral-drain' };
    const suffix = ability.id.slice('ability_v2_umbramancer_'.length);
    return sheets[suffix] ? { type: suffix === 'shadow_bolt' ? 'bolt' : 'tether',
      color: 0xb18ed9, sheet: sheets[suffix] } : null;
  }

  // The bolt flies straight; the ray grows outward from the caster. Healing,
  // blessings and locally summoned holy fire keep their recipient delivery.
  if (ability.id === 'ability_v2_dawnpriest_radiant_bolt') {
    return { type: 'bolt', color: 0xffe6a0, sheet: 'everbright-bolt' };
  }
  if (ability.id === 'ability_v2_dawnpriest_judgement_ray') {
    return { type: 'beam', color: 0xffe6a0, sheet: 'everbright-ray' };
  }

  // Current Ranger arrows use their own art. Volley fans three arrows through
  // rising and falling arcs; direct shots keep a straight line to the recipient.
  if (ability.id?.startsWith('ability_v2_ranger_')) {
    const sheets = { 'Piercing Shot': 'piercing', 'Pinning Arrow': 'pinning',
      'Crippling Shot': 'crippling', 'Exploding Arrow': 'exploding', Volley: 'piercing' };
    if (sheets[ability.name]) return { type: 'arrow', color: 0xe5dcc2,
      sheet: 'ranger-' + sheets[ability.name],
      ...(ability.name === 'Volley' ? { arc: true, ground: true, volley: true } : {}) };
  }
  if (['Nightbolt', 'Shadow Bolt', 'Exploding Arrow'].includes(ability.name)) return null;
  if (ability.name === 'Attack') {
    if (!(caster.attackRange > 180) && ability.attackType !== 'ranged' && ability.attackType !== 'spell') return null;
    if (caster.className === 'Ranger') return { type: 'arrow', color: 0xe5dcc2 };
    if (/Lasher/.test(caster.name ?? '')) return { type: 'whip', color: 0xabc477, sheet: 'thorn-whip' };
    if (/Tongue/.test(caster.name ?? '')) return { type: 'whip', color: 0xabc477 };
    if (/Depths Sovereign/.test(caster.name ?? '')) return { type: 'rock', color: 0xb9aa91, arc: true };
    return { type: 'bolt', color: caster.isEnemy ? 0xb693dc : 0x9bc9ff };
  }
  if (caster === ability.recipient || ability.anchor === 'Caster' || ability.target === 'self') return null;

  // Lacerate uses weapon reach. A bow sends an arrow, while a melee weapon applies
  // its existing cuts on contact. The ability keeps both class presentations.
  if (ability.name === 'Lacerate') return caster.attackRange > 180
    ? { type: 'arrow', color: 0xe5dcc2 } : null;

  if (ability.projectile === 'beam') return { type: 'beam', color: 0xb693dc };
  return profiles[ability.name] ?? null;
}
