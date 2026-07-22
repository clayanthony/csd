# Little Bear: Words of Home — Complete Browser Campaign

A silent, no-typing Plains Cree reading-and-recognition adventure containing the complete 750-entry curriculum: five acts, 25 chapters, 125 missions, five chapter-per-act mastery gates, a persistent journal and a final campaign ending.

The web build uses a detailed 768×512 production canvas with the same 3:2 aspect ratio as the Game Boy Advance. Curriculum data, campaign state, controls, rendering and save data remain separate for a later tile-and-sprite GBA port.

## Complete campaign

- **5 visual acts:** Home, Land, Time, Community and Meaning each have an original production environment.
- **25 chapters:** Five chapters per act, using the curriculum titles, themes and progression.
- **125 missions:** Five missions per chapter and exactly six new words per mission.
- **750 curriculum records:** Each record keeps its own ID, Cree form, English support, part of speech, grammatical class, chapter and mission assignment.
- **Physical exploration:** Little Bear finds six wooden word signs in every mission.
- **Two-way recognition:** Checks alternate between Cree→English and English→Cree choices.
- **Spaced cumulative checks:** Six-word mission checks lead to 30-word chapter pools and 150-word act pools.
- **Full progression:** Mission, chapter, act and final completion states are saved and replayable.
- **Journey map:** Browse five chapters at a time, inspect progress and replay any unlocked mission.
- **750-word journal:** Encountered records unlock independently, including repeated written forms with different curriculum IDs.
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
2. Little Bear explores six numbered word signs.
3. Opening a sign shows the Cree form first, with English support available at all times.
4. First and second encounters show English by default; later encounters encourage recall but never remove support.
5. The mission check asks six two-way recognition questions.
6. Five missions unlock a ten-question check drawn from the chapter's 30-word pool.
7. Five chapters unlock a fifteen-question check drawn from the act's 150-word pool.
8. Completed words remain in the journal and completed missions can be replayed.

English glosses are independent meaning cues, not claims of word-for-word sentence grammar.

## Sentence-content boundary

This build teaches every selected word and the mechanics of reading statement-like sequences, but it deliberately does **not** invent publishable Cree sentences. Chapter 25 retains its curriculum role; speaker-approved sentences can be added to the same campaign engine after community review.

Every form, gloss, grammatical class, picture association and future sentence must be independently approved by authorized Muscowpetung/Plains Cree speakers before public release. See `LANGUAGE_REVIEW.md`.

## Rights boundary

- No source prose, sample sentence, dialogue, exercise, explanation, table, lesson flow, page design, illustration or scan is reproduced.
- The five maps, bear character, signs, UI, campaign structure, mission logic and code are original project assets.
- The art uses broad handheld-era life-simulation readability and cinematic wilderness atmosphere without copying protected characters, maps, logos, signature symbols or interface layouts.
- No ceremonial imagery or pan-Indigenous visual stereotypes are used.

## GBA port map

| Browser system | GBA counterpart |
|---|---|
| 768×512 3:2 authoring canvas | Retiled 240×160 Mode 0/1 scenes |
| Five illustrated scrolling maps | Background tilemaps and palettes |
| Directional bear and sign sheets | 4bpp OBJ sprites |
| DOM campaign, word and journal panels | Tile-based UI scenes |
| `lexicon-data.js` | Generated ROM lookup tables |
| Campaign state machine | Scene enum and update/draw functions |
| Keyboard/touch/gamepad actions | GBA key bitmask |
| `localStorage` campaign save | SRAM or Flash save structure |

The GBA conversion still requires palette quantization, map tiling, sprite-size reduction and approved curriculum export.

## Project structure

```text
web-game/
├── assets/
│   ├── act-1-home-v3.png
│   ├── act-2-land-v3.png
│   ├── act-3-time-v3.png
│   ├── act-4-community-v3.png
│   ├── act-5-meaning-v3.png
│   ├── bear-sprites-v2.png
│   ├── blank-sign-v3.png
│   ├── fonts/
│   │   ├── balsamiq-sans-latin-400-normal.woff2
│   │   ├── balsamiq-sans-latin-700-normal.woff2
│   │   └── OFL-Balsamiq-Sans.txt
│   └── word-signs-v2.png
├── css/game.css
├── js/game-v3.js
├── js/lexicon-data.js
├── preview-five-acts-v3.jpg
├── preview-gameplay-v3.jpg
├── scripts/generate-lexicon.mjs
├── scripts/render_campaign_preview.py
├── LANGUAGE_REVIEW.md
├── README.md
└── index.html
```

`scripts/generate-lexicon.mjs` regenerates browser curriculum data from the project story map. `scripts/render_campaign_preview.py` produces deterministic previews from the same map and sprite assets used by the runtime.
