# V6 — Focused Companion Campaign

## Curriculum

- Reduced the playable campaign from 750 candidate records to **300 focused beginner records**.
- Preserved all five acts and 25 chapters.
- Rebalanced every chapter to **two six-word missions**: 50 missions total.
- Chapter checks now adaptively sample 10 of 12 words; act checks sample 15 of 60.
- Added `CURATED_300_AUDIT.md` with every playable record and its new mission assignment.

## Visual learning

- Added **211 explicit word-to-pictogram associations** covering every playable noun and verb.
- Bundled **177 distinct OpenMoji 17.0.0 SVG assets** with CC BY-SA 4.0 attribution and license.
- Kept neutral part-of-speech symbols for abstract and grammatical forms so pictures do not invent literal meanings.
- Added `PICTOGRAM_AUDIT_V6.md` for record-by-record visual review.

## Story and world

- Added five original illustrated companions: Moss, Reed, Tansy, Pip and Ink.
- Each companion appears in the world, introduces missions, and builds persistent friendship hearts.
- Added seasonal ambience: spring petals, summer fireflies, autumn leaves and winter snow.
- Preserved the expanded 3072×2048 semantic maps and regenerated 300 unique placements.
- Added in-world companion interaction and mission-story replay.

## Learning and rewards

- Missed recognition choices now enter an adaptive review queue.
- Mission rewards: one trail leaf and one friendship point.
- Chapter rewards: three leaves and a persistent leaf badge.
- Act rewards: five leaves and a companion keepsake.
- Added a private local **Learner Report** for encountered words, accuracy, review count and hardest words.
- Added `PLAYTEST_GUIDE_V6.md` with supervised learner-testing thresholds and revision rules.

## Verification

- 300 playable records and 50 missions.
- Exactly six records in every mission and 12 in every chapter.
- 300 unique coordinates; no act-level duplicates.
- Minimum 190-world-pixel sign spacing inside each mission.
- 211/211 playable nouns and verbs have explicit pictograms.
- All five expanded maps, 177 icon files, the companion sheet and Balsamiq Sans load successfully.
- Browser automation passed 45/45 runtime, progression, reward, story, season, pictogram and adaptive-check assertions.
- No browser console or runtime errors in the release test.
