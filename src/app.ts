import { ARENAS, CHARACTERS, RANKS, STYLE_CONFIGS, WEAPONS, arenaUnlocked, nextRankForRp, rankForRp, type CharacterId, type Difficulty, type ModeId, type StyleId, type WeaponId } from './data';
import { AudioManager } from './audio';
import { ArenaGame, arenaById, type GameHud, type MatchSummary } from './game';
import { applyMatchResult, characterMasteryProgress, loadProfile, profileSummary, randomAiName, saveProfile, weaponMasteryProgress, type ProfileSave } from './save';

const esc = (s: unknown) => String(s).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] ?? c));
const pct = (v: number) => `${Math.round(v * 100)}%`;
const fmt = (n: number) => Math.round(n).toLocaleString();
const modeName = (m: ModeId) => ({ quickplay: 'Quickplay', accountRanked: 'Account Ranked', seasonalRanked: 'Seasonal Ranked', tournament: 'Tournament', league: 'League Mode' }[m]);

const RIVALS: { name: string; style: StyleId; weapon: WeaponId; character: CharacterId; quote: string }[] = [
  { name: 'Ghost Pike', style: 'mirror', weapon: 'spear', character: 'rogueReaper', quote: 'I already know your next move.' },
  { name: 'Chrome Fang', style: 'rusher', weapon: 'daggers', character: 'blitz', quote: 'Back up. I dare you.' },
  { name: 'Hollow Pulse', style: 'zoner', weapon: 'energyStaff', character: 'kairo', quote: 'Your lane belongs to me.' },
  { name: 'Nova Vale', style: 'adaptiveAnalyzer', weapon: 'bow', character: 'ace', quote: 'Patterns always surface.' },
  { name: 'Rex Calder', style: 'hyperAggro', weapon: 'hammer', character: 'coreBreaker', quote: 'The round ends when I get close.' },
  { name: 'Vanta Cross', style: 'antiMeta', weapon: 'chainWhip', character: 'scarlet', quote: 'Popular does not mean safe.' }
];

interface TournamentState { round: number; wins: number; active: boolean; opponent: string; }

export class AdaptiveArenaApp {
  private root: HTMLElement;
  private profile: ProfileSave;
  private audio: AudioManager;
  private game: ArenaGame | null = null;
  private currentMode: ModeId = 'quickplay';
  private lastMatchConfig: { mode: ModeId; difficulty: Difficulty } | null = null;
  private tournament: TournamentState = { round: 1, wins: 0, active: false, opponent: '' };
  private navSection = 'home';
  private navTab = '';
  private weaponView: 'quick' | 'full' = 'quick';
  private arenaDetailsId = ARENAS[0].id;
  private statTab = 'overview';
  private leagueTab = 'hub';
  private profileTab = 'stats';
  private extrasTab = 'settings';
  private metaScope = 'combined';

  constructor(root: HTMLElement) {
    this.root = root;
    this.profile = loadProfile();
    this.audio = new AudioManager(this.profile);
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('change', this.onChange);
    this.root.addEventListener('input', this.onInput);
    this.renderHome();
  }

  private onClick = (ev: Event) => {
    const target = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;
    const action = target.dataset.action ?? '';
    this.audio.ui('click');
    if (action === 'home') return this.renderHome();
    if (action === 'section') return this.renderSection(target.dataset.section ?? 'play');
    if (action === 'play-tab') { this.navTab = target.dataset.tab ?? 'quickplay'; return this.renderPlay(); }
    if (action === 'collection-tab') { this.navTab = target.dataset.tab ?? 'weapons'; return this.renderCollection(); }
    if (action === 'profile-tab') { this.profileTab = target.dataset.tab ?? 'stats'; return this.renderProfile(); }
    if (action === 'league-tab') { this.leagueTab = target.dataset.tab ?? 'hub'; return this.renderLeague(); }
    if (action === 'extras-tab') { this.extrasTab = target.dataset.tab ?? 'settings'; return this.renderExtras(); }
    if (action === 'start-match') return this.startMatch((target.dataset.mode ?? 'quickplay') as ModeId, (target.dataset.difficulty ?? this.profile.quickplayDifficulty) as Difficulty);
    if (action === 'next-match') return this.startMatch(this.lastMatchConfig?.mode ?? 'quickplay', this.lastMatchConfig?.difficulty ?? 'Medium');
    if (action === 'select-weapon') { this.profile.selectedWeapon = target.dataset.weapon as WeaponId; saveProfile(this.profile); this.audio.ui('confirm'); return this.renderCollection(); }
    if (action === 'select-character') { this.profile.selectedCharacter = target.dataset.character as CharacterId; saveProfile(this.profile); this.audio.ui('confirm'); return this.renderCollection(); }
    if (action === 'select-arena') { const id = target.dataset.arena ?? ARENAS[0].id; const arena = arenaById(id); if (!arenaUnlocked(arena, this.profile.accountRp)) return this.audio.ui('error'); this.profile.selectedArenaId = id; this.arenaDetailsId = id; saveProfile(this.profile); this.audio.ui('confirm'); return this.renderCollection(); }
    if (action === 'arena-details') { this.arenaDetailsId = target.dataset.arena ?? ARENAS[0].id; return this.renderCollection(); }
    if (action === 'weapon-view') { this.weaponView = target.dataset.view === 'full' ? 'full' : 'quick'; return this.renderCollection(); }
    if (action === 'stat-tab') { this.statTab = target.dataset.tab ?? 'overview'; return this.renderStats(); }
    if (action === 'simulate-week') { this.simulateLeagueWeek(); return this.renderLeague(); }
    if (action === 'start-league-match') return this.startMatch('league', 'Hard');
    if (action === 'tournament-start') { this.tournament = { round: 1, wins: 0, active: true, opponent: randomAiName() }; return this.startMatch('tournament', 'Hard'); }
    if (action === 'save-settings') { saveProfile(this.profile); this.audio.updateProfile(this.profile); this.audio.ui('confirm'); return this.renderExtras(); }
    if (action === 'reset-profile') { if (confirm('Reset this Adaptive Arena profile and all local progression?')) { localStorage.removeItem('adaptive-arena-profile-v1'); location.reload(); } return; }
    if (action === 'buy-cosmetic') return this.buyCosmetic(target.dataset.item ?? '', Number(target.dataset.cost ?? 0));
    if (action === 'balance-save') { this.saveBalanceOverrides(); return this.renderLeague(); }
  };

  private onChange = (ev: Event) => {
    const el = ev.target as HTMLInputElement | HTMLSelectElement;
    if (el.dataset.setting === 'difficulty') { this.profile.quickplayDifficulty = el.value as Difficulty; saveProfile(this.profile); }
    if (el.dataset.setting === 'username') { this.profile.username = el.value.trim().slice(0, 24) || 'Player'; saveProfile(this.profile); }
    if (el.dataset.setting === 'arena-filter') this.renderCollection(el.value);
  };

  private onInput = (ev: Event) => {
    const el = ev.target as HTMLInputElement;
    const key = el.dataset.volume;
    if (key) {
      const value = Number(el.value) / 100;
      if (key === 'master') this.profile.settings.masterVolume = value;
      if (key === 'music') this.profile.settings.musicVolume = value;
      if (key === 'sfx') this.profile.settings.sfxVolume = value;
      if (key === 'ui') this.profile.settings.uiVolume = value;
      if (key === 'ambience') this.profile.settings.ambienceVolume = value;
      this.audio.updateProfile(this.profile);
    }
    if (el.dataset.mute === 'true') { this.profile.settings.mute = el.checked; this.audio.updateProfile(this.profile); }
  };

  private shell(content: string, section = '') {
    const { rank, seasonalRank } = profileSummary(this.profile);
    this.root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <button class="brand" data-action="home"><span class="brand-mark">AA</span><span><b>Adaptive Arena</b><small>Competitive Simulation Combat</small></span></button>
          <div class="top-stats"><span>${esc(this.profile.username)}</span><span>${rank.name} • ${fmt(this.profile.accountRp)} RP</span><span>Seasonal ${seasonalRank.name}</span><span>${fmt(this.profile.credits)} credits</span></div>
        </header>
        <nav class="main-nav">
          ${this.navButton('play','Play', section)}${this.navButton('collection','Collection', section)}${this.navButton('league','League', section)}${this.navButton('profile','Profile', section)}${this.navButton('extras','Extras', section)}
        </nav>
        <main class="page">${content}</main>
      </div>`;
    if (section !== 'match') this.audio.menuMusic();
  }

  private navButton(id: string, label: string, active: string) { return `<button data-action="section" data-section="${id}" class="nav-btn ${active === id ? 'active' : ''}">${label}</button>`; }
  private subnav(items: { id: string; label: string }[], active: string, action: string) { return `<div class="subnav">${items.map(i => `<button class="${active === i.id ? 'active' : ''}" data-action="${action}" data-tab="${i.id}">${i.label}</button>`).join('')}</div>`; }

  renderHome() {
    this.navSection = 'home'; this.audio.menuMusic();
    const { rank, next, seasonalRank } = profileSummary(this.profile); const char = CHARACTERS[this.profile.selectedCharacter]; const weapon = WEAPONS[this.profile.selectedWeapon];
    const recent = this.profile.matchHistory.slice(0, 4);
    this.shell(`
      <section class="home-grid">
        <article class="panel identity-panel">
          <div class="eyebrow">SELECTED FIGHTER</div>
          <div class="fighter-preview"><div class="fighter-orb" style="--char:${char.color};--accent:${char.accent}">${char.name.slice(0,2).toUpperCase()}</div><div><h2>${char.name}</h2><p>${char.abilityName}</p><strong>${weapon.name}</strong></div></div>
          <div class="mini-grid"><div><small>USERNAME</small><b>${esc(this.profile.username)}</b></div><div><small>CREDITS</small><b>${fmt(this.profile.credits)}</b></div><div><small>ACCOUNT RANK</small><b>${rank.name}</b></div><div><small>MATCHES</small><b>${this.profile.stats.matches}</b><small>${this.profile.stats.matches ? Math.round(this.profile.stats.wins / this.profile.stats.matches * 100) : 0}% WIN</small></div></div>
        </article>
        <article class="panel hero-panel"><div class="eyebrow">NEON 1V1 ARENA</div><button class="hero-play" data-action="section" data-section="play">Play</button><div class="chips"><span>${rank.name} — ${fmt(this.profile.accountRp)}${next ? ` / ${fmt(next.rp)} RP` : ''}</span><span>${weapon.name}</span><span>${arenaById(this.profile.selectedArenaId).name}</span></div><div class="home-feature"><h3>Featured Mode</h3><p>Account Ranked: permanent RP stakes against adaptive AI, rivals, arena pressure, and mastery progression.</p></div><div class="home-feature"><h3>Seasonal Sprint</h3><p>${seasonalRank.name} • ${fmt(this.profile.seasonal.rp)} Seasonal RP • ${this.seasonDaysLeft()}</p></div></article>
        <article class="panel nav-panel"><div class="eyebrow">QUICK ACCESS</div>${this.homeQuick('play','Play','Ranked, Seasonal, Quickplay, Tournament')}${this.homeQuick('collection','Collection','Weapons, Characters, Mastery, Arenas')}${this.homeQuick('league','League','Standings, Schedule, Simcast, Balance Lab')}${this.homeQuick('profile','Profile','Stats, Rivals, Replays, Meta')}${this.homeQuick('extras','Extras','Settings, Controls, Systems, Notes')}</article>
        <article class="panel activity-panel"><div class="section-head"><div><div class="eyebrow">RECENT ACTIVITY</div><h2>Last Matches</h2></div><button data-action="section" data-section="profile">View Profile</button></div>${recent.length ? `<div class="history-list">${recent.map(m => this.historyRow(m)).join('')}</div>` : '<div class="empty">Play your first match to begin building Adaptive Arena history.</div>'}</article>
        <article class="panel news-panel"><div class="eyebrow">LEAGUE PULSE</div><h2>${esc(this.profile.league.news[0] ?? 'League opening week')}</h2><p>${this.profile.league.teams.slice().sort((a,b)=>b.wins-a.wins)[0]?.name ?? 'Haven Sentinels'} currently leads the simulated ecosystem.</p><button data-action="section" data-section="league">Open League</button></article>
      </section>`, 'home');
  }

  private homeQuick(section: string, label: string, desc: string) { return `<button class="quick-nav" data-action="section" data-section="${section}"><b>${label}</b><small>${desc}</small></button>`; }

  private renderSection(section: string) {
    this.navSection = section;
    if (section === 'play') return this.renderPlay();
    if (section === 'collection') return this.renderCollection();
    if (section === 'league') return this.renderLeague();
    if (section === 'profile') return this.renderProfile();
    return this.renderExtras();
  }

  private renderPlay() {
    if (!this.navTab) this.navTab = 'quickplay';
    const tabs = [{id:'quickplay',label:'Quickplay'},{id:'accountRanked',label:'Account Ranked'},{id:'seasonalRanked',label:'Seasonal Ranked'},{id:'tournament',label:'Tournament'}];
    const content = this.navTab === 'quickplay' ? this.quickplayPanel() : this.navTab === 'accountRanked' ? this.accountRankedPanel() : this.navTab === 'seasonalRanked' ? this.seasonalPanel() : this.tournamentPanel();
    this.shell(`<div class="page-head"><div><div class="eyebrow">PLAY</div><h1>Choose Mode</h1><p>One hub for casual practice, permanent ranked progression, seasonal competition, and tournaments.</p></div></div>${this.subnav(tabs,this.navTab,'play-tab')}<section class="mode-layout">${content}<aside class="panel recent-panel"><div class="eyebrow">RECENT MATCH HISTORY</div>${this.profile.matchHistory.slice(0,5).map(m=>this.historyRow(m)).join('') || '<div class="empty">No matches yet.</div>'}</aside></section>`, 'play');
  }

  private quickplayPanel() {
    return `<article class="panel mode-card feature-card"><div class="mode-icon">▶</div><h2>Quickplay</h2><p>Casual BO3 combat with selectable AI difficulty. No RP risk; lowest credit rate.</p><label>AI Difficulty<select data-setting="difficulty">${(['Easy','Medium','Hard','Pro','Master'] as Difficulty[]).map(d=>`<option ${this.profile.quickplayDifficulty===d?'selected':''}>${d}</option>`).join('')}</select></label><div class="mode-facts"><span>Arena: ${arenaById(this.profile.selectedArenaId).name}</span><span>Credits: casual rate</span></div><button class="primary" data-action="start-match" data-mode="quickplay" data-difficulty="${this.profile.quickplayDifficulty}">Start Quickplay</button></article>`;
  }

  private accountRankedPanel() {
    const rank = rankForRp(this.profile.accountRp), next = nextRankForRp(this.profile.accountRp); const progress = next ? (this.profile.accountRp-rank.rp)/(next.rp-rank.rp) : 1;
    const diff = this.rankDifficulty(this.profile.accountRp);
    return `<article class="panel mode-card feature-card ranked"><div class="mode-icon">▥</div><h2>Account Ranked</h2><p>Permanent progression. No loss protection. Demotions are possible, and Zenith is built as a months-long grind.</p><div class="rank-card"><div><small>CURRENT RANK</small><h3>${rank.name}</h3></div><b>${fmt(this.profile.accountRp)} RP</b><div class="progress"><i style="width:${progress*100}%"></i></div><small>${next ? `${fmt(next.rp-this.profile.accountRp)} RP to ${next.name}` : 'ZENITH'}</small></div><div class="mode-facts"><span>Opponent tier: ${diff}</span><span>Streak: ${this.profile.stats.streak}</span></div><button class="primary" data-action="start-match" data-mode="accountRanked" data-difficulty="${diff}">Start Account Ranked</button></article>`;
  }

  private seasonalPanel() {
    const rank = rankForRp(this.profile.seasonal.rp), next = nextRankForRp(this.profile.seasonal.rp), progress = next ? (this.profile.seasonal.rp-rank.rp)/(next.rp-rank.rp) : 1, diff = this.rankDifficulty(this.profile.seasonal.rp);
    return `<article class="panel mode-card feature-card seasonal"><div class="mode-icon">◫</div><h2>Seasonal Ranked</h2><p>45-day competitive sprint. Separate Seasonal RP. AI health normalized to 150 HP. Character abilities remain core gameplay.</p><div class="rank-card"><div><small>SEASON ${this.profile.seasonal.seasonNumber}</small><h3>${rank.name}</h3></div><b>${fmt(this.profile.seasonal.rp)} RP</b><div class="progress"><i style="width:${progress*100}%"></i></div><small>${next ? `${fmt(next.rp-this.profile.seasonal.rp)} RP to ${next.name}` : 'ZENITH'} • ${this.seasonDaysLeft()}</small></div><div class="mode-facts"><span>${this.profile.seasonal.wins}-${this.profile.seasonal.losses} record</span><span>Best streak ${this.profile.seasonal.bestStreak}</span></div><button class="primary" data-action="start-match" data-mode="seasonalRanked" data-difficulty="${diff}">Play Seasonal Ranked</button></article>`;
  }

  private tournamentPanel() {
    const status = this.tournament.active ? `Round ${this.tournament.round} • ${this.tournament.wins} wins` : 'No active bracket';
    return `<article class="panel mode-card feature-card"><div class="mode-icon bracket-icon"><span></span><span></span><span></span></div><h2>Tournament</h2><p>32-fighter single-elimination bracket. Win five BO3 matches to become champion.</p><div class="rank-card"><small>BRACKET STATUS</small><h3>${status}</h3></div><div class="mode-facts"><span>5 rounds</span><span>Third-highest credit rate</span></div><button class="primary" data-action="tournament-start">${this.tournament.active ? 'Continue Tournament' : 'Tournament Setup'}</button></article>`;
  }

  private renderCollection(filter = 'All') {
    if (!this.navTab || !['weapons','characters','mastery','arenas','cosmetics'].includes(this.navTab)) this.navTab = 'weapons';
    const tabs = [{id:'weapons',label:'Weapons'},{id:'characters',label:'Characters'},{id:'mastery',label:'Mastery'},{id:'arenas',label:'Arenas'},{id:'cosmetics',label:'Cosmetics'}];
    let content = '';
    if (this.navTab === 'weapons') content = this.weaponScreen();
    else if (this.navTab === 'characters') content = this.characterScreen();
    else if (this.navTab === 'mastery') content = this.masteryScreen();
    else if (this.navTab === 'arenas') content = this.arenaScreen(filter);
    else content = this.cosmeticsScreen();
    this.shell(`<div class="page-head"><div><div class="eyebrow">COLLECTION</div><h1>${tabs.find(t=>t.id===this.navTab)?.label}</h1><p>Combat identity, mastery, arenas, and cosmetic progression. No permanent power upgrades.</p></div></div>${this.subnav(tabs,this.navTab,'collection-tab')}${content}`, 'collection');
  }

  private weaponScreen() {
    const current = this.profile.selectedWeapon;
    return `<div class="toolbar"><div class="segmented"><button class="${this.weaponView==='quick'?'active':''}" data-action="weapon-view" data-view="quick">Quick View</button><button class="${this.weaponView==='full'?'active':''}" data-action="weapon-view" data-view="full">Full View</button></div><span>${WEAPONS[current].name} selected</span></div>${this.weaponView === 'quick' ? `<div class="weapon-grid">${Object.values(WEAPONS).map(w=>`<article class="panel weapon-card ${current===w.id?'selected':''}"><div class="weapon-art weapon-${w.id}">${this.weaponSvg(w.id)}</div><h2>${w.name}</h2><p>${w.role}</p><div class="chips"><span>${w.kind}</span><span>${w.difficulty}</span></div><button data-action="select-weapon" data-weapon="${w.id}" class="${current===w.id?'active':''}">${current===w.id?'Active':'Select'}</button></article>`).join('')}</div>` : `<div class="weapon-full-list">${Object.values(WEAPONS).map(w=>this.weaponFullCard(w.id)).join('')}</div>`}`;
  }

  private weaponFullCard(id: WeaponId) {
    const w = WEAPONS[id], selected = this.profile.selectedWeapon===id;
    const resource = w.kind==='melee' ? `<div><small>Stamina Rating</small><b class="stat-mid">${w.staminaRating}</b></div><div><small>Attack Cost</small><b>${w.staminaCost}</b></div><div><small>Full Regen</small><b>${w.staminaFullRegen}s</b></div>` : `<div><small>Magazine</small><b class="stat-mid">${w.magSize}</b></div><div><small>Reload</small><b>${w.reloadTime}s</b></div><div><small>Projectile Speed</small><b class="stat-high">${w.projectileSpeed}</b></div>`;
    return `<article class="panel weapon-detail ${selected?'selected':''}"><div class="weapon-art large weapon-${w.id}">${this.weaponSvg(w.id)}</div><div class="weapon-detail-body"><div class="section-head"><div><h2>${w.name}</h2><p>${w.role} • ${w.metaRole}</p></div><button data-action="select-weapon" data-weapon="${w.id}">${selected?'Active':'Select'}</button></div><div class="stat-grid"><div><small>Basic Damage</small><b class="stat-high">${w.basicDamage}</b></div><div><small>Special Damage</small><b class="stat-high">${w.specialDamage}</b></div><div><small>Range</small><b class="stat-high">${w.range} tiles</b></div><div><small>Attack Speed</small><b class="stat-high">${w.attacksPerSecond}/s</b></div>${resource}<div><small>Crit Chance</small><b>${Math.round(w.critChance*100)}%</b></div><div><small>Crit Damage</small><b>${w.critMultiplier}×</b></div><div><small>Special Cooldown</small><b>${w.specialCooldown}s</b></div></div><div class="strength-row"><span class="positive">Strength: ${w.strength}</span><span class="negative">Weakness: ${w.weakness}</span></div></div></article>`;
  }

  private weaponSvg(id: WeaponId) {
    const c = WEAPONS[id].color;
    if (id==='hammer') return `<svg viewBox="0 0 180 80"><g stroke="${c}" stroke-width="10" stroke-linecap="round"><path d="M40 62L105 25"/><rect x="94" y="10" width="55" height="28" rx="4" fill="${c}"/></g></svg>`;
    if (id==='daggers') return `<svg viewBox="0 0 180 80"><g stroke="${c}" stroke-width="7" stroke-linecap="round"><path d="M42 62L118 18"/><path d="M64 68L140 25"/></g></svg>`;
    if (id==='sword') return `<svg viewBox="0 0 180 80"><g stroke="${c}" stroke-width="8" stroke-linecap="round"><path d="M35 65L135 15"/><path d="M52 66L68 50"/></g></svg>`;
    if (id==='spear') return `<svg viewBox="0 0 180 80"><path d="M25 60L145 20" stroke="${c}" stroke-width="6"/><path d="M145 20L126 15L136 34Z" fill="${c}"/></svg>`;
    if (id==='chainWhip') return `<svg viewBox="0 0 180 80"><path d="M25 48 C55 12, 85 68, 112 32 S150 22,160 48" fill="none" stroke="${c}" stroke-width="6" stroke-dasharray="9 5"/></svg>`;
    if (id==='bow') return `<svg viewBox="0 0 180 80"><path d="M105 10 Q145 40 105 70 M105 10L105 70 M35 40L130 40" fill="none" stroke="${c}" stroke-width="6"/></svg>`;
    if (id==='blaster') return `<svg viewBox="0 0 180 80"><path d="M35 28H125L148 40L125 52H35Z" fill="${c}"/><rect x="60" y="50" width="25" height="18" rx="3" fill="${c}" opacity=".7"/><circle cx="145" cy="40" r="8" fill="#fff"/></svg>`;
    return `<svg viewBox="0 0 180 80"><path d="M32 50L130 30" stroke="${c}" stroke-width="8" stroke-linecap="round"/><circle cx="140" cy="28" r="13" fill="none" stroke="${c}" stroke-width="5"/></svg>`;
  }

  private characterScreen() {
    return `<div class="character-grid">${Object.values(CHARACTERS).map(ch=>{const m=characterMasteryProgress(this.profile,ch.id); return `<article class="panel character-card ${this.profile.selectedCharacter===ch.id?'selected':''}"><div class="character-avatar" style="--char:${ch.color};--accent:${ch.accent}">${ch.name.slice(0,2).toUpperCase()}</div><div><div class="section-head"><h2>${ch.name}</h2><span>Lv ${m.level}</span></div><h3>${ch.abilityName}</h3><p>${ch.abilitySummary}</p><button data-action="select-character" data-character="${ch.id}">${this.profile.selectedCharacter===ch.id?'Active':'Select'}</button></div></article>`}).join('')}</div>`;
  }

  private masteryScreen() {
    const chars = Object.values(CHARACTERS).sort((a,b)=>characterMasteryProgress(this.profile,b.id).level-characterMasteryProgress(this.profile,a.id).level);
    const weapons = Object.values(WEAPONS).sort((a,b)=>weaponMasteryProgress(this.profile,b.id).level-weaponMasteryProgress(this.profile,a.id).level);
    return `<section class="mastery-layout"><article class="panel"><div class="section-head"><div><div class="eyebrow">CHARACTER MASTERY</div><h2>Level 100 Mastered • Infinite Levels After</h2></div></div><div class="mastery-list">${chars.map(c=>{const m=characterMasteryProgress(this.profile,c.id);return `<div class="mastery-row"><span class="dot" style="background:${c.accent}"></span><b>${c.name}</b><span>Lv ${m.level}</span><span>${m.matches} matches</span><span>${m.wins} wins</span><em>${m.level>=100?'MASTERED':'Cosmetic progression'}</em></div>`}).join('')}</div></article><article class="panel"><div class="section-head"><div><div class="eyebrow">WEAPON MASTERY</div><h2>Level 250 Mastered • Infinite Levels After</h2></div></div><div class="mastery-list">${weapons.map(w=>{const m=weaponMasteryProgress(this.profile,w.id);return `<div class="mastery-row"><span class="dot" style="background:${w.color}"></span><b>${w.name}</b><span>Lv ${m.level}</span><span>${m.matches} matches</span><span>${m.wins} wins</span><em>${m.level>=250?'MASTERED':'Skins • badges • titles'}</em></div>`}).join('')}</div></article></section>`;
  }

  private arenaScreen(filter: string) {
    const selected = this.profile.selectedArenaId, details = arenaById(this.arenaDetailsId);
    const filtered = ARENAS.filter(a=>filter==='All'||a.tier===filter||(filter==='Unlocked'&&arenaUnlocked(a,this.profile.accountRp))||(filter==='Locked'&&!arenaUnlocked(a,this.profile.accountRp)));
    return `<div class="toolbar"><label>Filter<select data-setting="arena-filter"><option>All</option>${['Practice','Easy','Medium','Hard','Pro','Extreme','Unlocked','Locked'].map(v=>`<option ${filter===v?'selected':''}>${v}</option>`).join('')}</select></label><span>${ARENAS.filter(a=>arenaUnlocked(a,this.profile.accountRp)).length}/16 unlocked</span></div><section class="arena-layout"><div class="arena-grid">${filtered.map(a=>`<article class="panel arena-card ${selected===a.id?'selected':''} ${!arenaUnlocked(a,this.profile.accountRp)?'locked':''}"><div class="arena-preview" style="--base:${a.baseColor};--accent:${a.accentColor}">${this.arenaPreview(a)}</div><div class="section-head"><h3>${a.name}</h3><span class="tier ${a.tier.toLowerCase()}">${a.tier}</span></div><div class="chips"><span>${a.pressure}/10 pressure</span><span>${a.hazards.reduce((s,h)=>s+h.count,0)} hazards</span></div><p>${a.tagline}</p><div class="card-actions"><button data-action="arena-details" data-arena="${a.id}">Details</button><button data-action="select-arena" data-arena="${a.id}" ${!arenaUnlocked(a,this.profile.accountRp)?'disabled':''}>${selected===a.id?'Selected':arenaUnlocked(a,this.profile.accountRp)?'Select':`Unlock ${a.unlockRank}`}</button></div></article>`).join('')}</div>${this.arenaDetails(details)}</section>`;
  }

  private arenaPreview(a: (typeof ARENAS)[number]) { return `<svg viewBox="0 0 240 80"><rect width="240" height="80" rx="8" fill="${a.baseColor}"/><g stroke="${a.accentColor}" opacity=".35">${Array.from({length:8},(_,i)=>`<path d="M${i*30} 0V80"/>`).join('')}${Array.from({length:4},(_,i)=>`<path d="M0 ${i*20}H240"/>`).join('')}</g>${a.hazards.slice(0,6).map((h,i)=>`<circle cx="${28+i*36}" cy="${25+(i%2)*28}" r="${7+Math.min(h.count,5)}" fill="${a.accentColor}" opacity=".45"/>`).join('')}</svg>`; }

  private arenaDetails(a: (typeof ARENAS)[number]) {
    const unlocked=arenaUnlocked(a,this.profile.accountRp); return `<aside class="panel arena-details"><div class="eyebrow">ARENA DETAILS</div><h2>${a.name}</h2><p>${a.tagline}</p><div class="chips"><span class="tier ${a.tier.toLowerCase()}">${a.tier}</span><span>${a.pressure}/10 pressure</span><span>${a.widthTiles}×${a.heightTiles} tiles</span><span>${unlocked?'Unlocked':`Unlock ${a.unlockRank}`}</span></div><div class="detail-grid"><div><small>Mechanic</small><b>${a.mechanic}</b></div><div><small>Theme</small><b>${a.theme}</b></div><div><small>AI Awareness</small><b>Adaptive routing uses warnings, slow zones, barriers, and safe-lane pressure.</b></div><div><small>Moving Walls</small><b>${a.hazards.find(h=>h.type==='movingWall')?.count ?? 0}</b></div></div><h3>Hazards</h3><div class="hazard-list">${a.hazards.map(h=>`<span>${h.type} ×${h.count}</span>`).join('')}</div><button class="primary" data-action="select-arena" data-arena="${a.id}" ${!unlocked?'disabled':''}>${this.profile.selectedArenaId===a.id?'Active Arena':unlocked?'Select Arena':`Unlocks at ${a.unlockRank}`}</button></aside>`;
  }

  private cosmeticsScreen() {
    const items = [
      ['Rare Profile Banner','banner-rare',2500,'Rare'],['Legendary Character Skin Token','skin-legendary',12000,'Legendary'],['Mythic Voice Line Pack','voice-mythic',18000,'Mythic'],['Relic Match Card Frame','frame-relic',30000,'Relic'],['Rare Profile Icon','icon-rare',1800,'Rare'],['Legendary Victory Animation','victory-legendary',14000,'Legendary']
    ];
    return `<div class="section-head"><div><h2>Cosmetic Store</h2><p>Credits buy identity, never combat power.</p></div><b>${fmt(this.profile.credits)} credits</b></div><div class="cosmetic-grid">${items.map(([name,id,cost,rarity])=>`<article class="panel cosmetic-card rarity-${String(rarity).toLowerCase()}"><div class="cosmetic-art">${String(rarity).slice(0,1)}</div><small>${rarity}</small><h3>${name}</h3><button data-action="buy-cosmetic" data-item="${id}" data-cost="${cost}">${fmt(Number(cost))} Credits</button></article>`).join('')}</div>`;
  }

  private buyCosmetic(item: string, cost: number) {
    const key='adaptive-arena-cosmetics'; const owned=JSON.parse(localStorage.getItem(key)??'[]') as string[];
    if (owned.includes(item)) return this.audio.ui('error'); if (this.profile.credits<cost) return this.audio.ui('error'); this.profile.credits-=cost; owned.push(item); localStorage.setItem(key,JSON.stringify(owned)); saveProfile(this.profile); this.audio.ui('unlock'); this.renderCollection();
  }

  private renderProfile() {
    const tabs=[{id:'stats',label:'Stats'},{id:'rivals',label:'Rivals'},{id:'replays',label:'Replays'},{id:'ratings',label:'Weapon Skill Ratings'},{id:'meta',label:'Meta'},{id:'styles',label:'Combat Styles'},{id:'profiles',label:'Profiles'}];
    let body=''; if(this.profileTab==='stats') body=this.statsScreen(); else if(this.profileTab==='rivals') body=this.rivalsScreen(); else if(this.profileTab==='replays') body=this.replaysScreen(); else if(this.profileTab==='ratings') body=this.ratingsScreen(); else if(this.profileTab==='meta') body=this.metaScreen(); else if(this.profileTab==='styles') body=this.stylesScreen(); else body=this.profilesScreen();
    this.shell(`<div class="page-head"><div><div class="eyebrow">PROFILE</div><h1>${tabs.find(t=>t.id===this.profileTab)?.label}</h1></div></div>${this.subnav(tabs,this.profileTab,'profile-tab')}${body}`,'profile');
  }

  private renderStats(){ this.shell(`<div class="page-head"><div><div class="eyebrow">PROFILE</div><h1>Stats</h1></div></div>${this.subnav([{id:'stats',label:'Stats'},{id:'rivals',label:'Rivals'},{id:'replays',label:'Replays'},{id:'ratings',label:'Weapon Skill Ratings'},{id:'meta',label:'Meta'},{id:'styles',label:'Combat Styles'},{id:'profiles',label:'Profiles'}],this.profileTab,'profile-tab')}${this.statsScreen()}`,'profile'); }
  private statsScreen() {
    const s=this.profile.stats, win=s.matches?s.wins/s.matches:0, rank=rankForRp(this.profile.accountRp), sr=rankForRp(this.profile.seasonal.rp); const favorite=this.favoriteWeapon();
    const tabs=[['overview','Overview'],['ranked','Ranked'],['combat','Combat'],['economy','Economy'],['advanced','Advanced']];
    const common=`<div class="segmented stat-tabs">${tabs.map(([id,l])=>`<button data-action="stat-tab" data-tab="${id}" class="${this.statTab===id?'active':''}">${l}</button>`).join('')}</div>`;
    let body='';
    if(this.statTab==='overview') body=`<div class="stats-feature-grid">${this.statCard('Account Rank',rank.name,`${fmt(this.profile.accountRp)} RP`,'primary')}${this.statCard('Seasonal Rank',sr.name,`${fmt(this.profile.seasonal.rp)} RP`,'seasonal')}${this.statCard('Win Rate',pct(win),`${s.wins}-${s.losses} record`,'positive')}${this.statCard('Matches',s.matches,`${s.roundsWon}-${s.roundsLost} rounds`)}${this.statCard('Current Streak',s.streak,`Best ${s.bestStreak}`)}${this.statCard('Favorite Weapon',WEAPONS[favorite].name,`${this.profile.weaponMastery[favorite].matches} uses`)}${this.statCard('Character',CHARACTERS[this.profile.selectedCharacter].name,`Lv ${characterMasteryProgress(this.profile,this.profile.selectedCharacter).level}`)}${this.statCard('Avg Damage',s.matches?Math.round(s.totalDamage/s.matches):0,'per match')}</div>`;
    else if(this.statTab==='ranked') body=`<div class="stats-feature-grid">${this.statCard('Account Rank',rank.name,`${fmt(this.profile.accountRp)} RP`,'primary')}${this.statCard('Next Rank',nextRankForRp(this.profile.accountRp)?.name??'Zenith',nextRankForRp(this.profile.accountRp)?`${fmt(nextRankForRp(this.profile.accountRp)!.rp-this.profile.accountRp)} RP needed`:'Maximum rank')}${this.statCard('Seasonal Rank',sr.name,`${fmt(this.profile.seasonal.rp)} Seasonal RP`,'seasonal')}${this.statCard('Season Ends',this.seasonDaysLeft(),`Season ${this.profile.seasonal.seasonNumber}`)}${this.statCard('Season Record',`${this.profile.seasonal.wins}-${this.profile.seasonal.losses}`,`${this.profile.seasonal.wins+this.profile.seasonal.losses?Math.round(this.profile.seasonal.wins/(this.profile.seasonal.wins+this.profile.seasonal.losses)*100):0}% win`)}${this.statCard('Season Peak',rankForRp(this.profile.seasonal.peakRp).name,`${fmt(this.profile.seasonal.peakRp)} RP`)}</div>`;
    else if(this.statTab==='combat') body=`<div class="stats-feature-grid">${this.statCard('Favorite Weapon',WEAPONS[favorite].name,`${this.profile.weaponMastery[favorite].matches} matches`)}${this.statCard('Selected Character',CHARACTERS[this.profile.selectedCharacter].name,`Lv ${this.profile.characterMastery[this.profile.selectedCharacter].level}`)}${this.statCard('Selected Arena',arenaById(this.profile.selectedArenaId).name,arenaById(this.profile.selectedArenaId).tier)}${this.statCard('Total Damage',fmt(s.totalDamage),`${s.matches?Math.round(s.totalDamage/s.matches):0} avg`)}${this.statCard('Rounds Won',s.roundsWon,`${s.roundsLost} lost`)}${this.statCard('Best Streak',s.bestStreak,'matches')}</div>`;
    else if(this.statTab==='economy') body=`<div class="stats-feature-grid">${this.statCard('Credits',fmt(this.profile.credits),'available','positive')}${this.statCard('Credits Earned',fmt(s.creditsEarned),'lifetime')}${this.statCard('Average / Match',s.matches?Math.round(s.creditsEarned/s.matches):0,'credits')}${this.statCard('League Credits',0,'League never awards credits')}</div>`;
    else body=`<div class="stats-grid compact">${this.statCard('2-0 Wins',this.profile.matchHistory.filter(m=>m.won&&m.score==='2-0').length,'')}${this.statCard('2-1 Wins',this.profile.matchHistory.filter(m=>m.won&&m.score==='2-1').length,'')}${this.statCard('0-2 Losses',this.profile.matchHistory.filter(m=>!m.won&&m.score==='0-2').length,'')}${this.statCard('1-2 Losses',this.profile.matchHistory.filter(m=>!m.won&&m.score==='1-2').length,'')}${this.statCard('Hazard Damage Taken',fmt(s.hazardDamageTaken),'')}${this.statCard('Hazard Damage Dealt',fmt(s.hazardDamageDealt),'')}${this.statCard('Round 3 Matches',this.profile.matchHistory.filter(m=>m.score==='2-1'||m.score==='1-2').length,'')}</div>`;
    return `${common}${body}`;
  }

  private statCard(label:string,value:string|number,sub:string,cls=''){return `<article class="panel stat-card ${cls}"><small>${label}</small><b>${value}</b>${sub?`<span>${sub}</span>`:''}</article>`;}

  private rivalsScreen(){return `<div class="rival-grid">${RIVALS.map(r=>{const games=this.profile.matchHistory.filter(m=>m.opponent===r.name),wins=games.filter(m=>m.won).length;return `<article class="panel rival-card" style="--rival:${STYLE_CONFIGS[r.style].color}"><div class="eyebrow">${STYLE_CONFIGS[r.style].name}</div><h2>${r.name}</h2><p>“${r.quote}”</p><div class="chips"><span>${WEAPONS[r.weapon].name}</span><span>${CHARACTERS[r.character].name}</span><span>${wins}-${games.length-wins} H2H</span></div><p>${STYLE_CONFIGS[r.style].summary}</p></article>`}).join('')}</div>`;}
  private replaysScreen(){return `<article class="panel"><div class="section-head"><div><h2>Match Archive</h2><p>Every completed match stores a result snapshot; live matches include a final-hit replay sequence.</p></div></div><div class="history-list">${this.profile.matchHistory.slice(0,30).map(m=>this.historyRow(m)).join('')||'<div class="empty">No replays yet.</div>'}</div></article>`;}
  private ratingsScreen(){return `<div class="weapon-grid">${Object.values(WEAPONS).map(w=>{const m=weaponMasteryProgress(this.profile,w.id),rating=this.weaponSkillRating(w.id);return `<article class="panel weapon-card"><div class="weapon-art">${this.weaponSvg(w.id)}</div><h2>${w.name}</h2><div class="skill-rating"><b>${rating}/100</b><div class="progress"><i style="width:${rating}%"></i></div><small>${m.matches} matches • Lv ${m.level} mastery</small></div></article>`}).join('')}</div>`;}
  private weaponSkillRating(id:WeaponId){const m=this.profile.weaponMastery[id];if(!m.matches)return 0;const wr=m.wins/m.matches;let raw=Math.round(wr*58+Math.min(30,m.matches/8)+12);if(m.matches<10)return Math.min(25,raw);if(m.matches<25)return Math.min(40,raw);if(m.matches<50)return Math.min(60,raw);if(m.matches<100)return Math.min(75,raw);if(m.matches<250)return Math.min(99,raw);return Math.min(100,raw);}

  private metaScreen(){const rows=Object.values(WEAPONS).map(w=>{const ms=this.profile.matchHistory.filter(m=>m.weapon===w.id);const wins=ms.filter(m=>m.won).length;return {w,matches:ms.length,wr:ms.length?wins/ms.length:0,avg:ms.length?ms.reduce((s,m)=>s+m.damage,0)/ms.length:0}}).sort((a,b)=>b.matches-a.matches);return `<div class="toolbar"><div class="chips"><span>Player data</span><span>AI simulation-ready architecture</span><span>Combined meta</span></div></div><article class="panel table-panel"><table><thead><tr><th>Weapon</th><th>Usage</th><th>Win Rate</th><th>Avg Damage</th><th>Matches</th><th>Role</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${r.w.name}</b></td><td>${this.profile.stats.matches?Math.round(r.matches/this.profile.stats.matches*100):0}%</td><td>${Math.round(r.wr*100)}%</td><td>${Math.round(r.avg)}</td><td>${r.matches}</td><td>${r.w.metaRole}</td></tr>`).join('')}</tbody></table></article>`;}
  private stylesScreen(){return `<div class="style-grid">${Object.values(STYLE_CONFIGS).map(s=>`<article class="panel style-card" style="--style:${s.color}"><div class="style-sigil"></div><h2>${s.name}</h2><p>${s.summary}</p><div class="chips"><span>Aggression ${Math.round(s.aggression*100)}</span><span>Range ${s.preferredRange}</span><span>Awareness ${Math.round(s.hazardAwareness*100)}</span></div></article>`).join('')}</div>`;}
  private profilesScreen(){return `<section class="two-col"><article class="panel"><div class="eyebrow">CURRENT PROFILE</div><h2>${esc(this.profile.username)}</h2><label>Username<input data-setting="username" value="${esc(this.profile.username)}" maxlength="24"></label><p>Progress is saved locally in this browser and the codebase is backed by GitHub.</p></article><article class="panel danger-zone"><h2>Reset Profile</h2><p>Creates a fresh progression state, including fresh AI memory.</p><button data-action="reset-profile">Reset Local Profile</button></article></section>`;}

  private renderLeague(){const tabs=[{id:'hub',label:'League Hub'},{id:'standings',label:'Standings'},{id:'schedule',label:'Schedule'},{id:'simcast',label:'Simcast'},{id:'playoffs',label:'Playoffs'},{id:'history',label:'History'},{id:'balance',label:'Balance Lab'},{id:'news',label:'News'}];let body='';if(this.leagueTab==='hub')body=this.leagueHub();else if(this.leagueTab==='standings')body=this.leagueStandings();else if(this.leagueTab==='schedule')body=this.leagueSchedule();else if(this.leagueTab==='simcast')body=this.leagueSimcast();else if(this.leagueTab==='playoffs')body=this.leaguePlayoffs();else if(this.leagueTab==='history')body=this.leagueHistory();else if(this.leagueTab==='balance')body=this.balanceLab();else body=this.leagueNews();this.shell(`<div class="page-head"><div><div class="eyebrow">LEAGUE MODE</div><h1>${tabs.find(t=>t.id===this.leagueTab)?.label}</h1><p>Offline esports universe. League awards no credits.</p></div><button data-action="simulate-week">Simulate Week</button></div>${this.subnav(tabs,this.leagueTab,'league-tab')}${body}`,'league');}
  private leagueHub(){const sorted=this.sortedTeams(),hot=sorted[0];return `<div class="league-dashboard">${this.statCard('Week',this.profile.league.week,`Season ${this.profile.league.season}`,'primary')}${this.statCard('Hottest Team',hot.name,`${hot.wins}-${hot.losses}`,'positive')}${this.statCard('Damage Leader',sorted.slice().sort((a,b)=>b.damageFor-a.damageFor)[0].name,`${fmt(sorted.slice().sort((a,b)=>b.damageFor-a.damageFor)[0].damageFor)} total`)}${this.statCard('Top Weapon',this.metaTopWeapon().name,this.metaTopWeapon().metaRole,'seasonal')}</div><section class="two-col"><article class="panel"><div class="section-head"><h2>Standings Snapshot</h2><button data-action="league-tab" data-tab="standings">Full Standings</button></div>${this.standingsTable(sorted.slice(0,6))}</article><article class="panel"><div class="section-head"><h2>Breaking News</h2><button data-action="league-tab" data-tab="news">News Feed</button></div>${this.profile.league.news.slice(0,6).map(n=>`<div class="news-item">${esc(n)}</div>`).join('')}</article></section><button class="primary wide" data-action="start-league-match">Play Featured League Match</button>`;}
  private sortedTeams(){return this.profile.league.teams.slice().sort((a,b)=>b.wins-a.wins||(b.damageFor-b.damageAgainst)-(a.damageFor-a.damageAgainst));}
  private standingsTable(teams=this.sortedTeams()){return `<table><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>Damage</th><th>Diff</th></tr></thead><tbody>${teams.map((t,i)=>`<tr><td>${i+1}</td><td><b style="color:${t.color}">${t.name}</b></td><td>${t.wins}</td><td>${t.losses}</td><td>${fmt(t.damageFor)}</td><td>${fmt(t.damageFor-t.damageAgainst)}</td></tr>`).join('')}</tbody></table>`;}
  private leagueStandings(){return `<article class="panel table-panel">${this.standingsTable()}</article>`;}
  private leagueSchedule(){const date=new Date();return `<article class="panel"><h2>Week ${this.profile.league.week} Schedule</h2>${Array.from({length:6},(_,i)=>{const a=this.profile.league.teams[(i*2)%12],b=this.profile.league.teams[(i*2+1)%12];const d=new Date(date.getTime()+i*86400000);return `<div class="schedule-row"><span>${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span><b>${a.name}</b><span>vs</span><b>${b.name}</b><em>${i===0?'Featured matchup':''}</em></div>`}).join('')}</article>`;}
  private leagueSimcast(){return `<article class="panel"><div class="eyebrow">LIVE SIMULATION FEED</div><h2>Week ${this.profile.league.week}</h2><p>Simulate a week to produce matchup-driven results, damage totals, standings changes, and league news.</p><button class="primary" data-action="simulate-week">Run Simcast Week</button></article>`;}
  private leaguePlayoffs(){const top=this.sortedTeams().slice(0,8);return `<article class="panel playoff-panel"><div class="eyebrow">PLAYOFF PICTURE</div><h2>Top 8 Seeds</h2><div class="bracket-list">${top.map((t,i)=>`<div><span>${i+1}</span><b>${t.name}</b><em>${t.wins}-${t.losses}</em></div>`).join('')}</div><p>Playoffs lock after the regular-season schedule reaches its final week.</p></article>`;}
  private leagueHistory(){return `<section class="two-col"><article class="panel"><h2>Champions</h2>${this.profile.league.champions.length?this.profile.league.champions.map(c=>`<div class="news-item">Season ${c.season}: ${c.team}</div>`).join(''):'<div class="empty">No completed league seasons yet.</div>'}</article><article class="panel"><h2>Persistent Records</h2><p>Team records, damage totals, standings, and news survive across sessions. Future seasons can append champions and dynasty history without erasing prior seasons.</p></article></section>`;}

  private balanceLab(){return `<article class="panel"><div class="section-head"><div><div class="eyebrow">BALANCE LAB</div><h2>Authoritative Weapon Values</h2><p>Edits update the same WEAPONS data used by gameplay and league simulation for this browser profile.</p></div><button class="primary" data-action="balance-save">Save Balance Patch</button></div><div class="balance-grid">${Object.values(WEAPONS).map(w=>`<section class="balance-card"><h3>${w.name}</h3>${this.balanceInput(w.id,'basicDamage','Basic Damage',w.basicDamage)}${this.balanceInput(w.id,'specialDamage','Special Damage',w.specialDamage)}${this.balanceInput(w.id,'range','Range',w.range)}${this.balanceInput(w.id,'attacksPerSecond','Attack Speed',w.attacksPerSecond)}${w.projectileSpeed?this.balanceInput(w.id,'projectileSpeed','Projectile Speed',w.projectileSpeed):''}${w.magSize?this.balanceInput(w.id,'magSize','Magazine',w.magSize):''}${w.reloadTime?this.balanceInput(w.id,'reloadTime','Reload',w.reloadTime):''}${w.staminaRating?this.balanceInput(w.id,'staminaRating','Stamina Rating',w.staminaRating):''}${w.staminaCost?this.balanceInput(w.id,'staminaCost','Stamina Cost',w.staminaCost):''}</section>`).join('')}</div></article>`;}
  private balanceInput(id:WeaponId,key:string,label:string,value:number){return `<label>${label}<input type="number" step="0.01" data-balance="${id}" data-key="${key}" value="${value}"></label>`;}
  private saveBalanceOverrides(){const inputs=[...this.root.querySelectorAll<HTMLInputElement>('[data-balance]')];const overrides:Record<string,Record<string,number>>={};for(const input of inputs){const id=input.dataset.balance!,key=input.dataset.key!;(overrides[id]??={})[key]=Number(input.value);}for(const[id,vals]of Object.entries(overrides))Object.assign(WEAPONS[id as WeaponId],vals);localStorage.setItem('adaptive-arena-balance-overrides',JSON.stringify(overrides));this.audio.ui('confirm');}
  private leagueNews(){return `<article class="panel"><h2>League News</h2><div class="news-feed">${this.profile.league.news.map(n=>`<div class="news-item">${esc(n)}</div>`).join('')}</div></article>`;}

  private simulateLeagueWeek(){const teams=this.profile.league.teams.slice();for(let i=0;i<teams.length;i+=2){const a=teams[i],b=teams[i+1];const strengthA=.8+Math.random()*.4,strengthB=.8+Math.random()*.4;const dmgA=Math.round(clamp(460*strengthA+Math.random()*260,200,930));const dmgB=Math.round(clamp(460*strengthB+Math.random()*260,200,930));a.damageFor+=dmgA;a.damageAgainst+=dmgB;b.damageFor+=dmgB;b.damageAgainst+=dmgA;if(dmgA>=dmgB){a.wins++;b.losses++;}else{b.wins++;a.losses++;}if(Math.max(dmgA,dmgB)>900)this.profile.league.news.unshift(`Record watch: ${dmgA>dmgB?a.name:b.name} exploded for ${Math.max(dmgA,dmgB)} damage in Week ${this.profile.league.week}.`);}
    const sorted=this.sortedTeams();this.profile.league.news.unshift(`Week ${this.profile.league.week}: ${sorted[0].name} leads the table at ${sorted[0].wins}-${sorted[0].losses}.`);this.profile.league.week++;if(this.profile.league.week>12){this.profile.league.champions.unshift({season:this.profile.league.season,team:sorted[0].name});this.profile.league.news.unshift(`${sorted[0].name} are Season ${this.profile.league.season} champions.`);this.profile.league.season++;this.profile.league.week=1;for(const t of this.profile.league.teams){t.wins=0;t.losses=0;t.damageFor=0;t.damageAgainst=0;}}saveProfile(this.profile);}

  private renderExtras(){const tabs=[{id:'settings',label:'Settings'},{id:'controls',label:'Controls'},{id:'howto',label:'How To Play'},{id:'systems',label:'Systems & Values'},{id:'notes',label:'Patch Notes'}];let body=this.extrasTab==='settings'?this.settingsScreen():this.extrasTab==='controls'?this.controlsScreen():this.extrasTab==='howto'?this.howToScreen():this.extrasTab==='systems'?this.systemsScreen():this.patchNotesScreen();this.shell(`<div class="page-head"><div><div class="eyebrow">EXTRAS</div><h1>${tabs.find(t=>t.id===this.extrasTab)?.label}</h1></div></div>${this.subnav(tabs,this.extrasTab,'extras-tab')}${body}`,'extras');}
  private settingsScreen(){const s=this.profile.settings;return `<section class="two-col"><article class="panel"><h2>Audio</h2>${this.volume('Master','master',s.masterVolume)}${this.volume('Music','music',s.musicVolume)}${this.volume('SFX','sfx',s.sfxVolume)}${this.volume('UI','ui',s.uiVolume)}${this.volume('Ambience','ambience',s.ambienceVolume)}<label class="toggle"><input type="checkbox" data-mute="true" ${s.mute?'checked':''}> Mute All</label><button data-action="save-settings">Save Settings</button></article><article class="panel"><h2>Profile</h2><label>Username<input data-setting="username" value="${esc(this.profile.username)}"></label><p>Audio files are loaded locally from <code>/adaptive-arena-audio/</code>. Missing files fail silently so gameplay remains stable.</p></article></section>`;}
  private volume(label:string,key:string,value:number){return `<label>${label}<input type="range" min="0" max="100" value="${Math.round(value*100)}" data-volume="${key}"><span>${Math.round(value*100)}%</span></label>`;}
  private controlsScreen(){return `<article class="panel controls-grid"><div><kbd>WASD</kbd><b>Move</b></div><div><kbd>LMB</kbd><b>Basic Attack</b></div><div><kbd>C</kbd><b>Weapon Special</b></div><div><kbd>F</kbd><b>Character Ability — once per round</b></div><div><kbd>Space</kbd><b>Dodge</b></div><div><kbd>R</kbd><b>Reload</b></div><div><kbd>Esc</kbd><b>Pause</b></div></article>`;}
  private howToScreen(){return `<section class="two-col"><article class="panel"><h2>Win the BO3</h2><p>First fighter to win two rounds wins the match. Aim with the mouse, move with WASD, dodge with Space, use your weapon special with C, and commit your one character ability with F at the right moment.</p><h3>Combat hierarchy</h3><ol><li>Player skill — most important.</li><li>Weapon — converts skill into damage and pressure.</li><li>Character ability — one strong timing tool each round.</li><li>Arena hazards — awareness and positioning pressure.</li></ol></article><article class="panel"><h2>Progression</h2><p>Account Ranked is permanent. Seasonal Ranked resets every 45 days. Character mastery reaches its main milestone at Level 100 and continues infinitely. Weapon mastery reaches its main milestone at Level 250 and continues infinitely. Mastery never increases combat stats.</p></article></section>`;}
  private systemsScreen(){return `<div class="docs-grid"><article class="panel"><h2>Competitive Rules</h2><p>Player skill is the dominant outcome factor. Weapons define combat style. Character abilities create clutch windows. Arenas create environmental pressure. No mastery stat scaling exists.</p></article><article class="panel"><h2>Ranked</h2><p>No loss protection. Demotions remain possible. Account Ranked is permanent; Seasonal Ranked is a separate 45-day ladder with 150 HP normalized AI health.</p></article><article class="panel"><h2>Credits</h2><p>Reward hierarchy: Seasonal Ranked → Account Ranked → Tournament → Quickplay. League Mode awards zero credits. Credits purchase cosmetics, not combat power.</p></article><article class="panel"><h2>Hazards</h2><p>Lava 28 damage. Spikes 14. Poison 10 damage/s. Lightning 35% of target max HP. Healing zones restore 16 HP/s while making the healed fighter take 1.4× incoming damage.</p></article><article class="panel"><h2>Melee Stamina</h2><p>At 0 stamina: movement -7%, dodge distance -50%, and melee attacks remain blocked until enough stamina exists to pay the attack cost.</p></article><article class="panel"><h2>League</h2><p>Persistent offline esports ecosystem with standings, schedule, simulation, history, news, Balance Lab, and no credit farming.</p></article></div>`;}
  private patchNotesScreen(){return `<article class="panel"><div class="eyebrow">REBUILD 0.1</div><h2>Adaptive Arena — Reconstructed Foundation</h2><ul><li>Rebuilt browser-first architecture from scratch.</li><li>Added all 16 arenas and core arena modifiers.</li><li>Added 8 weapon classes with melee stamina and ranged ammo.</li><li>Added 16 character abilities, one use per round.</li><li>Added Quickplay, Account Ranked, Seasonal Ranked, Tournament, and League.</li><li>Added persistent profiles, mastery, match history, meta, rivals, stats, replays, settings, and Balance Lab.</li><li>Added adaptive AI styles and hazard awareness.</li><li>Added final-hit replay sequence and local-file audio routing.</li></ul></article>`;}

  private startMatch(mode:ModeId,difficulty:Difficulty){this.audio.stopMusic();this.navSection='match';this.currentMode=mode;this.lastMatchConfig={mode,difficulty};let rival:null|(typeof RIVALS)[number]=null;if(mode!=='league'&&Math.random()<.5)rival=RIVALS[Math.floor(Math.random()*RIVALS.length)];const style=(rival?.style??Object.keys(STYLE_CONFIGS)[Math.floor(Math.random()*Object.keys(STYLE_CONFIGS).length)]) as StyleId;const opponentName=rival?.name??randomAiName();const opponentWeapon=rival?.weapon??this.pickAiWeapon(style);const opponentCharacter=rival?.character??Object.keys(CHARACTERS)[Math.floor(Math.random()*Object.keys(CHARACTERS).length)] as CharacterId;if(mode==='tournament'&&this.tournament.active)this.tournament.opponent=opponentName;
    this.shell(`<section class="match-shell"><div id="match-hud" class="match-hud"></div><div class="canvas-wrap"><canvas id="arena-canvas"></canvas><div id="match-overlay" class="match-overlay"></div></div><div class="match-controls">WASD Move • LMB Basic • C Special • F Ability • R Reload • Space Dodge • Esc Pause</div></section>`,'match');
    const canvas=this.root.querySelector<HTMLCanvasElement>('#arena-canvas')!;const hud=this.root.querySelector<HTMLElement>('#match-hud')!,overlay=this.root.querySelector<HTMLElement>('#match-overlay')!;
    this.game?.destroy();this.game=new ArenaGame({canvas,audio:this.audio,mode,difficulty,arena:arenaById(this.profile.selectedArenaId),playerWeapon:this.profile.selectedWeapon,playerCharacter:this.profile.selectedCharacter,opponentWeapon,opponentCharacter,opponentStyle:style,opponentName,onHud:s=>this.renderHud(hud,s),onOverlay:(t,sub)=>{overlay.innerHTML=t?`<div><b>${esc(t)}</b>${sub?`<span>${esc(sub)}</span>`:''}</div>`:'';overlay.classList.toggle('show',!!t);},onMatchEnd:summary=>this.handleMatchEnd(mode,difficulty,summary)});
  }

  private renderHud(el:HTMLElement,h:GameHud){const pw=WEAPONS[this.profile.selectedWeapon];el.innerHTML=`<div class="hud-item"><small>PLAYER HP</small><b>${Math.ceil(h.playerHp)} / ${h.playerMaxHp}${h.playerShield?` +${Math.ceil(h.playerShield)} shield`:''}</b><div class="progress hp"><i style="width:${h.playerHp/h.playerMaxHp*100}%"></i></div></div><div class="hud-item"><small>ROUND ${h.round}</small><b>${h.playerRounds} - ${h.enemyRounds}</b><span>${Math.ceil(h.roundTime)}s</span></div><div class="hud-item"><small>${esc(h.opponentName)} • ${esc(h.opponentStyle)}</small><b>${Math.ceil(h.enemyHp)} / ${h.enemyMaxHp}${h.enemyShield?` +${Math.ceil(h.enemyShield)} shield`:''}</b><div class="progress enemy"><i style="width:${h.enemyHp/h.enemyMaxHp*100}%"></i></div></div><div class="hud-item compact"><small>${pw.kind==='melee'?'STAMINA':'AMMO'}</small><b>${pw.kind==='melee'?Math.round(h.playerStamina):`${h.playerAmmo}/${h.playerMag}`}</b></div><div class="hud-item compact"><small>SPECIAL</small><b>${h.playerSpecial<=0?'Ready':`${h.playerSpecial.toFixed(1)}s`}</b></div><div class="hud-item compact"><small>ABILITY</small><b>${h.abilityReady?'F • Ready':'Used'}</b></div>`;}

  private handleMatchEnd(mode:ModeId,difficulty:Difficulty,summary:MatchSummary){this.game?.destroy();this.game=null;const history=applyMatchResult(this.profile,{mode,opponent:summary.opponentName,opponentStyle:summary.opponentStyle,weapon:this.profile.selectedWeapon,character:this.profile.selectedCharacter,arena:arenaById(this.profile.selectedArenaId).name,won:summary.won,roundsWon:summary.roundsWon,roundsLost:summary.roundsLost,damage:summary.damage,hazardDamageDealt:summary.hazardDamageDealt,hazardDamageTaken:summary.hazardDamageTaken,opponentDifficulty:difficulty});
    const mem=this.profile.aiMemory[summary.opponentName]??{games:0,favoriteWeapon:null,dodgeRate:0,retreatRate:0,aggression:0,rangePreference:0,hazardTendency:0,specialRate:0};mem.games++;mem.favoriteWeapon=this.profile.selectedWeapon;mem.hazardTendency=(mem.hazardTendency*(mem.games-1)+summary.hazardDamageTaken)/(mem.games);this.profile.aiMemory[summary.opponentName]=mem;
    if(mode==='tournament'&&this.tournament.active){if(summary.won){this.tournament.wins++;this.tournament.round++;if(this.tournament.round>5){this.tournament.active=false;this.profile.league.news.unshift(`${this.profile.username} completed a 32-fighter tournament championship run.`);}}else this.tournament.active=false;}
    if(mode==='league'){const team=this.profile.league.teams[0],opp=this.profile.league.teams[1];if(summary.won){team.wins++;opp.losses++;}else{opp.wins++;team.losses++;}team.damageFor+=Math.round(summary.damage);saveProfile(this.profile);}saveProfile(this.profile);
    const rank=rankForRp(this.profile.accountRp),sr=rankForRp(this.profile.seasonal.rp);this.audio.menuMusic();this.shell(`<section class="result-page"><article class="panel result-card ${summary.won?'win':'loss'}"><div class="eyebrow">${modeName(mode).toUpperCase()}</div><h1>${summary.won?'VICTORY':'DEFEAT'}</h1><h2>${summary.roundsWon}-${summary.roundsLost} vs ${esc(summary.opponentName)}</h2><div class="result-stats">${this.statCard('Damage',fmt(summary.damage),'')}${this.statCard('Hazard Damage Taken',fmt(summary.hazardDamageTaken),'')}${this.statCard('Credits',`+${history.credits}`,'')}${this.statCard('RP',history.rpDelta>0?`+${history.rpDelta}`:history.rpDelta,'')}</div><div class="result-progression"><span>Account: ${rank.name} • ${fmt(this.profile.accountRp)} RP</span><span>Seasonal: ${sr.name} • ${fmt(this.profile.seasonal.rp)} RP</span><span>${CHARACTERS[this.profile.selectedCharacter].name} Lv ${this.profile.characterMastery[this.profile.selectedCharacter].level}</span><span>${WEAPONS[this.profile.selectedWeapon].name} Lv ${this.profile.weaponMastery[this.profile.selectedWeapon].level}</span></div><div class="card-actions"><button data-action="home">Main Menu</button>${mode==='tournament'&&this.tournament.active?`<button class="primary" data-action="start-match" data-mode="tournament" data-difficulty="Hard">Next Tournament Round</button>`:`<button class="primary" data-action="next-match">Next Match</button>`}</div></article></section>`,'match');}

  private pickAiWeapon(style:StyleId):WeaponId{const ranged:WeaponId[]=['bow','blaster','energyStaff'],melee:WeaponId[]=['sword','hammer','daggers','spear','chainWhip'];if(['zoner','kiter'].includes(style))return ranged[Math.floor(Math.random()*ranged.length)];if(['rusher','hyperAggro','chaseHunter','anchor'].includes(style))return melee[Math.floor(Math.random()*melee.length)];return Object.keys(WEAPONS)[Math.floor(Math.random()*8)] as WeaponId;}
  private rankDifficulty(rp:number):Difficulty{if(rp<2750)return'Easy';if(rp<9000)return'Medium';if(rp<20000)return'Hard';if(rp<45000)return'Pro';return'Master';}
  private seasonDaysLeft(){const ms=Math.max(0,this.profile.seasonal.endsAt-Date.now()),d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000);return`${d}d ${h}h left`;}
  private historyRow(m:ProfileSave['matchHistory'][number]){return `<div class="history-row"><span class="result-dot ${m.won?'win':'loss'}"></span><div><b>${modeName(m.mode)}</b><small>${esc(m.opponent)} • ${esc(m.arena)}</small></div><strong>${m.score}</strong><em>${m.rpDelta?`${m.rpDelta>0?'+':''}${m.rpDelta} RP`:`+${m.credits} cr`}</em></div>`;}
  private favoriteWeapon():WeaponId{let best=this.profile.selectedWeapon,max=-1;for(const id of Object.keys(this.profile.weaponMastery) as WeaponId[]){const m=this.profile.weaponMastery[id];if(m.matches>max){max=m.matches;best=id;}}return best;}
  private metaTopWeapon(){return Object.values(WEAPONS).slice().sort((a,b)=>(b.basicDamage*b.attacksPerSecond+b.range*1.5)-(a.basicDamage*a.attacksPerSecond+a.range*1.5))[0];}
}

export function applyStoredBalanceOverrides(){try{const raw=JSON.parse(localStorage.getItem('adaptive-arena-balance-overrides')??'{}') as Record<string,Record<string,number>>;for(const[id,vals]of Object.entries(raw))if(id in WEAPONS)Object.assign(WEAPONS[id as WeaponId],vals);}catch{/* ignore invalid local patch */}}
