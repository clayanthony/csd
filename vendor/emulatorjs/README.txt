OPTIONAL SELF-HOSTED EMULATORJS RUNTIME

Copy the complete official EmulatorJS data folder here so this path exists:

vendor/emulatorjs/data/loader.js

Keep every matching JS, WASM, core, language and asset file in the data folder.
The app automatically falls back to the official EmulatorJS CDN when the local runtime is absent.
