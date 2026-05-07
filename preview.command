#!/bin/zsh

cd "$(dirname "$0")"
python3 scripts/generate_manifest.py
if lsof -i tcp:8000 >/dev/null 2>&1; then
  open "http://localhost:8000"
  exit 0
fi

python3 -m http.server 8000 >/tmp/netflixx-preview.log 2>&1 &
SERVER_PID=$!
sleep 1
open "http://localhost:8000"
wait "$SERVER_PID"
