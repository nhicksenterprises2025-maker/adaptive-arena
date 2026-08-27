# Adaptive Arena

Browser-first reconstruction of Adaptive Arena.

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL in a browser.

## Build

```bash
npm run build
```

## Controls

- WASD — Move
- Mouse — Aim
- Left Mouse — Basic attack
- C — Weapon special
- F — Character ability (one use per round)
- Space — Dodge
- R — Reload ranged weapons
- Esc — Pause

## Current rebuilt systems

- 1v1 top-down BO3 combat
- Quickplay
- Account Ranked
- 45-day Seasonal Ranked
- 32-fighter Tournament progression
- Offline League Mode
- 8 weapons
- melee stamina / ranged ammo
- 16 characters with one active ability per round
- 16 arenas with arena-specific modifiers and hazards
- adaptive AI combat styles
- rivals
- match history and final-hit replay sequence
- Account / Seasonal RP
- character mastery (Level 100 milestone, then infinite)
- weapon mastery (Level 250 milestone, then infinite)
- cosmetic-only credit economy
- Meta / stats / weapon skill ratings
- Balance Lab
- local-file audio routing
- persistent browser save

## Audio asset structure

The game never synthesizes replacement audio. Missing local files fail silently.

Place audio files under `public/adaptive-arena-audio/` using folders such as:

```text
public/adaptive-arena-audio/
  music/
  ui-sounds/
  weapon-sounds/
  arena-hazard-sounds/
  arena-ambiance/
```

Expected filenames are documented by `src/audio.ts`.

## Source-of-truth rule

Weapon values live in `src/data.ts` and are read directly by both gameplay and League Balance Lab. Balance Lab overrides are stored locally and reapplied at startup, keeping simulation/gameplay values aligned.
