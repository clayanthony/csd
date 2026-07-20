(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const ui = {
    hud: document.querySelector("#hud"),
    objective: document.querySelector("#objective"),
    seenCount: document.querySelector("#seen-count"),
    title: document.querySelector("#title-screen"),
    start: document.querySelector("#start-button"),
    continue: document.querySelector("#continue-button"),
    wordCard: document.querySelector("#word-card"),
    wordIcon: document.querySelector("#word-icon"),
    exposureLabel: document.querySelector("#exposure-label"),
    creeWord: document.querySelector("#cree-word"),
    englishWord: document.querySelector("#english-word"),
    translationNote: document.querySelector("#translation-note"),
    translation: document.querySelector("#translation-button"),
    wordContinue: document.querySelector("#word-continue-button"),
    challenge: document.querySelector("#challenge"),
    roundLabel: document.querySelector("#round-label"),
    challengeWord: document.querySelector("#challenge-word"),
    choices: document.querySelector("#choice-grid"),
    feedback: document.querySelector("#challenge-feedback"),
    nextRound: document.querySelector("#next-round-button"),
    complete: document.querySelector("#complete-screen"),
    completeSeen: document.querySelector("#complete-seen"),
    completeCorrect: document.querySelector("#complete-correct"),
    keepExploring: document.querySelector("#keep-exploring-button"),
    journal: document.querySelector("#journal"),
    journalChapter: document.querySelector("#journal-chapter"),
    journalList: document.querySelector("#journal-list"),
    journalTotal: document.querySelector("#journal-total"),
    previousChapter: document.querySelector("#previous-chapter-button"),
    nextChapter: document.querySelector("#next-chapter-button"),
    journalTranslation: document.querySelector("#journal-translation-button"),
    journalClose: document.querySelector("#journal-close-button"),
    journalOpen: document.querySelector("#journal-button"),
    pause: document.querySelector("#pause-menu"),
    resume: document.querySelector("#resume-button"),
    restart: document.querySelector("#restart-button"),
    toast: document.querySelector("#toast"),
    menu: document.querySelector("#menu-button"),
    buttonA: document.querySelector("#button-a"),
    buttonB: document.querySelector("#button-b")
  };

  const SAVE_KEY = "little-bear-words-of-home-demo-v1";
  const WORLD = { width: 480, height: 320 };
  const VIEW = { width: 240, height: 160 };
  const DEMO_FORMS = ["maskwa", "mîtos", "asiniy", "nîpiy", "mînis", "kinosêw"];
  const ICONS = {
    maskwa: "bear",
    "mîtos": "tree",
    asiniy: "rock",
    "nîpiy": "leaf",
    "mînis": "berry",
    "kinosêw": "fish"
  };
  const HOTSPOTS = [
    { cree: "maskwa", x: 224, y: 209, sign: true },
    { cree: "mîtos", x: 91, y: 106, sign: true },
    { cree: "mînis", x: 246, y: 91, sign: true },
    { cree: "kinosêw", x: 340, y: 158, sign: true },
    { cree: "nîpiy", x: 85, y: 219, sign: true },
    { cree: "asiniy", x: 145, y: 268, sign: true }
  ];
  const DEMO_WORDS = DEMO_FORMS.map((form) => window.CREE_LEXICON.find((entry) => entry.cree === form));
  const keys = new Set();

  const defaultState = () => ({
    player: { x: 226, y: 247, direction: "up", step: 0 },
    exposures: {},
    correct: 0,
    demoComplete: false,
    journalChapter: 6,
    journalEnglish: true
  });

  let state = defaultState();
  let mode = "title";
  let activeWord = null;
  let wordEnglishVisible = true;
  let challengeRounds = [];
  let challengeIndex = 0;
  let challengeAnswered = false;
  let challengeSelection = 0;
  let currentChoices = [];
  let camera = { x: 106, y: 160 };
  let lastTime = performance.now();
  let toastTimer = 0;
  let gamepadPrevious = [];

  function hasSave() {
    return Boolean(localStorage.getItem(SAVE_KEY));
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!saved) return false;
      state = {
        ...defaultState(),
        ...saved,
        player: { ...defaultState().player, ...(saved.player || {}) },
        exposures: saved.exposures || {}
      };
      return true;
    } catch {
      return false;
    }
  }

  function saveState() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    ui.continue.classList.remove("hidden");
  }

  function setMode(nextMode) {
    mode = nextMode;
    ui.title.classList.toggle("hidden", mode !== "title");
    ui.hud.classList.toggle("hidden", mode === "title");
    ui.wordCard.classList.toggle("hidden", mode !== "word");
    ui.challenge.classList.toggle("hidden", mode !== "challenge");
    ui.complete.classList.toggle("hidden", mode !== "complete");
    ui.journal.classList.toggle("hidden", mode !== "journal");
    ui.pause.classList.toggle("hidden", mode !== "pause");
    updateHud();
  }

  function beginGame(useSave) {
    if (useSave) loadState();
    else {
      state = defaultState();
      localStorage.removeItem(SAVE_KEY);
    }
    setMode("play");
    saveState();
    canvas.focus();
    showToast("Walk to a picture sign. Press A to look.");
  }

  function encounteredCount() {
    return DEMO_FORMS.filter((form) => (state.exposures[form] || 0) > 0).length;
  }

  function totalEncounteredCount() {
    return Object.values(state.exposures).filter((count) => count > 0).length;
  }

  function allDemoWordsSeen() {
    return encounteredCount() === DEMO_FORMS.length;
  }

  function updateHud() {
    const seen = encounteredCount();
    ui.seenCount.textContent = `${seen}/6`;
    if (state.demoComplete) ui.objective.textContent = "The trail is open — revisit any sign";
    else if (allDemoWordsSeen()) ui.objective.textContent = "Return to the bear sign for the trail check";
    else ui.objective.textContent = `Find the six picture signs · ${seen} found`;
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.remove("hidden");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => ui.toast.classList.add("hidden"), 2400);
  }

  function nearestHotspot() {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const hotspot of HOTSPOTS) {
      const distance = Math.hypot(state.player.x - hotspot.x, state.player.y - hotspot.y);
      if (distance < nearestDistance) {
        nearest = hotspot;
        nearestDistance = distance;
      }
    }
    return nearestDistance <= 27 ? nearest : null;
  }

  function interact() {
    const hotspot = nearestHotspot();
    if (!hotspot) {
      showToast("Move closer to a picture sign.");
      return;
    }
    if (hotspot.cree === "maskwa" && allDemoWordsSeen() && !state.demoComplete && (state.exposures.maskwa || 0) > 0) {
      startChallenge();
      return;
    }
    openWord(hotspot.cree);
  }

  function openWord(form) {
    const entry = DEMO_WORDS.find((word) => word.cree === form);
    if (!entry) return;
    state.exposures[form] = (state.exposures[form] || 0) + 1;
    activeWord = entry;
    wordEnglishVisible = state.exposures[form] <= 2;
    ui.creeWord.textContent = entry.cree;
    ui.englishWord.textContent = entry.english;
    ui.exposureLabel.textContent = exposureName(state.exposures[form]);
    drawVocabularyIcon(ui.wordIcon.getContext("2d"), ICONS[form], 44, 44);
    renderWordTranslation();
    setMode("word");
    saveState();
  }

  function exposureName(count) {
    if (count === 1) return "FIRST LOOK";
    if (count === 2) return "SEEN AGAIN";
    if (count < 5) return `RETURN ${count}`;
    return "FAMILIAR WORD";
  }

  function renderWordTranslation() {
    ui.englishWord.classList.toggle("concealed", !wordEnglishVisible);
    ui.translation.textContent = wordEnglishVisible ? "B  HIDE ENGLISH" : "B  SHOW ENGLISH";
    ui.translationNote.textContent = wordEnglishVisible
      ? "English support is visible. Notice the Cree form first."
      : "Recall the picture, then reveal English whenever you need it.";
  }

  function closeWord() {
    activeWord = null;
    setMode("play");
    if (allDemoWordsSeen() && !state.demoComplete) showToast("All six found. Return to maskwa for the trail check.");
    canvas.focus();
  }

  function startChallenge() {
    challengeRounds = shuffle([...DEMO_WORDS]).slice(0, 5);
    challengeIndex = 0;
    setMode("challenge");
    renderChallengeRound();
  }

  function renderChallengeRound() {
    challengeAnswered = false;
    challengeSelection = 0;
    ui.nextRound.classList.add("hidden");
    ui.feedback.textContent = "";
    const target = challengeRounds[challengeIndex];
    const distractors = shuffle(DEMO_WORDS.filter((word) => word.cree !== target.cree)).slice(0, 2);
    currentChoices = shuffle([target, ...distractors]);
    challengeSelection = currentChoices.findIndex((word) => word.cree === target.cree);
    challengeSelection = (challengeSelection + 1) % currentChoices.length;
    ui.roundLabel.textContent = `${challengeIndex + 1}/5`;
    ui.challengeWord.textContent = target.cree;
    ui.choices.replaceChildren();

    currentChoices.forEach((word, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-button";
      button.setAttribute("aria-label", `Picture choice ${index + 1}`);
      button.dataset.index = String(index);
      const icon = document.createElement("canvas");
      icon.width = 48;
      icon.height = 48;
      icon.setAttribute("aria-hidden", "true");
      button.append(icon);
      button.addEventListener("click", () => answerChallenge(index));
      ui.choices.append(button);
      drawVocabularyIcon(icon.getContext("2d"), ICONS[word.cree], 48, 48);
    });
    updateChallengeSelection();
  }

  function navigateChallenge(delta) {
    if (challengeAnswered) return;
    challengeSelection = (challengeSelection + delta + currentChoices.length) % currentChoices.length;
    updateChallengeSelection();
  }

  function updateChallengeSelection() {
    [...ui.choices.children].forEach((button, index) => {
      button.style.outline = index === challengeSelection ? "3px solid #a84536" : "";
      button.style.outlineOffset = index === challengeSelection ? "2px" : "";
    });
  }

  function answerChallenge(index = challengeSelection) {
    if (challengeAnswered) return;
    challengeAnswered = true;
    const target = challengeRounds[challengeIndex];
    const selected = currentChoices[index];
    const correct = selected.cree === target.cree;
    if (correct) state.correct += 1;
    state.exposures[target.cree] = (state.exposures[target.cree] || 0) + 1;

    [...ui.choices.children].forEach((button, choiceIndex) => {
      button.disabled = true;
      const word = currentChoices[choiceIndex];
      if (word.cree === target.cree) button.classList.add("correct");
      else if (choiceIndex === index) button.classList.add("wrong");
    });
    ui.feedback.textContent = correct
      ? `Yes — ${target.cree} means ${target.english}.`
      : `${target.cree} means ${target.english}. Notice its picture and try it again later.`;
    ui.nextRound.textContent = challengeIndex === challengeRounds.length - 1 ? "A  FINISH" : "A  NEXT";
    ui.nextRound.classList.remove("hidden");
    saveState();
  }

  function nextChallengeRound() {
    if (!challengeAnswered) {
      answerChallenge();
      return;
    }
    challengeIndex += 1;
    if (challengeIndex >= challengeRounds.length) {
      state.demoComplete = true;
      ui.completeSeen.textContent = String(encounteredCount());
      ui.completeCorrect.textContent = String(state.correct);
      saveState();
      setMode("complete");
      return;
    }
    renderChallengeRound();
  }

  function openJournal() {
    if (mode !== "play" && mode !== "complete") return;
    const encountered = DEMO_WORDS.find((word) => (state.exposures[word.cree] || 0) > 0);
    if (encountered && !window.CREE_LEXICON.some((word) => word.chapter === state.journalChapter && (state.exposures[word.cree] || 0) > 0)) {
      state.journalChapter = encountered.chapter;
    }
    renderJournal();
    setMode("journal");
  }

  function closeJournal() {
    setMode("play");
    saveState();
    canvas.focus();
  }

  function renderJournal() {
    const words = window.CREE_LEXICON
      .filter((word) => word.chapter === state.journalChapter)
      .sort((a, b) => a.order - b.order);
    ui.journalChapter.textContent = `${state.journalChapter}: ${words[0]?.chapterTitle || ""}`;
    ui.journalTranslation.textContent = `ENGLISH: ${state.journalEnglish ? "ON" : "OFF"}`;
    ui.previousChapter.disabled = state.journalChapter <= 1;
    ui.nextChapter.disabled = state.journalChapter >= 25;
    ui.journalList.replaceChildren();

    for (const word of words) {
      const encountered = (state.exposures[word.cree] || 0) > 0;
      const row = document.createElement("div");
      row.className = `journal-entry${encountered ? "" : " locked"}`;
      row.title = encountered ? `${word.partOfSpeech} · ${word.grammaticalClass}` : "Encounter this word on the trail";
      const number = document.createElement("span");
      number.className = "number";
      number.textContent = String(word.order).padStart(3, "0");
      const form = document.createElement("span");
      form.className = "form";
      form.textContent = encountered ? word.cree : "••••";
      const meaning = document.createElement("span");
      meaning.className = "meaning";
      meaning.textContent = encountered && state.journalEnglish ? word.english : "";
      row.append(number, form, meaning);
      ui.journalList.append(row);
    }
    ui.journalTotal.textContent = `${totalEncounteredCount()} of 750 encountered`;
  }

  function changeJournalChapter(delta) {
    state.journalChapter = clamp(state.journalChapter + delta, 1, 25);
    renderJournal();
  }

  function togglePause() {
    if (mode === "play") setMode("pause");
    else if (mode === "pause") setMode("play");
  }

  function actionA() {
    if (mode === "play") interact();
    else if (mode === "word") closeWord();
    else if (mode === "challenge") nextChallengeRound();
    else if (mode === "complete") setMode("play");
    else if (mode === "pause") togglePause();
  }

  function actionB() {
    if (mode === "word") {
      wordEnglishVisible = !wordEnglishVisible;
      renderWordTranslation();
    } else if (mode === "journal") closeJournal();
    else if (mode === "pause") togglePause();
    else if (mode === "complete") setMode("play");
    else if (mode === "play") togglePause();
  }

  function restartDemo() {
    if (!window.confirm("Restart the trailhead demo? Your saved word encounters will be cleared.")) return;
    state = defaultState();
    localStorage.removeItem(SAVE_KEY);
    setMode("play");
    saveState();
    showToast("Trail restarted.");
  }

  function update(dt) {
    if (mode !== "play") return;
    let dx = 0;
    let dy = 0;
    if (keys.has("up")) dy -= 1;
    if (keys.has("down")) dy += 1;
    if (keys.has("left")) dx -= 1;
    if (keys.has("right")) dx += 1;
    if (dx && dy) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }
    if (dx || dy) {
      const speed = 56;
      const proposedX = state.player.x + dx * speed * dt;
      const proposedY = state.player.y + dy * speed * dt;
      if (!blocked(proposedX, state.player.y)) state.player.x = proposedX;
      if (!blocked(state.player.x, proposedY)) state.player.y = proposedY;
      state.player.direction = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
      state.player.step += dt * 8;
    }
    const targetCameraX = clamp(state.player.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    const targetCameraY = clamp(state.player.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    camera.x += (targetCameraX - camera.x) * Math.min(1, dt * 8);
    camera.y += (targetCameraY - camera.y) * Math.min(1, dt * 8);
  }

  function blocked(x, y) {
    if (x < 14 || y < 34 || x > WORLD.width - 14 || y > WORLD.height - 12) return true;
    if (x > 34 && x < 164 && y > 43 && y < 123) return true;
    const creekEdge = 382 + Math.sin(y / 24) * 10;
    if (x > creekEdge && !(y > 138 && y < 181)) return true;
    return false;
  }

  function draw() {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    ctx.save();
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
    drawWorld();
    drawHotspots();
    drawPlayer();
    ctx.restore();
  }

  function drawWorld() {
    ctx.fillStyle = "#66864d";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    for (let y = 8; y < WORLD.height; y += 16) {
      for (let x = (y / 16) % 2 ? 8 : 2; x < WORLD.width; x += 19) {
        const tone = ((x * 13 + y * 7) % 4);
        ctx.fillStyle = ["#5d7f48", "#708f52", "#547642", "#789256"][tone];
        ctx.fillRect(x, y, tone % 2 ? 2 : 1, 2);
      }
    }

    drawPath([[203, 320], [205, 245], [221, 207], [247, 169], [270, 117]], 34);
    drawPath([[220, 211], [163, 217], [109, 226], [63, 259]], 25);
    drawPath([[236, 197], [288, 180], [342, 164], [399, 160]], 23);
    drawPath([[205, 237], [163, 260], [129, 286]], 22);
    drawPath([[209, 202], [174, 167], [133, 133], [95, 109]], 20);

    drawCreek();
    drawBridge(372, 157);
    drawBuilding(46, 49);

    drawTree(24, 50, 1.1);
    drawTree(180, 42, .9);
    drawTree(93, 90, 1.15);
    drawTree(294, 51, .95);
    drawTree(335, 75, .78);
    drawTree(60, 185, .82);
    drawTree(40, 285, .95);
    drawTree(284, 275, .92);
    drawTree(329, 239, .8);
    drawTree(447, 91, .9);
    drawTree(454, 249, 1.05);

    drawBerryBush(246, 82);
    drawBerryBush(269, 98);
    drawBerryBush(302, 115);
    drawRock(145, 266, 1.25);
    drawRock(168, 281, .7);
    drawRock(319, 202, .55);
    drawLeafCluster(76, 217);
    drawLeafCluster(99, 231);

    drawFence(170, 68, 88);
    drawDock(399, 213);
  }

  function drawPath(points, width) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#a8905d";
    ctx.lineWidth = width + 4;
    path(points);
    ctx.stroke();
    ctx.strokeStyle = "#c6ae73";
    ctx.lineWidth = width;
    path(points);
    ctx.stroke();
    ctx.strokeStyle = "rgba(232, 207, 139, .36)";
    ctx.lineWidth = 2;
    path(points);
    ctx.stroke();
  }

  function path(points) {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  }

  function drawCreek() {
    ctx.fillStyle = "#315f68";
    ctx.beginPath();
    ctx.moveTo(390, 0);
    for (let y = 0; y <= WORLD.height; y += 12) ctx.lineTo(382 + Math.sin(y / 24) * 10, y);
    ctx.lineTo(WORLD.width, WORLD.height);
    ctx.lineTo(WORLD.width, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#88a67e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let y = 0; y <= WORLD.height; y += 8) {
      const x = 380 + Math.sin(y / 24) * 10;
      y ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = "rgba(178, 218, 191, .45)";
    ctx.lineWidth = 1;
    for (let y = 17; y < WORLD.height; y += 27) {
      ctx.beginPath();
      ctx.moveTo(408 + ((y * 3) % 34), y);
      ctx.lineTo(439 + ((y * 5) % 22), y - 3);
      ctx.stroke();
    }
  }

  function drawBridge(x, y) {
    ctx.fillStyle = "#493d2b";
    ctx.fillRect(x - 15, y - 17, 86, 6);
    ctx.fillRect(x - 15, y + 17, 86, 6);
    for (let i = 0; i < 9; i += 1) {
      ctx.fillStyle = i % 2 ? "#9a6a35" : "#b27b3b";
      ctx.fillRect(x - 12 + i * 9, y - 14, 8, 31);
    }
    ctx.fillStyle = "#5b442a";
    ctx.fillRect(x - 16, y - 21, 4, 44);
    ctx.fillRect(x + 68, y - 21, 4, 44);
  }

  function drawBuilding(x, y) {
    ctx.fillStyle = "rgba(25, 40, 31, .25)";
    ctx.beginPath();
    ctx.ellipse(x + 69, y + 76, 73, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b95e3d";
    ctx.fillRect(x + 3, y + 22, 115, 49);
    ctx.fillStyle = "#8d422e";
    ctx.fillRect(x + 3, y + 65, 115, 8);
    ctx.fillStyle = "#34453b";
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 23);
    ctx.lineTo(x + 47, y - 9);
    ctx.lineTo(x + 129, y + 23);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#53645a";
    ctx.beginPath();
    ctx.moveTo(x - 1, y + 20);
    ctx.lineTo(x + 48, y - 5);
    ctx.lineTo(x + 117, y + 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#d6bd75";
    ctx.fillRect(x + 48, y + 43, 22, 30);
    ctx.fillStyle = "#4d3022";
    ctx.fillRect(x + 52, y + 47, 15, 26);
    for (const wx of [14, 83]) {
      ctx.fillStyle = "#213b3c";
      ctx.fillRect(x + wx, y + 37, 21, 17);
      ctx.fillStyle = "#8cb3a2";
      ctx.fillRect(x + wx + 3, y + 40, 15, 11);
      ctx.fillStyle = "#d9e9bb";
      ctx.fillRect(x + wx + 5, y + 41, 3, 8);
    }
    ctx.fillStyle = "#e0b548";
    ctx.fillRect(x + 43, y + 28, 32, 6);
    ctx.fillStyle = "#17332b";
    ctx.fillRect(x + 48, y + 30, 22, 2);
  }

  function drawTree(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(26, 48, 31, .24)";
    ctx.beginPath();
    ctx.ellipse(2, 31, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d8d0a8";
    ctx.fillRect(-3, 3, 7, 29);
    ctx.fillStyle = "#5d5948";
    ctx.fillRect(1, 8, 3, 4);
    ctx.fillRect(-3, 18, 3, 4);
    ctx.fillStyle = "#315d3d";
    blob(-10, 1, 13, 13);
    blob(7, 2, 13, 14);
    ctx.fillStyle = "#44764a";
    blob(-4, -10, 15, 15);
    ctx.fillStyle = "#6c914e";
    blob(-13, -5, 8, 8);
    blob(10, -7, 8, 8);
    ctx.restore();
  }

  function blob(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBerryBush(x, y) {
    ctx.fillStyle = "#2f593a";
    blob(x - 7, y, 9, 7);
    blob(x + 6, y - 2, 10, 8);
    ctx.fillStyle = "#4c7945";
    blob(x, y - 7, 10, 8);
    ctx.fillStyle = "#a73e37";
    [[-8, -2], [0, -9], [8, -3], [4, 4]].forEach(([dx, dy]) => ctx.fillRect(x + dx, y + dy, 3, 3));
  }

  function drawRock(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#596861";
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.lineTo(-8, -5);
    ctx.lineTo(2, -10);
    ctx.lineTo(12, -3);
    ctx.lineTo(14, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#89958b";
    ctx.beginPath();
    ctx.moveTo(-7, -4);
    ctx.lineTo(2, -8);
    ctx.lineTo(8, -3);
    ctx.lineTo(-2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawLeafCluster(x, y) {
    ctx.strokeStyle = "#344d31";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 6);
    ctx.lineTo(x + 9, y - 9);
    ctx.stroke();
    ctx.fillStyle = "#72934b";
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.ellipse(x - 7 + i * 5, y + 2 - i * 4, 4, 2, -.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFence(x, y, length) {
    ctx.fillStyle = "#8c6839";
    ctx.fillRect(x, y, length, 3);
    ctx.fillRect(x, y + 12, length, 3);
    for (let px = x; px <= x + length; px += 22) ctx.fillRect(px, y - 4, 4, 23);
  }

  function drawDock(x, y) {
    ctx.fillStyle = "#725030";
    ctx.fillRect(x, y, 59, 20);
    ctx.fillStyle = "#a4773e";
    for (let i = 0; i < 7; i += 1) ctx.fillRect(x + i * 9, y + 2, 7, 15);
  }

  function drawHotspots() {
    for (const hotspot of HOTSPOTS) {
      drawSign(hotspot.x, hotspot.y, ICONS[hotspot.cree], (state.exposures[hotspot.cree] || 0) > 0);
    }
    const nearest = nearestHotspot();
    if (mode === "play" && nearest) {
      const pulse = Math.round(Math.sin(performance.now() / 170) * 2);
      ctx.fillStyle = "#fff4cf";
      ctx.fillRect(nearest.x - 9, nearest.y - 36 + pulse, 18, 9);
      ctx.fillStyle = "#17332b";
      ctx.fillRect(nearest.x - 7, nearest.y - 34 + pulse, 14, 5);
      ctx.fillStyle = "#f7d668";
      ctx.font = "bold 6px monospace";
      ctx.textAlign = "center";
      ctx.fillText("A", nearest.x, nearest.y - 29 + pulse);
    }
  }

  function drawSign(x, y, icon, seen) {
    ctx.fillStyle = "rgba(30, 43, 30, .24)";
    blob(x + 1, y + 11, 11, 4);
    ctx.fillStyle = "#5d3f28";
    ctx.fillRect(x - 2, y - 9, 4, 20);
    ctx.fillStyle = seen ? "#e4bc51" : "#d8c797";
    ctx.fillRect(x - 11, y - 22, 22, 16);
    ctx.fillStyle = "#3d3424";
    ctx.fillRect(x - 10, y - 21, 20, 2);
    ctx.fillRect(x - 10, y - 8, 20, 2);
    const temp = document.createElement("canvas");
    temp.width = 16;
    temp.height = 12;
    drawVocabularyIcon(temp.getContext("2d"), icon, 16, 12, true);
    ctx.drawImage(temp, x - 8, y - 19);
    if (seen) {
      ctx.fillStyle = "#fff4cf";
      ctx.fillRect(x + 7, y - 25, 5, 5);
      ctx.fillStyle = "#2d6b50";
      ctx.fillRect(x + 8, y - 24, 3, 3);
    }
  }

  function drawPlayer() {
    const { x, y, direction, step } = state.player;
    const bob = Math.abs(Math.sin(step)) * 1.2;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y - bob));
    if (direction === "left") ctx.scale(-1, 1);
    ctx.fillStyle = "rgba(17, 29, 23, .32)";
    blob(0, 8 + bob, 13, 4);
    ctx.fillStyle = "#151713";
    blob(-2, -1, 12, 8);
    blob(9, -5, 7, 7);
    ctx.fillStyle = "#0b0d0b";
    blob(6, -11, 3, 3);
    blob(13, -11, 3, 3);
    ctx.fillStyle = "#242820";
    blob(14, -3, 4, 3);
    ctx.fillStyle = "#0b0d0b";
    ctx.fillRect(16, -4, 2, 2);
    ctx.fillRect(-9, 4, 4, 8);
    ctx.fillRect(4, 4, 4, 8);
    ctx.fillStyle = "#287d78";
    ctx.fillRect(-4, -7, 8, 10);
    ctx.fillStyle = "#185c59";
    ctx.fillRect(-6, -5, 2, 10);
    ctx.fillStyle = "#d7aa37";
    ctx.fillRect(-2, -2, 2, 2);
    ctx.restore();
  }

  function drawVocabularyIcon(iconCtx, icon, width, height, compact = false) {
    iconCtx.clearRect(0, 0, width, height);
    iconCtx.imageSmoothingEnabled = false;
    const sx = width / 48;
    const sy = height / 48;
    iconCtx.save();
    iconCtx.scale(sx, sy);
    if (!compact) {
      iconCtx.fillStyle = "#d7c785";
      iconCtx.fillRect(0, 0, 48, 48);
      iconCtx.fillStyle = "#c0ae6f";
      for (let y = 4; y < 48; y += 9) iconCtx.fillRect((y * 3) % 43, y, 2, 2);
    }
    const p = (color, x, y, w, h) => {
      iconCtx.fillStyle = color;
      iconCtx.fillRect(x, y, w, h);
    };
    if (icon === "bear") {
      p("#1a1b17", 12, 22, 25, 15); p("#1a1b17", 29, 15, 12, 14);
      p("#0c0d0b", 29, 11, 5, 6); p("#0c0d0b", 37, 12, 5, 6);
      p("#0c0d0b", 14, 34, 6, 8); p("#0c0d0b", 30, 34, 6, 8);
      p("#8d825f", 37, 23, 7, 5); p("#0a0b09", 42, 24, 3, 2);
    } else if (icon === "tree") {
      p("#d8d0a8", 21, 20, 7, 23); p("#5d5948", 24, 25, 4, 5);
      p("#315d3d", 8, 12, 30, 20); p("#44764a", 14, 5, 22, 22);
      p("#6c914e", 8, 13, 8, 8); p("#6c914e", 31, 10, 8, 9);
    } else if (icon === "rock") {
      p("#596861", 9, 24, 31, 15); p("#596861", 14, 18, 19, 7);
      p("#89958b", 15, 20, 17, 7); p("#aab0a5", 18, 21, 7, 3);
    } else if (icon === "leaf") {
      p("#345837", 22, 9, 3, 31);
      p("#72934b", 9, 14, 15, 8); p("#84a659", 24, 10, 15, 8);
      p("#5f8445", 10, 27, 14, 8); p("#789b50", 24, 23, 15, 9);
    } else if (icon === "berry") {
      p("#315d3d", 13, 17, 23, 19); p("#4c7945", 9, 22, 14, 13); p("#4c7945", 25, 12, 13, 14);
      p("#a73e37", 14, 18, 6, 6); p("#b94a3f", 25, 17, 6, 6); p("#92332f", 19, 28, 6, 6); p("#b94a3f", 31, 28, 5, 5);
    } else if (icon === "fish") {
      p("#376d72", 12, 18, 25, 15); p("#2c565e", 5, 15, 11, 20);
      p("#6e9b91", 18, 20, 12, 4); p("#17332b", 32, 21, 3, 3);
      p("#9ab5a6", 16, 29, 7, 3);
    }
    iconCtx.restore();
  }

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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
      else if (mode === "journal" && (direction === "left" || direction === "right")) changeJournalChapter(direction === "left" ? -1 : 1);
      else keys.add(direction);
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
    if (direction) keys.delete(direction);
  });

  document.querySelectorAll("[data-direction]").forEach((button) => {
    const direction = button.dataset.direction;
    const press = (event) => {
      event.preventDefault();
      if (mode === "challenge") navigateChallenge(direction === "left" || direction === "up" ? -1 : 1);
      else if (mode === "journal" && (direction === "left" || direction === "right")) changeJournalChapter(direction === "left" ? -1 : 1);
      else keys.add(direction);
    };
    const release = (event) => {
      event.preventDefault();
      keys.delete(direction);
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
    const padDirections = {
      left: pressed[14] || horizontal < 0,
      right: pressed[15] || horizontal > 0,
      up: pressed[12] || vertical < 0,
      down: pressed[13] || vertical > 0
    };
    for (const [direction, down] of Object.entries(padDirections)) {
      if (mode === "play") down ? keys.add(direction) : keys.delete(direction);
    }
    if (justPressed(0)) actionA();
    if (justPressed(1)) actionB();
    if (justPressed(9)) togglePause();
    if (justPressed(8)) mode === "journal" ? closeJournal() : openJournal();
    if (mode === "challenge") {
      if (justPressed(14) || justPressed(12)) navigateChallenge(-1);
      if (justPressed(15) || justPressed(13)) navigateChallenge(1);
    }
    gamepadPrevious = pressed;
  }

  ui.start.addEventListener("click", () => beginGame(false));
  ui.continue.addEventListener("click", () => beginGame(true));
  ui.wordContinue.addEventListener("click", closeWord);
  ui.translation.addEventListener("click", () => {
    wordEnglishVisible = !wordEnglishVisible;
    renderWordTranslation();
  });
  ui.nextRound.addEventListener("click", nextChallengeRound);
  ui.keepExploring.addEventListener("click", () => setMode("play"));
  ui.journalOpen.addEventListener("click", openJournal);
  ui.journalClose.addEventListener("click", closeJournal);
  ui.previousChapter.addEventListener("click", () => changeJournalChapter(-1));
  ui.nextChapter.addEventListener("click", () => changeJournalChapter(1));
  ui.journalTranslation.addEventListener("click", () => {
    state.journalEnglish = !state.journalEnglish;
    renderJournal();
  });
  ui.resume.addEventListener("click", togglePause);
  ui.restart.addEventListener("click", restartDemo);
  ui.menu.addEventListener("click", togglePause);
  ui.buttonA.addEventListener("click", actionA);
  ui.buttonB.addEventListener("click", actionB);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && mode === "play") {
      keys.clear();
      saveState();
      setMode("pause");
    }
  });

  function loop(now) {
    const dt = Math.min(.05, (now - lastTime) / 1000);
    lastTime = now;
    pollGamepad();
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  ui.continue.classList.toggle("hidden", !hasSave());
  setMode("title");
  requestAnimationFrame(loop);
})();
