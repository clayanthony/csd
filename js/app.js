(function () {
  'use strict';

  var DESIGN_WIDTH = 320;
  var DESIGN_HEIGHT = 568;
  var consoleEl = document.getElementById('console');
  var frame = document.getElementById('emulator-frame');
  var romPicker = document.getElementById('rom-picker');
  var menuOverlay = document.getElementById('menu-overlay');
  var screenLoader = document.getElementById('screen-loader');
  var screenLoaderText = document.getElementById('screen-loader-text');
  var screenError = document.getElementById('screen-error');
  var screenStatus = document.getElementById('screen-status');
  var analogZone = document.getElementById('analog-zone');
  var analogKnob = document.getElementById('analog-knob');
  var dpadZone = document.getElementById('dpad-zone');

  var state = {
    running: false,
    ready: false,
    started: false,
    menuOpen: false,
    pausedByMenu: false,
    romFile: null,
    romName: '',
    transferBuffer: null,
    bootTimer: null,
    activeInputs: {},
    statusTimer: null,
    storedRom: null,
    offlineReady: false,
    offlineKnown: false,
    offlineInstalling: false,
    offlineDone: 0,
    offlineTotal: 0,
    offlineMode: 'auto',
    serviceWorkerRegistration: null,
    settings: {
      lowOverhead: true,
      smooth: true,
      saveRom: false,
      volume: 0.75
    }
  };

  var INPUT = {
    b:       { index: 0,  key: 'x',          code: 'KeyX' },
    start:   { index: 3,  key: 'Enter',      code: 'Enter' },
    d_up:    { index: 4,  key: 'ArrowUp',    code: 'ArrowUp' },
    d_down:  { index: 5,  key: 'ArrowDown',  code: 'ArrowDown' },
    d_left:  { index: 6,  key: 'ArrowLeft',  code: 'ArrowLeft' },
    d_right: { index: 7,  key: 'ArrowRight', code: 'ArrowRight' },
    a:       { index: 8,  key: 'z',          code: 'KeyZ' },
    l:       { index: 10, key: 'q',          code: 'KeyQ' },
    r:       { index: 11, key: 'e',          code: 'KeyE' },
    z:       { index: 12, key: 'Tab',        code: 'Tab' },
    analog_right: { index: 16, key: 'h', code: 'KeyH' },
    analog_left:  { index: 17, key: 'f', code: 'KeyF' },
    analog_down:  { index: 18, key: 'g', code: 'KeyG' },
    analog_up:    { index: 19, key: 't', code: 'KeyT' },
    c_right: { index: 20, key: 'l', code: 'KeyL' },
    c_left:  { index: 21, key: 'j', code: 'KeyJ' },
    c_down:  { index: 22, key: 'k', code: 'KeyK' },
    c_up:    { index: 23, key: 'i', code: 'KeyI' }
  };

  function byId(id) { return document.getElementById(id); }

  function safeGet(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (e) { return fallback; }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) {}
  }

  function loadSettings() {
    state.settings.lowOverhead = safeGet('csd64.lowOverhead', '1') !== '0';
    state.settings.smooth = safeGet('csd64.smooth', '1') !== '0';
    state.settings.saveRom = safeGet('csd64.saveRom', '0') === '1';
    state.settings.volume = Math.max(0, Math.min(1, Number(safeGet('csd64.volume', '0.75')) || 0.75));

    byId('setting-low-overhead').checked = state.settings.lowOverhead;
    byId('setting-smooth').checked = state.settings.smooth;
    byId('setting-save-rom').checked = state.settings.saveRom;
    byId('setting-volume').value = String(Math.round(state.settings.volume * 100));
    document.body.classList.toggle('low-overhead', state.settings.lowOverhead);
  }

  function scaleConsole() {
    var width = window.innerWidth || document.documentElement.clientWidth || DESIGN_WIDTH;
    var height = window.innerHeight || document.documentElement.clientHeight || DESIGN_HEIGHT;
    var scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    consoleEl.style.transform = 'scale(' + scale.toFixed(5) + ')';
    consoleEl.style.top = Math.max(0, Math.floor((height - DESIGN_HEIGHT * scale) / 2)) + 'px';
  }

  function preventPageGesture(event) {
    if (event.cancelable) event.preventDefault();
  }

  function showStatus(message, duration) {
    clearTimeout(state.statusTimer);
    screenStatus.textContent = message;
    screenStatus.classList.add('visible');
    state.statusTimer = setTimeout(function () {
      screenStatus.classList.remove('visible');
    }, duration || 1500);
  }

  function showLoader(message) {
    screenLoaderText.textContent = message || 'PREPARING CORE';
    screenLoader.hidden = false;
  }

  function hideLoader() { screenLoader.hidden = true; }

  function showError(title, message) {
    clearTimeout(state.bootTimer);
    hideLoader();
    byId('screen-error-title').textContent = title || 'CORE ERROR';
    byId('screen-error-message').textContent = message || 'Unknown error.';
    screenError.hidden = false;
  }

  function hideError() { screenError.hidden = true; }

  function haptic() {
    try {
      if (navigator.vibrate) navigator.vibrate(8);
    } catch (e) {}
  }

  function readBlobAsArrayBuffer(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error || new Error('File read failed.')); };
      reader.onabort = function () { reject(new Error('File read cancelled.')); };
      reader.readAsArrayBuffer(blob);
    });
  }

  function extensionOf(name) {
    var match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : '';
  }

  function validRom(file) {
    var ext = extensionOf(file && file.name);
    return ['z64', 'n64', 'v64', 'zip'].indexOf(ext) !== -1;
  }

  function numericGameId(name) {
    var hash = 2166136261;
    var value = String(name || 'CSD64');
    for (var i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash | 0) || 1;
  }

  function makeDefaultControls() {
    var p = {};
    function set(index, value, value2) { p[index] = { value: value || '', value2: value2 || '' }; }
    set(0, 'x', 'BUTTON_2');
    set(1, 's', 'BUTTON_4');
    set(2, 'v', 'SELECT');
    set(3, 'enter', 'START');
    set(4, 'up arrow', 'DPAD_UP');
    set(5, 'down arrow', 'DPAD_DOWN');
    set(6, 'left arrow', 'DPAD_LEFT');
    set(7, 'right arrow', 'DPAD_RIGHT');
    set(8, 'z', 'BUTTON_1');
    set(9, 'a', 'BUTTON_3');
    set(10, 'q', 'LEFT_TOP_SHOULDER');
    set(11, 'e', 'RIGHT_TOP_SHOULDER');
    set(12, 'tab', 'LEFT_BOTTOM_SHOULDER');
    set(13, 'r', 'RIGHT_BOTTOM_SHOULDER');
    set(14, '', 'LEFT_STICK');
    set(15, '', 'RIGHT_STICK');
    set(16, 'h', 'LEFT_STICK_X:+1');
    set(17, 'f', 'LEFT_STICK_X:-1');
    set(18, 'g', 'LEFT_STICK_Y:+1');
    set(19, 't', 'LEFT_STICK_Y:-1');
    set(20, 'l', 'RIGHT_STICK_X:+1');
    set(21, 'j', 'RIGHT_STICK_X:-1');
    set(22, 'k', 'RIGHT_STICK_Y:+1');
    set(23, 'i', 'RIGHT_STICK_Y:-1');
    return { 0: p, 1: {}, 2: {}, 3: {} };
  }

  function makeEjsDocument(config) {
    var safeConfig = JSON.stringify(config).replace(/</g, '\\u003c');
    return '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
      '<style>' +
      'html,body,#game{margin:0;width:100%;height:100%;overflow:hidden;background:#000}' +
      'body{touch-action:none;-webkit-user-select:none;user-select:none}' +
      '#game{position:fixed;left:0;top:0;width:100%;height:100%}' +
      '#csd-loader,#csd-tap{position:fixed;left:0;top:0;width:100%;height:100%;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;background:#000;color:#d2b3ef;font:700 10px -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:1.4px;text-align:center}' +
      '#csd-tap{display:none;background:rgba(0,0,0,.72);color:#fff;padding:20px}' +
      '#csd-tap b{display:block;font-size:13px;margin-bottom:7px}' +
      '#csd-tap span{font-size:9px;color:#c8bdcf;letter-spacing:.5px;line-height:1.4}' +
      '</style></head><body><div id="game"></div><div id="csd-loader">LOADING N64 CORE</div>' +
      '<button id="csd-tap" type="button"><b>TOUCH TO START</b><span>iOS needs one direct tap to unlock game audio.</span></button>' +
      '<script>' +
      '(function(){"use strict";' +
      'var CFG=' + safeConfig + ';var BOOTED=false;var STARTED=false;var PAUSED=false;var ROM_URL=null;var INPUT_STATE={};' +
      'var IS_APPLE=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);' +
      'var LOCAL_RUNTIME={name:"LOCAL OFFLINE",loader:"vendor/emulatorjs/data/loader.js",data:"vendor/emulatorjs/data/"};' +
      'var CACHED_RUNTIME={name:"CACHED 4.2.3",loader:"https://cdn.emulatorjs.org/4.2.3/data/loader.js",data:"https://cdn.emulatorjs.org/4.2.3/data/"};' +
      'var RUNTIMES=CFG.runtimeMode==="local"?[LOCAL_RUNTIME]:(CFG.runtimeMode==="cache"?[CACHED_RUNTIME]:[LOCAL_RUNTIME,CACHED_RUNTIME]);var ACTIVE_RUNTIME=null;' +
      'window.EJS_player="#game";window.EJS_core="mupen64plus_next";window.EJS_gameName=CFG.gameName;window.EJS_gameID=CFG.gameID;' +
      'window.EJS_startOnLoaded=!IS_APPLE;window.EJS_browserMode="mobile";window.EJS_volume=CFG.volume;' +
      'window.EJS_color="#8f35e7";window.EJS_backgroundColor="#000";window.EJS_backgroundBlur=false;' +
      'window.EJS_noAutoFocus=true;window.EJS_askBeforeExit=false;window.EJS_threads=false;' +
      'window.EJS_forceLegacyCores=!!CFG.forceLegacy;window.EJS_disableAutoLang=true;window.EJS_language="en-US";' +
      'window.EJS_disableLocalStorage=true;window.EJS_defaultControls=CFG.controls;window.EJS_controlScheme="n64";' +
      'window.EJS_cacheConfig={enabled:true,cacheMaxSizeMB:384,cacheMaxAgeMins:525600};' +
      'window.EJS_defaultOptions={"virtual-gamepad":"disabled","shader":"disabled","fps":"hide","vsync":"enabled"};' +
      'window.EJS_hideSettings=["virtual-gamepad","shader","fps","slowMotion","fastForward","rewind"];' +
      'window.EJS_Buttons={playPause:false,play:false,pause:false,restart:false,mute:false,unmute:false,settings:false,fullscreen:false,enterFullscreen:false,exitFullscreen:false,saveState:false,loadState:false,screenRecord:false,gamepad:false,cheat:false,volume:false,saveSavFiles:false,loadSavFiles:false,quickSave:false,quickLoad:false,screenshot:false,cacheManager:false,exitEmulation:false};' +
      'function post(type,extra){var m=extra||{};m.type=type;parent.postMessage(m,"*")}' +
      'function error(message){post("csd-ejs-error",{message:String(message||"Unknown core error")})}' +
      'function status(text){var n=document.getElementById("csd-loader");if(n)n.textContent=text}' +
      'function focusGame(){try{window.focus();var g=document.getElementById("game");g.tabIndex=-1;g.focus()}catch(e){}}' +
      'function resumeAudio(){try{var a=[];if(window.EJS_emulator){a.push(EJS_emulator.audioContext);if(EJS_emulator.gameManager){a.push(EJS_emulator.gameManager.audioContext);var m=EJS_emulator.gameManager.Module;if(m){a.push(m.audioContext);if(m.SDL2)a.push(m.SDL2.audioContext)}}}for(var i=0;i<a.length;i++){if(a[i]&&a[i].state==="suspended"&&a[i].resume)a[i].resume().catch(function(){})}}catch(e){}}' +
      'function manager(){try{return window.EJS_emulator&&EJS_emulator.gameManager&&typeof EJS_emulator.gameManager.simulateInput==="function"?EJS_emulator.gameManager:null}catch(e){return null}}' +
      'function applyInput(index,value,key,code){INPUT_STATE[index]=value;var gm=manager();if(gm){try{focusGame();gm.simulateInput(0,Number(index),Number(value));return true}catch(e){}}try{var ev=new KeyboardEvent(value?"keydown":"keyup",{key:key||"",code:code||"",bubbles:true,cancelable:true,repeat:false});window.dispatchEvent(ev)}catch(e){}return false}' +
      'function flushInputs(){var keys=Object.keys(INPUT_STATE);for(var i=0;i<keys.length;i++){var k=keys[i];applyInput(Number(k),INPUT_STATE[k],"","")}}' +
      'function releaseAll(){var keys=Object.keys(INPUT_STATE);for(var i=0;i<keys.length;i++){INPUT_STATE[keys[i]]=0;var gm=manager();if(gm){try{gm.simulateInput(0,Number(keys[i]),0)}catch(e){}}}}' +
      'function hideChrome(){try{var s=[".ejs_virtualGamepad",".ejs-vgamepad",".ejs-vgamepad-active",".ejs_mobile_controls",".ejs_gamepad_bar","[class*=virtual-gamepad]","[class*=vgamepad]",".ejs_menu_bar",".ejs_control_bar",".ejs_controls",".ejs_bottom_bar",".ejs_top_bar","[class*=menu-bar]","[class*=control-bar]","[class*=gamepad-bar]"];var els=document.querySelectorAll(s.join(","));for(var i=0;i<els.length;i++){els[i].classList.remove("ejs-vgamepad-active");els[i].style.setProperty("display","none","important");els[i].style.setProperty("visibility","hidden","important");els[i].style.setProperty("pointer-events","none","important")}var start=document.querySelector(".ejs_start_button");if(start){start.style.opacity="0";start.style.pointerEvents="none"}var canvas=document.querySelector("canvas");if(canvas){canvas.style.setProperty("width","100%","important");canvas.style.setProperty("height","100%","important");canvas.style.setProperty("object-fit","contain","important");canvas.style.setProperty("image-rendering",CFG.smooth?"auto":"pixelated","important");canvas.style.pointerEvents="auto"}}catch(e){}}' +
      'function startCore(){if(STARTED)return;resumeAudio();try{var start=document.querySelector(".ejs_start_button");if(start)start.click()}catch(e){}setTimeout(resumeAudio,40)}' +
      'function power(on){releaseAll();var em=window.EJS_emulator;if(!em||!STARTED)return;if(!on&&!PAUSED&&typeof em.togglePlaying==="function"){try{em.togglePlaying(true);PAUSED=true}catch(e){}}else if(on&&PAUSED&&typeof em.togglePlaying==="function"){try{em.togglePlaying(true);PAUSED=false;setTimeout(function(){focusGame();flushInputs();resumeAudio()},0)}catch(e){}}}' +
      'function setVolume(v){window.EJS_volume=Math.max(0,Math.min(1,Number(v)));try{if(window.EJS_emulator&&typeof EJS_emulator.setVolume==="function")EJS_emulator.setVolume(window.EJS_volume)}catch(e){}resumeAudio()}' +
      'function loadRuntime(i){if(i>=RUNTIMES.length){error("The offline N64 engine is missing. Reconnect once, open the CSD 64 menu, and install the offline engine.");return}var r=RUNTIMES[i];ACTIVE_RUNTIME=r;window.EJS_pathtodata=r.data;status("LOADING "+r.name);var s=document.createElement("script");s.src=r.loader;s.async=true;s.onload=function(){post("csd-ejs-loader",{runtime:r.name})};s.onerror=function(){try{s.parentNode.removeChild(s)}catch(e){}loadRuntime(i+1)};document.body.appendChild(s)}' +
      'window.EJS_ready=function(){hideChrome();setTimeout(hideChrome,70);setTimeout(hideChrome,350);var n=document.getElementById("csd-loader");if(n)n.style.display="none";if(IS_APPLE&&!STARTED){var tap=document.getElementById("csd-tap");if(tap)tap.style.display="flex"}setTimeout(flushInputs,0);post("csd-ejs-ready",{manualStart:IS_APPLE})};' +
      'window.EJS_onGameStart=function(){STARTED=true;PAUSED=false;hideChrome();resumeAudio();var tap=document.getElementById("csd-tap");if(tap)tap.style.display="none";setTimeout(function(){hideChrome();focusGame();flushInputs()},0);post("csd-ejs-started")};' +
      'document.getElementById("csd-tap").addEventListener("touchstart",function(e){e.preventDefault();startCore()},{passive:false});' +
      'document.getElementById("csd-tap").addEventListener("click",startCore);' +
      'window.addEventListener("message",function(ev){var d=ev.data||{};if(d.type==="csd-boot"&&!BOOTED){BOOTED=true;try{var bytes=d.rom instanceof ArrayBuffer?new Uint8Array(d.rom):null;if(!bytes||!bytes.byteLength)throw new Error("ROM transfer was empty");ROM_URL=URL.createObjectURL(new Blob([bytes],{type:"application/octet-stream"}));window.EJS_gameUrl=ROM_URL;post("csd-rom-received",{size:bytes.byteLength});loadRuntime(0)}catch(err){error(err&&err.message||err)}return}if(d.type==="csd-input"){if(d.down)startCore();resumeAudio();applyInput(Number(d.index),d.down?1:0,d.key,d.code);setTimeout(flushInputs,0);return}if(d.type==="csd-power"){power(!!d.on);return}if(d.type==="csd-volume"){setVolume(d.value);return}if(d.type==="csd-smooth"){CFG.smooth=!!d.value;hideChrome();return}if(d.type==="csd-release-all"){releaseAll();return}});' +
      'window.addEventListener("error",function(ev){var m=String(ev.message||"Runtime error");if(m.indexOf("Script error")===-1)error(m)});' +
      'window.addEventListener("unhandledrejection",function(ev){error(String(ev.reason&&ev.reason.message||ev.reason||"Core load failed"))});' +
      'window.addEventListener("beforeunload",function(){releaseAll();if(ROM_URL)try{URL.revokeObjectURL(ROM_URL)}catch(e){}});' +
      'try{new MutationObserver(hideChrome).observe(document.documentElement,{childList:true,subtree:true})}catch(e){}' +
      'post("csd-shell-ready");' +
      '})();' +
      '<\/script></body></html>';
  }

  function sendMessage(message, transfer) {
    if (!frame || !frame.contentWindow) return;
    try {
      if (transfer && transfer.length) frame.contentWindow.postMessage(message, '*', transfer);
      else frame.contentWindow.postMessage(message, '*');
    } catch (e) {}
  }

  function sendInput(name, down) {
    var spec = INPUT[name];
    if (!spec || !state.running) return;
    down = !!down;
    if (!!state.activeInputs[name] === down) return;
    state.activeInputs[name] = down;
    sendMessage({ type: 'csd-input', index: spec.index, key: spec.key, code: spec.code, down: down });
  }

  function releaseAllInputs() {
    var names = Object.keys(state.activeInputs);
    for (var i = 0; i < names.length; i += 1) {
      if (state.activeInputs[names[i]]) sendInput(names[i], false);
    }
    state.activeInputs = {};
    sendMessage({ type: 'csd-release-all' });
    resetAnalogVisual();
    setDpadDirections([]);
    var pressed = document.querySelectorAll('.pressed');
    for (var p = 0; p < pressed.length; p += 1) pressed[p].classList.remove('pressed');
  }

  function bootFile(file) {
    if (!file) return;
    if (navigator.onLine === false && state.offlineKnown && !state.offlineReady) {
      showError('OFFLINE ENGINE MISSING', 'Reconnect once, open the menu, and tap Install offline engine. Wait for OFFLINE READY before disconnecting.');
      return;
    }
    if (!validRom(file)) {
      showError('UNSUPPORTED ROM', 'Choose an uncompressed .z64, .n64 or .v64 file. A compatible .zip may also work.');
      return;
    }
    if (!file.size) {
      showError('EMPTY ROM', 'The selected file contains no data.');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      showError('ROM TOO LARGE', 'This file is too large for the iPhone 5s memory profile.');
      return;
    }

    hideError();
    releaseAllInputs();
    state.romFile = file;
    state.romName = file.name || 'N64 Game';
    state.running = true;
    state.ready = false;
    state.started = false;
    consoleEl.classList.add('game-running');
    document.body.classList.add('game-running');
    updateMenuButtons();
    showLoader('READING ROM');

    if (state.settings.saveRom) saveRomToLibrary(file);

    readBlobAsArrayBuffer(file).then(function (buffer) {
      state.transferBuffer = buffer;
      var config = {
        gameName: state.romName.replace(/\.[^.]+$/, ''),
        gameID: numericGameId(state.romName + '|' + file.size),
        volume: state.settings.volume,
        smooth: state.settings.smooth,
        forceLegacy: state.settings.lowOverhead,
        controls: makeDefaultControls(),
        runtimeMode: state.offlineReady ? state.offlineMode : 'auto'
      };
      frame.srcdoc = makeEjsDocument(config);
      clearTimeout(state.bootTimer);
      state.bootTimer = setTimeout(function () {
        if (state.running && !state.ready) {
          showError('CORE LOAD TIMEOUT', 'The core did not become ready. Reconnect once and install the offline engine from the CSD 64 menu, then try again.');
        }
      }, 50000);
    }).catch(function (error) {
      showError('ROM READ FAILED', String(error && error.message || error));
    });
  }

  function stopGame() {
    releaseAllInputs();
    clearTimeout(state.bootTimer);
    state.running = false;
    state.ready = false;
    state.started = false;
    state.pausedByMenu = false;
    frame.src = 'about:blank';
    try { frame.srcdoc = ''; } catch (e) {}
    consoleEl.classList.remove('game-running');
    document.body.classList.remove('game-running');
    hideLoader();
    hideError();
    updateMenuButtons();
    showStatus('GAME CLOSED', 1000);
  }

  function restartGame() {
    if (!state.romFile) return;
    var file = state.romFile;
    stopGame();
    setTimeout(function () { bootFile(file); }, 50);
  }

  function handleFrameMessage(event) {
    if (!frame || event.source !== frame.contentWindow) return;
    var data = event.data || {};
    if (data.type === 'csd-shell-ready') {
      if (!state.transferBuffer) return;
      var transferable = state.transferBuffer;
      state.transferBuffer = null;
      showLoader('TRANSFERRING ROM');
      sendMessage({ type: 'csd-boot', rom: transferable }, [transferable]);
      return;
    }
    if (data.type === 'csd-rom-received') {
      showLoader('LOADING N64 CORE');
      return;
    }
    if (data.type === 'csd-ejs-loader') {
      showLoader('INITIALIZING CORE');
      return;
    }
    if (data.type === 'csd-ejs-ready') {
      state.ready = true;
      clearTimeout(state.bootTimer);
      hideLoader();
      showStatus(data.manualStart ? 'TOUCH THE GAME SCREEN ONCE' : 'CORE READY', 2200);
      return;
    }
    if (data.type === 'csd-ejs-started') {
      state.started = true;
      hideLoader();
      showStatus('GAME STARTED', 1100);
      return;
    }
    if (data.type === 'csd-ejs-error') {
      showError('EMULATOR ERROR', data.message || 'The core could not start.');
    }
  }

  function bindDigitalButton(button) {
    var control = button.getAttribute('data-control');
    var touchId = null;

    function press(event) {
      if (event && event.cancelable) event.preventDefault();
      if (touchId !== null) return;
      if (event && event.changedTouches && event.changedTouches.length) touchId = event.changedTouches[0].identifier;
      else touchId = 'mouse';
      button.classList.add('pressed');
      haptic();
      sendInput(control, true);
    }

    function release(event) {
      if (touchId === null) return;
      if (event && event.changedTouches) {
        var found = false;
        for (var i = 0; i < event.changedTouches.length; i += 1) {
          if (event.changedTouches[i].identifier === touchId) { found = true; break; }
        }
        if (!found) return;
        if (event.cancelable) event.preventDefault();
      }
      touchId = null;
      button.classList.remove('pressed');
      sendInput(control, false);
    }

    button.addEventListener('touchstart', press, { passive: false });
    button.addEventListener('touchend', release, { passive: false });
    button.addEventListener('touchcancel', release, { passive: false });
    button.addEventListener('mousedown', press);
    button.addEventListener('mouseup', release);
    button.addEventListener('mouseleave', release);
  }

  function bindAnalog() {
    var touchId = null;
    var mouseDown = false;
    var rect = null;

    function findTouch(list) {
      for (var i = 0; i < list.length; i += 1) if (list[i].identifier === touchId) return list[i];
      return null;
    }

    function moveTo(clientX, clientY) {
      if (!rect) rect = analogZone.getBoundingClientRect();
      var scale = rect.width / 119;
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = (clientX - cx) / scale;
      var dy = (clientY - cy) / scale;
      var max = 25;
      var length = Math.sqrt(dx * dx + dy * dy);
      if (length > max) { dx = dx / length * max; dy = dy / length * max; }
      analogKnob.style.transform = 'rotate(-22.5deg) translate3d(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px,0)';
      var threshold = 7;
      sendInput('analog_left', dx < -threshold);
      sendInput('analog_right', dx > threshold);
      sendInput('analog_up', dy < -threshold);
      sendInput('analog_down', dy > threshold);
    }

    function start(event) {
      if (event.cancelable) event.preventDefault();
      rect = analogZone.getBoundingClientRect();
      if (event.changedTouches && event.changedTouches.length) {
        touchId = event.changedTouches[0].identifier;
        moveTo(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
      } else {
        mouseDown = true;
        moveTo(event.clientX, event.clientY);
      }
      haptic();
    }

    function move(event) {
      if (touchId !== null && event.touches) {
        var touch = findTouch(event.touches);
        if (!touch) return;
        if (event.cancelable) event.preventDefault();
        moveTo(touch.clientX, touch.clientY);
      } else if (mouseDown) {
        moveTo(event.clientX, event.clientY);
      }
    }

    function end(event) {
      if (touchId !== null && event.changedTouches) {
        var touch = findTouch(event.changedTouches);
        if (!touch) return;
        if (event.cancelable) event.preventDefault();
        touchId = null;
      } else if (mouseDown) {
        mouseDown = false;
      } else return;
      resetAnalogVisual();
      sendInput('analog_left', false);
      sendInput('analog_right', false);
      sendInput('analog_up', false);
      sendInput('analog_down', false);
    }

    analogZone.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end, { passive: false });
    document.addEventListener('touchcancel', end, { passive: false });
    analogZone.addEventListener('mousedown', start);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
  }

  function resetAnalogVisual() {
    analogKnob.style.transform = 'rotate(-22.5deg) translate3d(0,0,0)';
  }

  function setDpadDirections(directions) {
    var all = ['up', 'down', 'left', 'right'];
    for (var i = 0; i < all.length; i += 1) {
      var dir = all[i];
      var active = directions.indexOf(dir) !== -1;
      dpadZone.classList.toggle('dir-' + dir, active);
      sendInput('d_' + dir, active);
    }
  }

  function bindDpad() {
    var touchId = null;
    var mouseDown = false;
    var rect = null;

    function findTouch(list) {
      for (var i = 0; i < list.length; i += 1) if (list[i].identifier === touchId) return list[i];
      return null;
    }

    function moveTo(clientX, clientY) {
      if (!rect) rect = dpadZone.getBoundingClientRect();
      var dx = clientX - (rect.left + rect.width / 2);
      var dy = clientY - (rect.top + rect.height / 2);
      var dead = rect.width * 0.10;
      if (Math.sqrt(dx * dx + dy * dy) < dead) { setDpadDirections([]); return; }
      var dirs = [];
      if (Math.abs(dx) > dead) dirs.push(dx < 0 ? 'left' : 'right');
      if (Math.abs(dy) > dead) dirs.push(dy < 0 ? 'up' : 'down');
      if (Math.abs(dx) > Math.abs(dy) * 2.2) dirs = [dx < 0 ? 'left' : 'right'];
      else if (Math.abs(dy) > Math.abs(dx) * 2.2) dirs = [dy < 0 ? 'up' : 'down'];
      setDpadDirections(dirs);
    }

    function start(event) {
      if (event.cancelable) event.preventDefault();
      rect = dpadZone.getBoundingClientRect();
      if (event.changedTouches && event.changedTouches.length) {
        touchId = event.changedTouches[0].identifier;
        moveTo(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
      } else {
        mouseDown = true;
        moveTo(event.clientX, event.clientY);
      }
      haptic();
    }

    function move(event) {
      if (touchId !== null && event.touches) {
        var touch = findTouch(event.touches);
        if (!touch) return;
        if (event.cancelable) event.preventDefault();
        moveTo(touch.clientX, touch.clientY);
      } else if (mouseDown) moveTo(event.clientX, event.clientY);
    }

    function end(event) {
      if (touchId !== null && event.changedTouches) {
        var touch = findTouch(event.changedTouches);
        if (!touch) return;
        if (event.cancelable) event.preventDefault();
        touchId = null;
      } else if (mouseDown) mouseDown = false;
      else return;
      setDpadDirections([]);
    }

    dpadZone.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end, { passive: false });
    document.addEventListener('touchcancel', end, { passive: false });
    dpadZone.addEventListener('mousedown', start);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
  }

  function openMenu() {
    if (state.menuOpen) return;
    state.menuOpen = true;
    releaseAllInputs();
    if (state.running && state.started) {
      sendMessage({ type: 'csd-power', on: false });
      state.pausedByMenu = true;
    }
    menuOverlay.hidden = false;
    updateDiagnostics();
    queryOfflineEngine();
    updateMenuButtons();
  }

  function closeMenu(resume) {
    if (!state.menuOpen) return;
    state.menuOpen = false;
    menuOverlay.hidden = true;
    if (resume !== false && state.running && state.pausedByMenu) {
      sendMessage({ type: 'csd-power', on: true });
      state.pausedByMenu = false;
    }
  }

  function updateMenuButtons() {
    byId('menu-resume').disabled = !state.running;
    byId('menu-restart').disabled = !state.romFile;
    byId('menu-close-game').disabled = !state.running;
  }

  function setOfflineUi(status, done, total, message, mode) {
    var label = byId('diag-engine');
    var button = byId('menu-install-offline');
    var detail = byId('offline-detail');
    state.offlineDone = Number(done) || 0;
    state.offlineTotal = Number(total) || 0;
    if (mode === 'local' || mode === 'cache') state.offlineMode = mode;

    if (status === 'ready') {
      state.offlineReady = true;
      state.offlineKnown = true;
      state.offlineInstalling = false;
      if (label) label.textContent = 'READY';
      if (button) { button.disabled = true; button.textContent = 'Offline engine installed'; }
      if (detail) detail.textContent = 'The pinned N64 engine is cached for airplane-mode play.';
      return;
    }
    if (status === 'installing') {
      state.offlineReady = false;
      state.offlineKnown = true;
      state.offlineInstalling = true;
      var percent = total ? Math.round((done / total) * 100) : 0;
      if (label) label.textContent = percent + '%';
      if (button) { button.disabled = true; button.textContent = 'Installing offline engine… ' + percent + '%'; }
      if (detail) detail.textContent = message || ('Caching file ' + done + ' of ' + total + '. Keep this page open.');
      return;
    }
    if (status === 'error') {
      state.offlineReady = false;
      state.offlineKnown = true;
      state.offlineInstalling = false;
      if (label) label.textContent = 'RETRY';
      if (button) { button.disabled = false; button.textContent = 'Retry offline-engine install'; }
      if (detail) detail.textContent = message || 'The engine could not be cached. Check your connection and retry.';
      return;
    }
    state.offlineReady = false;
    state.offlineKnown = true;
    state.offlineInstalling = false;
    if (label) label.textContent = navigator.onLine === false ? 'MISSING' : 'NOT READY';
    if (button) { button.disabled = false; button.textContent = 'Install offline engine'; }
    if (detail) detail.textContent = message || 'Install once while online, then the emulator can start in airplane mode.';
  }

  function activeWorker() {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) return Promise.resolve(navigator.serviceWorker.controller);
    if (state.serviceWorkerRegistration && state.serviceWorkerRegistration.active) return Promise.resolve(state.serviceWorkerRegistration.active);
    if (!navigator.serviceWorker) return Promise.reject(new Error('Service workers are unavailable.'));
    return navigator.serviceWorker.ready.then(function (registration) {
      state.serviceWorkerRegistration = registration;
      return registration.active || registration.waiting || registration.installing;
    });
  }

  function postWorkerMessage(type) {
    return activeWorker().then(function (worker) {
      if (!worker) throw new Error('Offline worker is not active yet.');
      worker.postMessage({ type: type });
    });
  }

  function queryOfflineEngine() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
      setOfflineUi('error', 0, 0, location.protocol === 'file:' ? 'Serve this folder over HTTP or HTTPS; offline installation cannot run from file://.' : 'This browser does not support the required offline worker.');
      return;
    }
    postWorkerMessage('CSD_OFFLINE_STATUS').catch(function (error) {
      setOfflineUi('error', 0, 0, String(error && error.message || error));
    });
  }

  function installOfflineEngine(manual) {
    if (state.offlineInstalling || state.offlineReady) return;
    if (navigator.onLine === false) {
      setOfflineUi('error', 0, 0, 'Internet is needed for this one-time engine installation.');
      if (manual) showStatus('CONNECT ONCE TO INSTALL', 1800);
      return;
    }
    setOfflineUi('installing', 0, 1, 'Starting one-time offline installation…');
    postWorkerMessage('CSD_INSTALL_OFFLINE').catch(function (error) {
      setOfflineUi('error', 0, 0, String(error && error.message || error));
    });
  }

  function handleWorkerMessage(event) {
    var data = event.data || {};
    if (data.type === 'CSD_OFFLINE_STATUS') {
      if (data.ready) setOfflineUi('ready', data.total, data.total, data.message, data.mode);
      else if (data.installing) setOfflineUi('installing', data.done, data.total, data.message, data.mode);
      else setOfflineUi('missing', data.done, data.total, data.message);
      return;
    }
    if (data.type === 'CSD_OFFLINE_PROGRESS') {
      setOfflineUi('installing', data.done, data.total, data.message, data.mode);
      return;
    }
    if (data.type === 'CSD_OFFLINE_READY') {
      setOfflineUi('ready', data.total, data.total, data.message, data.mode);
      showStatus('OFFLINE ENGINE READY', 1800);
      return;
    }
    if (data.type === 'CSD_OFFLINE_ERROR') {
      setOfflineUi('error', data.done, data.total, data.message);
      showStatus('OFFLINE INSTALL FAILED', 1800);
    }
  }

  function updateDiagnostics() {
    byId('diag-viewport').textContent = (window.innerWidth || 0) + ' × ' + (window.innerHeight || 0);
    byId('diag-standalone').textContent = (window.navigator.standalone || window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ? 'YES' : 'NO';
    var webgl = 'NO';
    try {
      var canvas = document.createElement('canvas');
      if (canvas.getContext('webgl2')) webgl = '2';
      else if (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) webgl = '1';
    } catch (e) {}
    byId('diag-webgl').textContent = webgl;
    byId('diag-sw').textContent = navigator.serviceWorker && navigator.serviceWorker.controller ? 'READY' : (navigator.serviceWorker ? 'AVAILABLE' : 'NO');
    if (!state.offlineKnown && byId('diag-engine')) byId('diag-engine').textContent = 'CHECKING';
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
      setTimeout(queryOfflineEngine, 0);
      return;
    }
    navigator.serviceWorker.addEventListener('message', handleWorkerMessage);
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (registration) {
        state.serviceWorkerRegistration = registration;
        return navigator.serviceWorker.ready;
      }).then(function (registration) {
        state.serviceWorkerRegistration = registration;
        updateDiagnostics();
        queryOfflineEngine();
        setTimeout(function () {
          if (!state.offlineReady && !state.offlineInstalling && navigator.onLine !== false) installOfflineEngine(false);
        }, 900);
      }).catch(function (error) {
        updateDiagnostics();
        setOfflineUi('error', 0, 0, 'Offline worker failed: ' + String(error && error.message || error));
      });
    });
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable.')); return; }
      var request = indexedDB.open('CSD64_5S', 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains('library')) db.createObjectStore('library', { keyPath: 'id' });
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error('Database failed.')); };
    });
  }

  function saveRomToLibrary(file) {
    openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction('library', 'readwrite');
        tx.objectStore('library').put({ id: 'last-rom', name: file.name, size: file.size, blob: file, savedAt: Date.now() });
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('ROM could not be saved.')); };
      });
    }).then(function () {
      showStatus('ROM SAVED OFFLINE', 1400);
      refreshStoredRom();
    }).catch(function () {
      showStatus('OFFLINE ROM SAVE FAILED', 1800);
    });
  }

  function refreshStoredRom() {
    openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db.transaction('library', 'readonly').objectStore('library').get('last-rom');
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    }).then(function (record) {
      state.storedRom = record;
      var button = byId('menu-play-stored');
      var note = byId('stored-rom-note');
      if (record && record.blob) {
        button.hidden = false;
        button.textContent = 'Play saved: ' + record.name;
        note.hidden = false;
        note.textContent = 'SAVED ROM: ' + record.name;
      } else {
        button.hidden = true;
        note.hidden = true;
      }
    }).catch(function () {
      state.storedRom = null;
      byId('menu-play-stored').hidden = true;
      byId('stored-rom-note').hidden = true;
    });
  }

  function bindMenu() {
    byId('menu-button').addEventListener('click', openMenu);
    byId('menu-close').addEventListener('click', function () { closeMenu(true); });
    byId('menu-resume').addEventListener('click', function () { closeMenu(true); });
    byId('menu-load-rom').addEventListener('click', function () { closeMenu(false); romPicker.click(); });
    byId('menu-restart').addEventListener('click', function () { closeMenu(false); restartGame(); });
    byId('menu-close-game').addEventListener('click', function () { closeMenu(false); stopGame(); });
    byId('menu-install-offline').addEventListener('click', function () { installOfflineEngine(true); });
    byId('menu-play-stored').addEventListener('click', function () {
      if (!state.storedRom || !state.storedRom.blob) return;
      closeMenu(false);
      var blob = state.storedRom.blob;
      try { blob.name = state.storedRom.name; } catch (e) {}
      var fileLike = new Blob([blob], { type: blob.type || 'application/octet-stream' });
      try { Object.defineProperty(fileLike, 'name', { value: state.storedRom.name }); } catch (e2) { fileLike.name = state.storedRom.name; }
      bootFile(fileLike);
    });

    byId('setting-low-overhead').addEventListener('change', function () {
      state.settings.lowOverhead = this.checked;
      safeSet('csd64.lowOverhead', this.checked ? '1' : '0');
      document.body.classList.toggle('low-overhead', this.checked);
      if (state.running) showStatus('APPLIES ON RESTART', 1300);
    });
    byId('setting-smooth').addEventListener('change', function () {
      state.settings.smooth = this.checked;
      safeSet('csd64.smooth', this.checked ? '1' : '0');
      sendMessage({ type: 'csd-smooth', value: this.checked });
    });
    byId('setting-save-rom').addEventListener('change', function () {
      state.settings.saveRom = this.checked;
      safeSet('csd64.saveRom', this.checked ? '1' : '0');
    });
    byId('setting-volume').addEventListener('input', function () {
      state.settings.volume = Number(this.value) / 100;
      safeSet('csd64.volume', state.settings.volume);
      sendMessage({ type: 'csd-volume', value: state.settings.volume });
    });
  }

  function bindKeyboard() {
    var keyMap = {
      ArrowUp: 'analog_up', ArrowDown: 'analog_down', ArrowLeft: 'analog_left', ArrowRight: 'analog_right',
      x: 'a', z: 'b', q: 'l', e: 'r', Tab: 'z', Enter: 'start',
      i: 'c_up', k: 'c_down', j: 'c_left', l: 'c_right'
    };
    window.addEventListener('keydown', function (event) {
      var name = keyMap[event.key];
      if (!name || event.repeat) return;
      event.preventDefault();
      sendInput(name, true);
    });
    window.addEventListener('keyup', function (event) {
      var name = keyMap[event.key];
      if (!name) return;
      event.preventDefault();
      sendInput(name, false);
    });
  }

  function bindRomPicker() {
    function openPicker() { romPicker.click(); }
    byId('load-rom-hero').addEventListener('click', openPicker);
    romPicker.addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (file) bootFile(file);
    });
  }

  function handleVisibility() {
    releaseAllInputs();
    if (!state.running || !state.started) return;
    if (document.hidden) sendMessage({ type: 'csd-power', on: false });
    else if (!state.menuOpen) sendMessage({ type: 'csd-power', on: true });
  }

  function init() {
    loadSettings();
    scaleConsole();
    refreshStoredRom();
    registerServiceWorker();
    updateDiagnostics();

    var controls = document.querySelectorAll('.control[data-control]');
    for (var i = 0; i < controls.length; i += 1) bindDigitalButton(controls[i]);
    bindAnalog();
    bindDpad();
    bindMenu();
    bindKeyboard();
    bindRomPicker();

    byId('screen-error-close').addEventListener('click', function () { hideError(); stopGame(); });
    window.addEventListener('message', handleFrameMessage);
    window.addEventListener('resize', scaleConsole);
    window.addEventListener('orientationchange', function () { setTimeout(scaleConsole, 200); });
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('contextmenu', preventPageGesture);
    document.addEventListener('gesturestart', preventPageGesture, { passive: false });
    document.addEventListener('gesturechange', preventPageGesture, { passive: false });
    document.addEventListener('gestureend', preventPageGesture, { passive: false });
    document.addEventListener('touchmove', function (event) {
      if (!event.target.closest || !event.target.closest('.menu-scroll')) preventPageGesture(event);
    }, { passive: false });
    window.addEventListener('blur', releaseAllInputs);
    window.addEventListener('online', function () { queryOfflineEngine(); });
    window.addEventListener('offline', function () { queryOfflineEngine(); });
  }

  init();
})();
