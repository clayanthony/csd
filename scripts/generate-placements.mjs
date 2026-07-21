import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lexiconSource = fs.readFileSync(path.join(ROOT, "js", "lexicon-data-v6.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(lexiconSource, sandbox);
const WORDS = sandbox.window.CREE_LEXICON;

const SCALE = 2;
const WORLD = { width: 3072, height: 2048 };

// Coordinates are authored against the 1536×1024 map art and expanded 2× at export.
// Every point sits on open ground immediately beside the named visible landmark.
const ANCHORS = {
  1: {
    home: [[400, 230], [560, 245], [760, 225], [880, 250]],
    food: [[770, 350], [860, 370], [1130, 250], [1210, 300]],
    garden: [[230, 360], [340, 420], [650, 420], [760, 455]],
    clothing: [[1240, 380], [1320, 430], [1120, 390], [520, 300]],
    play: [[300, 610], [410, 560], [360, 690], [520, 610]],
    work: [[1320, 540], [1220, 590], [1080, 550], [450, 390]],
    community: [[720, 500], [880, 520], [1030, 460], [560, 500]],
    learning: [[470, 300], [680, 290], [920, 310], [540, 520]],
    forest: [[360, 760], [610, 760], [980, 690], [1230, 710]],
    water: [[1110, 270], [1180, 330], [760, 370], [850, 400]],
    rock: [[540, 470], [760, 570], [1020, 550], [1160, 670]],
    animal: [[430, 700], [690, 690], [970, 650], [1260, 650]],
    sky: [[560, 570], [850, 600], [1040, 500], [680, 650]],
    time: [[480, 280], [820, 270], [1030, 440], [730, 540]],
    number: [[1070, 790], [1180, 800], [1110, 700], [940, 760]],
    path: [[500, 520], [840, 520], [1020, 440], [520, 850], [860, 850], [1100, 900]],
    care: [[330, 570], [450, 520], [1210, 420], [1020, 510]],
    abstract: [[430, 510], [650, 540], [900, 500], [1120, 480], [510, 820], [820, 800], [1060, 870]]
  },
  2: {
    home: [[220, 190], [330, 240], [410, 180], [300, 300]],
    food: [[310, 250], [460, 300], [600, 420], [660, 750]],
    garden: [[430, 330], [590, 410], [650, 730], [1090, 560]],
    clothing: [[250, 250], [360, 300], [500, 350], [650, 450]],
    play: [[310, 470], [540, 540], [710, 520], [320, 720]],
    work: [[360, 260], [530, 360], [750, 480], [1000, 430]],
    community: [[380, 300], [580, 360], [730, 470], [1040, 430]],
    learning: [[300, 220], [470, 330], [650, 460], [820, 500]],
    forest: [[400, 150], [540, 200], [1260, 150], [1310, 650], [270, 610]],
    water: [[760, 270], [850, 430], [790, 610], [910, 760], [1060, 900], [1290, 880]],
    rock: [[1060, 180], [1160, 230], [320, 620], [250, 830], [1080, 650]],
    animal: [[300, 450], [500, 530], [690, 510], [330, 710], [610, 850], [1120, 700]],
    sky: [[600, 270], [1120, 380], [470, 500], [1020, 500]],
    time: [[400, 290], [610, 360], [980, 460], [1140, 620]],
    number: [[420, 460], [560, 550], [680, 680], [1080, 680]],
    path: [[500, 280], [650, 380], [720, 500], [500, 700], [760, 820], [1160, 620]],
    care: [[330, 260], [470, 430], [640, 520], [1120, 500]],
    abstract: [[430, 300], [580, 490], [730, 420], [1050, 420], [470, 730], [740, 800], [1120, 700]]
  },
  3: {
    home: [[260, 210], [390, 250], [470, 190], [370, 340]],
    food: [[280, 220], [420, 280], [360, 560], [480, 620]],
    garden: [[250, 540], [380, 570], [480, 650], [300, 700]],
    clothing: [[300, 240], [430, 310], [1160, 700], [1260, 760]],
    play: [[330, 620], [520, 720], [1130, 510], [1210, 570]],
    work: [[260, 250], [420, 330], [620, 400], [1150, 500]],
    community: [[580, 470], [700, 430], [760, 540], [1160, 510]],
    learning: [[340, 260], [520, 350], [650, 470], [1180, 500]],
    forest: [[220, 300], [280, 480], [1250, 240], [1260, 630], [530, 830]],
    water: [[880, 300], [920, 470], [930, 640], [970, 810]],
    rock: [[520, 400], [820, 370], [1080, 450], [1070, 720]],
    animal: [[330, 500], [500, 650], [1100, 420], [1210, 660]],
    sky: [[760, 180], [840, 250], [1100, 220], [650, 300]],
    time: [[260, 360], [420, 430], [1190, 300], [1240, 680], [630, 780]],
    number: [[540, 470], [640, 410], [740, 470], [650, 570]],
    path: [[320, 760], [530, 700], [760, 650], [1060, 560], [1150, 780]],
    care: [[340, 300], [520, 420], [1110, 520], [1220, 710]],
    abstract: [[360, 420], [520, 520], [760, 600], [1060, 520], [1120, 740], [620, 820], [850, 760]]
  },
  4: {
    home: [[250, 250], [420, 280], [860, 230], [1150, 250]],
    food: [[1050, 500], [1160, 540], [1220, 480], [680, 270]],
    garden: [[240, 410], [360, 470], [420, 420], [570, 350]],
    clothing: [[270, 680], [360, 720], [520, 660], [840, 320]],
    play: [[580, 700], [700, 760], [800, 700], [910, 640]],
    work: [[820, 230], [950, 250], [1080, 250], [900, 390]],
    community: [[620, 490], [730, 540], [840, 500], [1050, 700]],
    learning: [[250, 240], [420, 270], [560, 280], [990, 750]],
    forest: [[450, 680], [850, 850], [1170, 820], [570, 900]],
    water: [[1360, 260], [1400, 450], [1370, 690], [1210, 900]],
    rock: [[500, 530], [850, 590], [1080, 640], [1200, 820]],
    animal: [[460, 600], [850, 650], [1060, 600], [1230, 740]],
    sky: [[590, 420], [900, 420], [1120, 430], [760, 620]],
    time: [[380, 300], [620, 350], [860, 430], [1080, 650]],
    number: [[660, 500], [760, 450], [820, 560], [1030, 740]],
    path: [[430, 600], [820, 610], [980, 550], [760, 860], [1130, 860]],
    care: [[240, 680], [360, 720], [530, 660], [850, 690]],
    abstract: [[430, 520], [650, 600], [840, 520], [1010, 620], [500, 840], [850, 850], [1110, 800]]
  },
  5: {
    home: [[680, 220], [790, 250], [310, 670], [1050, 720]],
    food: [[220, 370], [330, 390], [1080, 700], [1180, 730]],
    garden: [[420, 300], [530, 360], [980, 460], [1060, 560]],
    clothing: [[360, 500], [560, 550], [930, 620], [1110, 720]],
    play: [[340, 420], [520, 500], [900, 600], [1120, 700]],
    work: [[230, 650], [340, 620], [690, 760], [820, 790]],
    community: [[220, 380], [330, 360], [720, 210], [1110, 700]],
    learning: [[650, 210], [790, 240], [230, 650], [360, 650]],
    forest: [[420, 190], [540, 280], [1040, 560], [880, 900]],
    water: [[720, 560], [790, 520], [980, 740], [1080, 820]],
    rock: [[430, 470], [720, 620], [920, 580], [660, 800]],
    animal: [[460, 380], [900, 460], [1040, 600], [840, 780]],
    sky: [[1160, 290], [1290, 310], [840, 280], [1000, 380]],
    time: [[340, 370], [520, 430], [1020, 450], [680, 780]],
    number: [[520, 780], [650, 800], [790, 820], [900, 780]],
    path: [[470, 430], [630, 480], [840, 430], [940, 560], [600, 680], [900, 700]],
    care: [[300, 390], [980, 460], [1080, 700], [1160, 740]],
    abstract: [[330, 500], [520, 590], [680, 660], [880, 620], [1020, 800], [580, 900], [1120, 880]]
  }
};

const LANDMARKS = {
  1: { home: "home", food: "shared table or outdoor kitchen", garden: "vegetable garden", clothing: "laundry line or home", play: "playground", work: "tool shed", community: "shared clearing", learning: "home learning area", forest: "tree line", water: "outdoor kitchen/drink area", rock: "rock edge", animal: "forest edge", sky: "open clearing", time: "home path", number: "stone circle", path: "looping home trail", care: "home or play area", abstract: "neutral home-trail clearing" },
  2: { home: "trail cabin", food: "cabin or berry patch", garden: "berry patch", clothing: "trail cabin", play: "meadow clearing", work: "trail route", community: "main trail junction", learning: "trail cabin", forest: "forest edge", water: "river, wetland, or shoreline", rock: "rocky hill", animal: "meadow or habitat edge", sky: "open-sky clearing", time: "main trail", number: "meadow clearing", path: "land trail or bridge approach", care: "cabin-side clearing", abstract: "neutral land-trail clearing" },
  3: { home: "seasonal storehouse", food: "storehouse supplies", garden: "spring or summer garden", clothing: "seasonal supply area", play: "seasonal clearing", work: "storehouse or route", community: "counting circle", learning: "storehouse learning area", forest: "seasonal grove", water: "stream bank", rock: "marker-stone area", animal: "seasonal habitat edge", sky: "sunlit clearing", time: "seasonal zone", number: "counting-stone circle", path: "sequence route", care: "seasonal shelter area", abstract: "neutral time-trail clearing" },
  4: { home: "community building", food: "shared cooking tables", garden: "community garden", clothing: "care or work area", play: "playground or playfield", work: "workshop", community: "gathering pavilion", learning: "school or outdoor library", forest: "community forest edge", water: "river edge", rock: "trail edge", animal: "open community edge", sky: "open playfield", time: "community path", number: "gathering circle", path: "community route or bridge", care: "care and safety station", abstract: "neutral community clearing" },
  5: { home: "reading pavilion", food: "participant seating", garden: "reflection grove", clothing: "neutral trail clearing", play: "question circle", work: "notice-board area", community: "participant circle", learning: "reading pavilion or notice board", forest: "reflection grove", water: "footbridge and stream", rock: "marker-stone clearing", animal: "grove edge", sky: "river-valley overlook", time: "sequencing path", number: "marker-stone clearing", path: "crossroads", care: "paired benches", abstract: "seeded neutral meaning-trail location" }
};

const CHAPTER_DEFAULTS = {
  1: "home", 2: "home", 3: "community", 4: "clothing", 5: "food",
  6: "animal", 7: "animal", 8: "garden", 9: "water", 10: "sky",
  11: "time", 12: "time", 13: "number", 14: "path", 15: "work",
  16: "learning", 17: "work", 18: "care", 19: "play", 20: "community",
  21: "community", 22: "path", 23: "abstract", 24: "path", 25: "learning"
};

const RULES = [
  ["water", ["fish", "whitefish", "jack-fish", "pickerel", "sturgeon", "trout", "sucker", "tullabee", "seal", "water", "lake", "river", "creek", "bay", "shore", "wetland", "underwater", "canoe", "boat", "paddle", "swim", "ice"]],
  ["forest", ["tree", "poplar", "spruce", "pine", "birch", "forest", "wood", "firewood", "log", "branch", "leaf", "willow"]],
  ["garden", ["berry", "berries", "blueberry", "raspberry", "strawberry", "cranberry", "cranberries", "gooseberry", "gooseberries", "saskatoon berries", "rose-hip", "plant", "flower", "grass", "root", "seed", "garden", "bush", "beet", "beets", "lettuce", "onion", "carrot", "turnip", "corn", "potato", "potatoes", "beans", "tomato", "sage"]],
  ["rock", ["stone", "rock", "hill", "mountain", "valley", "earth", "ground", "soil", "sand", "cave", "hole"]],
  ["sky", ["sun", "moon", "star", "sky", "cloud", "rain", "snows", "snow", "wind", "storm", "thunder", "lightning", "weather", "freeze", "freezes", "freeze-up", "cold", "warm", "hot", "dark", "light", "sundown"]],
  ["time", ["year", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "month", "season", "spring", "summer", "fall", "winter", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "minute", "morning", "afternoon", "evening", "night", "today", "tomorrow", "yesterday", "before", "after", "early", "late", "later", "soon", "always", "again", "once", "sometimes", "first", "last", "while", "clock", "calendar", "time"]],
  ["learning", ["read", "write", "book", "paper", "pen", "pencil", "chalk", "letter", "word", "language", "school", "class", "student", "teacher", "story", "sentence", "question", "answer", "speak", "listen", "teach", "name"]],
  ["path", ["walk", "run", "jump", "go", "arrive", "return", "visit", "leave", "travel", "drive", "ride", "car", "snowshoe", "road", "trail", "path", "route", "direction", "north", "south", "east", "west", "left", "right", "uphill", "downhill", "overland", "inland", "across", "through", "around", "near", "far", "turn", "from", "along"]],
  ["food", ["food", "meal", "feast", "eat", "breakfast", "drink", "cook", "roast", "bake", "bread", "bannock", "cake", "soup", "tea", "coffee", "milk", "cream", "butter", "sugar", "salt", "pepper", "meat", "beef", "pork", "mutton", "bacon", "sausage", "sausages", "ham", "pemmican", "egg", "rice", "oatmeal", "candy", "honey", "apple", "banana", "plate", "cup", "fork", "spoon", "table", "kettle", "frying-pan", "oven"]],
  ["clothing", ["clothes", "clothing", "shirt", "pants", "shorts", "skirt", "coat", "jacket", "parka", "raincoat", "dress", "shoe", "moccasin", "boot", "sock", "belt", "hat", "cap", "mitt", "glove", "scarf", "blanket", "undress", "wear"]],
  ["home", ["home", "house", "indoors", "room", "bed", "cupboard", "box", "bag", "door", "window", "wall", "ceiling", "lamp", "stove", "fridge", "freezer", "telephone", "pail", "tub", "chair", "tent", "camp", "lay down", "sit down", "rest", "snore"]],
  ["work", ["work", "make", "build", "repair", "fix", "carry", "bring", "take", "give", "buy", "help", "feed", "find", "search", "finish", "succeed", "tool", "screwdriver", "hammer", "axe", "knife", "nail", "sew", "bead", "wipe", "flatten", "dry dishes", "wash dishes", "cut", "place", "hold", "open", "close"]],
  ["play", ["play", "game", "games", "ball", "jump", "dance", "sing", "music", "doll", "gym", "exercise", "chase", "strong", "fast", "fun"]],
  ["care", ["medicine", "hospital", "washroom", "wash", "bath", "brush teeth", "feel", "happy", "sad", "cry", "angry", "afraid", "sick", "hurt", "healthy", "safe", "care", "body", "brain", "head", "hair", "forehead", "nose", "tooth", "tongue", "hand", "finger", "fingernail", "foot", "leg", "eye", "eye-glasses", "ear", "mouth", "heart", "skin", "bone", "ready", "want", "like", "know", "think", "surprise", "confuse"]],
  ["community", ["town", "reserve", "store", "hotel", "motel", "library", "café", "drug store", "person", "people", "family", "mother", "father", "grandmother", "grandfather", "sister", "brother", "sibling", "son", "daughter", "parent", "child", "baby", "friend", "woman", "man", "girl", "boy", "boss", "chief", "leader", "elder", "visitor", "everyone", "together", "community", "gift", "welcome", "call", "invite"]]
];

const MIN_MISSION_SPACING = 190;
const PREFERRED_POINTS = {
  // Keep the flagship picture boards unmistakably adjacent to their literal
  // landmarks in representative play captures.
  "CR-0222": { x: 2300, y: 1440 }
};

function actForChapter(chapter) {
  return Math.ceil(chapter / 5);
}

function isAbstractPartOfSpeech(partOfSpeech) {
  return /interjection|pronoun|particle|conjunction|preverb|question word/i.test(partOfSpeech || "");
}

function containsWholeTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${escaped}(?=$|[^a-z])`, "i").test(text);
}

function classify(word) {
  const text = `${word.english} ${word.contextNote || ""}`.toLowerCase();
  for (const [zone, terms] of RULES) {
    if (terms.some((term) => containsWholeTerm(text, term))) return zone;
  }
  if (word.chapter === 13) return "number";
  // After literal meaning rules have had first refusal, conversational and
  // grammatical forms use neutral clearings distributed across the act.
  if (isAbstractPartOfSpeech(word.partOfSpeech)) return "abstract";
  if (/location word/i.test(word.partOfSpeech || "")) return "path";
  if (/\b(thank|yes|no|okay|perhaps|maybe|but|and|because|why|who|what|which|how|where|when)\b/.test(text)) return "abstract";
  return CHAPTER_DEFAULTS[word.chapter] || "abstract";
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function candidate(word, zone, attempt) {
  const act = actForChapter(word.chapter);
  const points = ANCHORS[act][zone] || ANCHORS[act].abstract;
  const seed = hash(`${word.id}:${zone}:${attempt}`);
  const anchor = points[(seed + attempt) % points.length];
  const jitterX = ((seed >>> 8) % 141) - 70;
  const jitterY = ((seed >>> 17) % 121) - 60;
  return {
    x: Math.max(150, Math.min(WORLD.width - 150, Math.round((anchor[0] + jitterX) * SCALE))),
    y: Math.max(180, Math.min(WORLD.height - 100, Math.round((anchor[1] + jitterY) * SCALE)))
  };
}

const placements = {};
const usedExact = new Set();
const byMission = new Map();
for (const word of WORDS) {
  const key = `${word.chapter}-${word.mission}`;
  const already = byMission.get(key) || [];
  const zone = classify(word);
  let point;
  let accepted = false;
  for (let attempt = 0; attempt < 1200; attempt += 1) {
    const proposed = attempt === 0 && PREFERRED_POINTS[word.id]
      ? PREFERRED_POINTS[word.id]
      : candidate(word, zone, attempt);
    const exact = `${actForChapter(word.chapter)}:${proposed.x}:${proposed.y}`;
    const clear = already.every((other) => Math.hypot(other.x - proposed.x, other.y - proposed.y) >= MIN_MISSION_SPACING);
    if (!usedExact.has(exact) && clear) {
      point = proposed;
      usedExact.add(exact);
      accepted = true;
      break;
    }
  }
  if (!accepted) {
    throw new Error(`Unable to place ${word.id} (${word.cree}) in ${zone} without a collision.`);
  }
  const entry = {
    x: point.x,
    y: point.y,
    zone,
    landmark: LANDMARKS[actForChapter(word.chapter)][zone],
    abstract: zone === "abstract"
  };
  placements[word.id] = entry;
  already.push(entry);
  byMission.set(key, already);
}

const output = `(() => {\n  "use strict";\n\n  window.CREE_PLACEMENT_META = Object.freeze(${JSON.stringify({ version: 6, world: WORLD, mapScale: SCALE, total: WORDS.length }, null, 2)});\n  window.CREE_PLACEMENTS = Object.freeze(${JSON.stringify(placements, null, 2)});\n})();\n`;
fs.writeFileSync(path.join(ROOT, "js", "placement-data-v6.js"), output);

const zoneCounts = {};
for (const entry of Object.values(placements)) zoneCounts[entry.zone] = (zoneCounts[entry.zone] || 0) + 1;
const rows = WORDS.map((word) => {
  const placement = placements[word.id];
  return `| ${word.id} | ${word.cree.replaceAll("|", "\\|")} | ${word.english.replaceAll("|", "\\|")} | ${actForChapter(word.chapter)} | ${word.chapter} | ${word.mission} | ${placement.zone} | ${placement.landmark} | ${placement.x}, ${placement.y} |`;
});
const audit = `# V6 Semantic Placement Audit\n\nGenerated from the curated ${WORDS.length}-record beginner campaign. Every record has one unique, deterministic world coordinate within its act. Concrete meanings use visible landmark zones; abstract and conversational forms use seeded neutral clearings.\n\n- Records: **${WORDS.length}**\n- Missions: **${byMission.size}**\n- World size: **${WORLD.width} × ${WORLD.height}**\n- Exact duplicate coordinates within an act: **${WORDS.length - usedExact.size}**\n- Minimum within-mission spacing: **${MIN_MISSION_SPACING} world pixels**\n\n## Zone counts\n\n${Object.entries(zoneCounts).sort((a, b) => b[1] - a[1]).map(([zone, count]) => `- ${zone}: ${count}`).join("\n")}\n\n## Complete placement manifest\n\n| ID | Cree form | English support | Act | Chapter | Mission | Zone | Visible landmark | Coordinate |\n|---|---|---|---:|---:|---:|---|---|---|\n${rows.join("\n")}\n`;
fs.writeFileSync(path.join(ROOT, "PLACEMENT_AUDIT_V6.md"), audit);

console.log(JSON.stringify({ records: WORDS.length, missions: byMission.size, uniqueCoordinates: usedExact.size, zoneCounts }, null, 2));
