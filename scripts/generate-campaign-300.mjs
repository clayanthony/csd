#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [stageInput, placementInput, outputFile] = process.argv.slice(2);
if (!stageInput || !placementInput || !outputFile) {
  console.error("Usage: node generate-campaign-300.mjs STAGES.json PLACEMENTS.json OUTPUT.js");
  process.exit(2);
}

const stageRows = JSON.parse(fs.readFileSync(stageInput, "utf8")).values.slice(4);
const placementRows = JSON.parse(fs.readFileSync(placementInput, "utf8")).values.slice(4);

const worlds = [
  {
    number: 1,
    title: "Homefire",
    subtitle: "Lodge rooms, family circles, and the belongings that make a home",
    map: "assets/act-1-home-v3.png",
    stageStart: 1,
    stageEnd: 10,
  },
  {
    number: 2,
    title: "Hands & Harvest",
    subtitle: "Body knowledge, warm clothing, garden work, and the meadow",
    map: "assets/act-2-land-v3.png",
    stageStart: 11,
    stageEnd: 20,
  },
  {
    number: 3,
    title: "Forest & Wetland",
    subtitle: "Wildlife, waters, forest harvests, and the changing ground",
    map: "assets/act-3-time-v3.png",
    stageStart: 21,
    stageEnd: 30,
  },
  {
    number: 4,
    title: "Lake, Sky & Journey",
    subtitle: "Wild rice, weather, calendars, kitchens, boats, and roads",
    map: "assets/act-5-meaning-v3.png",
    stageStart: 31,
    stageEnd: 40,
  },
  {
    number: 5,
    title: "Community Trail",
    subtitle: "School, clinic, workshop, town, market, feast, and quarry",
    map: "assets/act-4-community-v3.png",
    stageStart: 41,
    stageEnd: 50,
  },
];

const WORLD_BOUNDS = { xMin: 300, xMax: 1236, yMin: 275, yMax: 835 };

function parsePoint(value) {
  const [x, y] = String(value).split(",").map(Number);
  return { x, y };
}

function parseBounds(value) {
  const numbers = String(value).match(/\d+/g)?.map(Number) || [];
  if (numbers.length !== 4) throw new Error(`Could not parse stage bounds: ${value}`);
  return { left: numbers[0], top: numbers[1], right: numbers[2], bottom: numbers[3] };
}

function mapPoint(x, y, bounds) {
  const u = (x - bounds.left) / Math.max(1, bounds.right - bounds.left);
  const v = (y - bounds.top) / Math.max(1, bounds.bottom - bounds.top);
  return {
    x: Math.round(WORLD_BOUNDS.xMin + Math.max(0, Math.min(1, u)) * (WORLD_BOUNDS.xMax - WORLD_BOUNDS.xMin)),
    y: Math.round(WORLD_BOUNDS.yMin + Math.max(0, Math.min(1, v)) * (WORLD_BOUNDS.yMax - WORLD_BOUNDS.yMin)),
  };
}

const stages = stageRows.map((row) => {
  const number = Number(row[0]);
  const bounds = parseBounds(row[3]);
  const spawnMaster = parsePoint(row[4]);
  const world = Math.ceil(number / 10);
  return {
    number,
    world,
    trail: number % 10 === 0 || number % 10 > 5 ? 2 : 1,
    region: row[1],
    title: row[2],
    landmark: row[5],
    route: row[13],
    spawn: mapPoint(spawnMaster.x, spawnMaster.y, bounds),
    bounds,
  };
});

const stageByNumber = new Map(stages.map((stage) => [stage.number, stage]));

const birdWords = new Set([
  "bee", "owl", "eagle", "goose", "duck", "loon", "bird", "grouse", "turkey", "birch grouse", "chicken",
]);
const fishWords = new Set([
  "fish", "whitefish", "jack-fish", "pickerel", "mariah fish", "sturgeon", "trout", "sucker", "tullabee", "seal",
]);
const plantTerms = [
  "berry", "berries", "tree", "leaf", "bush", "grass", "flower", "rose-hip", "lettuce", "muskrat-root", "sage",
];

function animationFor(english, category) {
  const lower = english.toLowerCase();
  if (/meat|beef/.test(lower)) return "still";
  if (lower === "dance") return "dance";
  if (lower === "games") return "bounce";
  if (category === "Person/NPC") return "walk";
  if (category === "Animal/wildlife") {
    if (birdWords.has(lower)) return "fly";
    if (fishWords.has(lower)) return "swim";
    if (lower === "frog" || lower === "rabbit" || lower === "gopher/squirrel") return "hop";
    return "walk";
  }
  if (plantTerms.some((term) => lower.includes(term))) return "sway";
  if (["water", "river", "bay", "lake", "fire", "sky", "snow"].includes(lower)) return "pulse";
  return "still";
}

function displaySize(category, animation) {
  if (category === "Building/place") return 110;
  if (category === "Environmental feature") return 96;
  if (category === "Event/scene proxy") return 100;
  if (["walk", "fly", "swim", "hop", "dance"].includes(animation)) return 88;
  if (category === "Body teaching object") return 82;
  if (category === "Time/calendar proxy") return 86;
  return 78;
}

const words = placementRows.map((row, spriteIndex) => {
  const stageNumber = Number(row[0]);
  const stage = stageByNumber.get(stageNumber);
  if (!stage) throw new Error(`Placement references missing stage ${stageNumber}`);
  const object = mapPoint(Number(row[10]), Number(row[11]), stage.bounds);
  const board = mapPoint(Number(row[12]), Number(row[13]), stage.bounds);
  const english = String(row[6]);
  const category = String(row[8]);
  const animation = animationFor(english, category);
  return {
    id: String(row[4]),
    cree: String(row[5]),
    english,
    grammar: String(row[7]),
    category,
    depiction: String(row[9]),
    stage: stageNumber,
    world: stage.world,
    slot: Number(row[3]),
    sprite: spriteIndex,
    object,
    board,
    placement: String(row[14]),
    physicality: String(row[15]),
    culturalReview: String(row[16]),
    duplicateGloss: String(row[17]),
    languageReview: String(row[18]),
    animation,
    displaySize: displaySize(category, animation),
  };
});

for (const world of worlds) {
  const worldStages = stages.filter((stage) => stage.world === world.number);
  world.trails = [1, 2].map((trailNumber) => {
    const trailStages = worldStages.filter((stage) => stage.trail === trailNumber);
    return {
      number: trailNumber,
      title: trailStages[0].region,
      stageStart: trailStages[0].number,
      stageEnd: trailStages.at(-1).number,
    };
  });
}

if (stages.length !== 50) throw new Error(`Expected 50 stages; found ${stages.length}`);
if (words.length !== 300) throw new Error(`Expected 300 words; found ${words.length}`);
if (new Set(words.map((word) => word.id)).size !== 300) throw new Error("Lexicon IDs must be unique");
for (const stage of stages) {
  const count = words.filter((word) => word.stage === stage.number).length;
  if (count !== 6) throw new Error(`Stage ${stage.number} has ${count} placements instead of 6`);
}

const campaign = {
  version: "300-word-50-arena-v1",
  totals: { worlds: 5, trails: 10, stages: 50, words: 300 },
  worlds,
  stages: stages.map((stage) => Object.fromEntries(
    Object.entries(stage).filter(([key]) => key !== "bounds")
  )),
  words,
};

const banner = "// Generated from Little_Bear_300_Word_50_Arena_Master_Plan(1).xlsx.\n";
const output = `${banner}window.LITTLE_BEAR_CAMPAIGN = ${JSON.stringify(campaign, null, 2)};\n`;
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, output, "utf8");
console.log(`Wrote ${words.length} words across ${stages.length} stages and ${worlds.length} worlds to ${outputFile}`);
