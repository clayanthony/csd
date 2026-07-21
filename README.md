# Little Bear: Words of Home — Focused V6 Campaign

A silent, no-typing Plains Cree reading-and-recognition adventure focused on 300 candidate beginner words: five acts, 25 chapters, 50 missions, five companion stories, adaptive review, seasonal ambience, a persistent journal and a final campaign ending.

The web build uses a detailed 768×512 production canvas with the same 3:2 aspect ratio as the Game Boy Advance. Curriculum data, campaign state, controls, rendering and save data remain separate for a later tile-and-sprite GBA port.

## Complete campaign

- **5 visual acts:** Home, Land, Time, Community and Meaning each have an original production environment.
- **25 chapters:** Five chapters per act, using the curriculum titles, themes and progression.
- **50 focused missions:** Two missions per chapter and exactly six new words per mission.
- **300 curated candidate records:** Twelve words per chapter and 60 per act, selected from the existing candidate lexicon without composing new Cree forms or sentences.
- **Expanded semantic worlds:** Each act is a 3072×2048 scrolling world—four times the explorable area of the earlier map build—with homes, water, forest, garden, rock, school, workshop, play, care and gathering landmarks.
- **300 authored placements:** Every playable record has its own deterministic coordinate. Concrete words appear beside a matching visible landmark; conversational and grammatical forms are distributed through neutral clearings.
- **211 explicit picture associations:** Every playable noun and verb has an audited pictogram; abstract grammar retains neutral part-of-speech symbols.
- **Five original companions:** Moss, Reed, Tansy, Pip and Ink appear in-world, introduce each act’s missions and build persistent friendship hearts.
- **Living seasons:** Spring petals, summer fireflies, autumn leaves and winter snow change with the campaign.
- **Rewards:** Missions award trail leaves and friendship; chapters award leaf badges; acts award companion keepsakes.
- **Adaptive review:** Missed recognition choices enter a local review queue and receive priority in chapter and act checks.
- **Physical exploration:** Little Bear finds six wooden word signs in every mission, guided by a non-verbal golden compass toward the nearest unseen sign.
- **Two-way recognition:** Checks alternate between Cree→English and English→Cree choices.
- **Spaced cumulative checks:** Six-word mission checks lead to 12-word chapter pools and 60-word act pools.
- **Full progression:** Mission, chapter, act and final completion states are saved and replayable.
- **Journey map:** Browse five chapters at a time, inspect progress and replay any unlocked mission.
- **300-word journal and learner report:** Encountered records unlock independently; a private local report shows accuracy and words needing another look.
- **Silent accessibility:** No typing, microphone, audio or speech recognition.
- **Three control systems:** Keyboard, touchscreen and standard gamepad.
- **One child-friendly typeface:** Every visible UI label, word card, button and canvas label uses the bundled Balsamiq Sans family.

## Typography

Balsamiq Sans Regular (400) and Bold (700) are self-hosted in `assets/fonts`, so the game does not need a font CDN or network connection. The build waits for both faces before enabling play, and its title artwork contains no baked-in lettering. Direction arrows and completion ticks are drawn with CSS shapes rather than substituted symbol fonts.

Balsamiq Sans is redistributed under the SIL Open Font License 1.1. The required license copy is included at `assets/fonts/OFL-Balsamiq-Sans.txt`.

## Run it

Open `index.html` directly in a current browser. A local server is recommended:

```sh
python3 -m http.server 4173 --directory web-game
```

Then visit `http://localhost:4173`.

## Controls

| Action | Keyboard | Touch / gamepad |
|---|---|---|
| Move / change selection | Arrows or WASD | D-pad / left stick |
| Look / confirm | Z, Enter or Space | A |
| English / back | X or Escape | B |
| Word journal | J | WORDS button |
| Journey map | MAP button | Select |
| Pause | P or M | Start / MENU |

No text entry is used anywhere.

## Learning loop

1. A mission briefing introduces its place in the act and chapter without exposing unseen answers.
2. Little Bear follows the golden compass to six numbered word signs placed beside meaning-related landmarks.
3. Opening a sign shows the Cree form first, with English support available at all times.
4. First and second encounters show English by default; later encounters encourage recall but never remove support.
5. The mission check asks six two-way recognition questions.
6. Two missions unlock a ten-question adaptive check drawn from the chapter's 12-word pool.
7. Five chapters unlock a fifteen-question adaptive check drawn from the act's 60-word pool.
8. Completed words remain in the journal and completed missions can be replayed.

English glosses are independent meaning cues, not claims of word-for-word sentence grammar.

## Sentence-content boundary

This build teaches every selected word and the mechanics of reading statement-like sequences, but it deliberately does **not** invent publishable Cree sentences. Chapter 25 retains its curriculum role; speaker-approved sentences can be added to the same campaign engine after community review.

Every form, gloss, grammatical class, picture association and future sentence must be independently approved by authorized Muscowpetung/Plains Cree speakers before public release. See `LANGUAGE_REVIEW.md`.

## Semantic placement system

`js/placement-data-v6.js` is the runtime manifest for all 300 playable coordinates. It is generated reproducibly by `scripts/generate-placements.mjs` from whole-word English meaning rules, part-of-speech handling and hand-authored landmark anchors. The generator prevents exact coordinate reuse within an act and enforces 190 world pixels of separation among the six signs in every mission.

`PLACEMENT_AUDIT_V6.md` lists every playable curriculum ID, Cree form, English support, act, chapter, mission, semantic zone, visible landmark and coordinate. `CURATED_300_AUDIT.md` records the complete playable selection. Run `node scripts/validate-placements.mjs` to verify all records, bounds, mission sizes, duplicate coordinates, spacing and representative meaning associations. Run `node scripts/validate-v6-assets.mjs` to verify the focused curriculum, pictogram coverage and required release assets.

The placement is intentionally stable across saves and replays. “Random” neutral words therefore receive seeded, varied locations rather than changing positions mid-save.

## Rights boundary

- No source prose, sample sentence, dialogue, exercise, explanation, table, lesson flow, page design, illustration or scan is reproduced.
- The five maps, bear character, signs, UI, campaign structure, mission logic and code are original project assets.
- The five companion designs are original generated assets created specifically for this project.
- OpenMoji 17.0.0 pictograms are used under CC BY-SA 4.0 with the required attribution and license included in `assets/icons/openmoji`.
- The art uses broad handheld-era life-simulation readability and cinematic wilderness atmosphere without copying protected characters, maps, logos, signature symbols or interface layouts.
- No ceremonial imagery or pan-Indigenous visual stereotypes are used.

## GBA port map

| Browser system | GBA counterpart |
|---|---|
| 768×512 3:2 authoring canvas | Retiled 240×160 Mode 0/1 scenes |
| Five illustrated scrolling maps | Background tilemaps and palettes |
| Directional bear and sign sheets | 4bpp OBJ sprites |
| DOM campaign, word and journal panels | Tile-based UI scenes |
| `lexicon-data-v6.js` | Generated ROM lookup tables |
| Campaign state machine | Scene enum and update/draw functions |
| Keyboard/touch/gamepad actions | GBA key bitmask |
| `localStorage` campaign save | SRAM or Flash save structure |

The GBA conversion still requires palette quantization, map tiling, sprite-size reduction and approved curriculum export.

## Project structure

```text
web-game/
├── assets/
│   ├── act-1-home-expanded-v4.png
│   ├── act-2-land-expanded-v4.png
│   ├── act-3-time-expanded-v4.png
│   ├── act-4-community-expanded-v4.png
│   ├── act-5-meaning-expanded-v4.png
│   ├── bear-sprites-v2.png
│   ├── companion-sheet-v6-cropped.png
│   ├── blank-sign-v3.png
│   ├── icons/openmoji/
│   ├── fonts/
│   │   ├── balsamiq-sans-latin-400-normal.woff2
│   │   ├── balsamiq-sans-latin-700-normal.woff2
│   │   └── OFL-Balsamiq-Sans.txt
│   └── word-signs-v2.png
├── css/game.css
├── js/game-v3.js
├── js/lexicon-data-v6.js
├── js/placement-data-v6.js
├── js/word-icon-data-v6.js
├── scripts/generate-placements.mjs
├── scripts/validate-placements.mjs
├── scripts/validate-v6-assets.mjs
├── CURATED_300_AUDIT.md
├── PICTOGRAM_AUDIT_V6.md
├── PLACEMENT_AUDIT_V6.md
├── PLAYTEST_GUIDE_V6.md
├── screenshots/v6/
├── LANGUAGE_REVIEW.md
├── README.md
└── index.html
```

`scripts/generate-placements.mjs` regenerates the semantic coordinate manifest and audit from the focused browser curriculum. The two validators verify the playable manifest and bundled release assets before packaging. See `CURATED_300_AUDIT.md` for the complete selection and `PLAYTEST_GUIDE_V6.md` for the supervised learner-testing protocol.
