#!/usr/bin/env bash
# Stop hook — lembra de rodar /pr-ready se houver mudanças staged
set -u

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
UNSTAGED=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')

if [ "$STAGED" -gt 0 ] || [ "$UNSTAGED" -gt 0 ]; then
  echo "ℹ Há $STAGED arquivos staged e $UNSTAGED unstaged."
  echo "  Considere rodar: /pr-ready (valida + paridade i18n + imports banidos)"
fi

exit 0
