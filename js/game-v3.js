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
    "challenge-kind-label", "challenge-icon", "round-label", "challenge-prompt", "challenge-word", "choice-grid",
    "challenge-feedback", "next-round-button", "complete-screen", "complete-title", "complete-copy", "complete-seen",
    "complete-correct", "keep-exploring-button", "journal", "journal-chapter", "journal-list", "journal-total",
    "previous-chapter-button", "next-chapter-button", "journal-translation-button", "journal-close-button", "journal-button",
    "journey-map", "map-button", "map-close-button", "map-act-number", "map-act-name", "previous-act-button",
    "next-act-button", "act-progress-label", "chapter-grid", "selected-chapter-label", "selected-chapter-title",
    "selected-chapter-theme", "mission-grid", "campaign-total", "campaign-missions", "pause-menu", "resume-button",
    "pause-map-button", "restart-button", "restart-confirm", "cancel-restart-button", "confirm-restart-button",
    "ending-screen", "ending-map-button", "toast", "menu-button", "button-a", "button-b"
  ].map((id) => [camel(id), document.querySelector(`#${id}`)]));

  const CAMPAIGN = window.LITTLE_BEAR_CAMPAIGN;
  if (!CAMPAIGN || CAMPAIGN.words?.length !== 300 || CAMPAIGN.stages?.length !== 50) {
    throw new Error("The 300-object campaign data did not load correctly.");
  }

  const SAVE_KEY = "little-bear-words-of-home-300-v1";
  const VIEW = { width: 768, height: 512 };
  const WORLD = { width: 1536, height: 1024 };
  const ATLAS = { cell: 64, columns: 20 };
  const WORDS = CAMPAIGN.words;
  const STAGES = CAMPAIGN.stages;
  const WORLDS = CAMPAIGN.worlds;
  const stageByNumber = new Map(STAGES.map((stage) => [stage.number, stage]));
  const worldByNumber = new Map(WORLDS.map((world) => [world.number, world]));

  const assets = {
    maps: WORLDS.map(() => new Image()),
    bear: new Image(),
    objects: new Image()
  };

  const held = new Set();
  let assetsReady = false;
  let mode = "title";
  let activeWord = null;
  let wordEnglishVisible = true;
  let mapWorldView = 1;
  let selectedMapTrail = 1;
  let mapReturnMode = "title";
  let journalReturnMode = "play";
  let challengeRounds = [];
  let challengeIndex = 0;
  let challengeAnswered = false;
  let challengeSelection = 0;
  let challengeScore = 0;
  let currentChoices = [];
  let camera = { x: 0, y: 0 };
  let lastTime = performance.now();
  let toastTimer = 0;
  let gamepadPrevious = [];

  const freshState = () => ({
    version: CAMPAIGN.version,
    started: false,
    stage: 1,
    arenaSeen: [],
    player: { x: 768, y: 700, direction: "up", step: 0 },
    exposures: {},
    completedStages: [],
    totalCorrect: 0,
    totalAttempts: 0,
    campaignFinished: false,
    journalStage: 1,
    journalEnglish: true
  });
  let state = freshState();

  function camel(id) {
    return id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function shuffle(items) {
    const output = [...items];
    for (let index = output.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [output[index], output[other]] = [output[other], output[index]];
    }
    return output;
  }

  function stageInfo(number = state.stage) {
    return stageByNumber.get(number);
  }

  function worldInfo(number = stageInfo()?.world || 1) {
    return worldByNumber.get(number);
  }

  function wordsForStage(number = state.stage) {
    return WORDS.filter((word) => word.stage === number).sort((a, b) => a.slot - b.slot);
  }

  function encounteredCount(words = WORDS) {
    return words.reduce((count, word) => count + (state.exposures[word.id] > 0 ? 1 : 0), 0);
  }

  function stageIsComplete(number) {
    return state.completedStages.includes(number);
  }

  function hasSave() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      return saved?.version === CAMPAIGN.version;
    } catch {
      return false;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      ui.continueButton.classList.remove("hidden");
    } catch {
      showToast("Progress could not be saved in this browser.");
    }
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!saved || saved.version !== CAMPAIGN.version) return false;
      state = {
        ...freshState(),
        ...saved,
        started: Boolean(saved.started),
        stage: clamp(Number(saved.stage) || 1, 1, 50),
        player: { ...freshState().player, ...(saved.player || {}) },
        arenaSeen: Array.isArray(saved.arenaSeen) ? saved.arenaSeen : [],
        exposures: saved.exposures || {},
        completedStages: Array.isArray(saved.completedStages) ? saved.completedStages : []
      };
      const validArenaIds = new Set(wordsForStage(state.stage).map((word) => word.id));
      state.arenaSeen = [...new Set(state.arenaSeen.filter((id) => validArenaIds.has(id)))];
      state.completedStages = [...new Set(state.completedStages
        .map(Number)
        .filter((number) => Number.isInteger(number) && number >= 1 && number <= 50))].sort((a, b) => a - b);
      state.journalStage = clamp(Number(state.journalStage) || state.stage, 1, 50);
      return true;
    } catch {
      return false;
    }
  }

  function setMode(nextMode) {
    mode = nextMode;
    const overlays = {
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
    Object.entries(overlays).forEach(([name, element]) => element.classList.toggle("hidden", name !== mode));
    ui.hud.classList.toggle("hidden", !["play", "word"].includes(mode));
    if (mode !== "play") held.clear();
    updateHud();
  }

  function updateHud() {
    const stage = stageInfo();
    const world = worldInfo(stage?.world);
    if (!stage || !world) return;
    const visitCount = state.arenaSeen.filter((id) => wordsForStage().some((word) => word.id === id)).length;
    ui.locationLabel.textContent = `WORLD ${world.number} · ${world.title.toUpperCase()} · ARENA ${stage.number}`;
    ui.objective.textContent = stageIsComplete(stage.number)
      ? `Replay the six objects · ${visitCount}/6 this visit`
      : `Find the six illustrated objects · ${visitCount}/6`;
    ui.seenCount.textContent = `${encounteredCount()}/300`;
  }

  function prepareStage(stageNumber) {
    const stage = stageInfo(stageNumber);
    if (!stage) return;
    state.started = true;
    state.stage = stage.number;
    state.arenaSeen = [];
    state.player = { ...stage.spawn, direction: "up", step: 0 };
    centerCamera(true);
    renderStageBanner();
    saveState();
    setMode("mission");
  }

  function renderStageBanner() {
    const stage = stageInfo();
    const world = worldInfo(stage.world);
    const trail = world.trails.find((item) => item.number === stage.trail);
    ui.missionBannerKicker.textContent = `WORLD ${world.number} · ${world.title.toUpperCase()} · TRAIL ${stage.trail}`;
    ui.missionBannerTitle.textContent = stage.title;
    ui.missionBannerName.textContent = `Arena ${stage.number} of 50 · ${trail.title}`;
    ui.missionBannerTheme.textContent = stage.landmark;
    ui.missionWordPreview.replaceChildren(...wordsForStage().map((word) => {
      const item = document.createElement("span");
      item.textContent = word.cree;
      item.title = word.english;
      return item;
    }));
    ui.beginMissionButton.textContent = stageIsComplete(stage.number) ? "REPLAY ARENA" : "ENTER ARENA";
  }

  function beginStagePlay() {
    setMode("play");
    canvas.focus({ preventScroll: true });
  }

  function startFreshJourney() {
    state = freshState();
    mapWorldView = 1;
    selectedMapTrail = 1;
    mapReturnMode = "title";
    renderMap();
    setMode("map");
  }

  function continueJourneyFromSave() {
    if (!loadState()) {
      startFreshJourney();
      return;
    }
    mapWorldView = stageInfo().world;
    selectedMapTrail = stageInfo().trail;
    mapReturnMode = state.started ? "play" : "title";
    centerCamera(true);
    renderMap();
    setMode("map");
  }

  function openMap(returnMode = mode) {
    if (returnMode === "complete" || returnMode === "ending") returnMode = "play";
    mapReturnMode = returnMode;
    mapWorldView = stageInfo().world;
    selectedMapTrail = stageInfo().trail;
    renderMap();
    setMode("map");
  }

  function closeMap() {
    if (!state.started || mapReturnMode === "title") {
      setMode("title");
    } else if (mapReturnMode === "pause") {
      setMode("pause");
    } else {
      setMode("play");
      canvas.focus({ preventScroll: true });
    }
  }

  function changeMapWorld(delta) {
    mapWorldView = clamp(mapWorldView + delta, 1, 5);
    selectedMapTrail = 1;
    renderMap();
  }

  function renderMap() {
    const world = worldInfo(mapWorldView);
    const worldStages = STAGES.filter((stage) => stage.world === world.number);
    const worldWords = WORDS.filter((word) => word.world === world.number);
    const checks = worldStages.filter((stage) => stageIsComplete(stage.number)).length;
    ui.mapActNumber.textContent = String(world.number);
    ui.mapActName.textContent = world.title;
    ui.actProgressLabel.textContent = `${checks} of 10 arenas checked · ${encounteredCount(worldWords)}/60 objects found`;
    ui.previousActButton.disabled = world.number === 1;
    ui.nextActButton.disabled = world.number === 5;

    const trailCards = world.trails.map((trail) => {
      const trailStages = worldStages.filter((stage) => stage.trail === trail.number);
      const trailWords = WORDS.filter((word) => trailStages.some((stage) => stage.number === word.stage));
      const completed = trailStages.filter((stage) => stageIsComplete(stage.number)).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `chapter-card${selectedMapTrail === trail.number ? " selected" : ""}${completed === 5 ? " completed" : ""}`;
      const status = document.createElement("span");
      status.className = `map-status${completed === 5 ? " checked" : ""}`;
      if (completed !== 5) status.textContent = String(trail.number);
      const title = document.createElement("strong");
      title.textContent = trail.title;
      const detail = document.createElement("small");
      detail.textContent = `${completed}/5 checks · ${encounteredCount(trailWords)}/30 objects · OPEN`;
      button.append(status, title, detail);
      button.addEventListener("click", () => {
        selectedMapTrail = trail.number;
        renderMap();
      });
      return button;
    });
    ui.chapterGrid.replaceChildren(...trailCards);

    const selectedTrail = world.trails.find((trail) => trail.number === selectedMapTrail) || world.trails[0];
    const selectedStages = worldStages.filter((stage) => stage.trail === selectedTrail.number);
    ui.selectedChapterLabel.textContent = `TRAIL ${selectedTrail.number} · ARENAS ${selectedTrail.stageStart}–${selectedTrail.stageEnd}`;
    ui.selectedChapterTitle.textContent = selectedTrail.title;
    ui.selectedChapterTheme.textContent = world.subtitle;

    const stageCards = selectedStages.map((stage) => {
      const stageWords = wordsForStage(stage.number);
      const found = encounteredCount(stageWords);
      const completed = stageIsComplete(stage.number);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `mission-card${completed ? " completed" : ""}`;
      const status = document.createElement("span");
      status.className = `map-status${completed ? " checked" : ""}`;
      if (!completed) status.textContent = String(stage.number);
      const title = document.createElement("strong");
      title.textContent = stage.title;
      const detail = document.createElement("small");
      detail.textContent = `${found}/6 found · ${completed ? "check complete" : "open now"}`;
      button.append(status, title, detail);
      button.addEventListener("click", () => prepareStage(stage.number));
      return button;
    });
    ui.missionGrid.replaceChildren(...stageCards);
    ui.campaignTotal.textContent = `${encounteredCount()} of 300 words encountered`;
    ui.campaignMissions.textContent = `${state.completedStages.length} of 50 arena checks complete`;
  }

  function openJournal() {
    journalReturnMode = mode;
    state.journalStage = state.stage;
    renderJournal();
    setMode("journal");
  }

  function closeJournal() {
    setMode(journalReturnMode === "word" ? "word" : "play");
    if (mode === "play") canvas.focus({ preventScroll: true });
  }

  function changeJournalStage(delta) {
    state.journalStage = clamp(state.journalStage + delta, 1, 50);
    renderJournal();
  }

  function renderJournal() {
    const stage = stageInfo(state.journalStage);
    ui.journalChapter.textContent = `${stage.number} · ${stage.title}`;
    ui.journalTranslationButton.textContent = `ENGLISH: ${state.journalEnglish ? "ON" : "OFF"}`;
    ui.previousChapterButton.disabled = stage.number === 1;
    ui.nextChapterButton.disabled = stage.number === 50;
    const entries = wordsForStage(stage.number).map((word) => {
      const unlocked = state.exposures[word.id] > 0;
      const entry = document.createElement("article");
      entry.className = `journal-entry${unlocked ? "" : " locked"}`;
      const icon = document.createElement("canvas");
      icon.width = 48;
      icon.height = 48;
      icon.className = "journal-icon";
      if (unlocked && assetsReady) drawAtlasIcon(icon.getContext("2d"), word, 48, 48, 3);
      const number = document.createElement("span");
      number.className = "number";
      number.textContent = String(word.sprite + 1).padStart(3, "0");
      const copy = document.createElement("div");
      const form = document.createElement("span");
      form.className = "form";
      form.textContent = unlocked ? word.cree : "••••••";
      const meaning = document.createElement("span");
      meaning.className = "meaning";
      meaning.textContent = unlocked && state.journalEnglish ? word.english : "";
      copy.append(form, meaning);
      entry.append(icon, number, copy);
      return entry;
    });
    ui.journalList.replaceChildren(...entries);
    ui.journalTotal.textContent = `${encounteredCount()} of 300 encountered`;
    saveState();
  }

  function nearestTarget() {
    let nearest = null;
    for (const word of wordsForStage()) {
      const boardDistance = Math.hypot(state.player.x - word.board.x, state.player.y - word.board.y);
      const objectDistance = Math.hypot(state.player.x - word.object.x, state.player.y - word.object.y);
      const distance = Math.min(boardDistance, objectDistance);
      if (!nearest || distance < nearest.distance) nearest = { word, distance, x: word.board.x, y: word.board.y };
    }
    return nearest && nearest.distance <= 118 ? nearest : null;
  }

  function interact() {
    const target = nearestTarget();
    if (!target) {
      showToast("Move closer to an object or its small wooden board.");
      return;
    }
    activeWord = target.word;
    if (!state.arenaSeen.includes(activeWord.id)) state.arenaSeen.push(activeWord.id);
    state.exposures[activeWord.id] = (state.exposures[activeWord.id] || 0) + 1;
    wordEnglishVisible = true;
    renderWordCard();
    saveState();
    setMode("word");
  }

  function renderWordCard() {
    if (!activeWord) return;
    ui.exposureLabel.textContent = state.exposures[activeWord.id] === 1 ? "FIRST LOOK" : `LOOK ${state.exposures[activeWord.id]}`;
    ui.creeWord.textContent = activeWord.cree;
    ui.englishWord.textContent = activeWord.english;
    ui.wordMeta.textContent = `${activeWord.grammar} · ${activeWord.category}`;
    ui.translationNote.textContent = "English is shown as an independent meaning. Cree forms remain flagged for fluent-speaker approval.";
    drawAtlasIcon(ui.wordIcon.getContext("2d"), activeWord, ui.wordIcon.width, ui.wordIcon.height, 8);
    renderWordTranslation();
    updateHud();
  }

  function renderWordTranslation() {
    ui.englishWord.classList.toggle("concealed", !wordEnglishVisible);
    ui.translationButton.textContent = wordEnglishVisible ? "HIDE ENGLISH" : "SHOW ENGLISH";
  }

  function closeWord() {
    if (state.arenaSeen.length >= 6) {
      beginChallenge();
    } else {
      setMode("play");
      canvas.focus({ preventScroll: true });
    }
  }

  function beginChallenge() {
    challengeRounds = shuffle(wordsForStage());
    challengeIndex = 0;
    challengeScore = 0;
    renderChallengeRound();
    setMode("challenge");
  }

  function choicesFor(correctWord) {
    const distinct = shuffle(wordsForStage().filter((word) => word.english !== correctWord.english));
    return shuffle([correctWord.english, ...distinct.slice(0, 2).map((word) => word.english)]);
  }

  function renderChallengeRound() {
    const correct = challengeRounds[challengeIndex];
    challengeAnswered = false;
    challengeSelection = 0;
    currentChoices = choicesFor(correct);
    ui.challengeKindLabel.textContent = "ARENA CHECK";
    ui.roundLabel.textContent = `${challengeIndex + 1}/6`;
    ui.challengePrompt.textContent = "Which meaning matches";
    ui.challengeWord.textContent = correct.cree;
    ui.challengeFeedback.textContent = "";
    ui.nextRoundButton.classList.add("hidden");
    drawAtlasIcon(ui.challengeIcon.getContext("2d"), correct, ui.challengeIcon.width, ui.challengeIcon.height, 6);
    const buttons = currentChoices.map((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `choice-button text-choice english-choice${index === challengeSelection ? " selected" : ""}`;
      button.textContent = choice;
      button.addEventListener("click", () => answerChallenge(choice, button));
      return button;
    });
    ui.choiceGrid.replaceChildren(...buttons);
  }

  function answerChallenge(choice, clickedButton) {
    if (challengeAnswered) return;
    challengeAnswered = true;
    const correct = challengeRounds[challengeIndex];
    const isCorrect = choice === correct.english;
    state.totalAttempts += 1;
    if (isCorrect) {
      state.totalCorrect += 1;
      challengeScore += 1;
    }
    [...ui.choiceGrid.children].forEach((button) => {
      button.disabled = true;
      button.classList.remove("selected");
      if (button.textContent === correct.english) button.classList.add("correct");
    });
    if (!isCorrect) clickedButton.classList.add("wrong");
    ui.challengeFeedback.textContent = isCorrect
      ? `Yes — ${correct.cree} · ${correct.english}`
      : `${correct.cree} means ${correct.english}. Look once more at its illustration.`;
    ui.nextRoundButton.textContent = challengeIndex === challengeRounds.length - 1 ? "FINISH ARENA" : "NEXT";
    ui.nextRoundButton.classList.remove("hidden");
    saveState();
  }

  function nextChallengeRound() {
    if (!challengeAnswered) {
      const button = ui.choiceGrid.children[challengeSelection];
      if (button) answerChallenge(currentChoices[challengeSelection], button);
      return;
    }
    challengeIndex += 1;
    if (challengeIndex < challengeRounds.length) {
      renderChallengeRound();
    } else {
      finishArena();
    }
  }

  function navigateChallenge(delta) {
    if (challengeAnswered || !ui.choiceGrid.children.length) return;
    challengeSelection = (challengeSelection + delta + ui.choiceGrid.children.length) % ui.choiceGrid.children.length;
    [...ui.choiceGrid.children].forEach((button, index) => button.classList.toggle("selected", index === challengeSelection));
  }

  function finishArena() {
    if (!stageIsComplete(state.stage)) state.completedStages.push(state.stage);
    state.completedStages.sort((a, b) => a - b);
    state.campaignFinished = encounteredCount() === 300 && state.completedStages.length === 50;
    const stage = stageInfo();
    ui.completeTitle.textContent = `${stage.title} is complete.`;
    ui.completeCopy.textContent = state.campaignFinished
      ? "Every object has been found and all 50 arena checks are complete."
      : "These six words remain in the journal. Every world and arena is still open.";
    ui.completeSeen.textContent = "6";
    ui.completeCorrect.textContent = String(challengeScore);
    ui.keepExploringButton.textContent = state.campaignFinished ? "SEE THE COMPLETE TRAIL" : "RETURN TO WORLD MAP";
    saveState();
    setMode("complete");
  }

  function continueAfterArena() {
    if (state.campaignFinished) {
      setMode("ending");
    } else {
      openMap("play");
    }
  }

  function togglePause() {
    if (mode === "play") setMode("pause");
    else if (mode === "pause") {
      setMode("play");
      canvas.focus({ preventScroll: true });
    }
  }

  function askToRestart() {
    if (mode === "pause") setMode("confirm");
  }

  function cancelRestart() {
    setMode("pause");
  }

  function confirmRestart() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // The in-memory reset still works when storage is unavailable.
    }
    state = freshState();
    mapWorldView = 1;
    selectedMapTrail = 1;
    ui.continueButton.classList.add("hidden");
    setMode("title");
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.remove("hidden");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => ui.toast.classList.add("hidden"), 1800);
  }

  function centerCamera(immediate = false) {
    const targetX = clamp(state.player.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    const targetY = clamp(state.player.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    if (immediate) {
      camera.x = targetX;
      camera.y = targetY;
    } else {
      camera.x += (targetX - camera.x) * .18;
      camera.y += (targetY - camera.y) * .18;
    }
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
      const speed = 185;
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

  function animatedTarget(word, time) {
    const seconds = time / 1000;
    const phase = word.sprite * .73;
    const result = { x: word.object.x, y: word.object.y, rotation: 0, scale: 1, flip: false };
    if (word.animation === "walk") {
      result.x += Math.sin(seconds * .72 + phase) * 20;
      result.y += Math.sin(seconds * 1.44 + phase) * 3 - Math.abs(Math.sin(seconds * 3.4 + phase)) * 2;
      result.flip = Math.cos(seconds * .72 + phase) < 0;
    } else if (word.animation === "fly") {
      result.x += Math.sin(seconds * .9 + phase) * 24;
      result.y += Math.sin(seconds * 2.4 + phase) * 8 - 6;
      result.rotation = Math.sin(seconds * 2.4 + phase) * .025;
      result.flip = Math.cos(seconds * .9 + phase) < 0;
    } else if (word.animation === "swim") {
      result.x += Math.sin(seconds * .8 + phase) * 24;
      result.y += Math.sin(seconds * 1.6 + phase) * 4;
      result.rotation = Math.sin(seconds * 1.6 + phase) * .035;
      result.flip = Math.cos(seconds * .8 + phase) < 0;
    } else if (word.animation === "hop") {
      const hop = Math.abs(Math.sin(seconds * 2.1 + phase));
      result.x += Math.sin(seconds * .62 + phase) * 16;
      result.y -= hop * 10;
      result.flip = Math.cos(seconds * .62 + phase) < 0;
    } else if (word.animation === "sway") {
      result.rotation = Math.sin(seconds * 1.15 + phase) * .045;
    } else if (word.animation === "pulse") {
      result.scale = 1 + Math.sin(seconds * 1.5 + phase) * .025;
    } else if (word.animation === "dance") {
      result.y -= Math.abs(Math.sin(seconds * 3 + phase)) * 7;
      result.rotation = Math.sin(seconds * 3 + phase) * .055;
    } else if (word.animation === "bounce") {
      result.y -= Math.abs(Math.sin(seconds * 2.3 + phase)) * 5;
    }
    return result;
  }

  function draw() {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    drawWorld();
    drawEntities(performance.now());
    drawInteractionMarker();
    ctx.restore();
  }

  function drawWorld() {
    const map = assets.maps[(stageInfo()?.world || 1) - 1];
    if (assetsReady && map?.naturalWidth) {
      ctx.drawImage(map, 0, 0, WORLD.width, WORLD.height);
    } else {
      ctx.fillStyle = "#244735";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    }
  }

  function drawEntities(time) {
    const entities = [];
    for (const word of wordsForStage()) {
      const animated = animatedTarget(word, time);
      entities.push({ type: "target", y: animated.y, word, animated });
      entities.push({ type: "board", y: word.board.y + 1, word });
    }
    entities.push({ type: "player", y: state.player.y });
    entities.sort((a, b) => a.y - b.y);
    for (const entity of entities) {
      if (entity.type === "target") drawTarget(entity.word, entity.animated);
      else if (entity.type === "board") drawBoard(entity.word);
      else drawPlayer();
    }
  }

  function drawTarget(word, animated) {
    if (!assetsReady) return;
    const size = word.displaySize * animated.scale;
    ctx.save();
    ctx.fillStyle = word.animation === "fly" ? "rgba(11, 21, 16, .18)" : "rgba(11, 21, 16, .28)";
    ctx.beginPath();
    const shadowX = word.animation === "fly" ? word.object.x : animated.x;
    const shadowY = word.animation === "fly" ? word.object.y : animated.y;
    ctx.ellipse(shadowX, shadowY + 4, size * .28, Math.max(5, size * .09), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(Math.round(animated.x), Math.round(animated.y));
    ctx.rotate(animated.rotation);
    ctx.scale(animated.flip ? -1 : 1, 1);
    drawAtlasSprite(ctx, word.sprite, -size / 2, -size, size, size);
    ctx.restore();
  }

  function drawBoard(word) {
    const x = Math.round(word.board.x);
    const y = Math.round(word.board.y);
    ctx.fillStyle = "rgba(12, 23, 17, .28)";
    ctx.beginPath();
    ctx.ellipse(x, y + 9, 24, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#624225";
    ctx.fillRect(x - 15, y - 7, 5, 22);
    ctx.fillRect(x + 10, y - 7, 5, 22);
    ctx.fillStyle = "#392719";
    ctx.fillRect(x - 24, y - 35, 48, 30);
    ctx.fillStyle = "#b77b36";
    ctx.fillRect(x - 21, y - 32, 42, 24);
    ctx.fillStyle = "#e2b85e";
    ctx.fillRect(x - 17, y - 28, 34, 16);
    ctx.fillStyle = "#4f6039";
    ctx.beginPath();
    ctx.arc(x, y - 20, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f7e3a0";
    ctx.font = '700 10px "Balsamiq Sans"';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(word.slot), x, y - 19);
    if (state.arenaSeen.includes(word.id)) drawCheck(x + 19, y - 33, 9);
  }

  function drawCheck(x, y, radius = 13) {
    ctx.fillStyle = "#f7d668";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#17332b";
    ctx.lineWidth = Math.max(2, radius * .25);
    ctx.beginPath();
    ctx.moveTo(x - radius * .5, y);
    ctx.lineTo(x - radius * .12, y + radius * .42);
    ctx.lineTo(x + radius * .58, y - radius * .48);
    ctx.stroke();
  }

  function drawInteractionMarker() {
    if (mode !== "play") return;
    const nearest = nearestTarget();
    if (!nearest) return;
    const pulse = Math.round(Math.sin(performance.now() / 170) * 5);
    const y = nearest.y - 66 + pulse;
    ctx.fillStyle = "rgba(14, 29, 22, .55)";
    ctx.beginPath();
    ctx.moveTo(nearest.x - 19, y - 2);
    ctx.lineTo(nearest.x + 19, y - 2);
    ctx.lineTo(nearest.x, y + 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f5bd2f";
    ctx.beginPath();
    ctx.moveTo(nearest.x - 16, y - 5);
    ctx.lineTo(nearest.x + 16, y - 5);
    ctx.lineTo(nearest.x, y + 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#17332b";
    ctx.font = '700 15px "Balsamiq Sans"';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", nearest.x, y + 2);
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

  function drawAtlasSprite(target, spriteIndex, x, y, width, height) {
    const sourceX = (spriteIndex % ATLAS.columns) * ATLAS.cell;
    const sourceY = Math.floor(spriteIndex / ATLAS.columns) * ATLAS.cell;
    target.drawImage(assets.objects, sourceX, sourceY, ATLAS.cell, ATLAS.cell, x, y, width, height);
  }

  function drawAtlasIcon(iconContext, word, width, height, padding = 4) {
    iconContext.clearRect(0, 0, width, height);
    iconContext.imageSmoothingEnabled = false;
    if (!assetsReady) return;
    const size = Math.min(width, height) - padding * 2;
    drawAtlasSprite(iconContext, word.sprite, (width - size) / 2, (height - size) / 2, size, size);
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
    ui.startButton.textContent = "LOADING 300 OBJECTS…";
    const requests = assets.maps.map((image, index) => loadImage(image, WORLDS[index].map));
    requests.push(loadImage(assets.bear, "assets/bear-sprites-v2.png"));
    requests.push(loadImage(assets.objects, "assets/object-sprites-300.png"));
    if (document.fonts?.load) {
      requests.push(document.fonts.load('400 16px "Balsamiq Sans"'));
      requests.push(document.fonts.load('700 16px "Balsamiq Sans"'));
    }
    return Promise.all(requests).then(() => {
      assetsReady = true;
      ui.startButton.disabled = false;
      ui.continueButton.disabled = false;
      ui.startButton.textContent = "EXPLORE ALL WORLDS";
      if (mode === "journal") renderJournal();
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

  function actionA() {
    if (mode === "mission") beginStagePlay();
    else if (mode === "play") interact();
    else if (mode === "word") closeWord();
    else if (mode === "challenge") nextChallengeRound();
    else if (mode === "complete") continueAfterArena();
    else if (mode === "pause") togglePause();
  }

  function actionB() {
    if (mode === "word") {
      wordEnglishVisible = !wordEnglishVisible;
      renderWordTranslation();
    } else if (mode === "journal") closeJournal();
    else if (mode === "map") closeMap();
    else if (mode === "confirm") cancelRestart();
    else if (mode === "pause" || mode === "play") togglePause();
    else if (mode === "mission") openMap("play");
  }

  window.addEventListener("keydown", (event) => {
    const direction = directionFromKey(event.key);
    if (direction) {
      event.preventDefault();
      if (event.repeat) return;
      if (mode === "challenge") navigateChallenge(direction === "left" || direction === "up" ? -1 : 1);
      else if (mode === "journal" && ["left", "right"].includes(direction)) changeJournalStage(direction === "left" ? -1 : 1);
      else if (mode === "map" && ["left", "right"].includes(direction)) changeMapWorld(direction === "left" ? -1 : 1);
      else if (mode === "play") held.add(direction);
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
    } else if (key === "j" && state.started && ["play", "word", "journal"].includes(mode)) {
      event.preventDefault();
      mode === "journal" ? closeJournal() : openJournal();
    } else if ((key === "p" || key === "m") && state.started) {
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
      else if (mode === "journal" && ["left", "right"].includes(direction)) changeJournalStage(direction === "left" ? -1 : 1);
      else if (mode === "map" && ["left", "right"].includes(direction)) changeMapWorld(direction === "left" ? -1 : 1);
      else if (mode === "play") held.add(direction);
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
    const directions = {
      left: pressed[14] || horizontal < 0,
      right: pressed[15] || horizontal > 0,
      up: pressed[12] || vertical < 0,
      down: pressed[13] || vertical > 0
    };
    for (const [direction, down] of Object.entries(directions)) {
      if (mode === "play") down ? held.add(direction) : held.delete(direction);
    }
    if (justPressed(0)) actionA();
    if (justPressed(1)) actionB();
    if (justPressed(9)) togglePause();
    if (justPressed(8) && state.started && ["play", "pause", "map"].includes(mode)) {
      mode === "map" ? closeMap() : openMap(mode);
    }
    if (mode === "challenge") {
      if (justPressed(14) || justPressed(12)) navigateChallenge(-1);
      if (justPressed(15) || justPressed(13)) navigateChallenge(1);
    }
    gamepadPrevious = pressed;
  }

  ui.startButton.addEventListener("click", startFreshJourney);
  ui.continueButton.addEventListener("click", continueJourneyFromSave);
  ui.beginMissionButton.addEventListener("click", beginStagePlay);
  ui.wordContinueButton.addEventListener("click", closeWord);
  ui.translationButton.addEventListener("click", () => {
    wordEnglishVisible = !wordEnglishVisible;
    renderWordTranslation();
  });
  ui.nextRoundButton.addEventListener("click", nextChallengeRound);
  ui.keepExploringButton.addEventListener("click", continueAfterArena);
  ui.journalButton.addEventListener("click", openJournal);
  ui.journalCloseButton.addEventListener("click", closeJournal);
  ui.previousChapterButton.addEventListener("click", () => changeJournalStage(-1));
  ui.nextChapterButton.addEventListener("click", () => changeJournalStage(1));
  ui.journalTranslationButton.addEventListener("click", () => {
    state.journalEnglish = !state.journalEnglish;
    renderJournal();
  });
  ui.mapButton.addEventListener("click", () => openMap("play"));
  ui.mapCloseButton.addEventListener("click", closeMap);
  ui.previousActButton.addEventListener("click", () => changeMapWorld(-1));
  ui.nextActButton.addEventListener("click", () => changeMapWorld(1));
  ui.resumeButton.addEventListener("click", togglePause);
  ui.pauseMapButton.addEventListener("click", () => openMap("pause"));
  ui.restartButton.addEventListener("click", askToRestart);
  ui.cancelRestartButton.addEventListener("click", cancelRestart);
  ui.confirmRestartButton.addEventListener("click", confirmRestart);
  ui.endingMapButton.addEventListener("click", () => openMap("play"));
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
