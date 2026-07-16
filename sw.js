'use strict';

/*
 * CSD 64 iPhone 5s offline worker.
 *
 * The app shell is cached immediately. The pinned EmulatorJS 4.2.3 runtime
 * and the non-threaded legacy Mupen64Plus-Next core are installed once in a
 * second cache. Cross-origin files are always served cache-first afterwards.
 */

var SHELL_CACHE = 'csd64-5s-shell-v2';
var RUNTIME_CACHE = 'csd64-5s-runtime-4.2.3-v2';
var CDN_ROOT = 'https://cdn.emulatorjs.org/4.2.3/data/';
var LOCAL_ROOT = new URL('./vendor/emulatorjs/data/', self.location.href).href;
var installJob = null;

var SHELL_FILES = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './manifest.json',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* Only files used by this N64/iPhone-5s profile are warmed. */
var RUNTIME_PATHS = [
  'loader.js',
  'emulator.min.js',
  'emulator.min.css',
  'localization/en-US.json',
  'localization/retroarch.json',
  'cores/cores.json',
  'cores/mupen64plus_next-legacy-wasm.data',
  'cores/mupen64plus_next-wasm.data',
  'compression/extract7z.js',
  'compression/extractzip.js'
];
var RUNTIME_FILES = RUNTIME_PATHS.map(function (path) { return CDN_ROOT + path; });
var LOCAL_RUNTIME_FILES = RUNTIME_PATHS.map(function (path) { return LOCAL_ROOT + path; });

function postToClient(client, payload) {
  if (!client || !client.postMessage) return;
  try { client.postMessage(payload); } catch (e) {}
}

function broadcast(payload) {
  return self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(function (clients) {
    for (var i = 0; i < clients.length; i += 1) postToClient(clients[i], payload);
  });
}

function countCached(cacheName, files) {
  return caches.open(cacheName).then(function (cache) {
    return Promise.all(files.map(function (url) {
      return cache.match(url).then(function (response) { return !!response; });
    }));
  }).then(function (present) {
    var done = 0;
    for (var i = 0; i < present.length; i += 1) if (present[i]) done += 1;
    return done;
  });
}

function runtimeStatus() {
  return Promise.all([
    countCached(SHELL_CACHE, LOCAL_RUNTIME_FILES),
    countCached(RUNTIME_CACHE, RUNTIME_FILES)
  ]).then(function (counts) {
    var localDone = counts[0];
    var cdnDone = counts[1];
    var localReady = localDone === LOCAL_RUNTIME_FILES.length;
    var cdnReady = cdnDone === RUNTIME_FILES.length;
    return {
      ready: localReady || cdnReady,
      done: localReady ? localDone : cdnDone,
      total: RUNTIME_FILES.length,
      mode: localReady ? 'local' : (cdnReady ? 'cache' : 'missing')
    };
  });
}

function localRuntimeAvailable() {
  return fetch(new Request(LOCAL_ROOT + 'loader.js', { cache: 'no-store' })).then(function (response) {
    return !!(response && response.ok);
  }).catch(function () { return false; });
}

function fetchRuntime(url) {
  var request = new Request(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store'
  });
  return fetch(request).then(function (response) {
    if (!response || (!response.ok && response.type !== 'opaque')) {
      throw new Error('HTTP ' + (response ? response.status : 'failure') + ' for ' + url.split('/').pop());
    }
    return response;
  });
}

function installRuntime(client) {
  if (installJob) return installJob;

  installJob = localRuntimeAvailable().then(function (hasLocalRuntime) {
    var targets = hasLocalRuntime ? LOCAL_RUNTIME_FILES : RUNTIME_FILES;
    var cacheName = hasLocalRuntime ? SHELL_CACHE : RUNTIME_CACHE;
    var sourceLabel = hasLocalRuntime ? 'bundled' : 'pinned';

    return caches.open(cacheName).then(function (cache) {
      var done = 0;
      var total = targets.length;

      function report(message) {
        var payload = {
          type: 'CSD_OFFLINE_PROGRESS',
          done: done,
          total: total,
          message: message || ('Caching file ' + done + ' of ' + total + '.')
        };
        postToClient(client, payload);
        return broadcast(payload);
      }

      function cacheOne(index) {
        if (index >= total) return Promise.resolve();
        var url = targets[index];
        var shortName = hasLocalRuntime ? RUNTIME_PATHS[index] : url.substring(CDN_ROOT.length);
        return cache.match(url).then(function (cached) {
          if (cached) return null;
          if (hasLocalRuntime) {
            return fetch(new Request(url, { cache: 'no-store' })).then(function (response) {
              if (!response || !response.ok) throw new Error('Missing bundled file: ' + shortName);
              return cache.put(url, response.clone());
            });
          }
          return fetchRuntime(url).then(function (response) {
            return cache.put(url, response.clone());
          });
        }).then(function () {
          done += 1;
          return report('Cached ' + shortName + ' (' + done + '/' + total + ').');
        }).then(function () {
          /* Sequential downloads reduce peak memory on the iPhone 5s. */
          return cacheOne(index + 1);
        });
      }

      return report('Preparing the ' + sourceLabel + ' N64 engine…').then(function () {
        return cacheOne(0);
      }).then(function () {
        var payload = {
          type: 'CSD_OFFLINE_READY',
          ready: true,
          done: total,
          total: total,
          mode: hasLocalRuntime ? 'local' : 'cache',
          message: hasLocalRuntime ? 'Bundled offline N64 engine installed.' : 'Offline N64 engine installed.'
        };
        postToClient(client, payload);
        return broadcast(payload);
      });
    });
  }).catch(function (error) {
    var payload = {
      type: 'CSD_OFFLINE_ERROR',
      ready: false,
      message: String(error && error.message || error),
      total: RUNTIME_FILES.length
    };
    postToClient(client, payload);
    return broadcast(payload).then(function () { throw error; });
  }).then(function (value) {
    installJob = null;
    return value;
  }, function (error) {
    installJob = null;
    throw error;
  });

  return installJob;
}

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(SHELL_CACHE).then(function (cache) {
    return cache.addAll(SHELL_FILES);
  }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (key) {
      if (key !== SHELL_CACHE && key !== RUNTIME_CACHE) return caches.delete(key);
      return Promise.resolve(false);
    }));
  }).then(function () {
    return self.clients.claim();
  }));
});

self.addEventListener('message', function (event) {
  var data = event.data || {};
  if (data.type === 'CSD_OFFLINE_STATUS') {
    event.waitUntil(runtimeStatus().then(function (status) {
      status.type = 'CSD_OFFLINE_STATUS';
      status.installing = !!installJob;
      status.message = status.ready ? (status.mode === 'local' ? 'Bundled offline N64 engine installed.' : 'Offline N64 engine installed.') : 'Offline N64 engine needs one online installation.';
      postToClient(event.source, status);
    }).catch(function (error) {
      postToClient(event.source, { type: 'CSD_OFFLINE_ERROR', message: String(error && error.message || error) });
    }));
    return;
  }
  if (data.type === 'CSD_INSTALL_OFFLINE') {
    event.waitUntil(installRuntime(event.source));
  }
});

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && (response.ok || response.type === 'opaque')) {
          cache.put(request, response.clone()).catch(function () {});
        }
        return response;
      });
    });
  });
}

function networkFirst(request) {
  return caches.open(SHELL_CACHE).then(function (cache) {
    return fetch(request).then(function (response) {
      if (response && response.ok) cache.put(request, response.clone()).catch(function () {});
      return response;
    }).catch(function () {
      return cache.match(request).then(function (cached) {
        return cached || cache.match('./index.html');
      });
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try { url = new URL(request.url); } catch (e) { return; }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  if (url.hostname === 'cdn.emulatorjs.org' && url.pathname.indexOf('/4.2.3/data/') === 0) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
  }
});
