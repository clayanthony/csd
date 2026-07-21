import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { window: {} };
for (const file of ["lexicon-data-v6.js", "placement-data-v6.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js", file), "utf8"), sandbox);
}

const words = sandbox.window.CREE_LEXICON;
const placements = sandbox.window.CREE_PLACEMENTS;
const meta = sandbox.window.CREE_PLACEMENT_META;
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(words.length === 300, `Expected 300 words; found ${words.length}.`);
check(Object.keys(placements).length === 300, `Expected 300 placements; found ${Object.keys(placements).length}.`);
check(meta.total === 300, `Expected placement metadata total 300; found ${meta.total}.`);
check(meta.world?.width === 3072 && meta.world?.height === 2048, `Expected a 3072×2048 world; found ${meta.world?.width}×${meta.world?.height}.`);

const missions = new Map();
const chapters = new Map();
const acts = new Map();
const coordinatesByAct = new Map();
for (const word of words) {
  const placement = placements[word.id];
  const act = Math.ceil(word.chapter / 5);
  check(Boolean(placement), `Missing placement for ${word.id}.`);
  if (!placement) continue;
  check(placement.x >= 150 && placement.x <= meta.world.width - 150, `${word.id} x coordinate is out of bounds.`);
  check(placement.y >= 180 && placement.y <= meta.world.height - 100, `${word.id} y coordinate is out of bounds.`);
  check(Boolean(placement.zone && placement.landmark), `${word.id} lacks semantic placement metadata.`);
  const coordinate = `${placement.x}:${placement.y}`;
  const actCoordinates = coordinatesByAct.get(act) || new Set();
  check(!actCoordinates.has(coordinate), `${word.id} duplicates coordinate ${coordinate} in Act ${act}.`);
  actCoordinates.add(coordinate);
  coordinatesByAct.set(act, actCoordinates);
  const key = `${word.chapter}-${word.mission}`;
  const mission = missions.get(key) || [];
  mission.push({ word, placement });
  missions.set(key, mission);

  const chapter = chapters.get(word.chapter) || [];
  chapter.push(word);
  chapters.set(word.chapter, chapter);

  const actWords = acts.get(act) || [];
  actWords.push(word);
  acts.set(act, actWords);
}

check(missions.size === 50, `Expected 50 missions; found ${missions.size}.`);
check(chapters.size === 25, `Expected 25 chapters; found ${chapters.size}.`);
check(acts.size === 5, `Expected 5 acts; found ${acts.size}.`);
for (const [key, mission] of missions) {
  check(mission.length === 6, `Mission ${key} has ${mission.length} placements instead of 6.`);
  for (let i = 0; i < mission.length; i += 1) {
    for (let j = i + 1; j < mission.length; j += 1) {
      const a = mission[i].placement;
      const b = mission[j].placement;
      check(Math.hypot(a.x - b.x, a.y - b.y) >= 190, `Mission ${key} has overlapping signs ${mission[i].word.id} and ${mission[j].word.id}.`);
    }
  }
}
for (const [chapterNumber, chapterWords] of chapters) {
  check(chapterWords.length === 12, `Chapter ${chapterNumber} has ${chapterWords.length} words instead of 12.`);
  check(new Set(chapterWords.map((word) => word.mission)).size === 2, `Chapter ${chapterNumber} does not contain exactly two missions.`);
}
for (const [actNumber, actWords] of acts) {
  check(actWords.length === 60, `Act ${actNumber} has ${actWords.length} words instead of 60.`);
}

const expectedZones = {
  "CR-0034": "abstract", // thank you
  "CR-0319": "food",     // plate
  "CR-0115": "water",    // fish
  "CR-0222": "forest",   // tree/poplar
  "CR-0219": "garden",   // berry
  "CR-0057": "rock",     // stone/rock
  "CR-0209": "path",     // road
  "CR-0061": "time",     // year
  "CR-0151": "learning", // book
  "CR-0042": "care",     // hospital
  "CR-0717": "work",     // work
  "CR-0898": "play"      // play
};
for (const [id, zone] of Object.entries(expectedZones)) {
  check(placements[id]?.zone === zone, `${id} should be in ${zone}, not ${placements[id]?.zone}.`);
}

if (failures.length) {
  console.error(`Placement validation failed (${failures.length}):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: "pass",
  records: words.length,
  acts: acts.size,
  chapters: chapters.size,
  missions: missions.size,
  uniqueCoordinatesWithinActs: [...coordinatesByAct.values()].reduce((sum, set) => sum + set.size, 0),
  world: meta.world,
  semanticSpotChecks: Object.keys(expectedZones).length
}, null, 2));
