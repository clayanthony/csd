#!/bin/bash
cd "$(dirname "$0")"
echo "CSD 64 is running at http://localhost:8080"
echo "Press Control-C to stop the server."
python3 -m http.server 8080
