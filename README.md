# Little Bear: Words of Home

A playable browser-first vertical slice for a silent, no-typing Plains Cree reading game. The game uses a 240×160 logical canvas—the Game Boy Advance screen size—and keeps curriculum data separate from the rendering and interaction code so the finished design can later be ported to a GBA-compatible engine.

## What is playable

- Explore an original parkland learning-centre map as a natural four-legged bear cub.
- Find six visual signs: `maskwa`, `mîtos`, `asiniy`, `nîpiy`, `mînis`, and `kinosêw`.
- See Cree first, with English support on early encounters and an always-available reveal on later encounters.
- Complete a five-round picture-recognition check without typing, audio, or speech.
- Open a 25-chapter word journal backed by the complete 750-entry curriculum. Only encountered words are revealed in this slice.
- Save and continue progress with browser local storage.
- Play with keyboard, touchscreen controls, or a standard gamepad.

This is a systems vertical slice, not the full 125-mission game. It proves the core learning loop and carries the full word data for expansion.

## Run it

Open `index.html` directly in a current browser, or serve this folder locally:

```sh
python3 -m http.server 4173 --directory web-game
```

Then visit `http://localhost:4173`.

## Controls

| Action | Keyboard | Touch / gamepad |
|---|---|---|
| Move / choose | Arrows or WASD | D-pad / left stick |
| Look / confirm | Z, Enter, or Space | A |
| English / back | X or Escape | B |
| Word journal | J | Select / WORDS button |
| Pause | P or M | Start / MENU button |

No text entry is used anywhere.

## Learning design

The prototype follows a simple exposure ladder:

1. First and second encounters show the Cree form with its English meaning.
2. Later encounters foreground only the Cree form and picture.
3. English remains available with B; support is never permanently withheld.
4. Recognition checks ask for a picture match, then reveal the English meaning after the choice.
5. Progress is based on encounters and recognition, not spelling tests.

The English glosses are independent meaning cues. They are not presented as word-for-word sentence grammar.

## Language and rights boundary

- The project contains individual language facts selected into an independently designed curriculum. It does not reproduce source prose, sample sentences, exercises, lesson explanations, tables, page design, or source sequence.
- The story, map, characters, UI, learning loop, mission structure, art direction, and code are original project work.
- The current art uses broad handheld-era life-simulation readability and cinematic wilderness atmosphere. It does not copy protected characters, maps, logos, signature symbols, dialogue, or interface layouts from another game.
- Every Plains Cree form, gloss, grammatical classification, and future sentence must be independently verified by authorized Muscowpetung/Plains Cree speakers before public release.
- Do not build publishable sentences by mechanically combining these entries. Cree morphology and animacy require speaker-led design.

See `LANGUAGE_REVIEW.md` for the release checklist.

## GBA port map

| Browser system | GBA counterpart |
|---|---|
| 240×160 canvas | Native Mode 0/1 screen |
| `drawWorld` tile-like layers | Background tilemaps and palettes |
| Bear and vocabulary drawings | 4bpp OBJ sprites |
| DOM word cards and menus | Tile-based UI layer |
| `lexicon-data.js` | Generated C structs / lookup tables |
| Keyboard, touch, gamepad actions | GBA key bitmask |
| `localStorage` save | SRAM or Flash save block |
| Mode string state machine | Scene enum and update/draw functions |

Before porting, replace canvas-drawn temporary sprites with reviewed sprite sheets, quantize assets to GBA palettes, convert the map to tiles, and export only the approved curriculum subset into ROM tables.

## Project structure

```text
web-game/
├── assets/little-bear-hybrid.png
├── css/game.css
├── js/game.js
├── js/lexicon-data.js
├── scripts/generate-lexicon.mjs
├── LANGUAGE_REVIEW.md
├── README.md
└── index.html
```

`scripts/generate-lexicon.mjs` regenerates the browser data from the project story map. It is a build helper, not needed to play the packaged game.

