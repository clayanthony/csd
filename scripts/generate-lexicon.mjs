import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, "..");
const source = path.resolve(project, "../tmp/story/story_map.json");
const destination = path.join(project, "js/lexicon-data.js");
const storyMap = JSON.parse(await readFile(source, "utf8"));

const words = storyMap.words.map((word) => ({
  id: word.lexicon_id,
  cree: word.cree,
  english: word.english,
  partOfSpeech: word.part_of_speech,
  grammaticalClass: word.grammatical_class,
  animacy: word.animacy_or_government,
  chapter: word.chapter,
  chapterTitle: word.chapter_title,
  mission: word.mission,
  missionTitle: word.mission_title,
  order: word.global_story_order,
  contextNote: word.context_note,
  verificationPriority: word.verification_priority
}));

const chapters = storyMap.chapters.map((chapter) => ({
  chapter: chapter.chapter,
  act: chapter.act,
  actTitle: chapter.act_title,
  title: chapter.title,
  theme: chapter.theme,
  story: chapter.story,
  grammar: chapter.grammar
}));

const output = `/* Generated from the project's independently structured 750-word curriculum. */\n` +
  `window.CREE_LEXICON = ${JSON.stringify(words, null, 2)};\n` +
  `window.CREE_CHAPTERS = ${JSON.stringify(chapters, null, 2)};\n`;

await writeFile(destination, output, "utf8");
console.log(`Wrote ${words.length} entries to ${destination}`);
