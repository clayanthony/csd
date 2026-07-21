(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const ui = Object.fromEntries([
    "hud", "objective", "seen-count", "location-label", "title-screen", "start-button", "continue-button",
    "mission-banner", "mission-banner-kicker", "mission-banner-title", "mission-banner-name", "mission-banner-theme",
    "mission-word-preview", "begin-mission-button", "word-card", "word-icon", "exposure-label", "cree-word",
    "english-word", "translation-note", "word-meta", "translation-button", "word-continue-button", "challenge",
    "challenge-kind-label", "round-label", "challenge-prompt", "challenge-word", "challenge-instruction", "choice-grid",
    "challenge-feedback", "next-round-button", "complete-screen", "complete-title", "complete-copy", "complete-seen",
    "complete-correct", "keep-exploring-button", "journal", "journal-chapter", "journal-list", "journal-total",
    "previous-chapter-button", "next-chapter-button", "journal-translation-button", "journal-close-button", "journal-button",
    "journey-map", "map-button", "map-close-button", "map-act-number", "map-act-name", "previous-act-button",
    "next-act-button", "act-progress-label", "chapter-grid", "selected-chapter-label", "selected-chapter-title",
    "selected-chapter-theme", "mission-grid", "campaign-total", "campaign-missions", "pause-menu", "resume-button",
    "pause-map-button", "restart-button", "restart-confirm", "cancel-restart-button", "confirm-restart-button",
    "ending-screen", "ending-map-button", "toast", "menu-button", "button-a", "button-b", "season-label",
    "companion-label", "friendship-level", "leaf-count", "companion-portrait", "companion-role", "story-prompt",
    "complete-leaves", "complete-friendship", "learner-report-button", "learner-report", "learner-report-close-button",
    "report-encountered", "report-accuracy", "report-review-count", "report-leaves", "report-hardest-list"
  ].map((id) => [camel(id), document.querySelector(`#${id}`)]));

  const SAVE_KEY = "little-bear-words-of-home-focused-campaign-v6";
  const VIEW = { width: 768, height: 512 };
  const WORLD = window.CREE_PLACEMENT_META?.world || { width: 3072, height: 2048 };
  const WORDS = window.CREE_LEXICON;
  const CHAPTERS = window.CREE_CHAPTERS;
  const PLACEMENTS = window.CREE_PLACEMENTS || {};
  const WORD_ICONS = window.CREE_WORD_ICONS || {};
  const CURRICULUM = window.CREE_CURRICULUM_META || { totalWords: WORDS.length, missionsPerChapter: 2, totalMissions: 50 };
  const TOTAL_WORDS = CURRICULUM.totalWords;
  const MISSIONS_PER_CHAPTER = CURRICULUM.missionsPerChapter;
  const TOTAL_MISSIONS = CURRICULUM.totalMissions;
  const TOTAL_CHAPTERS = CHAPTERS.length;
  const ACT_NAMES = ["Words Close to Home", "Words on the Land", "Words Through Time", "Words With Others", "Making Meaning"];
  const COMPANIONS = [
    { name: "Moss", role: "HOME BUILDER", sprite: 0, story: "Moss is preparing the home clearing. Find words that help everyone begin, point, dress, and share food." },
    { name: "Reed", role: "LAND GUIDE", sprite: 1, story: "Reed knows the paths between forest and water. Find words for animals, plants, weather, and safe travel." },
    { name: "Tansy", role: "SEASON KEEPER", sprite: 2, story: "Tansy watches the seasons change. Find words for time, counting, movement, and everyday routines." },
    { name: "Pip", role: "COMMUNITY HELPER", sprite: 3, story: "Pip is helping around the community. Find words for learning, work, feelings, play, and gathering places." },
    { name: "Ink", role: "STORY READER", sprite: 4, story: "Ink is opening the final reading trail. Find the small words and actions that help a basic thought take shape." }
  ];
  const KNOWN_ICONS = { maskwa: 0, "mîtos": 1, asiniy: 2, "nîpiy": 3, "mînis": 4, "kinosêw": 5 };
  const MAP_SOURCES = [
    "assets/act-1-home-expanded-v4.png",
    "assets/act-2-land-expanded-v4.png",
    "assets/act-3-time-expanded-v4.png",
    "assets/act-4-community-expanded-v4.png",
    "assets/act-5-meaning-expanded-v4.png"
  ];

  const assets = {
    maps: MAP_SOURCES.map(() => new Image()),
    bear: new Image(),
    signs: new Image(),
    blankSign: new Image(),
    companions: new Image(),
    pictograms: new Map([...new Set(Object.values(WORD_ICONS).map((entry) => entry.src))].map((source) => [source, new Image()]))
  };
  const held = new Set();
  let assetsReady = false;
  let mode = "title";
  let previousMode = "play";
  let activeWord = null;
  let wordEnglishVisible = true;
  let challengeKind = "mission";
  let challengeRounds = [];
  let challengePool = [];
  let challengeIndex = 0;
  let challengeAnswered = false;
  let challengeSelection = 0;
  let challengeScore = 0;
  let currentChoices = [];
  let currentDirection = "forward";
  let mapActView = 1;
  let selectedMapChapter = 1;
  let camera = { x: 0, y: 0 };
  let lastTime = performance.now();
  let toastTimer = 0;
  let gamepadPrevious = [];

  const freshState = () => ({
    player: { x: 410, y: 750, direction: "up", step: 0 },
    chapter: 1,
    mission: 1,
    activeMissionKey: "1-1",
    missionSeen: [],
    exposures: {},
    completedMissions: [],
    completedChapters: [],
    completedActs: [],
    totalCorrect: 0,
    totalAttempts: 0,
    pendingAdvance: null,
    campaignFinished: false,
    journalChapter: 1,
    journalEnglish: true,
    trailLeaves: 0,
    relationships: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    rewards: [],
    reviewQueue: [],
    wordStats: {}
  });
  let state = freshState();

  function camel(id) {
    return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  function chapterInfo(number = state.chapter) {
    return CHAPTERS.find((chapter) => chapter.chapter === number);
  }

  function actForChapter(chapter = state.chapter) {
    return Math.ceil(chapter / 5);
  }

  function currentCompanion() {
    return COMPANIONS[actForChapter() - 1];
  }

  function seasonForChapter(chapter = state.chapter) {
    if (chapter <= 5) return "SPRING";
    if (chapter <= 10) return "SUMMER";
    if (chapter === 11) return "SPRING";
    if (chapter === 12) return "SUMMER";
    if (chapter === 13) return "AUTUMN";
    if (chapter <= 15) return "WINTER";
    if (chapter <= 20) return "AUTUMN";
    return "WINTER";
  }

  function friendshipHearts(act = actForChapter()) {
    const filled = Math.min(5, Math.ceil((state.relationships[act] || 0) / 2));
    return `${"♥".repeat(filled)}${"♡".repeat(5 - filled)}`;
  }

  function missionKey(chapter = state.chapter, mission = state.mission) {
    return `${chapter}-${mission}`;
  }

  function wordsForMission(chapter = state.chapter, mission = state.mission) {
    return WORDS.filter((word) => word.chapter === chapter && word.mission === mission).sort((a, b) => a.order - b.order);
  }

  function wordsForChapter(chapter = state.chapter) {
    return WORDS.filter((word) => word.chapter === chapter).sort((a, b) => a.order - b.order);
  }

  function wordsForAct(act = actForChapter()) {
    return WORDS.filter((word) => actForChapter(word.chapter) === act).sort((a, b) => a.order - b.order);
  }

  function currentMissionWords() {
    return wordsForMission();
  }

  function currentHotspots() {
    return currentMissionWords().map((word, slot) => {
      const placement = PLACEMENTS[word.id];
      if (!placement) throw new Error(`Missing semantic placement for ${word.id}.`);
      return { ...placement, slot, wordId: word.id };
    });
  }

  function missionTitle(chapter = state.chapter, mission = state.mission) {
    return wordsForMission(chapter, mission)[0]?.missionTitle || `Mission ${mission}`;
  }

  function hasSave() {
    return Boolean(localStorage.getItem(SAVE_KEY));
  }

  function saveState() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    ui.continueButton.classList.remove("hidden");
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!saved) return false;
      state = {
        ...freshState(),
        ...saved,
        player: { ...freshState().player, ...(saved.player || {}) },
        exposures: saved.exposures || {},
        missionSeen: saved.missionSeen || [],
        completedMissions: saved.completedMissions || [],
        completedChapters: saved.completedChapters || [],
        completedActs: saved.completedActs || [],
        relationships: { ...freshState().relationships, ...(saved.relationships || {}) },
        rewards: saved.rewards || [],
        reviewQueue: saved.reviewQueue || [],
        wordStats: saved.wordStats || {}
      };
      return true;
    } catch {
      return false;
    }
  }

  function setMode(next) {
    if (mode !== next && !["title", "pause", "map", "journal"].includes(mode)) previousMode = mode;
    mode = next;
    if (next !== "play") {
      clearTimeout(toastTimer);
      ui.toast.classList.add("hidden");
    }
    const visible = {
      title: ui.titleScreen,
      mission: ui.missionBanner,
      word: ui.wordCard,
      challenge: ui.challenge,
      complete: ui.completeScreen,
      journal: ui.journal,
      map: ui.journeyMap,
      pause: ui.pauseMenu,
      report: ui.learnerReport,
      confirm: ui.restartConfirm,
      ending: ui.endingScreen
    };
    Object.entries(visible).forEach(([name, element]) => element.classList.toggle("hidden", name !== mode));
    ui.hud.classList.toggle("hidden", !["play", "word"].includes(mode));
    updateHud();
  }

  function beginGame(useSave) {
    if (useSave) loadState();
    else {
      state = freshState();
      localStorage.removeItem(SAVE_KEY);
    }
    if (state.campaignFinished) {
      setMode("ending");
      return;
    }
    if (state.pendingAdvance) {
      renderCompletionFromPending();
      return;
    }
    prepareMission(state.chapter, state.mission, false);
  }

  function prepareMission(chapter, mission, forceReset = true) {
    const key = missionKey(chapter, mission);
    state.chapter = chapter;
    state.mission = mission;
    if (forceReset || state.activeMissionKey !== key) {
      state.activeMissionKey = key;
      state.missionSeen = [];
    }
    const first = currentHotspots()[0];
    state.player = {
      x: clamp(first.x, 42, WORLD.width - 42),
      y: clamp(first.y + 96, 72, WORLD.height - 38),
      direction: "up",
      step: 0
    };
    camera.x = clamp(state.player.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    camera.y = clamp(state.player.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    state.pendingAdvance = null;
    renderMissionBanner();
    saveState();
    setMode("mission");
  }

  function renderMissionBanner() {
    const chapter = chapterInfo();
    const words = currentMissionWords();
    ui.missionBannerKicker.textContent = `ACT ${actForChapter()} · CHAPTER ${state.chapter}`;
    ui.missionBannerTitle.textContent = chapter.title;
    ui.missionBannerName.textContent = `Mission ${state.mission} · ${missionTitle()}`;
    ui.missionBannerTheme.textContent = chapter.story || sentenceCase(chapter.theme);
    const companion = currentCompanion();
    ui.companionRole.textContent = `${companion.name.toUpperCase()} · ${companion.role}`;
    ui.storyPrompt.textContent = `${companion.story} Today: ${missionTitle()}.`;
    drawCompanionPortrait();
    ui.missionWordPreview.replaceChildren();
    words.forEach((word, index) => {
      const chip = document.createElement("span");
      chip.textContent = state.exposures[word.id] ? word.cree : `WORD ${index + 1}`;
      ui.missionWordPreview.append(chip);
    });
  }

  function startMissionPlay() {
    setMode("play");
    canvas.focus();
    showToast("Follow the golden compass to six meaning-matched signs.");
  }

  function missionSeenCount() {
    return currentMissionWords().filter((word) => state.missionSeen.includes(word.id)).length;
  }

  function totalEncountered() {
    return WORDS.filter((word) => (state.exposures[word.id] || 0) > 0).length;
  }

  function updateHud() {
    if (!ui.locationLabel) return;
    const seen = missionSeenCount();
    const companion = currentCompanion();
    ui.locationLabel.textContent = `ACT ${actForChapter()} · CHAPTER ${state.chapter} · MISSION ${state.mission}`;
    ui.seenCount.textContent = `${totalEncountered()}/${TOTAL_WORDS}`;
    ui.objective.textContent = seen < 6 ? `${missionTitle()} · find six word signs · ${seen}/6` : "Mission check ready";
    ui.seasonLabel.textContent = seasonForChapter();
    ui.companionLabel.textContent = companion.name.toUpperCase();
    ui.friendshipLevel.textContent = friendshipHearts();
    ui.leafCount.textContent = String(state.trailLeaves || 0);
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.add("hidden"), 2600);
  }

  function nearestHotspot() {
    let nearest = null;
    let distance = Infinity;
    for (const hotspot of currentHotspots()) {
      const candidate = Math.hypot(state.player.x - hotspot.x, state.player.y - hotspot.y);
      if (candidate < distance) {
        nearest = hotspot;
        distance = candidate;
      }
    }
    return distance <= 110 ? nearest : null;
  }

  function companionPosition() {
    const first = currentHotspots()[0];
    return {
      x: clamp(first.x - 185, 80, WORLD.width - 80),
      y: clamp(first.y + 32, 100, WORLD.height - 40)
    };
  }

  function companionIsNear() {
    const companion = companionPosition();
    return Math.hypot(state.player.x - companion.x, state.player.y - companion.y) <= 105;
  }

  function interact() {
    const hotspot = nearestHotspot();
    if (!hotspot) {
      if (companionIsNear()) {
        renderMissionBanner();
        setMode("mission");
        return;
      }
      showToast("Follow the compass to a sign, or visit your companion.");
      return;
    }
    const word = currentMissionWords()[hotspot.slot];
    if (word) openWord(word);
  }

  function openWord(word) {
    state.exposures[word.id] = (state.exposures[word.id] || 0) + 1;
    if (!state.missionSeen.includes(word.id)) state.missionSeen.push(word.id);
    activeWord = word;
    wordEnglishVisible = state.exposures[word.id] <= 2;
    ui.creeWord.textContent = word.cree;
    ui.englishWord.textContent = word.english;
    ui.exposureLabel.textContent = exposureName(state.exposures[word.id]);
    const placement = PLACEMENTS[word.id];
    ui.wordMeta.textContent = [
      word.partOfSpeech,
      word.grammaticalClass,
      word.animacy,
      placement ? `found near ${placement.landmark}` : ""
    ].filter(Boolean).join(" · ");
    drawWordIcon(ui.wordIcon.getContext("2d"), word, 112, 112);
    renderWordTranslation();
    saveState();
    setMode("word");
  }

  function exposureName(count) {
    if (count === 1) return "FIRST LOOK";
    if (count === 2) return "SEEN AGAIN";
    if (count < 5) return `RETURN ${count}`;
    return "FAMILIAR WORD";
  }

  function renderWordTranslation() {
    ui.englishWord.classList.toggle("concealed", !wordEnglishVisible);
    ui.translationButton.textContent = wordEnglishVisible ? "B  HIDE ENGLISH" : "B  SHOW ENGLISH";
    ui.translationNote.textContent = wordEnglishVisible
      ? "Notice the Cree form first, then connect it with the meaning."
      : "Recall the meaning, then reveal English whenever you need support.";
  }

  function closeWord() {
    activeWord = null;
    if (missionSeenCount() === 6) {
      startChallenge("mission", currentMissionWords(), 6);
      return;
    }
    setMode("play");
    showToast(`${missionSeenCount()} of 6 mission words encountered.`);
    canvas.focus();
  }

  function startChallenge(kind, pool, count) {
    challengeKind = kind;
    challengePool = [...pool];
    challengeRounds = kind === "mission" ? shuffle(pool) : adaptiveReviewSample(pool, count);
    challengeIndex = 0;
    challengeScore = 0;
    setMode("challenge");
    renderChallengeRound();
  }

  function adaptiveReviewSample(pool, count) {
    const queue = new Set(state.reviewQueue || []);
    return [...pool]
      .sort((a, b) => {
        const aStats = state.wordStats[a.id] || {};
        const bStats = state.wordStats[b.id] || {};
        const aNeed = (queue.has(a.id) ? 100 : 0) + (aStats.incorrect || 0) * 12 - (aStats.correct || 0) * 3 - (state.exposures[a.id] || 0);
        const bNeed = (queue.has(b.id) ? 100 : 0) + (bStats.incorrect || 0) * 12 - (bStats.correct || 0) * 3 - (state.exposures[b.id] || 0);
        return bNeed - aNeed || hashOrder(`${a.id}:${state.totalAttempts}`) - hashOrder(`${b.id}:${state.totalAttempts}`);
      })
      .slice(0, count);
  }

  function hashOrder(value) {
    let result = 0;
    for (const character of value) result = Math.imul(31, result) + character.charCodeAt(0) | 0;
    return result;
  }

  function renderChallengeRound() {
    challengeAnswered = false;
    challengeSelection = 0;
    ui.nextRoundButton.classList.add("hidden");
    ui.challengeFeedback.textContent = "";
    const target = challengeRounds[challengeIndex];
    currentDirection = (challengeIndex + state.mission + state.chapter) % 2 ? "forward" : "reverse";
    const labelFor = (word) => currentDirection === "forward" ? word.english : word.cree;
    const distractorPool = shuffle(challengePool.filter((word) => word.cree !== target.cree && labelFor(word) !== labelFor(target)));
    const distractors = [];
    for (const candidate of distractorPool) {
      if (!distractors.some((word) => labelFor(word) === labelFor(candidate))) distractors.push(candidate);
      if (distractors.length === 2) break;
    }
    if (distractors.length < 2) {
      for (const candidate of shuffle(WORDS)) {
        if (candidate.cree !== target.cree && labelFor(candidate) !== labelFor(target) && !distractors.some((word) => labelFor(word) === labelFor(candidate))) distractors.push(candidate);
        if (distractors.length === 2) break;
      }
    }
    currentChoices = shuffle([target, ...distractors]);
    challengeSelection = currentChoices.findIndex((word) => word.cree === target.cree);
    challengeSelection = (challengeSelection + 1) % currentChoices.length;
    ui.challengeKindLabel.textContent = `${challengeKind.toUpperCase()} CHECK`;
    ui.roundLabel.textContent = `${challengeIndex + 1}/${challengeRounds.length}`;
    ui.challengePrompt.textContent = currentDirection === "forward" ? "Which meaning matches" : "Which Cree word means";
    ui.challengeWord.textContent = currentDirection === "forward" ? target.cree : target.english;
    ui.challengeInstruction.textContent = currentDirection === "forward"
      ? "Choose the English meaning. No spelling or typing."
      : "Choose the Cree form you have seen on the trail.";
    ui.choiceGrid.replaceChildren();

    currentChoices.forEach((word, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `choice-button text-choice ${currentDirection === "forward" ? "english-choice" : "cree-choice"}`;
      button.dataset.index = String(index);
      const label = document.createElement("span");
      label.className = "choice-label";
      label.textContent = labelFor(word);
      button.append(label);
      button.addEventListener("click", () => answerChallenge(index));
      ui.choiceGrid.append(button);
    });
    updateChallengeSelection();
  }

  function navigateChallenge(delta) {
    if (challengeAnswered) return;
    challengeSelection = (challengeSelection + delta + currentChoices.length) % currentChoices.length;
    updateChallengeSelection();
  }

  function updateChallengeSelection() {
    [...ui.choiceGrid.children].forEach((button, index) => {
      button.classList.toggle("selected", index === challengeSelection);
    });
  }

  function answerChallenge(index = challengeSelection) {
    if (challengeAnswered) return;
    challengeAnswered = true;
    const target = challengeRounds[challengeIndex];
    const selected = currentChoices[index];
    const correct = selected.cree === target.cree;
    state.totalAttempts += 1;
    if (correct) {
      state.totalCorrect += 1;
      challengeScore += 1;
    }
    const stats = state.wordStats[target.id] || { correct: 0, incorrect: 0 };
    if (correct) stats.correct += 1;
    else stats.incorrect += 1;
    state.wordStats[target.id] = stats;
    if (!correct && !state.reviewQueue.includes(target.id)) state.reviewQueue.push(target.id);
    if (correct && stats.correct >= 2 && stats.correct > stats.incorrect) {
      state.reviewQueue = state.reviewQueue.filter((id) => id !== target.id);
    }
    state.exposures[target.id] = (state.exposures[target.id] || 0) + 1;
    [...ui.choiceGrid.children].forEach((button, choiceIndex) => {
      button.disabled = true;
      const word = currentChoices[choiceIndex];
      if (word.cree === target.cree) button.classList.add("correct");
      else if (choiceIndex === index) button.classList.add("wrong");
    });
    ui.challengeFeedback.textContent = correct
      ? `Yes — ${target.cree} · ${target.english}`
      : `${target.cree} · ${target.english}. This word will return.`;
    ui.nextRoundButton.textContent = challengeIndex === challengeRounds.length - 1 ? "A  FINISH" : "A  NEXT";
    ui.nextRoundButton.classList.remove("hidden");
    saveState();
  }

  function nextChallengeRound() {
    if (!challengeAnswered) {
      answerChallenge();
      return;
    }
    challengeIndex += 1;
    if (challengeIndex < challengeRounds.length) {
      renderChallengeRound();
      return;
    }
    finishChallenge();
  }

  function finishChallenge() {
    if (challengeKind === "mission") finishMissionCheck();
    else if (challengeKind === "chapter") finishChapterCheck();
    else finishActCheck();
  }

  function finishMissionCheck() {
    const key = missionKey();
    const replay = state.completedMissions.includes(key);
    const act = actForChapter();
    if (!replay) {
      state.completedMissions.push(key);
      state.trailLeaves += 1;
      state.relationships[act] = Math.min(10, (state.relationships[act] || 0) + 1);
    }
    const reward = { leaves: replay ? 0 : 1, friendship: replay ? 0 : 1 };
    if (replay) state.pendingAdvance = { type: "map", score: challengeScore, total: challengeRounds.length, ...reward };
    else if (state.mission < MISSIONS_PER_CHAPTER) state.pendingAdvance = { type: "next-mission", chapter: state.chapter, mission: state.mission + 1, score: challengeScore, total: 6, ...reward };
    else state.pendingAdvance = { type: "chapter-gate", chapter: state.chapter, score: challengeScore, total: 6, ...reward };
    saveState();
    renderCompletionFromPending();
  }

  function finishChapterCheck() {
    const firstCompletion = !state.completedChapters.includes(state.chapter);
    if (firstCompletion) {
      state.completedChapters.push(state.chapter);
      state.trailLeaves += 3;
      state.rewards.push(`Chapter ${state.chapter} leaf badge`);
    }
    const reward = { leaves: firstCompletion ? 3 : 0, friendship: 0 };
    if (state.chapter % 5 === 0) state.pendingAdvance = { type: "act-gate", act: actForChapter(), score: challengeScore, total: challengeRounds.length, ...reward };
    else state.pendingAdvance = { type: "next-chapter", chapter: state.chapter + 1, mission: 1, score: challengeScore, total: challengeRounds.length, ...reward };
    saveState();
    renderCompletionFromPending();
  }

  function finishActCheck() {
    const act = actForChapter();
    const firstCompletion = !state.completedActs.includes(act);
    if (firstCompletion) {
      state.completedActs.push(act);
      state.trailLeaves += 5;
      state.rewards.push(`${COMPANIONS[act - 1].name}'s friendship keepsake`);
    }
    const reward = { leaves: firstCompletion ? 5 : 0, friendship: 0 };
    if (act === 5) state.pendingAdvance = { type: "ending", score: challengeScore, total: challengeRounds.length, ...reward };
    else state.pendingAdvance = { type: "next-chapter", chapter: state.chapter + 1, mission: 1, score: challengeScore, total: challengeRounds.length, ...reward };
    saveState();
    renderCompletionFromPending();
  }

  function renderCompletionFromPending() {
    const pending = state.pendingAdvance;
    if (!pending) return;
    const copy = {
      "next-mission": ["Six words now belong to this mission.", "They will return in chapter and act checks.", "NEXT MISSION"],
      "chapter-gate": ["Both chapter missions are complete.", "Twelve chapter words are ready for an adaptive recognition check.", "CHAPTER CHECK"],
      "next-chapter": ["The chapter sign is complete.", "Its twelve words remain in the journal and adaptive review.", "NEXT CHAPTER"],
      "act-gate": ["Five chapters now connect.", "Complete a mixed check drawn from the 60 focused words in this act.", "ACT CHECK"],
      map: ["Replay complete.", "Your original campaign progress is unchanged.", "JOURNEY MAP"],
      ending: ["The final act check is complete.", `All ${TOTAL_WORDS} focused words now have a place on the trail.`, "OPEN THE TRAIL"]
    }[pending.type];
    ui.completeTitle.textContent = copy[0];
    ui.completeCopy.textContent = copy[1];
    ui.keepExploringButton.textContent = copy[2];
    ui.completeSeen.textContent = String(totalEncountered());
    ui.completeCorrect.textContent = `${pending.score}/${pending.total}`;
    ui.completeLeaves.textContent = `+${pending.leaves || 0}`;
    ui.completeFriendship.textContent = pending.friendship ? "+♡" : "—";
    setMode("complete");
  }

  function continueJourney() {
    const pending = state.pendingAdvance;
    if (!pending) {
      setMode("play");
      return;
    }
    if (pending.type === "next-mission" || pending.type === "next-chapter") {
      prepareMission(pending.chapter, pending.mission, true);
      return;
    }
    if (pending.type === "chapter-gate") {
      state.pendingAdvance = null;
      saveState();
      startChallenge("chapter", wordsForChapter(pending.chapter), 10);
      return;
    }
    if (pending.type === "act-gate") {
      state.pendingAdvance = null;
      saveState();
      startChallenge("act", wordsForAct(pending.act), 15);
      return;
    }
    if (pending.type === "map") {
      state.pendingAdvance = null;
      saveState();
      openMap();
      return;
    }
    state.pendingAdvance = null;
    state.campaignFinished = true;
    saveState();
    setMode("ending");
  }

  function openJournal() {
    if (!["play", "pause", "ending", "complete"].includes(mode)) return;
    previousMode = mode === "pause" ? "play" : mode;
    state.journalChapter = state.chapter;
    renderJournal();
    setMode("journal");
  }

  function closeJournal() {
    setMode(previousMode === "ending" ? "ending" : "play");
    saveState();
    canvas.focus();
  }

  function renderJournal() {
    const words = wordsForChapter(state.journalChapter);
    ui.journalChapter.textContent = `${state.journalChapter}: ${chapterInfo(state.journalChapter)?.title || ""}`;
    ui.journalTranslationButton.textContent = `ENGLISH: ${state.journalEnglish ? "ON" : "OFF"}`;
    ui.previousChapterButton.disabled = state.journalChapter <= 1;
    ui.nextChapterButton.disabled = state.journalChapter >= TOTAL_CHAPTERS;
    ui.journalList.replaceChildren();
    words.forEach((word) => {
      const encountered = (state.exposures[word.id] || 0) > 0;
      const row = document.createElement("div");
      row.className = `journal-entry${encountered ? "" : " locked"}`;
      row.title = encountered ? `${word.partOfSpeech} · ${word.grammaticalClass}` : "Encounter this word on the trail";
      row.innerHTML = `<span class="number">${String(word.order).padStart(3, "0")}</span><span class="form"></span><span class="meaning"></span>`;
      row.querySelector(".form").textContent = encountered ? word.cree : "••••";
      row.querySelector(".meaning").textContent = encountered && state.journalEnglish ? word.english : "";
      ui.journalList.append(row);
    });
    ui.journalTotal.textContent = `${totalEncountered()} of ${TOTAL_WORDS} encountered`;
  }

  function changeJournalChapter(delta) {
    state.journalChapter = clamp(state.journalChapter + delta, 1, TOTAL_CHAPTERS);
    renderJournal();
  }

  function openLearnerReport() {
    const accuracy = state.totalAttempts ? Math.round(state.totalCorrect / state.totalAttempts * 100) : null;
    ui.reportEncountered.textContent = `${totalEncountered()}/${TOTAL_WORDS}`;
    ui.reportAccuracy.textContent = accuracy === null ? "—" : `${accuracy}%`;
    ui.reportReviewCount.textContent = String(state.reviewQueue.length);
    ui.reportLeaves.textContent = String(state.trailLeaves || 0);
    const hardest = WORDS
      .filter((word) => (state.wordStats[word.id]?.incorrect || 0) > 0 || state.reviewQueue.includes(word.id))
      .sort((a, b) => {
        const aStats = state.wordStats[a.id] || {};
        const bStats = state.wordStats[b.id] || {};
        return (bStats.incorrect || 0) - (aStats.incorrect || 0) || (aStats.correct || 0) - (bStats.correct || 0);
      })
      .slice(0, 12);
    ui.reportHardestList.replaceChildren();
    if (!hardest.length) {
      const empty = document.createElement("p");
      empty.className = "report-empty";
      empty.textContent = "No difficult words recorded yet. Missed choices will appear here and return in adaptive review.";
      ui.reportHardestList.append(empty);
    } else {
      hardest.forEach((word) => {
        const stats = state.wordStats[word.id] || {};
        const row = document.createElement("div");
        row.className = "report-word";
        row.innerHTML = `<strong></strong><span></span><small></small>`;
        row.querySelector("strong").textContent = word.cree;
        row.querySelector("span").textContent = word.english;
        row.querySelector("small").textContent = `${stats.incorrect || 0} missed · ${stats.correct || 0} correct`;
        ui.reportHardestList.append(row);
      });
    }
    setMode("report");
  }

  function closeLearnerReport() {
    setMode("pause");
  }

  function openMap() {
    previousMode = mode === "pause" ? "play" : mode;
    mapActView = actForChapter();
    selectedMapChapter = state.chapter;
    renderMap();
    setMode("map");
  }

  function closeMap() {
    setMode(previousMode === "ending" ? "ending" : "play");
    canvas.focus();
  }

  function chapterUnlocked(chapter) {
    return chapter === 1 || state.completedChapters.includes(chapter - 1) || chapter <= state.chapter;
  }

  function missionUnlocked(chapter, mission) {
    if (!chapterUnlocked(chapter)) return false;
    if (mission === 1) return true;
    return state.completedMissions.includes(missionKey(chapter, mission - 1));
  }

  function renderMap() {
    ui.mapActNumber.textContent = String(mapActView);
    ui.mapActName.textContent = ACT_NAMES[mapActView - 1];
    ui.previousActButton.disabled = mapActView <= 1;
    ui.nextActButton.disabled = mapActView >= 5;
    const actChapters = CHAPTERS.filter((chapter) => chapter.act === mapActView);
    if (actForChapter(selectedMapChapter) !== mapActView) selectedMapChapter = actChapters[0].chapter;
    const completedCount = actChapters.filter((chapter) => state.completedChapters.includes(chapter.chapter)).length;
    ui.actProgressLabel.textContent = `${completedCount} of 5 chapters complete`;
    ui.chapterGrid.replaceChildren();
    actChapters.forEach((chapter) => {
      const button = document.createElement("button");
      const unlocked = chapterUnlocked(chapter.chapter);
      const completed = state.completedChapters.includes(chapter.chapter);
      button.type = "button";
      button.disabled = !unlocked;
      button.className = `chapter-card${selectedMapChapter === chapter.chapter ? " selected" : ""}${completed ? " completed" : ""}${unlocked ? "" : " locked"}`;
      button.innerHTML = `<span class="map-status${completed ? " checked" : ""}">${completed ? "" : chapter.chapter}</span><strong></strong><small></small>`;
      button.querySelector("strong").textContent = chapter.title;
      button.querySelector("small").textContent = unlocked ? `${completedMissionsInChapter(chapter.chapter)}/${MISSIONS_PER_CHAPTER} missions` : "LOCKED";
      button.addEventListener("click", () => {
        selectedMapChapter = chapter.chapter;
        renderMap();
      });
      ui.chapterGrid.append(button);
    });
    renderMissionSelect();
    ui.campaignTotal.textContent = `${totalEncountered()} of ${TOTAL_WORDS} words encountered`;
    ui.campaignMissions.textContent = `${state.completedMissions.length} of ${TOTAL_MISSIONS} missions complete`;
  }

  function completedMissionsInChapter(chapter) {
    return Array.from({ length: MISSIONS_PER_CHAPTER }, (_, index) => index + 1).filter((mission) => state.completedMissions.includes(missionKey(chapter, mission))).length;
  }

  function renderMissionSelect() {
    const chapter = chapterInfo(selectedMapChapter);
    ui.selectedChapterLabel.textContent = `CHAPTER ${selectedMapChapter}`;
    ui.selectedChapterTitle.textContent = chapter.title;
    ui.selectedChapterTheme.textContent = sentenceCase(chapter.theme);
    ui.missionGrid.replaceChildren();
    for (let mission = 1; mission <= MISSIONS_PER_CHAPTER; mission += 1) {
      const button = document.createElement("button");
      const unlocked = missionUnlocked(selectedMapChapter, mission);
      const completed = state.completedMissions.includes(missionKey(selectedMapChapter, mission));
      button.type = "button";
      button.disabled = !unlocked;
      button.className = `mission-card${completed ? " completed" : ""}`;
      button.innerHTML = `<span class="map-status${completed ? " checked" : ""}">${completed ? "" : mission}</span><strong></strong><small>6 words</small>`;
      button.querySelector("strong").textContent = missionTitle(selectedMapChapter, mission);
      button.addEventListener("click", () => prepareMission(selectedMapChapter, mission, true));
      ui.missionGrid.append(button);
    }
  }

  function changeMapAct(delta) {
    mapActView = clamp(mapActView + delta, 1, 5);
    selectedMapChapter = (mapActView - 1) * 5 + 1;
    renderMap();
  }

  function togglePause() {
    if (mode === "play") setMode("pause");
    else if (mode === "pause") setMode("play");
  }

  function restartJourney() {
    setMode("confirm");
  }

  function cancelRestart() {
    setMode("pause");
  }

  function confirmRestart() {
    state = freshState();
    localStorage.removeItem(SAVE_KEY);
    prepareMission(1, 1, true);
  }

  function actionA() {
    if (mode === "mission") startMissionPlay();
    else if (mode === "play") interact();
    else if (mode === "word") closeWord();
    else if (mode === "challenge") nextChallengeRound();
    else if (mode === "complete") continueJourney();
    else if (mode === "pause") togglePause();
  }

  function actionB() {
    if (mode === "word") {
      wordEnglishVisible = !wordEnglishVisible;
      renderWordTranslation();
    } else if (mode === "journal") closeJournal();
    else if (mode === "map") closeMap();
    else if (mode === "report") closeLearnerReport();
    else if (mode === "confirm") cancelRestart();
    else if (mode === "pause") togglePause();
    else if (mode === "play") togglePause();
  }

  function update(dt) {
    if (mode !== "play") return;
    let dx = 0;
    let dy = 0;
    if (held.has("up")) dy -= 1;
    if (held.has("down")) dy += 1;
    if (held.has("left")) dx -= 1;
    if (held.has("right")) dx += 1;
    if (dx && dy) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    if (dx || dy) {
      const speed = 260;
      state.player.x = clamp(state.player.x + dx * speed * dt, 42, WORLD.width - 42);
      state.player.y = clamp(state.player.y + dy * speed * dt, 72, WORLD.height - 38);
      state.player.direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
      state.player.step += dt * 7;
    }
    const targetX = clamp(state.player.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    const targetY = clamp(state.player.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    camera.x += (targetX - camera.x) * Math.min(1, dt * 8);
    camera.y += (targetY - camera.y) * Math.min(1, dt * 8);
  }

  function draw() {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    drawWorld();
    drawEntities();
    drawInteractionMarker();
    ctx.restore();
    drawSeasonAmbience();
    drawTrailCompass();
  }

  function nextUnseenHotspot() {
    const words = currentMissionWords();
    const unseen = currentHotspots().filter((hotspot) => !state.missionSeen.includes(words[hotspot.slot]?.id));
    const pool = unseen.length ? unseen : currentHotspots();
    return pool.reduce((nearest, hotspot) => {
      const distance = Math.hypot(state.player.x - hotspot.x, state.player.y - hotspot.y);
      return !nearest || distance < nearest.distance ? { ...hotspot, distance } : nearest;
    }, null);
  }

  function drawTrailCompass() {
    if (mode !== "play") return;
    const target = nextUnseenHotspot();
    if (!target || target.distance < 135) return;
    const x = VIEW.width - 55;
    const y = VIEW.height - 55;
    const angle = Math.atan2(target.y - state.player.y, target.x - state.player.x);
    ctx.save();
    ctx.fillStyle = "rgba(18, 45, 37, .92)";
    ctx.strokeStyle = "#f4d267";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#f4b72d";
    ctx.beginPath();
    ctx.moveTo(29, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-angle);
    ctx.fillStyle = "#fff4cf";
    ctx.font = '700 13px "Balsamiq Sans"';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(target.slot + 1), 0, 1);
    ctx.restore();
  }

  function drawSeasonAmbience() {
    if (mode !== "play") return;
    const season = seasonForChapter();
    const time = performance.now() / 1000;
    const styles = {
      SPRING: { count: 15, color: "rgba(255, 205, 214, .72)", tint: "rgba(110, 180, 110, .025)" },
      SUMMER: { count: 12, color: "rgba(255, 222, 90, .8)", tint: "rgba(255, 188, 60, .018)" },
      AUTUMN: { count: 18, color: "rgba(218, 118, 42, .72)", tint: "rgba(166, 77, 29, .035)" },
      WINTER: { count: 24, color: "rgba(247, 252, 255, .78)", tint: "rgba(150, 200, 230, .055)" }
    }[season];
    ctx.save();
    ctx.fillStyle = styles.tint;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    for (let index = 0; index < styles.count; index += 1) {
      const seed = Math.abs(hashOrder(`${state.chapter}:${index}`));
      const drift = season === "WINTER" ? 16 : season === "AUTUMN" ? 28 : 12;
      const x = (seed % VIEW.width + time * drift + Math.sin(time + index) * 24) % VIEW.width;
      const fall = season === "SUMMER" ? 0 : season === "WINTER" ? 27 : 18;
      const y = season === "SUMMER"
        ? (seed * 7 % VIEW.height) + Math.sin(time * 1.7 + index) * 12
        : (seed * 11 % VIEW.height + time * fall + index * 19) % VIEW.height;
      ctx.fillStyle = styles.color;
      if (season === "SUMMER") {
        ctx.shadowColor = "#ffe972";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (season === "WINTER") {
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + index % 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time + index);
        ctx.fillRect(-3, -1.5, 6, 3);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawWorld() {
    const map = assets.maps[actForChapter() - 1];
    if (assetsReady) {
      ctx.drawImage(map, 0, 0, WORLD.width, WORLD.height);
      return;
    }
    ctx.fillStyle = "#244735";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  }

  function drawEntities() {
    const words = currentMissionWords();
    const entities = currentHotspots().map((hotspot) => ({ type: "sign", y: hotspot.y, hotspot, word: words[hotspot.slot] }));
    const companion = companionPosition();
    entities.push({ type: "companion", y: companion.y, companion });
    entities.push({ type: "player", y: state.player.y });
    entities.sort((a, b) => a.y - b.y);
    entities.forEach((entity) => {
      if (entity.type === "player") drawPlayer();
      else if (entity.type === "companion") drawCompanion(entity.companion);
      else drawSign(entity.hotspot, entity.word);
    });
  }

  function drawSign(hotspot, word) {
    if (!assetsReady || !word) return;
    const knownIndex = KNOWN_ICONS[word.cree];
    const size = 178;
    ctx.fillStyle = "rgba(19, 29, 20, .28)";
    ctx.beginPath();
    ctx.ellipse(hotspot.x, hotspot.y + 8, 45, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    if (knownIndex !== undefined) {
      const sw = assets.signs.naturalWidth / 3;
      const sh = assets.signs.naturalHeight / 2;
      ctx.drawImage(assets.signs, (knownIndex % 3) * sw, Math.floor(knownIndex / 3) * sh, sw, sh, hotspot.x - size / 2, hotspot.y - size + 24, size, size);
    } else {
      ctx.drawImage(assets.blankSign, hotspot.x - size / 2, hotspot.y - size + 24, size, size);
      const pictogram = getPictogram(word);
      if (pictogram?.complete && pictogram.naturalWidth) {
        ctx.drawImage(pictogram, hotspot.x - 34, hotspot.y - 114, 68, 68);
      } else {
        drawCategoryMark(ctx, word, hotspot.x, hotspot.y - 78, 24);
      }
      ctx.fillStyle = "#17332b";
      ctx.font = '700 12px "Balsamiq Sans"';
      ctx.textAlign = "center";
      ctx.fillText(String(hotspot.slot + 1), hotspot.x, hotspot.y - 43);
    }
    if (state.missionSeen.includes(word.id)) drawCheck(hotspot.x + 53, hotspot.y - 102);
  }

  function drawCheck(x, y) {
    ctx.fillStyle = "#f7d668";
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#17332b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x - 2, y + 6);
    ctx.lineTo(x + 8, y - 6);
    ctx.stroke();
  }

  function drawInteractionMarker() {
    if (mode !== "play") return;
    const nearest = nearestHotspot();
    const companion = companionIsNear() ? companionPosition() : null;
    if (!nearest && !companion) return;
    const target = nearest || companion;
    const pulse = Math.round(Math.sin(performance.now() / 170) * 7);
    const y = target.y - 138 + pulse;
    ctx.fillStyle = "rgba(14, 29, 22, .55)";
    ctx.beginPath();
    ctx.moveTo(target.x - 24, y - 2);
    ctx.lineTo(target.x + 24, y - 2);
    ctx.lineTo(target.x, y + 27);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f5bd2f";
    ctx.beginPath();
    ctx.moveTo(target.x - 20, y - 6);
    ctx.lineTo(target.x + 20, y - 6);
    ctx.lineTo(target.x, y + 19);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#17332b";
    ctx.font = '700 18px "Balsamiq Sans"';
    ctx.textAlign = "center";
    ctx.fillText("A", target.x, y + 4);
  }

  function drawCompanion(position) {
    if (!assetsReady || !assets.companions.naturalWidth) return;
    const companion = currentCompanion();
    const sw = assets.companions.naturalWidth / 5;
    const sh = assets.companions.naturalHeight;
    const width = 112;
    const height = 204;
    ctx.fillStyle = "rgba(11, 21, 16, .28)";
    ctx.beginPath();
    ctx.ellipse(position.x, position.y + 5, 37, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(assets.companions, companion.sprite * sw, 0, sw, sh, position.x - width / 2, position.y - height + 34, width, height);
    ctx.fillStyle = "rgba(18, 45, 37, .9)";
    ctx.fillRect(position.x - 38, position.y + 12, 76, 22);
    ctx.fillStyle = "#fff4cf";
    ctx.font = '700 13px "Balsamiq Sans"';
    ctx.textAlign = "center";
    ctx.fillText(companion.name, position.x, position.y + 28);
  }

  function drawCompanionPortrait() {
    if (!ui.companionPortrait) return;
    const target = ui.companionPortrait.getContext("2d");
    target.clearRect(0, 0, ui.companionPortrait.width, ui.companionPortrait.height);
    if (!assets.companions.complete || !assets.companions.naturalWidth) return;
    const companion = currentCompanion();
    const sw = assets.companions.naturalWidth / 5;
    target.drawImage(assets.companions, companion.sprite * sw, 0, sw, assets.companions.naturalHeight, 19, 3, 80, 112);
  }

  function drawPlayer() {
    if (!assetsReady) return;
    const { x, y, direction, step } = state.player;
    const directionIndex = { down: 0, right: 1, up: 2, left: 3 }[direction];
    const moving = held.size > 0 && mode === "play";
    const frame = moving ? Math.floor(step) % 2 : 0;
    const sw = assets.bear.naturalWidth / 4;
    const sh = assets.bear.naturalHeight / 2;
    const size = 190;
    const bob = moving ? Math.abs(Math.sin(step * Math.PI)) * 3 : 0;
    ctx.fillStyle = "rgba(11, 21, 16, .34)";
    ctx.beginPath();
    ctx.ellipse(x, y + 6, 48, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(assets.bear, directionIndex * sw, frame * sh, sw, sh, x - size / 2, y - size + 35 - bob, size, size);
  }

  function getPictogram(word) {
    const spec = WORD_ICONS[word.id];
    return spec ? assets.pictograms.get(spec.src) : null;
  }

  function drawWordIcon(iconCtx, word, width, height) {
    iconCtx.clearRect(0, 0, width, height);
    iconCtx.imageSmoothingEnabled = false;
    const knownIndex = KNOWN_ICONS[word.cree];
    if (knownIndex !== undefined) {
      const sw = assets.signs.naturalWidth / 3;
      const sh = assets.signs.naturalHeight / 2;
      iconCtx.drawImage(assets.signs, (knownIndex % 3) * sw, Math.floor(knownIndex / 3) * sh, sw, sh, 0, 0, width, height);
    } else {
      iconCtx.drawImage(assets.blankSign, 0, 0, width, height);
      const pictogram = getPictogram(word);
      if (pictogram?.complete && pictogram.naturalWidth) {
        const size = width * .5;
        iconCtx.drawImage(pictogram, (width - size) / 2, height * .2, size, size);
      } else {
        drawCategoryMark(iconCtx, word, width / 2, height * .47, width * .16);
      }
    }
  }

  function drawCategoryMark(target, word, x, y, radius) {
    const pos = word.partOfSpeech.toLowerCase();
    const color = pos.includes("verb") ? "#a84536" : pos.includes("noun") ? "#315e43" : pos.includes("pronoun") ? "#287d78" : pos.includes("interjection") ? "#d99f28" : "#52637a";
    target.fillStyle = "rgba(255, 244, 207, .78)";
    target.beginPath();
    target.arc(x, y, radius * 1.3, 0, Math.PI * 2);
    target.fill();
    target.fillStyle = color;
    if (pos.includes("verb")) {
      target.beginPath();
      target.moveTo(x - radius, y - radius * .55);
      target.lineTo(x + radius, y);
      target.lineTo(x - radius, y + radius * .55);
      target.closePath();
      target.fill();
    } else if (pos.includes("pronoun")) {
      target.save();
      target.translate(x, y);
      target.rotate(Math.PI / 4);
      target.fillRect(-radius * .7, -radius * .7, radius * 1.4, radius * 1.4);
      target.restore();
    } else if (pos.includes("interjection")) {
      target.fillRect(x - radius, y - radius * .65, radius * 2, radius * 1.3);
      target.beginPath();
      target.moveTo(x - radius * .4, y + radius * .6);
      target.lineTo(x - radius * .8, y + radius * 1.05);
      target.lineTo(x, y + radius * .6);
      target.fill();
    } else {
      target.beginPath();
      target.arc(x, y, radius, 0, Math.PI * 2);
      target.fill();
    }
  }

  function loadImage(image, source) {
    return new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
      image.src = source;
    });
  }

  function loadAssets() {
    ui.startButton.disabled = true;
    ui.continueButton.disabled = true;
    ui.startButton.textContent = "LOADING FIVE ACTS + WORD ART…";
    const requests = assets.maps.map((image, index) => loadImage(image, MAP_SOURCES[index]));
    requests.push(loadImage(assets.bear, "assets/bear-sprites-v2.png"));
    requests.push(loadImage(assets.signs, "assets/word-signs-v2.png"));
    requests.push(loadImage(assets.blankSign, "assets/blank-sign-v3.png"));
    requests.push(loadImage(assets.companions, "assets/companion-sheet-v6-cropped.png"));
    for (const [source, image] of assets.pictograms) requests.push(loadImage(image, source));
    if (document.fonts?.load) {
      requests.push(document.fonts.load('400 16px "Balsamiq Sans"'));
      requests.push(document.fonts.load('700 16px "Balsamiq Sans"'));
    }
    return Promise.all(requests).then(() => {
      assetsReady = true;
      ui.startButton.disabled = false;
      ui.continueButton.disabled = false;
      ui.startButton.textContent = "BEGIN TRAIL";
      drawCompanionPortrait();
    }).catch(() => {
      ui.startButton.textContent = "ART COULD NOT LOAD";
      ui.startButton.title = "Reload or serve the game from a local web server.";
    });
  }

  function directionFromKey(key) {
    const normalized = key.toLowerCase();
    if (normalized === "arrowup" || normalized === "w") return "up";
    if (normalized === "arrowdown" || normalized === "s") return "down";
    if (normalized === "arrowleft" || normalized === "a") return "left";
    if (normalized === "arrowright" || normalized === "d") return "right";
    return null;
  }

  window.addEventListener("keydown", (event) => {
    const direction = directionFromKey(event.key);
    if (direction) {
      event.preventDefault();
      if (event.repeat) return;
      if (mode === "challenge") navigateChallenge(direction === "left" || direction === "up" ? -1 : 1);
      else if (mode === "journal" && ["left", "right"].includes(direction)) changeJournalChapter(direction === "left" ? -1 : 1);
      else if (mode === "map" && ["left", "right"].includes(direction)) changeMapAct(direction === "left" ? -1 : 1);
      else held.add(direction);
      return;
    }
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (["z", "enter", " "].includes(key)) {
      event.preventDefault();
      actionA();
    } else if (["x", "escape"].includes(key)) {
      event.preventDefault();
      actionB();
    } else if (key === "j") {
      event.preventDefault();
      mode === "journal" ? closeJournal() : openJournal();
    } else if (key === "p" || key === "m") {
      event.preventDefault();
      togglePause();
    }
  });

  window.addEventListener("keyup", (event) => {
    const direction = directionFromKey(event.key);
    if (direction) held.delete(direction);
  });

  document.querySelectorAll("[data-direction]").forEach((button) => {
    const direction = button.dataset.direction;
    const press = (event) => {
      event.preventDefault();
      if (mode === "challenge") navigateChallenge(direction === "left" || direction === "up" ? -1 : 1);
      else if (mode === "journal" && ["left", "right"].includes(direction)) changeJournalChapter(direction === "left" ? -1 : 1);
      else if (mode === "map" && ["left", "right"].includes(direction)) changeMapAct(direction === "left" ? -1 : 1);
      else held.add(direction);
    };
    const release = (event) => {
      event.preventDefault();
      held.delete(direction);
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  });

  function pollGamepad() {
    const gamepad = navigator.getGamepads?.()[0];
    if (!gamepad) return;
    const pressed = gamepad.buttons.map((button) => button.pressed);
    const justPressed = (index) => pressed[index] && !gamepadPrevious[index];
    const horizontal = Math.abs(gamepad.axes[0] || 0) > .45 ? Math.sign(gamepad.axes[0]) : 0;
    const vertical = Math.abs(gamepad.axes[1] || 0) > .45 ? Math.sign(gamepad.axes[1]) : 0;
    const directions = { left: pressed[14] || horizontal < 0, right: pressed[15] || horizontal > 0, up: pressed[12] || vertical < 0, down: pressed[13] || vertical > 0 };
    for (const [direction, down] of Object.entries(directions)) if (mode === "play") down ? held.add(direction) : held.delete(direction);
    if (justPressed(0)) actionA();
    if (justPressed(1)) actionB();
    if (justPressed(9)) togglePause();
    if (justPressed(8)) mode === "map" ? closeMap() : openMap();
    if (mode === "challenge") {
      if (justPressed(14) || justPressed(12)) navigateChallenge(-1);
      if (justPressed(15) || justPressed(13)) navigateChallenge(1);
    }
    gamepadPrevious = pressed;
  }

  function shuffle(items) {
    const output = [...items];
    for (let i = output.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [output[i], output[j]] = [output[j], output[i]];
    }
    return output;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function sentenceCase(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) + (/[.!?]$/.test(value) ? "" : ".") : "";
  }

  ui.startButton.addEventListener("click", () => beginGame(false));
  ui.continueButton.addEventListener("click", () => beginGame(true));
  ui.beginMissionButton.addEventListener("click", startMissionPlay);
  ui.wordContinueButton.addEventListener("click", closeWord);
  ui.translationButton.addEventListener("click", () => {
    wordEnglishVisible = !wordEnglishVisible;
    renderWordTranslation();
  });
  ui.nextRoundButton.addEventListener("click", nextChallengeRound);
  ui.keepExploringButton.addEventListener("click", continueJourney);
  ui.journalButton.addEventListener("click", openJournal);
  ui.journalCloseButton.addEventListener("click", closeJournal);
  ui.previousChapterButton.addEventListener("click", () => changeJournalChapter(-1));
  ui.nextChapterButton.addEventListener("click", () => changeJournalChapter(1));
  ui.journalTranslationButton.addEventListener("click", () => {
    state.journalEnglish = !state.journalEnglish;
    renderJournal();
  });
  ui.mapButton.addEventListener("click", openMap);
  ui.mapCloseButton.addEventListener("click", closeMap);
  ui.previousActButton.addEventListener("click", () => changeMapAct(-1));
  ui.nextActButton.addEventListener("click", () => changeMapAct(1));
  ui.resumeButton.addEventListener("click", togglePause);
  ui.pauseMapButton.addEventListener("click", openMap);
  ui.learnerReportButton.addEventListener("click", openLearnerReport);
  ui.learnerReportCloseButton.addEventListener("click", closeLearnerReport);
  ui.restartButton.addEventListener("click", restartJourney);
  ui.cancelRestartButton.addEventListener("click", cancelRestart);
  ui.confirmRestartButton.addEventListener("click", confirmRestart);
  ui.endingMapButton.addEventListener("click", openMap);
  ui.menuButton.addEventListener("click", togglePause);
  ui.buttonA.addEventListener("click", actionA);
  ui.buttonB.addEventListener("click", actionB);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && mode === "play") {
      held.clear();
      saveState();
      setMode("pause");
    }
  });

  function loop(now) {
    const dt = Math.max(0, Math.min(.05, (now - lastTime) / 1000));
    lastTime = now;
    pollGamepad();
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  ui.continueButton.classList.toggle("hidden", !hasSave());
  setMode("title");
  loadAssets();
  requestAnimationFrame(loop);
})();
