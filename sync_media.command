#!/bin/zsh

cd "$(dirname "$0")"
python3 scripts/generate_manifest.py
echo ""
echo "NETFLIXX media library refreshed."
echo "You can close this window now."
read "?Press enter to close..."
