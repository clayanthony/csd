#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
BASE="https://cdn.emulatorjs.org/4.2.3/data"
DEST="vendor/emulatorjs/data"

mkdir -p "$DEST/cores" "$DEST/compression" "$DEST/localization"

fetch() {
  local path="$1"
  echo "Downloading $path"
  curl --fail --location --retry 3 --connect-timeout 20 \
    "$BASE/$path" --output "$DEST/$path"
}

fetch "loader.js"
fetch "emulator.min.js"
fetch "emulator.min.css"
fetch "localization/en-US.json"
fetch "localization/retroarch.json"
fetch "cores/cores.json"
fetch "cores/mupen64plus_next-legacy-wasm.data"
fetch "cores/mupen64plus_next-wasm.data"
fetch "compression/extract7z.js"
fetch "compression/extractzip.js"

curl --fail --location --retry 3 --connect-timeout 20 \
  "https://cdn.emulatorjs.org/4.2.3/LICENSE" \
  --output "vendor/emulatorjs/LICENSE"

printf '\nCSD 64 is now physically self-contained.\n'
printf 'Upload the entire folder again, open it once on the iPhone, and wait for OFFLINE READY.\n'
printf 'Press Return to close.\n'
read -r _
