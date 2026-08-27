export type WeaponId = 'sword' | 'hammer' | 'daggers' | 'spear' | 'chainWhip' | 'bow' | 'blaster' | 'energyStaff';
export type WeaponKind = 'melee' | 'ranged';
export type CharacterId = 'ace' | 'blitz' | 'knox' | 'rex' | 'skye' | 'maverick' | 'axel' | 'kairo' | 'dash' | 'cyberRunner' | 'coreBreaker' | 'surge' | 'rogueReaper' | 'scarlet' | 'toxicDrift' | 'icePhantom';
export type StyleId = 'rusher' | 'zoner' | 'adaptiveAnalyzer' | 'hyperAggro' | 'balanced' | 'kiter' | 'anchor' | 'flanker' | 'chaseHunter' | 'wildcard' | 'mirror' | 'metaSlave' | 'antiMeta';
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Pro' | 'Master';
export type ModeId = 'quickplay' | 'accountRanked' | 'seasonalRanked' | 'tournament' | 'league';
export type ArenaTier = 'Practice' | 'Easy' | 'Medium' | 'Hard' | 'Pro' | 'Extreme';
export type HazardType = 'barrier' | 'spikes' | 'lava' | 'glue' | 'poison' | 'healing' | 'lightning' | 'solar' | 'void' | 'movingWall' | 'explosion' | 'ice';

export interface WeaponConfig {
  id: WeaponId;
  name: string;
  kind: WeaponKind;
  basicDamage: number;
  specialDamage: number;
  critChance: number;
  critMultiplier: number;
  range: number;
  specialRange: number;
  attacksPerSecond: number;
  specialCooldown: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  role: string;
  metaRole: string;
  strength: string;
  weakness: string;
  projectileSpeed?: number;
  magSize?: number;
  reloadTime?: number;
  staminaRating?: number;
  staminaCost?: number;
  staminaFullRegen?: number;
  color: string;
}

export interface CharacterConfig {
  id: CharacterId;
  name: string;
  color: string;
  accent: string;
  abilityName: string;
  abilitySummary: string;
}

export interface RankConfig {
  name: string;
  rp: number;
}

export interface ArenaConfig {
  id: string;
  name: string;
  tier: ArenaTier;
  unlockRank: string;
  tagline: string;
  theme: string;
  baseColor: string;
  accentColor: string;
  widthTiles: number;
  heightTiles: number;
  hazards: { type: HazardType; count: number }[];
  pressure: number;
  mechanic: string;
  speedMultiplier?: number;
  roundSeconds?: number;
  closingGas?: boolean;
  iceFloor?: boolean;
}

export interface StyleConfig {
  id: StyleId;
  name: string;
  color: string;
  summary: string;
  aggression: number;
  preferredRange: number;
  dodgeBias: number;
  hazardAwareness: number;
}

export const TILE = 32;

export const WEAPONS: Record<WeaponId, WeaponConfig> = {
  sword: {
    id: 'sword', name: 'Sword', kind: 'melee', basicDamage: 26, specialDamage: 46, critChance: 0.10, critMultiplier: 1.55,
    range: 2.2, specialRange: 3.2, attacksPerSecond: 1.42, specialCooldown: 6.2, difficulty: 'Easy', role: 'Balanced melee', metaRole: 'Duelist', strength: 'Flexible pressure', weakness: 'No extreme range',
    staminaRating: 75, staminaCost: 9, staminaFullRegen: 1.5, color: '#56e8ff'
  },
  hammer: {
    id: 'hammer', name: 'Hammer', kind: 'melee', basicDamage: 32, specialDamage: 60.8, critChance: 0.08, critMultiplier: 1.75,
    range: 1.8, specialRange: 3.8, attacksPerSecond: 1.16, specialCooldown: 7.4, difficulty: 'Medium', role: 'Heavy burst', metaRole: 'Punish specialist', strength: 'High burst damage', weakness: 'Slow recovery',
    staminaRating: 35, staminaCost: 15, staminaFullRegen: 2.4, color: '#ffb02e'
  },
  daggers: {
    id: 'daggers', name: 'Daggers', kind: 'melee', basicDamage: 15, specialDamage: 34, critChance: 0.16, critMultiplier: 1.45,
    range: 1.45, specialRange: 2.5, attacksPerSecond: 2.6, specialCooldown: 5.5, difficulty: 'Hard', role: 'Rapid pressure', metaRole: 'Rushdown', strength: 'Fast sustained pressure', weakness: 'Short reach',
    staminaRating: 90, staminaCost: 4, staminaFullRegen: 0.9, color: '#ff4d84'
  },
  spear: {
    id: 'spear', name: 'Spear', kind: 'melee', basicDamage: 24, specialDamage: 45, critChance: 0.11, critMultiplier: 1.6,
    range: 3.15, specialRange: 4.5, attacksPerSecond: 1.28, specialCooldown: 6.8, difficulty: 'Medium', role: 'Reach control', metaRole: 'Spacing specialist', strength: 'Excellent melee range', weakness: 'Narrow attack lane',
    staminaRating: 65, staminaCost: 10, staminaFullRegen: 1.9, color: '#58ffbc'
  },
  chainWhip: {
    id: 'chainWhip', name: 'Chain Whip', kind: 'melee', basicDamage: 21, specialDamage: 42, critChance: 0.09, critMultiplier: 1.55,
    range: 3.5, specialRange: 5.0, attacksPerSecond: 1.35, specialCooldown: 7.0, difficulty: 'Hard', role: 'Control melee', metaRole: 'Disruptor', strength: 'Wide control arcs', weakness: 'Telegraphed swings',
    staminaRating: 55, staminaCost: 7, staminaFullRegen: 2.1, color: '#c27bff'
  },
  bow: {
    id: 'bow', name: 'Bow', kind: 'ranged', basicDamage: 24, specialDamage: 54, critChance: 0.14, critMultiplier: 1.7,
    range: 16, specialRange: 19, attacksPerSecond: 1.15, specialCooldown: 7.2, difficulty: 'Hard', role: 'Precision ranged', metaRole: 'Pick specialist', strength: 'Long range precision', weakness: 'Punished at close range',
    projectileSpeed: 17, magSize: 20, reloadTime: 1.8, color: '#ffe164'
  },
  blaster: {
    id: 'blaster', name: 'Blaster', kind: 'ranged', basicDamage: 13, specialDamage: 38, critChance: 0.08, critMultiplier: 1.45,
    range: 12.5, specialRange: 15, attacksPerSecond: 3.25, specialCooldown: 6.5, difficulty: 'Easy', role: 'Rapid ranged', metaRole: 'Pressure gun', strength: 'Reliable projectile pressure', weakness: 'Lower burst per shot',
    projectileSpeed: 20, magSize: 36, reloadTime: 2.2, color: '#32e2ff'
  },
  energyStaff: {
    id: 'energyStaff', name: 'Energy Staff', kind: 'ranged', basicDamage: 20, specialDamage: 49, critChance: 0.10, critMultiplier: 1.55,
    range: 13.5, specialRange: 16, attacksPerSecond: 1.65, specialCooldown: 7.6, difficulty: 'Medium', role: 'Energy control', metaRole: 'Zoner', strength: 'Strong area pressure', weakness: 'Small magazine',
    projectileSpeed: 14, magSize: 14, reloadTime: 1.5, color: '#81ff65'
  }
};

export const CHARACTERS: Record<CharacterId, CharacterConfig> = {
  ace: { id: 'ace', name: 'Ace', color: '#e7f5ff', accent: '#44e8ff', abilityName: 'Tactical Shift', abilitySummary: '+12% move, +15% attack speed, +10% damage resistance for 4s.' },
  blitz: { id: 'blitz', name: 'Blitz', color: '#ffe866', accent: '#fff21f', abilityName: 'Overdrive', abilitySummary: '+35% movement for 3.5s; phase through fighters; cannot attack for 0.5s after activation.' },
  knox: { id: 'knox', name: 'Knox', color: '#273b58', accent: '#55aaff', abilityName: 'Fortify', abilitySummary: 'Gain a 90 HP shield for 6s or until broken; no damage carry-over; -10% movement while active.' },
  rex: { id: 'rex', name: 'Rex', color: '#ba3027', accent: '#ff8538', abilityName: 'Predator Rush', abilitySummary: 'Dash 4 tiles; first attack within 2s deals +35% damage and knocks back 1.5 tiles.' },
  skye: { id: 'skye', name: 'Skye', color: '#dff6ff', accent: '#78ddff', abilityName: 'Air Step', abilitySummary: 'Untargetable for 0.8s, then reposition 5–10 tiles to a valid random location.' },
  maverick: { id: 'maverick', name: 'Maverick', color: '#ff9f45', accent: '#38dcff', abilityName: 'Wild Card', abilitySummary: 'Randomly gain +25% movement, +25% damage, or -25% dodge cooldown for 3 dodges. Each outcome can occur once per match.' },
  axel: { id: 'axel', name: 'Axel', color: '#7e98a9', accent: '#38ffd2', abilityName: 'Power Drive', abilitySummary: 'Next successful attack deals +50% damage.' },
  kairo: { id: 'kairo', name: 'Kairo', color: '#21b9a8', accent: '#ffd66b', abilityName: 'Rift Pulse', abilitySummary: 'Circular magical pulse: enemies hit are slowed 35% and deal 15% less damage for 3s.' },
  dash: { id: 'dash', name: 'Dash', color: '#1ce4ff', accent: '#80fffa', abilityName: 'Phase Dash', abilitySummary: 'Dash 5 tiles; invulnerable during dash and 0.8s after; 1.5s hazard escape grace after invulnerability.' },
  cyberRunner: { id: 'cyberRunner', name: 'Cyber Runner', color: '#0f5a78', accent: '#6cff53', abilityName: 'Neural Hijack', abilitySummary: '0.7s telegraphed lock; for 2s enemy attacks redirect at themselves. Counter by not attacking or breaking line-of-sight.' },
  coreBreaker: { id: 'coreBreaker', name: 'Core Breaker', color: '#c96922', accent: '#ffd33d', abilityName: 'Seismic Slam', abilitySummary: 'Shockwave deals 35 damage, slows 40%, and disables dodge for 1s.' },
  surge: { id: 'surge', name: 'Surge', color: '#2459ff', accent: '#65ffba', abilityName: 'Storm Call', abilitySummary: 'Call 3 lightning strikes 0.5 tiles around the enemy; 38 damage each; one cast can never hit with all 3.' },
  rogueReaper: { id: 'rogueReaper', name: 'Rogue Reaper', color: '#1b1625', accent: '#f33148', abilityName: 'Shadow Fade', abilitySummary: 'Invisible for 1.8s; first hit out of stealth deals +25% damage.' },
  scarlet: { id: 'scarlet', name: 'Scarlet', color: '#a80f31', accent: '#ff556b', abilityName: 'Hex Protocol', abilitySummary: 'For 2s enemy movement is confused and 15% slower while aim remains player-controlled.' },
  toxicDrift: { id: 'toxicDrift', name: 'Toxic Drift', color: '#1c7a37', accent: '#5dff5e', abilityName: 'Corrosion Field', abilitySummary: 'Create a 3-tile radius toxic field for 4s dealing 25 damage per second.' },
  icePhantom: { id: 'icePhantom', name: 'Ice Phantom', color: '#dff7ff', accent: '#80dfff', abilityName: 'Frost Mark', abilitySummary: 'Next 3 successful attacks slow movement and attack speed by 50% for 2s each.' }
};

export const RANKS: RankConfig[] = [
  { name: 'Rookie I', rp: 0 }, { name: 'Rookie II', rp: 100 }, { name: 'Rookie III', rp: 500 },
  { name: 'Novice I', rp: 1000 }, { name: 'Novice II', rp: 1500 }, { name: 'Novice III', rp: 2000 },
  { name: 'Fighter I', rp: 2750 }, { name: 'Fighter II', rp: 3500 }, { name: 'Fighter III', rp: 4500 },
  { name: 'Specialist I', rp: 5500 }, { name: 'Specialist II', rp: 6500 }, { name: 'Specialist III', rp: 7500 },
  { name: 'Elite I', rp: 9000 }, { name: 'Elite II', rp: 10500 }, { name: 'Elite III', rp: 12000 },
  { name: 'Master I', rp: 13500 }, { name: 'Master II', rp: 15000 }, { name: 'Master III', rp: 17500 },
  { name: 'Grandmaster I', rp: 20000 }, { name: 'Grandmaster II', rp: 22500 }, { name: 'Ascendant I', rp: 25000 },
  { name: 'Ascendant II', rp: 30000 }, { name: 'Champion I', rp: 35000 }, { name: 'Champion II', rp: 40000 },
  { name: 'Legend I', rp: 45000 }, { name: 'Legend II', rp: 50000 }, { name: 'Emperor', rp: 59000 },
  { name: 'Paragon', rp: 71000 }, { name: 'Immortal', rp: 84000 }, { name: 'Zenith', rp: 100000 }
];

export const STYLE_CONFIGS: Record<StyleId, StyleConfig> = {
  rusher: { id: 'rusher', name: 'Rusher', color: '#ff6633', summary: 'Constant forward pressure.', aggression: 0.9, preferredRange: 2.5, dodgeBias: 0.45, hazardAwareness: 0.55 },
  zoner: { id: 'zoner', name: 'Zoner', color: '#43d6c6', summary: 'Controls spacing and lanes.', aggression: 0.48, preferredRange: 10, dodgeBias: 0.62, hazardAwareness: 0.72 },
  adaptiveAnalyzer: { id: 'adaptiveAnalyzer', name: 'Adaptive Analyzer', color: '#4ab9ff', summary: 'Learns repeated behavior.', aggression: 0.62, preferredRange: 6, dodgeBias: 0.7, hazardAwareness: 0.82 },
  hyperAggro: { id: 'hyperAggro', name: 'Hyper Aggro', color: '#ff2f46', summary: 'Nonstop engagement and risky trades.', aggression: 1, preferredRange: 2, dodgeBias: 0.35, hazardAwareness: 0.45 },
  balanced: { id: 'balanced', name: 'Balanced', color: '#67efff', summary: 'Strong fundamentals with no extreme tendencies.', aggression: 0.62, preferredRange: 5, dodgeBias: 0.58, hazardAwareness: 0.68 },
  kiter: { id: 'kiter', name: 'Kiter', color: '#5ae8af', summary: 'Attacks while maintaining escape distance.', aggression: 0.44, preferredRange: 9, dodgeBias: 0.78, hazardAwareness: 0.7 },
  anchor: { id: 'anchor', name: 'Anchor', color: '#7a8fb0', summary: 'Controls center territory and holds ground.', aggression: 0.5, preferredRange: 4, dodgeBias: 0.42, hazardAwareness: 0.78 },
  flanker: { id: 'flanker', name: 'Flanker', color: '#ce7dff', summary: 'Attacks from side lanes and unusual angles.', aggression: 0.7, preferredRange: 5, dodgeBias: 0.74, hazardAwareness: 0.74 },
  chaseHunter: { id: 'chaseHunter', name: 'Chase Hunter', color: '#ff8b49', summary: 'Punishes retreat and weakened targets.', aggression: 0.86, preferredRange: 3, dodgeBias: 0.5, hazardAwareness: 0.62 },
  wildcard: { id: 'wildcard', name: 'Wildcard', color: '#e75cff', summary: 'Changes tempo unpredictably.', aggression: 0.68, preferredRange: 5, dodgeBias: 0.67, hazardAwareness: 0.6 },
  mirror: { id: 'mirror', name: 'Mirror', color: '#d5f5ff', summary: 'Reflects the opponent’s pacing.', aggression: 0.62, preferredRange: 5, dodgeBias: 0.62, hazardAwareness: 0.68 },
  metaSlave: { id: 'metaSlave', name: 'Meta Slave', color: '#ffd252', summary: 'Uses the strongest current statistical options.', aggression: 0.72, preferredRange: 6, dodgeBias: 0.65, hazardAwareness: 0.8 },
  antiMeta: { id: 'antiMeta', name: 'Anti-Meta', color: '#ff5d72', summary: 'Counters popular weapons and habits.', aggression: 0.66, preferredRange: 6, dodgeBias: 0.7, hazardAwareness: 0.84 }
};

export const DIFFICULTY_HP: Record<Difficulty, number> = { Easy: 125, Medium: 175, Hard: 225, Pro: 275, Master: 325 };
export const DIFFICULTY_REACTION: Record<Difficulty, number> = { Easy: 0.52, Medium: 0.38, Hard: 0.28, Pro: 0.2, Master: 0.14 };
export const DIFFICULTY_SKILL: Record<Difficulty, number> = { Easy: 0.62, Medium: 0.76, Hard: 0.86, Pro: 0.94, Master: 1 };

const hz = (type: HazardType, count: number) => ({ type, count });
export const ARENAS: ArenaConfig[] = [
  { id: 'training-grid', name: 'Training Grid', tier: 'Practice', unlockRank: 'Rookie I', tagline: 'Built for fundamentals.', theme: 'Clean training field', baseColor: '#0a2237', accentColor: '#39d7ff', widthTiles: 28, heightTiles: 18, hazards: [hz('barrier', 2), hz('healing', 1)], pressure: 1, mechanic: 'Open lanes and minimal pressure.' },
  { id: 'junk-yard', name: 'Junk Yard', tier: 'Practice', unlockRank: 'Rookie I', tagline: 'Messy, simple, and readable.', theme: 'Scrap-metal routing', baseColor: '#26251d', accentColor: '#e1ad55', widthTiles: 28, heightTiles: 18, hazards: [hz('barrier', 3), hz('spikes', 1), hz('glue', 1)], pressure: 2, mechanic: 'Simple obstacle routing.' },
  { id: 'lifeline-grid', name: 'Lifeline Grid', tier: 'Easy', unlockRank: 'Rookie II', tagline: 'Control the heal, or punish it.', theme: 'Healing-zone control', baseColor: '#0c2c23', accentColor: '#45ff9a', widthTiles: 28, heightTiles: 18, hazards: [hz('healing', 2), hz('barrier', 2), hz('glue', 1)], pressure: 3, mechanic: 'Healing zones restore HP but healed targets take 1.4x incoming damage.' },
  { id: 'static-arena', name: 'Static Arena', tier: 'Easy', unlockRank: 'Rookie III', tagline: 'Learn the rhythm of electric pressure.', theme: 'Predictable electricity', baseColor: '#102238', accentColor: '#7dd9ff', widthTiles: 28, heightTiles: 18, hazards: [hz('lightning', 2), hz('barrier', 2), hz('movingWall', 1)], pressure: 4, mechanic: 'Predictable warning pulses before lightning.' },
  { id: 'inferno-hazard', name: 'Inferno Hazard', tier: 'Medium', unlockRank: 'Novice I', tagline: 'Heat punishes bad rotations.', theme: 'Lava pressure', baseColor: '#32170d', accentColor: '#ff7135', widthTiles: 28, heightTiles: 18, hazards: [hz('lava', 3), hz('spikes', 2), hz('barrier', 2)], pressure: 5, mechanic: 'Lava lanes punish greedy rotations.' },
  { id: 'toxic-lockdown', name: 'Toxic Lockdown', tier: 'Medium', unlockRank: 'Novice II', tagline: 'The air runs out before your options do.', theme: 'Closing toxic gas', baseColor: '#102918', accentColor: '#64ff54', widthTiles: 28, heightTiles: 18, hazards: [hz('poison', 1), hz('barrier', 2)], pressure: 6, mechanic: 'Toxic gas closes inward over a 60-second round.', roundSeconds: 60, closingGas: true },
  { id: 'helio', name: 'Helio', tier: 'Hard', unlockRank: 'Novice III', tagline: 'Move before the light cuts through.', theme: 'Solar sweep lanes', baseColor: '#2c2610', accentColor: '#ffe35a', widthTiles: 30, heightTiles: 18, hazards: [hz('solar', 2), hz('movingWall', 2), hz('barrier', 2)], pressure: 7, mechanic: 'Telegraphed solar beams sweep lanes.' },
  { id: 'high-voltage', name: 'High Voltage', tier: 'Hard', unlockRank: 'Fighter I', tagline: 'One mistimed step can swing the round.', theme: 'Electrical reaction arena', baseColor: '#11263d', accentColor: '#53c8ff', widthTiles: 28, heightTiles: 18, hazards: [hz('lightning', 3), hz('movingWall', 2), hz('spikes', 2)], pressure: 7, mechanic: 'Repeated lightning patterns reward timing.' },
  { id: 'speed-circuit', name: 'Speed Circuit', tier: 'Hard', unlockRank: 'Fighter I', tagline: 'Everyone is faster. Mistakes happen sooner.', theme: 'Accelerated movement', baseColor: '#08283c', accentColor: '#3ff5ff', widthTiles: 30, heightTiles: 18, hazards: [hz('lightning', 1), hz('barrier', 2), hz('glue', 2)], pressure: 7, mechanic: 'Global movement speed +15%.', speedMultiplier: 1.15 },
  { id: 'gravity-pit', name: 'Gravity Pit', tier: 'Hard', unlockRank: 'Fighter II', tagline: 'Every step costs more.', theme: 'Heavy movement control', baseColor: '#25183d', accentColor: '#a66cff', widthTiles: 25, heightTiles: 16, hazards: [hz('void', 2), hz('glue', 2), hz('barrier', 3)], pressure: 7, mechanic: 'Global movement speed -15%.', speedMultiplier: 0.85 },
  { id: 'blast-factory', name: 'Blast Factory', tier: 'Pro', unlockRank: 'Specialist I', tagline: 'If it flashes, move.', theme: 'Industrial explosions', baseColor: '#2f2012', accentColor: '#ff9c36', widthTiles: 31, heightTiles: 19, hazards: [hz('explosion', 4), hz('movingWall', 2), hz('barrier', 3)], pressure: 8, mechanic: 'Warning circles detonate after a short delay.' },
  { id: 'frostline', name: 'Frostline', tier: 'Pro', unlockRank: 'Specialist II', tagline: 'Stopping is harder than starting.', theme: 'Icy inertia', baseColor: '#14293c', accentColor: '#bcecff', widthTiles: 28, heightTiles: 18, hazards: [hz('ice', 1), hz('spikes', 2), hz('barrier', 3)], pressure: 8, mechanic: 'Reduced friction creates controlled sliding.', iceFloor: true },
  { id: 'crimson-castle', name: 'Crimson Castle', tier: 'Pro', unlockRank: 'Specialist III', tagline: 'A fortress built to punish hesitation.', theme: 'Fortress choke points', baseColor: '#35131a', accentColor: '#ff5060', widthTiles: 26, heightTiles: 17, hazards: [hz('lava', 4), hz('spikes', 2), hz('movingWall', 2), hz('barrier', 4), hz('void', 1)], pressure: 8, mechanic: 'Tight fortress lanes and layered pressure.' },
  { id: 'eclipse', name: 'Eclipse', tier: 'Pro', unlockRank: 'Elite I', tagline: 'Light and void collapse the safe zones.', theme: 'Solar + void hybrid', baseColor: '#1e1632', accentColor: '#da71ff', widthTiles: 29, heightTiles: 18, hazards: [hz('void', 2), hz('solar', 2), hz('lightning', 1), hz('glue', 2), hz('barrier', 2)], pressure: 8, mechanic: 'Alternating solar and void pressure.' },
  { id: 'crystal-cavern', name: 'Crystal Cavern', tier: 'Extreme', unlockRank: 'Elite II', tagline: 'Sharp angles. No lazy paths.', theme: 'Crystal precision', baseColor: '#142e38', accentColor: '#6cf1ff', widthTiles: 27, heightTiles: 18, hazards: [hz('spikes', 6), hz('lightning', 2), hz('movingWall', 2), hz('solar', 1), hz('barrier', 4)], pressure: 9, mechanic: 'Spike-heavy routing and narrow pressure lanes.' },
  { id: 'oblivion', name: 'Oblivion', tier: 'Extreme', unlockRank: 'Master I', tagline: 'There is no safe position.', theme: 'Final hazard overload', baseColor: '#2c0c12', accentColor: '#ff3149', widthTiles: 30, heightTiles: 20, hazards: [hz('lava', 4), hz('spikes', 3), hz('glue', 2), hz('movingWall', 3), hz('barrier', 3), hz('void', 2), hz('lightning', 2), hz('healing', 1), hz('poison', 1), hz('solar', 1)], pressure: 10, mechanic: 'Endgame trap web with 22 hazards and barriers.' }
];

export const CREDIT_REWARDS: Record<ModeId, { win: number; loss: number }> = {
  seasonalRanked: { win: 60, loss: 15 },
  accountRanked: { win: 45, loss: 12 },
  tournament: { win: 32, loss: 8 },
  quickplay: { win: 20, loss: 5 },
  league: { win: 0, loss: 0 }
};

export function rankForRp(rp: number): RankConfig {
  let rank = RANKS[0];
  for (const candidate of RANKS) if (rp >= candidate.rp) rank = candidate;
  return rank;
}

export function nextRankForRp(rp: number): RankConfig | null {
  return RANKS.find(r => r.rp > rp) ?? null;
}

export function arenaUnlocked(arena: ArenaConfig, accountRp: number): boolean {
  const required = RANKS.find(r => r.name === arena.unlockRank)?.rp ?? 0;
  return accountRp >= required;
}
