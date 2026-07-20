# Little Bear: Words of Home

A playable browser-first vertical slice for a silent, no-typing Plains Cree reading game. This second visual build uses a high-detail 768×512 production canvas with the same 3:2 aspect ratio as the Game Boy Advance. Curriculum data, scene state, controls, collision and rendering remain separate so the finished design can later be retiled and ported to a GBA-compatible engine.

## What is playable

- Explore a fully illustrated original parkland learning-centre map as a natural four-legged bear cub with directional walk art.
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
| 768×512 high-detail 3:2 canvas | Retiled 240×160 Mode 0/1 screen |
| Illustrated scrolling map | Background tilemaps and palettes |
| Directional bear and sign sheets | 4bpp OBJ sprites |
| DOM word cards and menus | Tile-based UI layer |
| `lexicon-data.js` | Generated C structs / lookup tables |
| Keyboard, touch, gamepad actions | GBA key bitmask |
| `localStorage` save | SRAM or Flash save block |
| Mode string state machine | Scene enum and update/draw functions |

Before porting, quantize the production art to GBA palettes, convert the illustrated map to reusable tiles, reduce the sprite sheets to hardware-safe OBJ sizes, and export only the approved curriculum subset into ROM tables.

## Project structure

```text
web-game/
├── assets/little-bear-hybrid.png
├── assets/parkland-hub-v2.png
├── assets/bear-sprites-v2.png
├── assets/word-signs-v2.png
├── css/game.css
├── js/game.js
├── js/lexicon-data.js
├── preview-gameplay-v2.png
├── scripts/generate-lexicon.mjs
├── scripts/render_preview.py
├── LANGUAGE_REVIEW.md
├── README.md
└── index.html
```

`scripts/generate-lexicon.mjs` regenerates the browser data from the project story map. It is a build helper, not needed to play the packaged game.
