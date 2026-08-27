# Adaptive Arena audio

Drop local audio assets into these folders when available:

- `music/`
- `ui-sounds/`
- `weapon-sounds/`
- `arena-hazard-sounds/`
- `arena-ambiance/`

The runtime audio map is defined in `src/audio.ts`. Missing files fail silently; the game does not synthesize replacement audio.
