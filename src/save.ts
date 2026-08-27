import { ARENAS, CHARACTERS, CREDIT_REWARDS, ModeId, WeaponId, CharacterId, rankForRp, nextRankForRp } from './data';

export interface MatchHistoryItem {
  id: string;
  at: number;
  mode: ModeId;
  opponent: string;
  opponentStyle: string;
  weapon: WeaponId;
  character: CharacterId;
  arena: string;
  won: boolean;
  score: string;
  damage: number;
  hazardDamage: number;
  credits: number;
  rpDelta: number;
}

export interface UsageStats {
  matches: number;
  wins: number;
  losses: number;
  roundsWon: number;
  roundsLost: number;
  totalDamage: number;
  hazardDamageDealt: number;
  hazardDamageTaken: number;
  bestStreak: number;
  streak: number;
  creditsEarned: number;
}

export interface MasteryEntry { xp: number; level: number; matches: number; wins: number; }
export interface AiMemoryEntry {
  games: number;
  favoriteWeapon: WeaponId | null;
  dodgeRate: number;
  retreatRate: number;
  aggression: number;
  rangePreference: number;
  hazardTendency: number;
  specialRate: number;
}

export interface SeasonalState {
  seasonNumber: number;
  startedAt: number;
  endsAt: number;
  rp: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  peakRp: number;
}

export interface LeagueTeamRecord {
  name: string;
  wins: number;
  losses: number;
  damageFor: number;
  damageAgainst: number;
  color: string;
}

export interface LeagueState {
  season: number;
  week: number;
  teams: LeagueTeamRecord[];
  news: string[];
  champions: { season: number; team: string }[];
}

export interface ProfileSave {
  version: number;
  username: string;
  credits: number;
  accountRp: number;
  selectedWeapon: WeaponId;
  selectedCharacter: CharacterId;
  selectedArenaId: string;
  quickplayDifficulty: 'Easy' | 'Medium' | 'Hard' | 'Pro' | 'Master';
  stats: UsageStats;
  seasonal: SeasonalState;
  characterMastery: Record<CharacterId, MasteryEntry>;
  weaponMastery: Record<WeaponId, MasteryEntry>;
  aiMemory: Record<string, AiMemoryEntry>;
  matchHistory: MatchHistoryItem[];
  league: LeagueState;
  settings: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    uiVolume: number;
    ambienceVolume: number;
    mute: boolean;
    performanceMode: boolean;
  };
}

const KEY = 'adaptive-arena-profile-v1';
const SEASON_MS = 45 * 24 * 60 * 60 * 1000;

const characterMastery = (): Record<CharacterId, MasteryEntry> => Object.fromEntries(
  Object.keys(CHARACTERS).map(id => [id, { xp: 0, level: 1, matches: 0, wins: 0 }])
) as Record<CharacterId, MasteryEntry>;

const weaponMastery = (): Record<WeaponId, MasteryEntry> => Object.fromEntries(
  ['sword', 'hammer', 'daggers', 'spear', 'chainWhip', 'bow', 'blaster', 'energyStaff'].map(id => [id, { xp: 0, level: 1, matches: 0, wins: 0 }])
) as Record<WeaponId, MasteryEntry>;

const TEAM_NAMES = ['Haven Sentinels', 'Washington Wardens', 'Dallas Vipers', 'Miami Pulse', 'Cincinnati Crown', 'New York Phantoms', 'Phoenix Helix', 'Seattle Voltage', 'Chicago Forge', 'Atlanta Rift', 'Denver Frost', 'Las Vegas Eclipse'];
const TEAM_COLORS = ['#38e8ff', '#ff5e78', '#ffd04d', '#6cff8d', '#a878ff', '#ff8a42', '#64a9ff', '#e94dff', '#58d8c9', '#ff6654', '#b8e9ff', '#f2cf4c'];

function newLeague(): LeagueState {
  return {
    season: 1,
    week: 1,
    teams: TEAM_NAMES.map((name, i) => ({ name, wins: 0, losses: 0, damageFor: 0, damageAgainst: 0, color: TEAM_COLORS[i] })),
    news: ['League systems initialized. Opening week begins now.'],
    champions: []
  };
}

export function createDefaultProfile(username = 'Player'): ProfileSave {
  const now = Date.now();
  return {
    version: 1,
    username,
    credits: 0,
    accountRp: 0,
    selectedWeapon: 'sword',
    selectedCharacter: 'ace',
    selectedArenaId: ARENAS[0].id,
    quickplayDifficulty: 'Medium',
    stats: { matches: 0, wins: 0, losses: 0, roundsWon: 0, roundsLost: 0, totalDamage: 0, hazardDamageDealt: 0, hazardDamageTaken: 0, bestStreak: 0, streak: 0, creditsEarned: 0 },
    seasonal: { seasonNumber: 1, startedAt: now, endsAt: now + SEASON_MS, rp: 0, wins: 0, losses: 0, streak: 0, bestStreak: 0, peakRp: 0 },
    characterMastery: characterMastery(),
    weaponMastery: weaponMastery(),
    aiMemory: {},
    matchHistory: [],
    league: newLeague(),
    settings: { masterVolume: 0.8, musicVolume: 0.55, sfxVolume: 0.85, uiVolume: 0.65, ambienceVolume: 0.5, mute: false, performanceMode: false }
  };
}

function sanitize(raw: Partial<ProfileSave>): ProfileSave {
  const base = createDefaultProfile(typeof raw.username === 'string' ? raw.username : 'Player');
  const merged = {
    ...base,
    ...raw,
    stats: { ...base.stats, ...(raw.stats ?? {}) },
    seasonal: { ...base.seasonal, ...(raw.seasonal ?? {}) },
    settings: { ...base.settings, ...(raw.settings ?? {}) },
    characterMastery: { ...base.characterMastery, ...(raw.characterMastery ?? {}) },
    weaponMastery: { ...base.weaponMastery, ...(raw.weaponMastery ?? {}) },
    aiMemory: { ...(raw.aiMemory ?? {}) },
    league: raw.league ? { ...base.league, ...raw.league } : base.league,
    matchHistory: Array.isArray(raw.matchHistory) ? raw.matchHistory.slice(0, 100) : []
  } as ProfileSave;
  if (!ARENAS.some(a => a.id === merged.selectedArenaId)) merged.selectedArenaId = ARENAS[0].id;
  if (!CHARACTERS[merged.selectedCharacter]) merged.selectedCharacter = 'ace';
  return merged;
}

export function loadProfile(): ProfileSave {
  try {
    const text = localStorage.getItem(KEY);
    const profile = text ? sanitize(JSON.parse(text)) : createDefaultProfile();
    return ensureSeason(profile);
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfile(profile: ProfileSave): void {
  localStorage.setItem(KEY, JSON.stringify(profile));
}

export function ensureSeason(profile: ProfileSave): ProfileSave {
  const now = Date.now();
  if (now < profile.seasonal.endsAt) return profile;
  const elapsed = Math.max(1, Math.floor((now - profile.seasonal.startedAt) / SEASON_MS));
  profile.seasonal = {
    seasonNumber: profile.seasonal.seasonNumber + elapsed,
    startedAt: now,
    endsAt: now + SEASON_MS,
    rp: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    peakRp: 0
  };
  saveProfile(profile);
  return profile;
}

function characterLevelFromXp(xp: number): number {
  let level = 1;
  let spent = 0;
  while (level < 10000) {
    const cost = level <= 100 ? 120 + level * 6 : 720 + (level - 100) * 2.5;
    if (spent + cost > xp) break;
    spent += cost;
    level++;
  }
  return level;
}

function weaponLevelFromXp(xp: number): number {
  let level = 1;
  let spent = 0;
  while (level < 10000) {
    const cost = level <= 250 ? 100 + level * 2.4 : 700 + (level - 250) * 2;
    if (spent + cost > xp) break;
    spent += cost;
    level++;
  }
  return level;
}

export function characterMasteryProgress(profile: ProfileSave, id: CharacterId): MasteryEntry {
  const entry = profile.characterMastery[id];
  entry.level = characterLevelFromXp(entry.xp);
  return entry;
}

export function weaponMasteryProgress(profile: ProfileSave, id: WeaponId): MasteryEntry {
  const entry = profile.weaponMastery[id];
  entry.level = weaponLevelFromXp(entry.xp);
  return entry;
}

export interface MatchResultInput {
  mode: ModeId;
  opponent: string;
  opponentStyle: string;
  weapon: WeaponId;
  character: CharacterId;
  arena: string;
  won: boolean;
  roundsWon: number;
  roundsLost: number;
  damage: number;
  hazardDamageDealt: number;
  hazardDamageTaken: number;
  opponentDifficulty: 'Easy' | 'Medium' | 'Hard' | 'Pro' | 'Master';
}

const difficultyBonus = { Easy: 0, Medium: 4, Hard: 8, Pro: 13, Master: 18 } as const;

export function applyMatchResult(profile: ProfileSave, result: MatchResultInput): MatchHistoryItem {
  const baseCredits = result.won ? CREDIT_REWARDS[result.mode].win : CREDIT_REWARDS[result.mode].loss;
  const performanceCredits = result.mode === 'league' ? 0 : Math.min(18, Math.floor(result.damage / 90)) + (result.won && result.roundsLost === 0 ? 4 : 0);
  const credits = baseCredits + performanceCredits;
  let rpDelta = 0;
  if (result.mode === 'accountRanked') {
    rpDelta = result.won ? 28 + difficultyBonus[result.opponentDifficulty] + (result.roundsLost === 0 ? 5 : 0) : -(14 + Math.floor(difficultyBonus[result.opponentDifficulty] / 3));
    profile.accountRp = Math.max(0, profile.accountRp + rpDelta);
  } else if (result.mode === 'seasonalRanked') {
    rpDelta = result.won ? 34 + Math.min(10, Math.floor(result.damage / 140)) + (result.roundsLost === 0 ? 5 : 0) : -20;
    profile.seasonal.rp = Math.max(0, profile.seasonal.rp + rpDelta);
    profile.seasonal.peakRp = Math.max(profile.seasonal.peakRp, profile.seasonal.rp);
    if (result.won) {
      profile.seasonal.wins++;
      profile.seasonal.streak++;
      profile.seasonal.bestStreak = Math.max(profile.seasonal.bestStreak, profile.seasonal.streak);
    } else {
      profile.seasonal.losses++;
      profile.seasonal.streak = 0;
    }
  }

  profile.credits += credits;
  profile.stats.creditsEarned += credits;
  profile.stats.matches++;
  profile.stats.roundsWon += result.roundsWon;
  profile.stats.roundsLost += result.roundsLost;
  profile.stats.totalDamage += Math.round(result.damage);
  profile.stats.hazardDamageDealt += Math.round(result.hazardDamageDealt);
  profile.stats.hazardDamageTaken += Math.round(result.hazardDamageTaken);
  if (result.won) {
    profile.stats.wins++;
    profile.stats.streak++;
    profile.stats.bestStreak = Math.max(profile.stats.bestStreak, profile.stats.streak);
  } else {
    profile.stats.losses++;
    profile.stats.streak = 0;
  }

  const charEntry = profile.characterMastery[result.character];
  charEntry.matches++;
  if (result.won) charEntry.wins++;
  charEntry.xp += (result.won ? 100 : 15) + Math.min(50, Math.round(result.damage / 20));
  charEntry.level = characterLevelFromXp(charEntry.xp);

  const weaponEntry = profile.weaponMastery[result.weapon];
  weaponEntry.matches++;
  if (result.won) weaponEntry.wins++;
  weaponEntry.xp += (result.won ? 55 : 8) + Math.min(35, Math.round(result.damage / 30));
  weaponEntry.level = weaponLevelFromXp(weaponEntry.xp);

  const history: MatchHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    mode: result.mode,
    opponent: result.opponent,
    opponentStyle: result.opponentStyle,
    weapon: result.weapon,
    character: result.character,
    arena: result.arena,
    won: result.won,
    score: `${result.roundsWon}-${result.roundsLost}`,
    damage: Math.round(result.damage),
    hazardDamage: Math.round(result.hazardDamageTaken),
    credits,
    rpDelta
  };
  profile.matchHistory.unshift(history);
  profile.matchHistory = profile.matchHistory.slice(0, 100);
  saveProfile(profile);
  return history;
}

export function profileSummary(profile: ProfileSave) {
  const rank = rankForRp(profile.accountRp);
  const next = nextRankForRp(profile.accountRp);
  const seasonalRank = rankForRp(profile.seasonal.rp);
  return { rank, next, seasonalRank };
}

const FIRST = ['Chrome', 'Hollow', 'Nova', 'Kairo', 'Rex', 'Vanta', 'Echo', 'Ghost', 'Scarlet', 'Frost', 'Solar', 'Cipher', 'Rift', 'Atlas', 'Viper', 'Helix', 'Ash', 'Neon', 'Static', 'Crimson', 'Onyx', 'Jade', 'Astra', 'Rogue', 'Volt', 'Pyre', 'Zen', 'Nyx', 'Sable', 'Arc', 'Drift', 'Blaze', 'Iris', 'Cinder', 'Mako', 'Rune', 'Vector', 'Pulse', 'Shade', 'Flare'];
const SECOND = ['Fang', 'Vale', 'Calder', 'Pike', 'Warden', 'Rush', 'Trace', 'Reign', 'Voss', 'Keen', 'Rook', 'Haze', 'Strike', 'Crown', 'Shift', 'Locke', 'Vex', 'Stone', 'Cross', 'Ray', 'Forge', 'Storm', 'Zero', 'Quill', 'Dusk', 'Blade', 'Flux', 'Core', 'Hunter', 'Echo', 'Drake', 'Rift', 'Sage', 'Wolf', 'Knight', 'Arrow', 'Dash', 'Nova', 'Mire', 'Ward'];

export function randomAiName(): string {
  return `${FIRST[Math.floor(Math.random() * FIRST.length)]} ${SECOND[Math.floor(Math.random() * SECOND.length)]}`;
}
