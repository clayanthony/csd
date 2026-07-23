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
    "ending-screen", "ending-map-button", "toast", "menu-button", "button-a", "button-b"
  ].map((id) => [camel(id), document.querySelector(`#${id}`)]));

  const SAVE_KEY = "little-bear-words-of-home-complete-v3";
  const VIEW = { width: 768, height: 512 };
  const WORLD = { width: 1536, height: 1024 };
  const WORDS = window.CREE_LEXICON;
  const CHAPTERS = window.CREE_CHAPTERS;
  const ACT_NAMES = ["Words Close to Home", "Words on the Land", "Words Through Time", "Words With Others", "Making Meaning"];
  const KNOWN_ICONS = { maskwa: 0, "mîtos": 1, asiniy: 2, "nîpiy": 3, "mînis": 4, "kinosêw": 5 };
  const MAP_SOURCES = [
    "assets/act-1-home-v3.png",
    "assets/act-2-land-v3.png",
    "assets/act-3-time-v3.png",
    "assets/act-4-community-v3.png",
    "assets/act-5-meaning-v3.png"
  ];
  const HOTSPOTS_BY_ACT = [
    [[410, 640], [690, 585], [1020, 570], [1160, 720], [900, 850], [520, 850]],
    [[762, 575], [600, 238], [946, 338], [1090, 445], [322, 714], [662, 870]],
    [[350, 330], [300, 575], [585, 745], [880, 860], [1130, 720], [1120, 300]],
    [[380, 520], [340, 720], [620, 870], [900, 740], [1110, 850], [1020, 430]],
    [[270, 560], [560, 330], [800, 450], [1120, 520], [940, 800], [530, 800]]
  ];

  const assets = {
    maps: MAP_SOURCES.map(() => new Image()),
    bear: new Image(),
    signs: new Image(),
    blankSign: new Image()
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
    journalEnglish: true
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
    return HOTSPOTS_BY_ACT[actForChapter() - 1].map(([x, y], slot) => ({ x, y, slot }));
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
        completedActs: saved.completedActs || []
      };
      return true;
    } catch {
      return false;
    }
  }

  function setMode(next) {
    if (mode !== next && !["title", "pause", "map", "journal"].includes(mode)) previousMode = mode;
    mode = next;
    const visible = {
      title: ui.titleScreen,
      mission: ui.missionBanner,
      word: ui.wordCard,
      challenge: ui.challenge,
      complete: ui.completeScreen,
      journal: ui.journal,
      map: ui.journeyMap,
      pause: ui.pauseMenu,
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
    state.player = { x: first.x, y: first.y + 96, direction: "up", step: 0 };
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
    showToast("Explore the six wooden signs. Press A when the marker appears.");
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
    ui.locationLabel.textContent = `ACT ${actForChapter()} · CHAPTER ${state.chapter} · MISSION ${state.mission}`;
    ui.seenCount.textContent = `${totalEncountered()}/750`;
    ui.objective.textContent = seen < 6 ? `${missionTitle()} · find six word signs · ${seen}/6` : "Mission check ready";
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

  function interact() {
    const hotspot = nearestHotspot();
    if (!hotspot) {
      showToast("Move closer to a wooden word sign.");
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
    ui.wordMeta.textContent = [word.partOfSpeech, word.grammaticalClass, word.animacy].filter(Boolean).join(" · ");
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
    challengeRounds = kind === "mission" ? shuffle(pool) : shuffle(pool).slice(0, count);
    challengeIndex = 0;
    challengeScore = 0;
    setMode("challenge");
    renderChallengeRound();
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
    if (!replay) state.completedMissions.push(key);
    if (replay) state.pendingAdvance = { type: "map", score: challengeScore, total: challengeRounds.length };
    else {
      const remainingMissions = [1, 2, 3, 4, 5].filter((mission) => !state.completedMissions.includes(missionKey(state.chapter, mission)));
      const nextMission = remainingMissions.find((mission) => mission > state.mission) || remainingMissions[0];
      state.pendingAdvance = nextMission
        ? { type: "next-mission", chapter: state.chapter, mission: nextMission, score: challengeScore, total: 6 }
        : { type: "chapter-gate", chapter: state.chapter, score: challengeScore, total: 6 };
    }
    saveState();
    renderCompletionFromPending();
  }

  function finishChapterCheck() {
    if (!state.completedChapters.includes(state.chapter)) state.completedChapters.push(state.chapter);
    const act = actForChapter();
    const remainingChapters = CHAPTERS
      .filter((chapter) => chapter.act === act && !state.completedChapters.includes(chapter.chapter))
      .map((chapter) => chapter.chapter);
    const nextChapter = remainingChapters.find((chapter) => chapter > state.chapter) || remainingChapters[0];
    state.pendingAdvance = nextChapter
      ? { type: "next-chapter", chapter: nextChapter, mission: 1, score: challengeScore, total: challengeRounds.length }
      : { type: "act-gate", act, score: challengeScore, total: challengeRounds.length };
    saveState();
    renderCompletionFromPending();
  }

  function finishActCheck() {
    const act = actForChapter();
    if (!state.completedActs.includes(act)) state.completedActs.push(act);
    const remainingActs = [1, 2, 3, 4, 5].filter((number) => !state.completedActs.includes(number));
    const nextAct = remainingActs.find((number) => number > act) || remainingActs[0];
    const nextChapter = CHAPTERS.find((chapter) => chapter.act === nextAct && !state.completedChapters.includes(chapter.chapter))?.chapter;
    state.pendingAdvance = nextAct
      ? { type: "next-chapter", chapter: nextChapter || (nextAct - 1) * 5 + 1, mission: 1, score: challengeScore, total: challengeRounds.length }
      : { type: "ending", score: challengeScore, total: challengeRounds.length };
    saveState();
    renderCompletionFromPending();
  }

  function renderCompletionFromPending() {
    const pending = state.pendingAdvance;
    if (!pending) return;
    const copy = {
      "next-mission": ["Six words now belong to this mission.", "They will return in chapter and act checks.", "NEXT MISSION"],
      "chapter-gate": ["All five chapter missions are complete.", "Thirty chapter words are ready for a mixed recognition check.", "CHAPTER CHECK"],
      "next-chapter": ["The chapter sign is complete.", "Its thirty words remain in the journal and spaced review.", "NEXT CHAPTER"],
      "act-gate": ["Five chapters now connect.", "Complete a mixed check drawn from all 150 words in this act.", "ACT CHECK"],
      map: ["Replay complete.", "Your original campaign progress is unchanged.", "JOURNEY MAP"],
      ending: ["The final act check is complete.", "All 750 curriculum words now have a place on the trail.", "OPEN THE TRAIL"]
    }[pending.type];
    ui.completeTitle.textContent = copy[0];
    ui.completeCopy.textContent = copy[1];
    ui.keepExploringButton.textContent = copy[2];
    ui.completeSeen.textContent = String(totalEncountered());
    ui.completeCorrect.textContent = `${pending.score}/${pending.total}`;
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
    ui.nextChapterButton.disabled = state.journalChapter >= 25;
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
    ui.journalTotal.textContent = `${totalEncountered()} of 750 encountered`;
  }

  function changeJournalChapter(delta) {
    state.journalChapter = clamp(state.journalChapter + delta, 1, 25);
    renderJournal();
  }

  function openMap() {
    previousMode = mode === "pause" ? "play" : mode;
    mapActView = actForChapter();
    selectedMapChapter = state.chapter;
    renderMap();
    setMode("map");
  }

  function closeMap() {
    const destination = previousMode === "ending" ? "ending" : previousMode === "title" ? "title" : "play";
    setMode(destination);
    if (destination === "play") canvas.focus();
  }

  function chapterUnlocked() {
    return true;
  }

  function missionUnlocked() {
    return true;
  }

  function beginWorldSelect() {
    state = freshState();
    localStorage.removeItem(SAVE_KEY);
    openMap();
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
      button.querySelector("small").textContent = unlocked ? `${completedMissionsInChapter(chapter.chapter)}/5 missions` : "LOCKED";
      button.addEventListener("click", () => {
        selectedMapChapter = chapter.chapter;
        renderMap();
      });
      ui.chapterGrid.append(button);
    });
    renderMissionSelect();
    ui.campaignTotal.textContent = `${totalEncountered()} of 750 words encountered`;
    ui.campaignMissions.textContent = `${state.completedMissions.length} of 125 missions complete`;
  }

  function completedMissionsInChapter(chapter) {
    return [1, 2, 3, 4, 5].filter((mission) => state.completedMissions.includes(missionKey(chapter, mission))).length;
  }

  function renderMissionSelect() {
    const chapter = chapterInfo(selectedMapChapter);
    ui.selectedChapterLabel.textContent = `CHAPTER ${selectedMapChapter}`;
    ui.selectedChapterTitle.textContent = chapter.title;
    ui.selectedChapterTheme.textContent = sentenceCase(chapter.theme);
    ui.missionGrid.replaceChildren();
    for (let mission = 1; mission <= 5; mission += 1) {
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
      const speed = 180;
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
    entities.push({ type: "player", y: state.player.y });
    entities.sort((a, b) => a.y - b.y);
    entities.forEach((entity) => entity.type === "player" ? drawPlayer() : drawSign(entity.hotspot, entity.word));
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
      drawCategoryMark(ctx, word, hotspot.x, hotspot.y - 78, 24);
      ctx.fillStyle = "#17332b";
      ctx.font = '700 13px "Balsamiq Sans"';
      ctx.textAlign = "center";
      ctx.fillText(String(hotspot.slot + 1), hotspot.x, hotspot.y - 47);
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
    if (!nearest) return;
    const pulse = Math.round(Math.sin(performance.now() / 170) * 7);
    const y = nearest.y - 138 + pulse;
    ctx.fillStyle = "rgba(14, 29, 22, .55)";
    ctx.beginPath();
    ctx.moveTo(nearest.x - 24, y - 2);
    ctx.lineTo(nearest.x + 24, y - 2);
    ctx.lineTo(nearest.x, y + 27);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f5bd2f";
    ctx.beginPath();
    ctx.moveTo(nearest.x - 20, y - 6);
    ctx.lineTo(nearest.x + 20, y - 6);
    ctx.lineTo(nearest.x, y + 19);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#17332b";
    ctx.font = '700 18px "Balsamiq Sans"';
    ctx.textAlign = "center";
    ctx.fillText("A", nearest.x, y + 4);
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
      drawCategoryMark(iconCtx, word, width / 2, height * .47, width * .16);
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
    ui.startButton.textContent = "LOADING FIVE ACTS…";
    const requests = assets.maps.map((image, index) => loadImage(image, MAP_SOURCES[index]));
    requests.push(loadImage(assets.bear, "assets/bear-sprites-v2.png"));
    requests.push(loadImage(assets.signs, "assets/word-signs-v2.png"));
    requests.push(loadImage(assets.blankSign, "assets/blank-sign-v3.png"));
    if (document.fonts?.load) {
      requests.push(document.fonts.load('400 16px "Balsamiq Sans"'));
      requests.push(document.fonts.load('700 16px "Balsamiq Sans"'));
    }
    return Promise.all(requests).then(() => {
      assetsReady = true;
      ui.startButton.disabled = false;
      ui.continueButton.disabled = false;
      ui.startButton.textContent = "CHOOSE YOUR TRAIL";
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

  ui.startButton.addEventListener("click", beginWorldSelect);
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
