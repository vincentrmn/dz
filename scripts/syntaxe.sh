#!/usr/bin/env bash
# Contrôle de syntaxe de tous les fichiers JavaScript du cockpit (pas de
# TypeScript ici : `node --check` tient lieu de typecheck). Sort 0 si tout parse.
set -euo pipefail
cd "$(dirname "$0")/.."
statut=0
for f in server.js auth.js public/*.js n8n/*.mjs eslint.config.mjs tests/*.js; do
  [ -f "$f" ] || continue
  if ! node --check "$f" 2>/tmp/syntaxe.err; then
    echo "Syntaxe : $f" >&2; cat /tmp/syntaxe.err >&2; statut=1
  fi
done
exit $statut
