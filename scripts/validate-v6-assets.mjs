import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { window: {} };
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

for (const file of ["lexicon-data-v6.js", "placement-data-v6.js", "word-icon-data-v6.js"]) {
  const sourcePath = path.join(ROOT, "js", file);
  check(fs.existsSync(sourcePath), `Missing data file: js/${file}.`);
  if (fs.existsSync(sourcePath)) vm.runInNewContext(fs.readFileSync(sourcePath, "utf8"), sandbox);
}

const words = sandbox.window.CREE_LEXICON || [];
const icons = sandbox.window.CREE_WORD_ICONS || {};
const pictogramWords = words.filter((word) => word.partOfSpeech === "Noun" || word.partOfSpeech === "Verb");
const iconSources = new Set();

check(words.length === 300, `Expected 300 playable records; found ${words.length}.`);
check(pictogramWords.length === 211, `Expected 211 playable nouns and verbs; found ${pictogramWords.length}.`);
check(Object.keys(icons).length === 211, `Expected 211 word-to-pictogram associations; found ${Object.keys(icons).length}.`);

for (const word of pictogramWords) {
  const icon = icons[word.id];
  check(Boolean(icon), `Missing pictogram association for ${word.id} (${word.cree}).`);
  if (!icon) continue;
  check(Boolean(icon.label), `Missing accessibility label for ${word.id}.`);
  iconSources.add(icon.src);
  check(fs.existsSync(path.join(ROOT, icon.src)), `Missing pictogram file for ${word.id}: ${icon.src}.`);
}

check(iconSources.size === 177, `Expected 177 distinct pictogram files; found ${iconSources.size}.`);

const requiredFiles = [
  "index.html",
  "css/game.css",
  "js/game-v3.js",
  "assets/act-1-home-expanded-v4.png",
  "assets/act-2-land-expanded-v4.png",
  "assets/act-3-time-expanded-v4.png",
  "assets/act-4-community-expanded-v4.png",
  "assets/act-5-meaning-expanded-v4.png",
  "assets/bear-sprites-v2.png",
  "assets/companion-sheet-v6-cropped.png",
  "assets/blank-sign-v3.png",
  "assets/word-signs-v2.png",
  "assets/fonts/balsamiq-sans-latin-400-normal.woff2",
  "assets/fonts/balsamiq-sans-latin-700-normal.woff2",
  "assets/fonts/OFL-Balsamiq-Sans.txt",
  "assets/icons/openmoji/ATTRIBUTION.md",
  "assets/icons/openmoji/LICENSE-CC-BY-SA-4.0.txt"
];
for (const file of requiredFiles) check(fs.existsSync(path.join(ROOT, file)), `Missing required release file: ${file}.`);

const html = fs.existsSync(path.join(ROOT, "index.html")) ? fs.readFileSync(path.join(ROOT, "index.html"), "utf8") : "";
for (const activeScript of ["lexicon-data-v6.js", "placement-data-v6.js", "word-icon-data-v6.js", "game-v3.js"]) {
  check(html.includes(`src=\"js/${activeScript}\"`), `index.html does not load ${activeScript}.`);
}
check(!html.includes("lexicon-data.js\""), "index.html still loads the retired 750-record lexicon.");

if (failures.length) {
  console.error(`V6 asset validation failed (${failures.length}):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: "pass",
  playableRecords: words.length,
  pictogramAssociations: Object.keys(icons).length,
  distinctPictograms: iconSources.size,
  requiredReleaseFiles: requiredFiles.length
}, null, 2));
