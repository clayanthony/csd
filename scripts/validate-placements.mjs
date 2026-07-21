import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { window: {} };
for (const file of ["lexicon-data.js", "placement-data.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js", file), "utf8"), sandbox);
}

const words = sandbox.window.CREE_LEXICON;
const placements = sandbox.window.CREE_PLACEMENTS;
const meta = sandbox.window.CREE_PLACEMENT_META;
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

check(words.length === 750, `Expected 750 words; found ${words.length}.`);
check(Object.keys(placements).length === 750, `Expected 750 placements; found ${Object.keys(placements).length}.`);

const missions = new Map();
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
}

check(missions.size === 125, `Expected 125 missions; found ${missions.size}.`);
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

const expectedZones = {
  "CR-0034": "abstract", // thank you
  "CR-0319": "food",     // plate
  "CR-0115": "water",    // fish
  "CR-0222": "forest",   // tree/poplar
  "CR-0356": "garden",   // gooseberries
  "CR-0057": "rock",     // stone/rock
  "CR-0065": "path",     // snowshoe
  "CR-0344": "time",     // clock
  "CR-0151": "learning", // book
  "CR-0042": "care",     // hospital
  "CR-0401": "work",     // screwdriver
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
  missions: missions.size,
  uniqueCoordinatesWithinActs: [...coordinatesByAct.values()].reduce((sum, set) => sum + set.size, 0),
  world: meta.world,
  semanticSpotChecks: Object.keys(expectedZones).length
}, null, 2));
