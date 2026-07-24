# Little Bear: Words of Home — 300-Object Edition

A no-typing Plains Cree reading-and-recognition adventure built from the approved 300-word master plan: five open worlds, ten trails, 50 arenas, six discoveries per arena, and one six-round check per arena. This edition is an installable, offline-capable phone PWA with optional original instrumental woodland music.

The browser build starts from a detailed 768×512 logical camera and expands that camera to match the device's live aspect ratio. Wider displays reveal more world at the sides; taller displays reveal more above and below. The canvas always scales uniformly, so neither the maps nor the sprites are stretched. Campaign data, state, controls, rendering, and save data remain separate for a later native or tile-and-sprite port.

## Campaign structure

- **5 worlds:** Homefire; Hands & Harvest; Forest & Wetland; Lake, Sky & Journey; Community Trail.
- **10 trails:** Two named trails per world, taken from the master plan's ten regions.
- **50 arenas:** Five arenas per trail and ten per world.
- **300 unique records:** Exactly six workbook-assigned entries per arena and 60 per world.
- **Everything open immediately:** Every world, trail, and arena is selectable from a fresh start. There are no gates or prerequisite locks.
- **Completion rule:** 100% requires all 300 discoveries and all 50 arena checks.
- **Persistent journal:** Each encountered record unlocks independently, including deliberate duplicate-gloss contrasts.
- **Silent reading activities:** No typing, microphone, speech recognition, spoken Cree, voiceover, listening test, or timed response. Optional instrumental music can be turned on or off.
- **Original offline tune:** “Meadow Afterglow” is generated locally with Web Audio, so it adds a gentle woodland loop without an audio download or network dependency.
- **Keyboard, touch, and gamepad controls.**
- **iPhone-safe controller deck:** Long-press selection and touch callouts are disabled on the controls, with B lower-left and A upper-right on a Game Boy-style diagonal.
- **Installable offline PWA:** After the first complete visit over HTTPS or localhost, the app shell and all production art are cached for offline play.
- **Asset-gated boot sequence:** “TATAWAW TEACHINGS” remains on screen until all five world paintings, both sprite atlases, and both game-font weights have loaded and decoded. The title screen is never revealed over partially loaded art.
- **Handheld farm-life opening:** The title screen uses an original cozy GBA-era composition with an early-autumn/day ribbon, framed game mark, animated sky accents, and an A-to-begin prompt while keeping the Little Bear art and identity original.
- **Natural interface palette:** Espresso, khaki, cream, olive, forest green, bottle green, burgundy, walnut, and muted blue frame the existing artwork without recolouring it.
- **True fullscreen presentation:** The world, title screen, overlays, HUD, and touch controls fill the complete browser or installed-app viewport in landscape or portrait without changing artwork proportions.

## Object artwork and placement

`assets/object-sprites-300.png` is a transparent 20×15 atlas containing one indexed 64×64 pixel-art cell for every master-plan row. Household items, people, body-teaching objects, clothing, foods, wildlife, plants, landforms, weather/calendar cues, buildings, tools, and community scenes all have their own visible art.

The atlas order is identical to the 300-row workbook order. `js/campaign-300.js` preserves each row's unique lexicon ID, Cree form, English cue, grammatical class, category, depiction note, arena, slot, physicality/review flags, and object/board relationship. Workbook coordinates are normalized into each 1536×1024 world while preserving the six-object stage-local layout and board offsets.

The five original world paintings are used unchanged. Objects and the six active boards are separate runtime layers; people and animals move around their assigned anchors, birds and fish drift, and plants sway. No living target is baked into a world background.

Sensitive depictions use restrained, context-neutral treatments: contemporary everyday clothing, no invented ceremonial imagery, safely stored weapons/tools, an unlit plain pipe, a contemporary community landscape for “reserve,” and botanical sage.

## Run it

Use a local server so the manifest and offline service worker are available:

```sh
python3 -m http.server 4173 --directory "web-game 3"
```

Then visit `http://localhost:4173`.

To install on Android or desktop Chrome/Edge, use the in-game **INSTALL APP** prompt or the browser's install action. On iPhone/iPad Safari, use **Share → Add to Home Screen**. Launch the installed app once while online and wait for the title badge to report that offline setup is ready.

Opening `index.html` directly still runs the game, but browsers do not allow service-worker installation from a `file:` URL.

## Controls

| Action | Keyboard | Touch / gamepad |
|---|---|---|
| Move / change selection | Arrows or WASD | D-pad / left stick |
| Look / confirm | Z, Enter, or Space | A |
| English / back | X or Escape | B |
| Word journal | J | WORDS button |
| Journey map | MAP button | Select |
| Pause | P or M | Start / MENU |
| Music | MUSIC button | MUSIC button |

No text entry is used anywhere.

## Learning loop

1. Choose any of the five worlds, either trail, and any arena.
2. Enter the arena and explore its six illustrated objects and six small boards.
3. Looking at an object shows its Cree form first, with optional English support and its matching illustration.
4. After all six are found, complete a six-round Cree-to-English recognition check.
5. The arena check and each independent discovery are saved. Every arena remains replayable.

English glosses are independent meaning cues, not claims of word-for-word sentence grammar.

## Language and cultural review boundary

This is an internal candidate build, not a language-authorized public release. Every Cree form, gloss, class, image association, duplicate-gloss contrast, and context must be reviewed by authorized fluent speakers and the relevant community process. The game deliberately contains no newly composed Cree sentences. See `LANGUAGE_REVIEW.md`.

## Rights boundary

- No source prose, sample sentence, dialogue, exercise, explanation, lesson flow, page design, illustration, or scan is reproduced.
- The world paintings, bear character, object atlas, boards, UI, campaign implementation, and code are project assets.
- The art uses original high-definition pixel-art readability without copying protected characters, maps, logos, signature symbols, or interface layouts.
- No ceremonial imagery or pan-Indigenous stereotype is intentionally used.

## Project structure

```text
web-game 3/
├── assets/
│   ├── act-1-home-v3.png … act-5-meaning-v3.png
│   ├── bear-sprites-v2.png
│   ├── object-sprites-300.png
│   ├── blank-sign-v3.png and word-signs-v2.png (retained legacy art; not loaded)
│   └── fonts/
├── css/game.css
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-512.png
│   └── apple-touch-icon.png
├── js/
│   ├── campaign-300.js
│   ├── game-v3.js
│   └── pwa.js
├── scripts/
│   ├── build-object-atlas.py
│   ├── generate-campaign-300.mjs
│   └── render_campaign_preview.py
├── preview-five-acts-v3.jpg
├── preview-gameplay-v3.jpg
├── LANGUAGE_REVIEW.md
├── manifest.webmanifest
├── README.md
├── service-worker.js
└── index.html
```

`build-object-atlas.py` validates and crops 25 ordered 4×3 production sheets. `generate-campaign-300.mjs` validates the 50-stage and 300-placement workbook exports before producing browser data. `render_campaign_preview.py` produces deterministic previews from the exact world and atlas assets used at runtime.
