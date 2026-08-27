import type { ProfileSave } from './save';
import type { WeaponId } from './data';

type Group = 'music' | 'ui' | 'sfx' | 'ambience';

interface Playing { el: HTMLAudioElement; group: Group; base: number; loop: boolean; }

export class AudioManager {
  private active = new Set<Playing>();
  private profile: ProfileSave;
  private music: Playing | null = null;
  private ambience: Playing | null = null;
  private hoverAt = 0;

  constructor(profile: ProfileSave) { this.profile = profile; }
  updateProfile(profile: ProfileSave) { this.profile = profile; this.applyVolumes(); }

  private groupVolume(group: Group): number {
    const s = this.profile.settings;
    if (s.mute) return 0;
    if (group === 'music') return s.masterVolume * s.musicVolume;
    if (group === 'ui') return s.masterVolume * s.uiVolume;
    if (group === 'ambience') return s.masterVolume * s.ambienceVolume;
    return s.masterVolume * s.sfxVolume;
  }

  private playFile(path: string, group: Group, base = 1, loop = false): Playing | null {
    try {
      const el = new Audio(path);
      el.loop = loop;
      el.preload = 'auto';
      const playing: Playing = { el, group, base, loop };
      el.volume = Math.max(0, Math.min(1, this.groupVolume(group) * base));
      el.addEventListener('ended', () => { if (!loop) this.active.delete(playing); });
      el.addEventListener('error', () => { this.active.delete(playing); }, { once: true });
      this.active.add(playing);
      void el.play().catch(() => this.active.delete(playing));
      return playing;
    } catch { return null; }
  }

  private fadeOut(playing: Playing | null, ms = 350) {
    if (!playing) return;
    const start = performance.now();
    const initial = playing.el.volume;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      playing.el.volume = initial * (1 - t);
      if (t < 1) requestAnimationFrame(step);
      else { playing.el.pause(); this.active.delete(playing); }
    };
    requestAnimationFrame(step);
  }

  applyVolumes() {
    for (const p of this.active) p.el.volume = Math.max(0, Math.min(1, this.groupVolume(p.group) * p.base));
  }

  ui(kind: 'hover' | 'click' | 'confirm' | 'error' | 'unlock' | 'tab') {
    if (kind === 'hover') {
      const now = performance.now();
      if (now - this.hoverAt < 90) return;
      this.hoverAt = now;
    }
    this.playFile(`/adaptive-arena-audio/ui-sounds/${kind}.mp3`, 'ui', kind === 'hover' ? 0.45 : 0.75);
  }

  weapon(id: WeaponId, kind: 'basic' | 'special' | 'hit' | 'crit' | 'kill') {
    const names: Record<WeaponId, string> = { sword: 'sword', hammer: 'hammer', daggers: 'daggers', spear: 'spear', chainWhip: 'chain-whip', bow: 'bow', blaster: 'blaster', energyStaff: 'energy-staff' };
    const base = id === 'bow' ? 1 : id === 'hammer' && kind === 'basic' ? 1 : 0.85;
    const variant = kind === 'basic' ? Math.floor(Math.random() * 3) + 1 : 1;
    const folder = '/adaptive-arena-audio/weapon-sounds';
    const candidate = kind === 'basic' ? `${folder}/${names[id]}-basic-${variant}.mp3` : `${folder}/${names[id]}-${kind}.mp3`;
    this.playFile(candidate, 'sfx', base);
  }

  hazard(kind: string) { this.playFile(`/adaptive-arena-audio/arena-hazard-sounds/${kind}.mp3`, 'sfx', 0.8); }
  countdown(round: number) { this.playFile(round === 1 ? '/adaptive-arena-audio/music/round-start-countdown.mp3' : '/adaptive-arena-audio/music/Round-321-countdown.mp3', 'sfx', 0.9); }
  intro() { this.playFile('/adaptive-arena-audio/ui-sounds/battle-intro.mp3', 'ui', 0.8); }
  gameOverLoss() { this.playFile('/adaptive-arena-audio/ui-sounds/game-over.mp3', 'ui', 0.9); }

  menuMusic() {
    if (this.music?.el.dataset.track === 'menu') return;
    this.fadeOut(this.music);
    this.music = this.playFile('/adaptive-arena-audio/music/menu-music.mp3', 'music', 0.8, true);
    if (this.music) this.music.el.dataset.track = 'menu';
  }

  roundMusic(round: number) {
    const key = round === 3 ? 'round3' : 'round12';
    if (this.music?.el.dataset.track === key) return;
    this.fadeOut(this.music, 250);
    const file = round === 3 ? '/adaptive-arena-audio/music/round-3-arena-background-music.mp3' : '/adaptive-arena-audio/music/Round-1-and-2-arena-background-music.mp3';
    this.music = this.playFile(file, 'music', 0.75, true);
    if (this.music) this.music.el.dataset.track = key;
  }

  stopMusic() { this.fadeOut(this.music); this.music = null; }
  arenaAmbience(arenaId: string) {
    this.fadeOut(this.ambience);
    this.ambience = this.playFile(`/adaptive-arena-audio/arena-ambiance/${arenaId}.mp3`, 'ambience', 0.55, true);
  }
  stopAmbience() { this.fadeOut(this.ambience); this.ambience = null; }
  stopAll() {
    for (const p of [...this.active]) { p.el.pause(); this.active.delete(p); }
    this.music = null; this.ambience = null;
  }
}
