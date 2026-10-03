import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
import { CLASS_DEFINITIONS } from '../data/classes.js';

const outputDir = 'outputs/01a0fe4a-0897-7b00-92a4-6cce33fae9b6';
const A = (category, name, target, effect, value, unit, duration, cooldown) => ({ category, name, target, effect, value, unit, duration, cooldown });

// Six new class abilities per class. Potency is a rank 1 value.
const additions = {
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

const starters = {
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

const categoryOverrides = {
  stealth:'Prepare', enrage:'Prepare', veilstep:'Prepare', stabilization:'Prepare', ascendance:'Prepare',
  aegis:'Prepare', refuge:'Protect', armor:'Protect', vow:'Protect', parry:'Protect', sacrifice:'Restore',
  mark:'Prepare', trap:'Prepare', challenge:'Protect', defiant:'Protect', defense:'Protect', roar:'Protect'
};
const specificCategory = {
  'Mage of the Luminous Archive': { refuge:'Protect', touch:'Assault', spear:'Assault', libram:'Assault' },
  'Cleric of the Everbright': { aegis:'Prepare', judgement:'Assault' },
  'Cleric of the Verdant Covenant': { refuge:'Protect', thorn:'Assault' },
  'Cleric of the Sanguine Song': { rend:'Assault', ascendance:'Prepare' }
};
const formatEffect = (a) => {
  const fields = [];
  if (a.targets === Infinity) fields.push('all targets');
  else if (a.targets > 1) fields.push(`${a.targets} targets`);
  if (a.zone) fields.push(`${a.zone[0]} by ${a.zone[1]} cell zone`);
  if (a.radius) fields.push(`${a.radius} cell radius`);
  if (a.stun) fields.push(`${Math.min(2, a.stun / 1000)} s stun`);
  if (a.root) fields.push(`${Math.min(3, a.root / 1000)} s root`);
  if (a.blind) fields.push(`${Math.min(3, a.blind / 1000)} s blind`);
  if (a.poison) fields.push(`${a.poison.power} poison per tick`);
  if (a.damageTakenBoost) fields.push(`${Math.round(a.damageTakenBoost * 100)}% damage vulnerability`);
  if (a.reduction) fields.push('damage reduction');
  if (a.healRatio) fields.push(`${a.healRatio}x damage-linked healing`);
  if (a.healingBoost) fields.push('healing bonus');
  if (a.damageBoost) fields.push('damage bonus');
  if (a.damageMultiplier) fields.push('outgoing damage rises, then recovery fatigue');
  if (a.incomingMultiplier) fields.push('incoming damage also rises');
  if (a.armorMultiplier) fields.push('armor increases');
  if (a.temporaryHp) fields.push('grants temporary HP');
  if (a.lowHealthPower) fields.push('stronger on low-health allies');
  if (a.retaliation) fields.push('retaliates against attackers');
  if (a.attackSlow) fields.push('slows attack speed');
  if (a.charge) fields.push('rushes to a free adjacent cell');
  if (a.judgement) fields.push('stronger against its favored target');
  if (a.missingHealthBonus) fields.push('scales with missing HP');
  if (a.immunityDuration) fields.push('brief damage immunity');
  if (a.beam) fields.push('line');
  if (a.requiresStealth) fields.push('requires stealth');
  if (a.friendlyFire) fields.push('can hit allies');
  if (a.selfDamage) fields.push(`${a.selfDamage} self damage`);
  if (a.effect === 'sacrifice') return 'Final boss, exactly one other survivor: sacrifice self, fully restore fallen allies; cannot revive this encounter. Buff surviving DPS and healers.';
  return `${a.effect.charAt(0).toUpperCase()}${a.effect.slice(1)}${fields.length ? '; ' + fields.join('; ') : ''}.`;
};
const oldPotency = (a) => {
  if (Number.isFinite(a.power) && a.power > 0) return [Math.max(4, Math.round(a.power * (a.effect === 'heal' ? 0.7 : 0.65))), a.effect === 'heal' ? 'healing' : 'damage'];
  if (a.poison) return [Math.max(3, Math.round(a.poison.power * 0.7)), 'poison per tick'];
  if (Number.isFinite(a.reduction)) return [Math.round(a.reduction * 100), '% reduction'];
  if (Number.isFinite(a.chance)) return [Math.round(a.chance * 100), '% chance'];
  if (Number.isFinite(a.damageTakenBoost)) return [Math.round(a.damageTakenBoost * 100), '% vulnerability'];
  if (Number.isFinite(a.spellBoost)) return [Math.round(a.spellBoost * 100), '% spell bonus'];
  if (Number.isFinite(a.healingBoost)) return [Math.round(a.healingBoost * 100), '% healing bonus'];
  if (Number.isFinite(a.damageBoost)) return [Math.round(a.damageBoost * 100), '% damage bonus'];
  if (a.effect === 'stealth') return [8, 'seconds stealth'];
  if (a.effect === 'teleport') return [4, 'cells teleport'];
  if (a.effect === 'aegis') return [25, '% next-heal bonus'];
  if (a.effect === 'armor') return [18, '% reduction'];
  if (a.effect === 'refuge') return [11, 'healing per tick'];
  if (a.effect === 'sacrifice') return [30, '% survivor bonus'];
  if (a.effect === 'enrage') return [30, '% outgoing bonus'];
  if (a.effect === 'ascendance') return [18, '% healing bonus'];
  if (a.effect === 'vow') return [35, '% redirected reduction'];
  if (a.effect === 'trap') return [24, 'damage'];
  if (a.effect === 'taunt') return [20, '% extra threat'];
  return [6, 'seconds effect'];
};

const classes = Object.entries(CLASS_DEFINITIONS);
const abilities = [];
for (const [className, def] of classes) {
  for (const [key, a] of Object.entries(def.abilities)) {
    const [raw, unit] = oldPotency(a);
    const value = unit.includes('%') ? raw : Math.min(raw, 32);
    let category = specificCategory[className]?.[key] ?? categoryOverrides[key] ?? (a.effect === 'heal' ? 'Restore' : 'Assault');
    const target = ['stealth','enrage','stabilize','teleport','armor','ascendance','refuge','parry','sacrifice','aegis'].includes(a.effect) ? 'Self only' : a.zone || a.radius || a.targets === Infinity ? 'Area' : a.effect === 'heal' || a.effect === 'vow' ? 'Single ally or self' : 'Single enemy';
    abilities.push({ className, role:def.role, id:`${className.toLowerCase().replace(/[^a-z0-9]+/g,'_')}_${key}`, source:'Existing, retuned', category, name:a.name, target, effect:formatEffect(a), value, unit, duration:a.duration ? Math.min(10,a.duration/1000) : a.stun ? Math.min(2,a.stun/1000) : a.root ? Math.min(3,a.root/1000) : 0, cooldown:Math.max(4,a.cooldown/1000 || 30), starter:starters[className].includes(key), originalKey:key });
  }
  for (const a of additions[className]) abilities.push({ ...a, target:a.target==='Single ally' ? 'Single ally or self' : a.target, className, role:def.role, id:`${className.toLowerCase().replace(/[^a-z0-9]+/g,'_')}_${a.name.toLowerCase().replace(/[^a-z0-9]+/g,'_')}`, source:'New', starter:starters[className].includes(a.name), originalKey:'' });
}

const wb = Workbook.create();
const sheets = Object.fromEntries(['Guide','Starter kits','Abilities','Rank schedule','Learning cost'].map(n => [n, wb.worksheets.add(n)]));
for (const s of Object.values(sheets)) s.showGridLines = false;
const navy = '#223248', green = '#DDECE5', pale = '#F3F6F9';
const header = (s, range) => { s.getRange(range).format = { fill:navy, font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'}, rowHeight:27, verticalAlignment:'center' }; };
const base = (s, range) => { s.getRange(range).format.font = {name:'Arial',size:10,color:'#202A35'}; s.getRange(range).format.rowHeight=23; };

const guide = sheets['Guide'];
guide.getRange('A1').values=[['Ability progression']];
guide.getRange('A1').format.font={name:'Arial',size:16,bold:true,color:navy};
guide.getRange('A3:B15').values=[
  ['Scope','13 classes, 55 existing abilities retuned, 78 new abilities; 10 ranks each. Design proposal; game code is unchanged.'],
  ['Tactics categories','Assault, Protect, Restore, Prepare.'],
  ['Starting kit','Three recommended rank 1 abilities per class are granted free at level 1. All other rank 1 abilities may be learned from level 1.'],
  ['Skill points','One point earned at level 1 and one at each later level. A learned rank costs points equal to its rank. Starter grants waive the rank 1 cost.'],
  ['Rank levels','Rank 1: level 1. Ranks 2–10: levels 5, 10, 15, 20, 25, 30, 35, 40, 45. Level gates are minimums, not guaranteed affordability.'],
  ['Gold formula','Round up to 5: (20 + 5 × character level) × rank × (1 + (100 − happiness) / 100). Starter grants cost no gold.'],
  ['Happiness','Input is 0–100. Less happy characters charge more gold, up to 2× at 0 happiness.'],
  ['Rank growth','Potency grows 12% of rank 1 per added rank. Duration grows 5% of rank 1; crowd control caps at 4 seconds. Cooldown stays fixed.'],
  ['Single target rule','Single-target healing and defensive abilities may target the caster. Harmful abilities target enemies and cannot target their caster.'],
  ['Loadout','The current game equips at most four abilities per adventurer. Starter kits leave one slot free.'],
  ['Implementation note','Current source has three ranks and gold-only purchases. This workbook specifies a proposed system and does not modify gameplay or saves.'],
  ['Economy constraint','A rank 10 path costs 55 points, or 54 for a granted starter. With one point per level, earliest funding is level 55 or 54 if no other points are spent.'],
  ['Source','data/classes.js; game/AdventurerAbilities.js; game/AdventurerProgression.js; docs/CLASS_ABILITIES.md (repository, 2026-10-02).']
];
base(guide,'A3:B15'); guide.getRange('A3:A15').format.font={name:'Arial',size:10,bold:true,color:navy};
guide.getRange('A:A').format.columnWidth=23; guide.getRange('B:B').format.columnWidth=110; guide.getRange('B3:B15').format.wrapText=true;
guide.getRange('A3:B15').format.rowHeight=40;

const starterRows = [['Class','Role','Starter 1','Starter 2','Starter 3','Why this set works']];
for (const [className, def] of classes) {
  const picks=starters[className].map(id => abilities.find(a => a.className===className && (a.originalKey===id || a.name===id))?.name);
  const why = def.role==='Tank' ? 'Opens with threat control, a reliable action, and survival or ally cover.' : def.role==='Healer' ? 'Covers direct healing, group recovery, and protection.' : 'Covers a core attack, a tactical setup or second attack, and self sustain.';
  starterRows.push([className,def.role,...picks,why]);
}
const st=sheets['Starter kits']; st.getRangeByIndexes(0,0,starterRows.length,6).values=starterRows; base(st,`A2:F${starterRows.length}`);header(st,'A1:F1');
['A:A','B:B','C:E','F:F'].forEach((r,i)=>st.getRange(r).format.columnWidth=[35,15,25,67][i]);st.freezePanes.freezeRows(1);

const abRows=[['Class','Role','Ability ID','Ability','Origin','Category','Target','Rank 1 effect','Potency','Unit','Duration (s)','Cooldown (s)','Starter grant']];
for(const a of abilities) abRows.push([a.className,a.role,a.id,a.name,a.source,a.category,a.target,a.effect,a.value,a.unit,a.duration,a.cooldown,a.starter?'Yes':'No']);
const ab=sheets['Abilities'];ab.getRangeByIndexes(0,0,abRows.length,13).values=abRows;base(ab,`A2:M${abRows.length}`);header(ab,'A1:M1');ab.freezePanes.freezeRows(1);
const abWidths=[34,15,47,25,18,13,26,92,11,24,15,16,15];abWidths.forEach((w,i)=>ab.getRangeByIndexes(0,i,1,1).format.columnWidth=w);
ab.getRange(`H2:H${abRows.length}`).format.wrapText=true;ab.getRange(`A2:M${abRows.length}`).format.rowHeight=34;
ab.getRange(`I2:L${abRows.length}`).setNumberFormat('0');

const rankRows=[['Class','Ability ID','Ability','Category','Rank','Required level','Skill point cost','Cumulative points','Potency','Unit','Duration (s)','Cooldown (s)','Starter grant']];
for(const a of abilities) for(let rank=1;rank<=10;rank++) {
  let strength=Math.round(a.value*(1+(rank-1)*0.12));
  if(a.unit.includes('%') && (a.unit.includes('reduction')||a.unit.includes('dodge')||a.unit.includes('chance'))) strength=Math.min(strength,75);
  const duration=a.duration ? Math.round(Math.min(a.effect.includes('stun')||a.effect.includes('root')||a.effect.includes('blind') ? 4 : 20,a.duration*(1+(rank-1)*0.05))*10)/10 : 0;
  rankRows.push([a.className,a.id,a.name,a.category,rank,rank===1?1:rank*5-5,rank,rank*(rank+1)/2-(a.starter?1:0),strength,a.unit,duration,a.cooldown,a.starter?'Yes':'No']);
}
const rs=sheets['Rank schedule'];rs.getRangeByIndexes(0,0,rankRows.length,13).values=rankRows;base(rs,`A2:M${rankRows.length}`);header(rs,'A1:M1');rs.freezePanes.freezeRows(1);
[34,47,26,13,9,18,18,21,12,24,15,15,15].forEach((w,i)=>rs.getRangeByIndexes(0,i,1,1).format.columnWidth=w);
rs.getRange(`E2:I${rankRows.length}`).setNumberFormat('0');rs.getRange(`K2:K${rankRows.length}`).setNumberFormat('0.0');

const cost=sheets['Learning cost'];
cost.getRange('A1:B1').values=[['Learning cost calculator','Value']];header(cost,'A1:B1');
cost.getRange('A2:B8').values=[['Character level',5],['Happiness (0–100)',70],['Target rank',2],['Skill points available',5],['Rank level required',null],['Skill points needed',null],['Gold needed',null]];
cost.getRange('B6').formulas=[['=IF(B4=1,1,(B4-1)*5)']];
cost.getRange('B7').formulas=[['=B4']];
cost.getRange('B8').formulas=[['=CEILING((20+5*B2)*B4*(1+(100-B3)/100),5)']];
cost.getRange('A10:B12').values=[['Eligible by level',null],['Enough skill points',null],['Gold for starter grant',0]];
cost.getRange('B10').formulas=[['=IF(B2>=B6,"Yes","No")']];
cost.getRange('B11').formulas=[['=IF(B5>=B7,"Yes","No")']];
cost.getRange('A14:B14').values=[['Example','At level 5, happiness 70, rank 2 costs 2 points and 120 gold.']];
base(cost,'A2:B14'); cost.getRange('A:A').format.columnWidth=29;cost.getRange('B:B').format.columnWidth=77;
cost.getRange('B2:B5').format.fill='#FFF2C6';cost.getRange('A2:A14').format.font={name:'Arial',size:10,bold:true,color:navy};
cost.getRange('B3').dataValidation={rule:{type:'whole',operator:'between',formula1:0,formula2:100}};
cost.getRange('B4').dataValidation={rule:{type:'whole',operator:'between',formula1:1,formula2:10}};
cost.getRange('B2').dataValidation={rule:{type:'whole',operator:'between',formula1:1,formula2:99}};
cost.getRange('B8').setNumberFormat('"g"#,##0');

if (abilities.length!==133 || rankRows.length!==1331 || starterRows.length!==14) throw new Error(`Unexpected counts: ${abilities.length}, ${rankRows.length}, ${starterRows.length}`);
await fs.mkdir(outputDir,{recursive:true});
for(const [name,range] of [['Guide','A1:B15'],['Starter kits','A1:F14'],['Abilities','A1:M12'],['Rank schedule','A1:M12'],['Learning cost','A1:B14']]) {
  const preview=await wb.render({sheetName:name,range,scale:1,format:'png'});
  await fs.writeFile(`${outputDir}/${name.toLowerCase().replaceAll(' ','-')}.png`,new Uint8Array(await preview.arrayBuffer()));
}
const check=await wb.inspect({kind:'table',range:'Learning cost!A1:B14',include:'values,formulas',tableMaxRows:14,tableMaxCols:2});
console.log(check.ndjson);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:30}});
console.log(errors.ndjson);
const blob=await SpreadsheetFile.exportXlsx(wb);
await blob.save(`${outputDir}/delve-deep-ability-progression.xlsx`);
console.log(JSON.stringify({abilities:abilities.length,new:78,ranks:rankRows.length-1,starters:starterRows.length-1,output:`${outputDir}/delve-deep-ability-progression.xlsx`}));
