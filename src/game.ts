import { ARENAS, CHARACTERS, DIFFICULTY_HP, DIFFICULTY_REACTION, DIFFICULTY_SKILL, STYLE_CONFIGS, TILE, WEAPONS, type ArenaConfig, type CharacterId, type Difficulty, type ModeId, type StyleId, type WeaponId } from './data';
import { AudioManager } from './audio';

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

interface Fighter {
  id: 'player' | 'enemy';
  x: number; y: number; vx: number; vy: number; radius: number;
  hp: number; maxHp: number; shield: number;
  weapon: WeaponId; character: CharacterId;
  stamina: number; ammo: number;
  reloadUntil: number; attackReadyAt: number; specialReadyAt: number; dodgeReadyAt: number;
  dodgeUntil: number; dodgeDisabledUntil: number; invulnerableUntil: number; untargetableUntil: number;
  invisibleUntil: number; confusedUntil: number; slowUntil: number; attackSlowUntil: number; damageDebuffUntil: number;
  attackLockedUntil: number; abilityUsed: boolean; facing: number; lastMoveX: number; lastMoveY: number;
  healingVulnerable: boolean; hazardImmunity: Record<string, number>;
  rexBuffUntil: number; axelBuff: boolean; rogueBuff: boolean; iceCharges: number;
  aceUntil: number; blitzUntil: number; knoxUntil: number; maverickMoveUntil: number; maverickDamageUntil: number; maverickDodges: number;
  cyberHijackedUntil: number; hazardGraceUntil: number;
}

interface Projectile {
  owner: Fighter['id']; x: number; y: number; vx: number; vy: number; radius: number; damage: number; ttl: number;
  weapon: WeaponId; special: boolean; critChance: number; pierce: boolean;
}

interface Hazard {
  id: string; type: string; x: number; y: number; r: number; w: number; h: number; offset: number; baseX: number; baseY: number;
}

interface ReplayFrame {
  t: number;
  p: { x: number; y: number; hp: number; shield: number };
  e: { x: number; y: number; hp: number; shield: number };
  projectiles: { x: number; y: number; r: number; owner: Fighter['id']; weapon: WeaponId }[];
}

export interface GameHud {
  phase: string;
  round: number;
  playerRounds: number;
  enemyRounds: number;
  playerHp: number;
  playerMaxHp: number;
  playerShield: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyShield: number;
  playerStamina: number;
  enemyStamina: number;
  playerAmmo: number;
  enemyAmmo: number;
  playerMag: number | null;
  enemyMag: number | null;
  playerSpecial: number;
  enemySpecial: number;
  playerDodge: number;
  abilityReady: boolean;
  roundTime: number;
  opponentName: string;
  opponentStyle: string;
  countdown: number;
}

export interface MatchSummary {
  won: boolean;
  roundsWon: number;
  roundsLost: number;
  damage: number;
  hazardDamageDealt: number;
  hazardDamageTaken: number;
  opponentName: string;
  opponentStyle: string;
  opponentDifficulty: Difficulty;
}

export interface GameOptions {
  canvas: HTMLCanvasElement;
  audio: AudioManager;
  mode: ModeId;
  difficulty: Difficulty;
  arena: ArenaConfig;
  playerWeapon: WeaponId;
  playerCharacter: CharacterId;
  opponentWeapon: WeaponId;
  opponentCharacter: CharacterId;
  opponentStyle: StyleId;
  opponentName: string;
  onHud: (hud: GameHud) => void;
  onOverlay: (title: string, subtitle?: string) => void;
  onMatchEnd: (summary: MatchSummary) => void;
}

export class ArenaGame {
  private ctx: CanvasRenderingContext2D;
  private opts: GameOptions;
  private p: Fighter;
  private e: Fighter;
  private projectiles: Projectile[] = [];
  private hazards: Hazard[] = [];
  private keys = new Set<string>();
  private mouse = { x: 480, y: 320, down: false };
  private raf = 0;
  private last = performance.now();
  private startedAt = this.last;
  private phase: 'intro' | 'countdown' | 'playing' | 'roundBreak' | 'replay' | 'ended' | 'paused' = 'intro';
  private phaseEnds = this.last + 3500;
  private round = 1;
  private playerRounds = 0;
  private enemyRounds = 0;
  private roundStartedAt = 0;
  private roundDuration = 90;
  private damageDealt = 0;
  private hazardDamageDealt = 0;
  private hazardDamageTaken = 0;
  private lastHazardHit = new Map<string, number>();
  private lastAiThink = 0;
  private aiAim = { x: 0, y: 0 };
  private aiDodgeAt = 0;
  private maverickUsed = new Set<string>();
  private replayFrames: ReplayFrame[] = [];
  private replayStart = 0;
  private replayDuration = 4857;
  private countdownAudioRound = 0;
  private destroyed = false;
  private world = { x: 0, y: 0, w: 960, h: 640 };

  private onKeyDown = (ev: KeyboardEvent) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) ev.preventDefault();
    this.keys.add(ev.code);
    if (ev.code === 'Space') this.tryDodge(this.p, this.mouse.x, this.mouse.y);
    if (ev.code === 'KeyF') this.useCharacterAbility(this.p, this.e);
    if (ev.code === 'KeyC') this.tryAttack(this.p, this.e, true, this.mouse.x, this.mouse.y);
    if (ev.code === 'KeyR') this.startReload(this.p);
    if (ev.code === 'Escape') this.togglePause();
  };
  private onKeyUp = (ev: KeyboardEvent) => this.keys.delete(ev.code);
  private onMouseMove = (ev: MouseEvent) => {
    const rect = this.opts.canvas.getBoundingClientRect();
    this.mouse.x = (ev.clientX - rect.left) * (this.opts.canvas.width / rect.width);
    this.mouse.y = (ev.clientY - rect.top) * (this.opts.canvas.height / rect.height);
  };
  private onMouseDown = (ev: MouseEvent) => { if (ev.button === 0) { this.mouse.down = true; this.tryAttack(this.p, this.e, false, this.mouse.x, this.mouse.y); } };
  private onMouseUp = (ev: MouseEvent) => { if (ev.button === 0) this.mouse.down = false; };

  constructor(opts: GameOptions) {
    this.opts = opts;
    const ctx = opts.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    opts.canvas.width = 960;
    opts.canvas.height = 640;
    this.world.w = opts.arena.widthTiles * TILE;
    this.world.h = opts.arena.heightTiles * TILE;
    this.world.x = (960 - this.world.w) / 2;
    this.world.y = (640 - this.world.h) / 2;
    this.roundDuration = opts.arena.roundSeconds ?? 90;
    this.p = this.makeFighter('player', opts.playerWeapon, opts.playerCharacter, 150);
    const enemyHp = opts.mode === 'seasonalRanked' ? 150 : DIFFICULTY_HP[opts.difficulty];
    this.e = this.makeFighter('enemy', opts.opponentWeapon, opts.opponentCharacter, enemyHp);
    this.bind();
    this.generateArena();
    this.resetRoundPositions();
    opts.audio.intro();
    opts.onOverlay(opts.arena.name, `${opts.mode === 'seasonalRanked' ? 'Seasonal Ranked' : opts.mode === 'accountRanked' ? 'Account Ranked' : opts.mode === 'quickplay' ? 'Quickplay' : opts.mode} • ${opts.opponentName} • ${STYLE_CONFIGS[opts.opponentStyle].name}`);
    this.raf = requestAnimationFrame(this.loop);
  }

  private bind() {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    this.opts.canvas.addEventListener('mousemove', this.onMouseMove);
    this.opts.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.opts.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.opts.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.opts.audio.stopAmbience();
  }

  private makeFighter(id: Fighter['id'], weapon: WeaponId, character: CharacterId, hp: number): Fighter {
    const mag = WEAPONS[weapon].magSize ?? 0;
    return {
      id, x: 0, y: 0, vx: 0, vy: 0, radius: 14, hp, maxHp: hp, shield: 0, weapon, character,
      stamina: 100, ammo: mag, reloadUntil: 0, attackReadyAt: 0, specialReadyAt: 0, dodgeReadyAt: 0, dodgeUntil: 0,
      dodgeDisabledUntil: 0, invulnerableUntil: 0, untargetableUntil: 0, invisibleUntil: 0, confusedUntil: 0, slowUntil: 0,
      attackSlowUntil: 0, damageDebuffUntil: 0, attackLockedUntil: 0, abilityUsed: false, facing: 0, lastMoveX: 1, lastMoveY: 0,
      healingVulnerable: false, hazardImmunity: {}, rexBuffUntil: 0, axelBuff: false, rogueBuff: false, iceCharges: 0,
      aceUntil: 0, blitzUntil: 0, knoxUntil: 0, maverickMoveUntil: 0, maverickDamageUntil: 0, maverickDodges: 0,
      cyberHijackedUntil: 0, hazardGraceUntil: 0
    };
  }

  private resetFighterForRound(f: Fighter) {
    f.hp = f.maxHp; f.shield = 0; f.stamina = 100; f.ammo = WEAPONS[f.weapon].magSize ?? 0; f.reloadUntil = 0;
    f.attackReadyAt = 0; f.specialReadyAt = 0; f.dodgeReadyAt = 0; f.dodgeUntil = 0; f.dodgeDisabledUntil = 0;
    f.invulnerableUntil = 0; f.untargetableUntil = 0; f.invisibleUntil = 0; f.confusedUntil = 0; f.slowUntil = 0;
    f.attackSlowUntil = 0; f.damageDebuffUntil = 0; f.attackLockedUntil = 0; f.abilityUsed = false; f.healingVulnerable = false;
    f.rexBuffUntil = 0; f.axelBuff = false; f.rogueBuff = false; f.iceCharges = 0; f.aceUntil = 0; f.blitzUntil = 0;
    f.knoxUntil = 0; f.maverickMoveUntil = 0; f.maverickDamageUntil = 0; f.maverickDodges = 0; f.cyberHijackedUntil = 0; f.hazardGraceUntil = 0;
  }

  private resetRoundPositions() {
    this.resetFighterForRound(this.p); this.resetFighterForRound(this.e);
    this.p.x = this.world.x + this.world.w * 0.22; this.p.y = this.world.y + this.world.h * 0.5;
    this.e.x = this.world.x + this.world.w * 0.78; this.e.y = this.world.y + this.world.h * 0.5;
    this.projectiles.length = 0; this.replayFrames.length = 0; this.lastHazardHit.clear();
  }

  private togglePause() {
    if (this.phase === 'playing') { this.phase = 'paused'; this.opts.onOverlay('PAUSED', 'Press Esc to resume'); }
    else if (this.phase === 'paused') { this.phase = 'playing'; this.last = performance.now(); this.opts.onOverlay('', ''); }
  }

  private loop = (now: number) => {
    if (this.destroyed) return;
    const dt = Math.min(0.033, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.update(now, dt);
    this.draw(now);
    this.emitHud(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(now: number, dt: number) {
    if (this.phase === 'paused' || this.phase === 'ended') return;
    if (this.phase === 'intro' && now >= this.phaseEnds) {
      this.phase = 'countdown'; this.phaseEnds = now + 3000; this.countdownAudioRound = this.round; this.opts.audio.countdown(this.round); this.opts.onOverlay('3', '');
      return;
    }
    if (this.phase === 'countdown') {
      if (now >= this.phaseEnds) this.beginRound(now);
      return;
    }
    if (this.phase === 'roundBreak') {
      const remain = this.phaseEnds - now;
      if (remain <= 3000 && this.countdownAudioRound !== this.round) {
        this.countdownAudioRound = this.round; this.opts.audio.countdown(this.round);
      }
      if (remain <= 3000) this.opts.onOverlay(String(Math.max(1, Math.ceil(remain / 1000))), `Round ${this.round}`);
      if (now >= this.phaseEnds) this.beginRound(now);
      return;
    }
    if (this.phase === 'replay') {
      if (now - this.replayStart >= this.replayDuration) this.finishMatch();
      return;
    }
    if (this.phase !== 'playing') return;

    this.updatePlayer(now, dt);
    this.updateAi(now, dt);
    this.updateProjectiles(now, dt);
    this.updateHazards(now, dt);
    this.updateStamina(this.p, dt); this.updateStamina(this.e, dt);
    this.updateReload(this.p, now); this.updateReload(this.e, now);
    this.resolveWorld(this.p); this.resolveWorld(this.e);
    this.recordReplay(now);

    if (this.p.hp <= 0 || this.e.hp <= 0) this.endRound(this.e.hp <= 0 ? 'player' : 'enemy', now);
    else if ((now - this.roundStartedAt) / 1000 >= this.roundDuration) {
      const pRatio = (this.p.hp + this.p.shield) / this.p.maxHp;
      const eRatio = (this.e.hp + this.e.shield) / this.e.maxHp;
      this.endRound(pRatio >= eRatio ? 'player' : 'enemy', now);
    }
  }

  private beginRound(now: number) {
    this.phase = 'playing'; this.roundStartedAt = now; this.opts.onOverlay('', '');
    this.opts.audio.roundMusic(this.round); this.opts.audio.arenaAmbience(this.opts.arena.id);
  }

  private endRound(winner: Fighter['id'], now: number) {
    if (this.phase !== 'playing') return;
    if (winner === 'player') this.playerRounds++; else this.enemyRounds++;
    if (this.playerRounds >= 2 || this.enemyRounds >= 2) {
      this.startReplay(now); return;
    }
    this.round++;
    this.phase = 'roundBreak'; this.phaseEnds = now + 5000; this.countdownAudioRound = 0;
    this.opts.onOverlay(`ROUND ${this.round}`, `${this.playerRounds} - ${this.enemyRounds}`);
    this.resetRoundPositions();
  }

  private startReplay(now: number) {
    this.phase = 'replay'; this.replayStart = now; this.opts.audio.stopAmbience();
    this.opts.onOverlay('FINAL HIT REPLAY', 'Last 3 seconds • final second 0.35×');
  }

  private finishMatch() {
    if (this.phase === 'ended') return;
    this.phase = 'ended'; this.opts.audio.stopMusic(); this.opts.audio.stopAmbience();
    if (this.playerRounds < this.enemyRounds) this.opts.audio.gameOverLoss();
    this.opts.onMatchEnd({
      won: this.playerRounds > this.enemyRounds,
      roundsWon: this.playerRounds,
      roundsLost: this.enemyRounds,
      damage: this.damageDealt,
      hazardDamageDealt: this.hazardDamageDealt,
      hazardDamageTaken: this.hazardDamageTaken,
      opponentName: this.opts.opponentName,
      opponentStyle: STYLE_CONFIGS[this.opts.opponentStyle].name,
      opponentDifficulty: this.opts.difficulty
    });
  }

  private updatePlayer(now: number, dt: number) {
    let dx = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    let dy = (this.keys.has('KeyS') ? 1 : 0) - (this.keys.has('KeyW') ? 1 : 0);
    if (this.p.confusedUntil > now) { const t = Math.sin(now * 0.012); [dx, dy] = [dy * t - dx * (1 - t), dx * t + dy * (1 - t)]; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    if (Math.abs(dx) + Math.abs(dy) > 0.01) { this.p.lastMoveX = dx; this.p.lastMoveY = dy; }
    this.p.facing = Math.atan2(this.mouse.y - this.p.y, this.mouse.x - this.p.x);
    this.moveFighter(this.p, dx, dy, now, dt);
    if (this.mouse.down) this.tryAttack(this.p, this.e, false, this.mouse.x, this.mouse.y);
  }

  private updateAi(now: number, dt: number) {
    const skill = DIFFICULTY_SKILL[this.opts.difficulty];
    const style = STYLE_CONFIGS[this.opts.opponentStyle];
    const reactionMs = DIFFICULTY_REACTION[this.opts.difficulty] * 1000;
    if (now - this.lastAiThink >= reactionMs) {
      this.lastAiThink = now;
      const d = dist(this.e.x, this.e.y, this.p.x, this.p.y);
      const projSpeed = WEAPONS[this.e.weapon].projectileSpeed ?? 999;
      const travel = projSpeed < 900 ? d / (projSpeed * TILE) : 0;
      this.aiAim.x = this.p.x + this.p.vx * travel * skill;
      this.aiAim.y = this.p.y + this.p.vy * travel * skill;
      if (!this.e.abilityUsed && Math.random() < 0.18 * skill && (this.e.hp / this.e.maxHp < 0.6 || d < 7 * TILE)) this.useCharacterAbility(this.e, this.p);
      if (this.shouldAiDodge(now, skill)) this.aiDodgeAt = now + reactionMs * (1.1 - 0.5 * skill);
    }
    if (this.aiDodgeAt && now >= this.aiDodgeAt) { this.aiDodgeAt = 0; this.tryDodge(this.e, this.e.x - (this.p.y - this.e.y), this.e.y + (this.p.x - this.e.x)); }

    let dx = 0, dy = 0;
    const d = dist(this.e.x, this.e.y, this.p.x, this.p.y);
    const ang = Math.atan2(this.p.y - this.e.y, this.p.x - this.e.x);
    const pref = style.preferredRange * TILE;
    const visibleTarget = this.p.untargetableUntil <= now && (this.p.invisibleUntil <= now || d < 2.5 * TILE);
    if (visibleTarget) {
      const toward = d > pref * 1.08 ? 1 : d < pref * 0.75 ? -1 : (Math.random() < style.aggression * 0.02 ? 1 : 0);
      dx = Math.cos(ang) * toward; dy = Math.sin(ang) * toward;
      if (this.opts.opponentStyle === 'flanker' || this.opts.opponentStyle === 'kiter' || this.opts.opponentStyle === 'wildcard') {
        const side = Math.sin(now * 0.003 + 1.7) > 0 ? 1 : -1; dx += Math.cos(ang + Math.PI / 2) * 0.65 * side; dy += Math.sin(ang + Math.PI / 2) * 0.65 * side;
      }
      if (this.opts.opponentStyle === 'anchor' && d < pref * 1.25) { dx *= 0.45; dy *= 0.45; }
      if (this.opts.opponentStyle === 'chaseHunter' && this.p.hp / this.p.maxHp < 0.45) { dx = Math.cos(ang); dy = Math.sin(ang); }
    } else {
      dx = Math.cos(now * 0.0017); dy = Math.sin(now * 0.0017);
    }
    const tryX = this.e.x + dx * 32; const tryY = this.e.y + dy * 32;
    if (this.pointDanger(tryX, tryY, now) > (1 - style.hazardAwareness) * 2.5) { const tx = dx; dx = -dy; dy = tx; }
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    this.e.facing = Math.atan2(this.aiAim.y - this.e.y, this.aiAim.x - this.e.x);
    this.moveFighter(this.e, dx, dy, now, dt);

    if (visibleTarget) {
      const weapon = WEAPONS[this.e.weapon];
      if (d <= weapon.specialRange * TILE && now >= this.e.specialReadyAt && Math.random() < 0.012 * skill) this.tryAttack(this.e, this.p, true, this.aiAim.x, this.aiAim.y);
      else if (d <= weapon.range * TILE * (weapon.kind === 'ranged' ? 1 : 1.12)) this.tryAttack(this.e, this.p, false, this.aiAim.x, this.aiAim.y);
    }
  }

  private moveFighter(f: Fighter, dx: number, dy: number, now: number, dt: number) {
    let speed = 205 * (this.opts.arena.speedMultiplier ?? 1);
    if (f.stamina <= 0.01) speed *= 0.93;
    if (f.slowUntil > now) speed *= 0.5;
    if (f.character === 'knox' && f.knoxUntil > now) speed *= 0.9;
    if (f.aceUntil > now) speed *= 1.12;
    if (f.blitzUntil > now) speed *= 1.35;
    if (f.maverickMoveUntil > now) speed *= 1.25;
    if (f.confusedUntil > now) speed *= 0.85;
    const glue = this.isInsideType(f.x, f.y, 'glue'); if (glue) speed *= 0.2;
    if (f.dodgeUntil > now) speed *= 2.75;
    const desiredVx = dx * speed, desiredVy = dy * speed;
    const friction = this.opts.arena.iceFloor ? 3.2 : 13;
    const accel = this.opts.arena.iceFloor ? 6 : 18;
    f.vx += (desiredVx - f.vx) * Math.min(1, accel * dt);
    f.vy += (desiredVy - f.vy) * Math.min(1, accel * dt);
    if (Math.abs(dx) + Math.abs(dy) < 0.01) { f.vx *= Math.max(0, 1 - friction * dt); f.vy *= Math.max(0, 1 - friction * dt); }
    f.x += f.vx * dt; f.y += f.vy * dt;
  }

  private tryDodge(f: Fighter, targetX: number, targetY: number) {
    const now = performance.now();
    if (this.phase !== 'playing' || now < f.dodgeReadyAt || now < f.dodgeDisabledUntil) return;
    let dx = targetX - f.x, dy = targetY - f.y; let l = Math.hypot(dx, dy);
    if (l < 4) { dx = f.lastMoveX; dy = f.lastMoveY; l = 1; }
    dx /= l; dy /= l;
    const exhausted = f.stamina <= 0.01;
    const distanceMult = exhausted ? 0.5 : 1;
    const cdMult = f.maverickDodges > 0 ? 0.75 : 1;
    if (f.maverickDodges > 0) f.maverickDodges--;
    f.vx = dx * 620 * distanceMult; f.vy = dy * 620 * distanceMult; f.dodgeUntil = now + 180;
    f.invulnerableUntil = Math.max(f.invulnerableUntil, now + 180);
    f.dodgeReadyAt = now + 1800 * cdMult;
  }

  private startReload(f: Fighter) {
    const weapon = WEAPONS[f.weapon]; if (weapon.kind !== 'ranged' || !weapon.reloadTime) return;
    const now = performance.now(); if (f.reloadUntil > now || f.ammo >= (weapon.magSize ?? 0)) return;
    f.reloadUntil = now + weapon.reloadTime * 1000;
  }

  private updateReload(f: Fighter, now: number) {
    const w = WEAPONS[f.weapon];
    if (f.reloadUntil && now >= f.reloadUntil) { f.reloadUntil = 0; f.ammo = w.magSize ?? 0; }
  }

  private updateStamina(f: Fighter, dt: number) {
    const w = WEAPONS[f.weapon]; if (w.kind !== 'melee') return;
    if (f.stamina >= 100) return;
    const regen = 100 / (w.staminaFullRegen ?? 2);
    f.stamina = clamp(f.stamina + regen * dt, 0, 100);
  }

  private tryAttack(attacker: Fighter, target: Fighter, special: boolean, aimX: number, aimY: number) {
    const now = performance.now(); if (this.phase !== 'playing' || attacker.hp <= 0 || now < attacker.attackLockedUntil) return;
    const w = WEAPONS[attacker.weapon];
    if (special) {
      if (now < attacker.specialReadyAt) return;
      attacker.specialReadyAt = now + w.specialCooldown * 1000;
      this.opts.audio.weapon(attacker.weapon, 'special');
      this.executeAttack(attacker, target, true, aimX, aimY, now);
      return;
    }
    if (now < attacker.attackReadyAt) return;
    let rate = w.attacksPerSecond;
    if (attacker.aceUntil > now) rate *= 1.15;
    if (attacker.attackSlowUntil > now) rate *= 0.5;
    if (w.kind === 'melee') {
      const cost = w.staminaCost ?? 0;
      if (attacker.stamina < cost) return;
      attacker.stamina = Math.max(0, attacker.stamina - cost);
    } else {
      if (attacker.reloadUntil > now) return;
      if (attacker.ammo <= 0) { this.startReload(attacker); return; }
      attacker.ammo--;
      if (attacker.ammo <= 0) setTimeout(() => { if (!this.destroyed) this.startReload(attacker); }, 20);
    }
    attacker.attackReadyAt = now + 1000 / Math.max(0.2, rate);
    this.opts.audio.weapon(attacker.weapon, 'basic');
    this.executeAttack(attacker, target, false, aimX, aimY, now);
  }

  private executeAttack(attacker: Fighter, target: Fighter, special: boolean, aimX: number, aimY: number, now: number) {
    const w = WEAPONS[attacker.weapon];
    let base = special ? w.specialDamage : w.basicDamage;
    if (attacker.maverickDamageUntil > now) base *= 1.25;
    if (attacker.damageDebuffUntil > now) base *= 0.85;
    if (attacker.rexBuffUntil > now && !special) base *= 1.35;
    if (attacker.axelBuff && !special) { base *= 1.5; attacker.axelBuff = false; }
    if (attacker.rogueBuff && !special) { base *= 1.25; attacker.rogueBuff = false; attacker.invisibleUntil = 0; }
    attacker.facing = Math.atan2(aimY - attacker.y, aimX - attacker.x);

    if (attacker.cyberHijackedUntil > now) {
      this.damage(attacker, base, attacker, false, false); return;
    }

    if (w.kind === 'ranged') {
      const speed = (w.projectileSpeed ?? 16) * TILE;
      const ang = attacker.facing;
      const projectile: Projectile = { owner: attacker.id, x: attacker.x + Math.cos(ang) * 18, y: attacker.y + Math.sin(ang) * 18, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, radius: special ? 7 : 4.5, damage: base, ttl: ((special ? w.specialRange : w.range) * TILE) / speed, weapon: attacker.weapon, special, critChance: w.critChance, pierce: special && attacker.weapon === 'energyStaff' };
      this.projectiles.push(projectile);
      return;
    }

    const range = (special ? w.specialRange : w.range) * TILE;
    const d = dist(attacker.x, attacker.y, target.x, target.y);
    const targetAngle = Math.atan2(target.y - attacker.y, target.x - attacker.x);
    const cone = attacker.weapon === 'chainWhip' ? 1.45 : special && attacker.weapon === 'hammer' ? Math.PI : attacker.weapon === 'spear' ? 0.42 : 0.85;
    if (d <= range + target.radius && Math.abs(angleDiff(targetAngle, attacker.facing)) <= cone) {
      const crit = Math.random() < w.critChance;
      this.damage(target, base * (crit ? w.critMultiplier : 1), attacker, crit, false);
      if (attacker.rexBuffUntil > now && !special) { this.knockback(target, attacker, 1.5 * TILE); attacker.rexBuffUntil = 0; }
      this.applyIce(attacker, target, now);
    }
  }

  private damage(target: Fighter, amount: number, source: Fighter | null, crit: boolean, hazard: boolean) {
    const now = performance.now(); if (target.invulnerableUntil > now || target.untargetableUntil > now) return;
    let dmg = amount;
    if (target.aceUntil > now) dmg *= 0.9;
    if (target.healingVulnerable) dmg *= 1.4;
    if (target.shield > 0) {
      target.shield = Math.max(0, target.shield - dmg);
      if (target.shield <= 0) target.knoxUntil = 0;
      return;
    }
    target.hp = Math.max(0, target.hp - dmg);
    if (source?.id === 'player') { if (hazard) this.hazardDamageDealt += dmg; else this.damageDealt += dmg; }
    if (target.id === 'player' && hazard) this.hazardDamageTaken += dmg;
    if (source) this.opts.audio.weapon(source.weapon, target.hp <= 0 ? 'kill' : crit ? 'crit' : 'hit');
  }

  private knockback(target: Fighter, source: Fighter, distance: number) {
    let dx = target.x - source.x, dy = target.y - source.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    target.x += dx * distance; target.y += dy * distance; this.resolveWorld(target);
  }

  private applyIce(attacker: Fighter, target: Fighter, now: number) {
    if (attacker.iceCharges <= 0) return;
    attacker.iceCharges--;
    target.slowUntil = Math.max(target.slowUntil, now + 2000);
    target.attackSlowUntil = Math.max(target.attackSlowUntil, now + 2000);
  }

  private updateProjectiles(now: number, dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.ttl -= dt;
      const target = p.owner === 'player' ? this.e : this.p;
      if (this.pointBlocked(p.x, p.y) || p.ttl <= 0) { this.projectiles.splice(i, 1); continue; }
      if (dist(p.x, p.y, target.x, target.y) <= p.radius + target.radius && target.untargetableUntil <= now && target.invisibleUntil <= now) {
        const source = p.owner === 'player' ? this.p : this.e;
        const crit = Math.random() < p.critChance;
        this.damage(target, p.damage * (crit ? WEAPONS[p.weapon].critMultiplier : 1), source, crit, false);
        this.applyIce(source, target, now);
        if (!p.pierce) this.projectiles.splice(i, 1);
      }
    }
  }

  private useCharacterAbility(actor: Fighter, target: Fighter) {
    const now = performance.now(); if (this.phase !== 'playing' || actor.abilityUsed) return;
    actor.abilityUsed = true;
    switch (actor.character) {
      case 'ace': actor.aceUntil = now + 4000; break;
      case 'blitz': actor.blitzUntil = now + 3500; actor.attackLockedUntil = now + 500; break;
      case 'knox': actor.shield = 90; actor.knoxUntil = now + 6000; break;
      case 'rex': {
        const ang = actor.facing; actor.x += Math.cos(ang) * 4 * TILE; actor.y += Math.sin(ang) * 4 * TILE; actor.rexBuffUntil = now + 2000; this.resolveWorld(actor); break;
      }
      case 'skye': actor.untargetableUntil = now + 800; setTimeout(() => { if (!this.destroyed) this.safeRandomReposition(actor, 5 * TILE, 10 * TILE); }, 800); break;
      case 'maverick': this.activateMaverick(actor, now); break;
      case 'axel': actor.axelBuff = true; break;
      case 'kairo': if (dist(actor.x, actor.y, target.x, target.y) <= 4.5 * TILE) { target.slowUntil = now + 3000; target.damageDebuffUntil = now + 3000; } break;
      case 'dash': {
        const ang = actor.facing; actor.invulnerableUntil = now + 980; actor.hazardGraceUntil = now + 2480; actor.x += Math.cos(ang) * 5 * TILE; actor.y += Math.sin(ang) * 5 * TILE; this.resolveWorld(actor); break;
      }
      case 'cyberRunner': {
        const initial = dist(actor.x, actor.y, target.x, target.y); this.opts.onOverlay('NEURAL LOCK', 'Break line-of-sight or stop attacking');
        setTimeout(() => { if (!this.destroyed && initial <= 10 * TILE && dist(actor.x, actor.y, target.x, target.y) <= 11 * TILE && !this.lineBlocked(actor.x, actor.y, target.x, target.y)) target.cyberHijackedUntil = performance.now() + 2000; }, 700); break;
      }
      case 'coreBreaker': if (dist(actor.x, actor.y, target.x, target.y) <= 4 * TILE) { this.damage(target, 35, actor, false, false); target.slowUntil = now + 2000; target.dodgeDisabledUntil = now + 1000; } break;
      case 'surge': this.castSurge(actor, target); break;
      case 'rogueReaper': actor.invisibleUntil = now + 1800; actor.rogueBuff = true; break;
      case 'scarlet': target.confusedUntil = now + 2000; break;
      case 'toxicDrift': this.hazards.push({ id: `toxic-${now}`, type: 'abilityPoison', x: actor.x, y: actor.y, r: 3 * TILE, w: 0, h: 0, offset: now, baseX: actor.x, baseY: actor.y }); setTimeout(() => { this.hazards = this.hazards.filter(h => h.id !== `toxic-${now}`); }, 4000); break;
      case 'icePhantom': actor.iceCharges = 3; break;
    }
  }

  private activateMaverick(actor: Fighter, now: number) {
    const pool = ['move', 'damage', 'dodge'].filter(v => !this.maverickUsed.has(v));
    const choice = pool[Math.floor(Math.random() * pool.length)] ?? 'move'; this.maverickUsed.add(choice);
    if (choice === 'move') actor.maverickMoveUntil = now + 5000;
    if (choice === 'damage') actor.maverickDamageUntil = now + 5000;
    if (choice === 'dodge') actor.maverickDodges = 3;
  }

  private castSurge(actor: Fighter, target: Fighter) {
    const now = performance.now(); const baseAngle = Math.random() * TAU;
    for (let i = 0; i < 3; i++) {
      const ang = baseAngle + i * TAU / 3; const x = target.x + Math.cos(ang) * 0.5 * TILE; const y = target.y + Math.sin(ang) * 0.5 * TILE;
      const h: Hazard = { id: `surge-${now}-${i}`, type: 'surge', x, y, r: 17, w: 0, h: 0, offset: now + i * 220, baseX: x, baseY: y }; this.hazards.push(h);
      setTimeout(() => {
        if (this.destroyed) return; const victim = actor.id === 'player' ? this.e : this.p;
        if (dist(victim.x, victim.y, x, y) <= 20 && !(victim.hazardImmunity.surge > performance.now())) { this.damage(victim, 38, actor, false, false); victim.hazardImmunity.surge = performance.now() + 350; }
        this.hazards = this.hazards.filter(v => v.id !== h.id);
      }, 600 + i * 220);
    }
  }

  private safeRandomReposition(actor: Fighter, minD: number, maxD: number) {
    for (let tries = 0; tries < 32; tries++) {
      const a = Math.random() * TAU, d = minD + Math.random() * (maxD - minD); const x = actor.x + Math.cos(a) * d, y = actor.y + Math.sin(a) * d;
      if (x > this.world.x + 24 && x < this.world.x + this.world.w - 24 && y > this.world.y + 24 && y < this.world.y + this.world.h - 24 && !this.pointBlocked(x, y) && this.pointDanger(x, y, performance.now()) < 0.7) { actor.x = x; actor.y = y; return; }
    }
  }

  private shouldAiDodge(now: number, skill: number) {
    if (now < this.e.dodgeReadyAt) return false;
    for (const p of this.projectiles) if (p.owner === 'player') {
      const d = dist(p.x, p.y, this.e.x, this.e.y); if (d < 100 && Math.random() < 0.45 * skill) return true;
    }
    return false;
  }

  private updateHazards(now: number, dt: number) {
    this.p.healingVulnerable = false; this.e.healingVulnerable = false;
    for (const f of [this.p, this.e]) this.applyHazardsTo(f, now, dt);
  }

  private applyHazardsTo(f: Fighter, now: number, dt: number) {
    if (f.hazardGraceUntil > now) return;
    for (const h of this.hazards) {
      if (h.type === 'movingWall') h.x = h.baseX + Math.sin(now * 0.0012 + h.offset) * 45;
      const inside = h.w > 0 ? f.x > h.x - h.w / 2 && f.x < h.x + h.w / 2 && f.y > h.y - h.h / 2 && f.y < h.y + h.h / 2 : dist(f.x, f.y, h.x, h.y) <= h.r + f.radius;
      if (!inside) continue;
      const key = `${h.id}:${f.id}`; const last = this.lastHazardHit.get(key) ?? -Infinity;
      if (h.type === 'spikes' && now - last > 800) { this.damage(f, 14, null, false, true); this.lastHazardHit.set(key, now); this.opts.audio.hazard('spikes'); }
      else if (h.type === 'lava' && now - last > 750) { this.damage(f, 28, null, false, true); this.lastHazardHit.set(key, now); this.opts.audio.hazard('lava'); }
      else if ((h.type === 'poison' || h.type === 'abilityPoison') && now - last > 250) { const dmg = h.type === 'abilityPoison' ? 25 * 0.25 : 10 * 0.25; this.damage(f, dmg, h.type === 'abilityPoison' ? (f.id === 'player' ? this.e : this.p) : null, false, true); this.lastHazardHit.set(key, now); }
      else if (h.type === 'healing') { f.hp = Math.min(f.maxHp, f.hp + 16 * dt); f.healingVulnerable = true; }
      else if (h.type === 'lightning') {
        const cycle = (now / 1000 + h.offset) % 4.5; if (cycle > 4.0 && cycle < 4.28 && now - last > 1400) { this.damage(f, f.maxHp * 0.35, null, false, true); this.lastHazardHit.set(key, now); f.hazardImmunity.lightning = now + 1500; this.opts.audio.hazard('lightning'); }
      } else if (h.type === 'void') {
        const cycle = (now / 1000 + h.offset) % 5.2; if (cycle > 4.65 && cycle < 5.0 && now - last > 1200) { this.damage(f, 39, null, false, true); this.lastHazardHit.set(key, now); const center = { ...f, x: h.x, y: h.y } as Fighter; this.knockback(f, center, TILE); this.opts.audio.hazard('void'); }
      } else if (h.type === 'explosion') {
        const cycle = (now / 1000 + h.offset) % 4.2; if (cycle > 3.6 && cycle < 3.9 && now - last > 1400) { this.damage(f, 40, null, false, true); this.lastHazardHit.set(key, now); this.opts.audio.hazard('explosion'); }
      }
    }
    for (const h of this.hazards.filter(v => v.type === 'solar')) {
      const phase = (now / 1000 + h.offset) % 5; const active = phase > 4.2 && phase < 4.65;
      if (active && Math.abs(f.y - h.y) < 18 && f.x > this.world.x && f.x < this.world.x + this.world.w) {
        const key = `${h.id}:${f.id}`; const last = this.lastHazardHit.get(key) ?? -Infinity;
        if (now - last > 450) { this.damage(f, 50, null, false, true); this.lastHazardHit.set(key, now); this.opts.audio.hazard('solar'); }
      }
    }
    if (this.opts.arena.closingGas) {
      const elapsed = clamp((now - this.roundStartedAt) / (this.roundDuration * 1000), 0, 1); const maxR = Math.min(this.world.w, this.world.h) * 0.55; const safeR = maxR * (1 - elapsed * 0.72);
      const cx = this.world.x + this.world.w / 2, cy = this.world.y + this.world.h / 2;
      if (dist(f.x, f.y, cx, cy) > safeR) { const key = `gas:${f.id}`; const last = this.lastHazardHit.get(key) ?? -Infinity; if (now - last > 250) { this.damage(f, 2.5, null, false, true); this.lastHazardHit.set(key, now); } }
    }
  }

  private pointDanger(x: number, y: number, now: number) {
    let danger = 0;
    for (const h of this.hazards) {
      const d = dist(x, y, h.x, h.y);
      if (['lava', 'spikes', 'poison', 'abilityPoison', 'void', 'lightning', 'explosion'].includes(h.type) && d < h.r + 28) danger += 1;
      if (h.type === 'glue' && d < h.r + 20) danger += 0.5;
    }
    if (this.opts.arena.closingGas && this.roundStartedAt) {
      const elapsed = clamp((now - this.roundStartedAt) / (this.roundDuration * 1000), 0, 1); const safeR = Math.min(this.world.w, this.world.h) * 0.55 * (1 - elapsed * 0.72); const cx = this.world.x + this.world.w / 2, cy = this.world.y + this.world.h / 2; if (dist(x, y, cx, cy) > safeR) danger += 2;
    }
    return danger;
  }

  private isInsideType(x: number, y: number, type: string) { return this.hazards.some(h => h.type === type && dist(x, y, h.x, h.y) <= h.r + 14); }

  private resolveWorld(f: Fighter) {
    f.x = clamp(f.x, this.world.x + f.radius, this.world.x + this.world.w - f.radius);
    f.y = clamp(f.y, this.world.y + f.radius, this.world.y + this.world.h - f.radius);
    for (const h of this.hazards) if (h.type === 'barrier' || h.type === 'movingWall') {
      const left = h.x - h.w / 2 - f.radius, right = h.x + h.w / 2 + f.radius, top = h.y - h.h / 2 - f.radius, bottom = h.y + h.h / 2 + f.radius;
      if (f.x > left && f.x < right && f.y > top && f.y < bottom) {
        const dl = Math.abs(f.x - left), dr = Math.abs(right - f.x), dt = Math.abs(f.y - top), db = Math.abs(bottom - f.y); const m = Math.min(dl, dr, dt, db);
        if (m === dl) f.x = left; else if (m === dr) f.x = right; else if (m === dt) f.y = top; else f.y = bottom;
        f.vx *= 0.2; f.vy *= 0.2;
      }
    }
  }

  private pointBlocked(x: number, y: number) { return this.hazards.some(h => (h.type === 'barrier' || h.type === 'movingWall') && x > h.x - h.w / 2 && x < h.x + h.w / 2 && y > h.y - h.h / 2 && y < h.y + h.h / 2); }
  private lineBlocked(x1: number, y1: number, x2: number, y2: number) { const steps = 24; for (let i = 1; i < steps; i++) { const t = i / steps; if (this.pointBlocked(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return true; } return false; }

  private generateArena() {
    const seed = [...this.opts.arena.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 2166136261);
    let s = seed || 1; const rand = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
    const safe = (x: number, y: number) => x > this.world.x + 120 && x < this.world.x + this.world.w - 120 && y > this.world.y + 70 && y < this.world.y + this.world.h - 70;
    let index = 0;
    for (const spec of this.opts.arena.hazards) for (let n = 0; n < spec.count; n++) {
      let x = this.world.x + this.world.w * (0.25 + rand() * 0.5), y = this.world.y + this.world.h * (0.15 + rand() * 0.7); if (!safe(x, y)) { x = this.world.x + this.world.w / 2; y = this.world.y + this.world.h / 2; }
      const type = spec.type; let r = 26, w = 0, h = 0;
      if (type === 'barrier' || type === 'movingWall') { w = 42 + rand() * 50; h = 22 + rand() * 34; r = 0; }
      if (type === 'lava') r = 34; if (type === 'glue') r = 36; if (type === 'healing') r = 40; if (type === 'lightning') r = 30; if (type === 'solar') { r = 0; y = this.world.y + 70 + rand() * (this.world.h - 140); }
      if (type === 'void') r = 38; if (type === 'explosion') r = 42; if (type === 'ice') { r = Math.min(this.world.w, this.world.h); x = this.world.x + this.world.w / 2; y = this.world.y + this.world.h / 2; }
      this.hazards.push({ id: `${type}-${index++}`, type, x, y, r, w, h, offset: rand() * 4, baseX: x, baseY: y });
    }
  }

  private recordReplay(now: number) {
    if (now - (this.replayFrames.at(-1)?.t ?? 0) < 33) return;
    this.replayFrames.push({ t: now, p: { x: this.p.x, y: this.p.y, hp: this.p.hp, shield: this.p.shield }, e: { x: this.e.x, y: this.e.y, hp: this.e.hp, shield: this.e.shield }, projectiles: this.projectiles.slice(0, 24).map(p => ({ x: p.x, y: p.y, r: p.radius, owner: p.owner, weapon: p.weapon })) });
    while (this.replayFrames.length > 92) this.replayFrames.shift();
  }

  private replayFrame(now: number): ReplayFrame | null {
    if (!this.replayFrames.length) return null;
    const wall = now - this.replayStart; const virtual = wall <= 2000 ? wall : 2000 + (wall - 2000) * 0.35; const idx = Math.floor(clamp(virtual / 3000, 0, 0.999) * this.replayFrames.length); return this.replayFrames[idx] ?? this.replayFrames.at(-1)!;
  }

  private emitHud(now: number) {
    const wp = WEAPONS[this.p.weapon], we = WEAPONS[this.e.weapon];
    const countdown = this.phase === 'countdown' ? Math.max(1, Math.ceil((this.phaseEnds - now) / 1000)) : this.phase === 'roundBreak' && this.phaseEnds - now <= 3000 ? Math.max(1, Math.ceil((this.phaseEnds - now) / 1000)) : 0;
    this.opts.onHud({
      phase: this.phase, round: this.round, playerRounds: this.playerRounds, enemyRounds: this.enemyRounds,
      playerHp: this.p.hp, playerMaxHp: this.p.maxHp, playerShield: this.p.shield, enemyHp: this.e.hp, enemyMaxHp: this.e.maxHp, enemyShield: this.e.shield,
      playerStamina: this.p.stamina, enemyStamina: this.e.stamina, playerAmmo: this.p.ammo, enemyAmmo: this.e.ammo, playerMag: wp.magSize ?? null, enemyMag: we.magSize ?? null,
      playerSpecial: Math.max(0, (this.p.specialReadyAt - now) / 1000), enemySpecial: Math.max(0, (this.e.specialReadyAt - now) / 1000), playerDodge: Math.max(0, (this.p.dodgeReadyAt - now) / 1000),
      abilityReady: !this.p.abilityUsed, roundTime: this.phase === 'playing' ? Math.max(0, this.roundDuration - (now - this.roundStartedAt) / 1000) : this.roundDuration,
      opponentName: this.opts.opponentName, opponentStyle: STYLE_CONFIGS[this.opts.opponentStyle].name, countdown
    });
  }

  private draw(now: number) {
    const c = this.ctx; c.clearRect(0, 0, 960, 640); c.fillStyle = '#050b14'; c.fillRect(0, 0, 960, 640);
    c.save(); c.fillStyle = this.opts.arena.baseColor; c.fillRect(this.world.x, this.world.y, this.world.w, this.world.h);
    c.strokeStyle = this.opts.arena.accentColor + '44'; c.lineWidth = 1;
    for (let x = this.world.x; x <= this.world.x + this.world.w; x += TILE) { c.beginPath(); c.moveTo(x, this.world.y); c.lineTo(x, this.world.y + this.world.h); c.stroke(); }
    for (let y = this.world.y; y <= this.world.y + this.world.h; y += TILE) { c.beginPath(); c.moveTo(this.world.x, y); c.lineTo(this.world.x + this.world.w, y); c.stroke(); }
    c.strokeStyle = this.opts.arena.accentColor; c.lineWidth = 3; c.strokeRect(this.world.x, this.world.y, this.world.w, this.world.h);
    this.drawHazards(now);
    if (this.phase === 'replay') {
      const frame = this.replayFrame(now); if (frame) { this.drawFighterAt(frame.p.x, frame.p.y, this.p, frame.p.hp, frame.p.shield, now); this.drawFighterAt(frame.e.x, frame.e.y, this.e, frame.e.hp, frame.e.shield, now); for (const p of frame.projectiles) this.drawProjectileSimple(p.x, p.y, p.r, p.owner, p.weapon); }
    } else {
      for (const p of this.projectiles) this.drawProjectileSimple(p.x, p.y, p.radius, p.owner, p.weapon);
      this.drawFighterAt(this.p.x, this.p.y, this.p, this.p.hp, this.p.shield, now); this.drawFighterAt(this.e.x, this.e.y, this.e, this.e.hp, this.e.shield, now);
    }
    c.restore();
  }

  private drawHazards(now: number) {
    const c = this.ctx;
    for (const h of this.hazards) {
      if (h.type === 'ice') continue;
      if (h.type === 'movingWall') h.x = h.baseX + Math.sin(now * 0.0012 + h.offset) * 45;
      if (h.type === 'barrier' || h.type === 'movingWall') { c.fillStyle = h.type === 'movingWall' ? '#5b7587aa' : '#314353cc'; c.fillRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h); c.strokeStyle = '#9bd9ee88'; c.strokeRect(h.x - h.w / 2, h.y - h.h / 2, h.w, h.h); continue; }
      if (h.type === 'solar') { const phase = (now / 1000 + h.offset) % 5; const warning = phase > 3.6; c.strokeStyle = phase > 4.2 ? '#fff06d' : warning ? '#f9d94d88' : '#f9d94d25'; c.lineWidth = phase > 4.2 ? 10 : 2; c.beginPath(); c.moveTo(this.world.x, h.y); c.lineTo(this.world.x + this.world.w, h.y); c.stroke(); continue; }
      let color = '#8aa';
      if (h.type === 'spikes') color = '#ff6a5d'; if (h.type === 'lava') color = '#ff6a24'; if (h.type === 'glue') color = '#42d8c1'; if (h.type === 'poison' || h.type === 'abilityPoison') color = '#55e64f'; if (h.type === 'healing') color = '#41ff9a'; if (h.type === 'lightning' || h.type === 'surge') color = '#5fd9ff'; if (h.type === 'void') color = '#a85cff'; if (h.type === 'explosion') color = '#ff9d3d';
      let alpha = 0.25;
      if (h.type === 'lightning') { const cycle = (now / 1000 + h.offset) % 4.5; alpha = cycle > 3.5 ? 0.65 : 0.18; }
      if (h.type === 'void') { const cycle = (now / 1000 + h.offset) % 5.2; alpha = cycle > 4.2 ? 0.6 : 0.18; }
      if (h.type === 'explosion') { const cycle = (now / 1000 + h.offset) % 4.2; alpha = cycle > 3 ? 0.7 : 0.15; }
      if (h.type === 'surge') alpha = 0.72;
      c.globalAlpha = alpha; c.fillStyle = color; c.beginPath(); c.arc(h.x, h.y, h.r, 0, TAU); c.fill(); c.globalAlpha = 1; c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); c.arc(h.x, h.y, h.r, 0, TAU); c.stroke();
    }
    if (this.opts.arena.closingGas && this.roundStartedAt) {
      const elapsed = clamp((now - this.roundStartedAt) / (this.roundDuration * 1000), 0, 1); const maxR = Math.min(this.world.w, this.world.h) * 0.55; const safeR = maxR * (1 - elapsed * 0.72); const cx = this.world.x + this.world.w / 2, cy = this.world.y + this.world.h / 2;
      c.save(); c.fillStyle = '#4dff4b22'; c.fillRect(this.world.x, this.world.y, this.world.w, this.world.h); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(cx, cy, safeR, 0, TAU); c.fill(); c.restore(); c.strokeStyle = '#6dff5a'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, safeR, 0, TAU); c.stroke();
    }
  }

  private drawFighterAt(x: number, y: number, f: Fighter, hp: number, shield: number, now: number) {
    if (f.invisibleUntil > now && f.id === 'enemy') return;
    const c = this.ctx; const ch = CHARACTERS[f.character]; const alpha = f.invisibleUntil > now ? 0.22 : f.untargetableUntil > now ? 0.35 : 1;
    c.save(); c.globalAlpha = alpha; c.translate(x, y); c.rotate(f.facing); c.fillStyle = ch.color; c.strokeStyle = ch.accent; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, f.radius, 0, TAU); c.fill(); c.stroke(); c.fillStyle = ch.accent; c.beginPath(); c.moveTo(8, 0); c.lineTo(-4, -6); c.lineTo(-4, 6); c.closePath(); c.fill(); c.restore();
    if (shield > 0) { c.strokeStyle = '#7fc7ff'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, f.radius + 6, 0, TAU); c.stroke(); }
    const w = 64, ratio = clamp(hp / f.maxHp, 0, 1); c.fillStyle = '#081018cc'; c.fillRect(x - w / 2, y - 28, w, 5); c.fillStyle = f.id === 'player' ? '#49e9ff' : '#ff714d'; c.fillRect(x - w / 2, y - 28, w * ratio, 5);
    this.drawWeaponShape(x, y, f);
  }

  private drawWeaponShape(x: number, y: number, f: Fighter) {
    const c = this.ctx, w = WEAPONS[f.weapon]; c.save(); c.translate(x, y); c.rotate(f.facing); c.strokeStyle = w.color; c.fillStyle = w.color; c.lineWidth = 4; c.lineCap = 'round';
    if (f.weapon === 'hammer') { c.strokeRect(17, -7, 18, 14); c.beginPath(); c.moveTo(5, 0); c.lineTo(22, 0); c.stroke(); }
    else if (f.weapon === 'daggers') { for (const sy of [-5, 5]) { c.beginPath(); c.moveTo(10, sy); c.lineTo(29, sy * 1.2); c.stroke(); } }
    else if (f.weapon === 'sword') { c.beginPath(); c.moveTo(8, 0); c.lineTo(35, 0); c.stroke(); c.beginPath(); c.moveTo(13, -6); c.lineTo(13, 6); c.stroke(); }
    else if (f.weapon === 'spear') { c.beginPath(); c.moveTo(5, 0); c.lineTo(42, 0); c.stroke(); c.beginPath(); c.moveTo(42, 0); c.lineTo(32, -5); c.lineTo(32, 5); c.closePath(); c.fill(); }
    else if (f.weapon === 'chainWhip') { c.beginPath(); for (let i = 0; i < 6; i++) { const px = 10 + i * 6, py = Math.sin(i * 1.3) * 4; if (!i) c.moveTo(px, py); else c.lineTo(px, py); } c.stroke(); }
    else if (f.weapon === 'bow') { c.beginPath(); c.arc(24, 0, 15, -1.2, 1.2); c.stroke(); c.beginPath(); c.moveTo(29, -14); c.lineTo(29, 14); c.stroke(); }
    else if (f.weapon === 'blaster') { c.fillRect(10, -5, 24, 10); c.fillRect(15, 5, 8, 9); c.fillStyle = '#e9ffff'; c.fillRect(31, -2, 7, 4); }
    else if (f.weapon === 'energyStaff') { c.beginPath(); c.moveTo(6, 0); c.lineTo(34, 0); c.stroke(); c.beginPath(); c.arc(38, 0, 6, 0, TAU); c.stroke(); }
    c.restore();
  }

  private drawProjectileSimple(x: number, y: number, r: number, owner: Fighter['id'], weapon: WeaponId) {
    const c = this.ctx; c.fillStyle = WEAPONS[weapon].color; c.shadowColor = WEAPONS[weapon].color; c.shadowBlur = 8; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.shadowBlur = 0; if (owner === 'enemy') { c.strokeStyle = '#ff7968'; c.stroke(); }
  }
}

export function arenaById(id: string): ArenaConfig { return ARENAS.find(a => a.id === id) ?? ARENAS[0]; }
