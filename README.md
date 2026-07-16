# CSD 64 — iPhone 5s Offline Portrait Edition

A portrait Nintendo 64 web-emulator shell built around the iPhone 5s / iOS 12 viewport.

## What changed in this offline edition

- The app shell is cached immediately by `sw.js`.
- The first hosted launch automatically installs a pinned EmulatorJS 4.2.3 engine.
- Only the iPhone-5s runtime is warmed: the non-threaded legacy `mupen64plus_next` core, minified frontend, English localization, and ZIP extractor.
- Runtime downloads are sequential to reduce peak memory usage on the iPhone 5s.
- The menu reports installation progress and changes to **OFFLINE READY** only after every required engine file exists in Cache Storage.
- Once ready, all pinned runtime requests are cache-first and can start in airplane mode.
- The emulator no longer falls forward to changing `stable` or `latest` CDN versions.
- A Mac helper can optionally put the runtime files physically inside the project before deployment.

No ROMs or commercial game assets are included.

## Normal installation — same pattern as the offline Bible

1. Upload the complete folder to an HTTPS host.
2. Open its HTTPS address in Safari on the iPhone 5s.
3. Keep the page open while the one-time engine installation completes.
4. Open the center menu and confirm **Offline engine: READY**.
5. Use Safari's Share button → **Add to Home Screen**.
6. Launch CSD 64 from the Home Screen.
7. Import a `.z64`, `.n64`, or `.v64` ROM dump you are permitted to use.

After step 4, the interface and N64 engine can load without internet. Turn on **Keep ROM offline** before importing a game to store one ROM in IndexedDB as well. Otherwise, the engine remains offline-ready but the ROM must be selected again from the Files app.

## Physically self-contained deployment

For a deployment whose first installation does not contact the EmulatorJS CDN:

1. Unzip this build on a Mac with internet access.
2. Double-click `MAKE-SELF-CONTAINED.command`.
3. Wait for the script to download the ten pinned runtime files.
4. Upload the entire folder again, including `vendor/emulatorjs/data/`.
5. Open the hosted app once and wait for **OFFLINE READY**.

The app detects the bundled runtime and caches those local files instead of downloading the runtime from the CDN.

## Local Mac test

Do not open `index.html` through `file://`. WebAssembly, service workers, and offline storage require HTTP or HTTPS.

Double-click `START-MAC.command`, then open:

`http://localhost:8080`

A local Mac test verifies layout and controls. For an iPhone, deploy to HTTPS; ordinary LAN HTTP addresses do not provide the secure context required for a service worker.

## iPhone 5s optimizations

- Fixed 320 × 568 design canvas.
- 320 × 240 4:3 game display.
- Non-threaded legacy core profile.
- WebGL 1-compatible path.
- Shaders, built-in virtual controls, rewind, recording, and unnecessary emulator chrome disabled.
- Sequential offline downloads and a 100 MB ROM ceiling.
- Direct libretro input delivery with keyboard fallback.
- Multi-touch cleanup on cancellation, blur, menu opening, and app switching.
- Manual first-tap audio unlock inside the game frame for iOS.

Keep iOS Low Power Mode disabled while playing, close unused Safari tabs, and prefer an uncompressed ROM. N64 performance remains game-dependent on 2013 hardware.

## Controls

- Analog stick: N64 analog stick
- D-pad: N64 D-pad
- Blue A / green B: N64 A and B
- Purple Z: N64 Z trigger
- Yellow diamond: four C-buttons
- L / R: shoulder buttons
- Red center: Start
- Center menu: pause and CSD settings

## Storage limitation

Offline data is kept in Safari/PWA Cache Storage and IndexedDB. iOS can remove website data under storage pressure or after the app has not been used for a long time. If the menu stops reporting **OFFLINE READY**, reconnect once and reinstall the engine.

## Rights and licenses

EmulatorJS is licensed separately under GPL-3.0; its license is included at `vendor/emulatorjs/LICENSE`. CSD 64 includes no ROMs, BIOS files, copyrighted game artwork, or Delta branding. Use only content you are legally permitted to use.
