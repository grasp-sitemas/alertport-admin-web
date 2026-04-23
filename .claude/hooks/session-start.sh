#!/usr/bin/env bash
# SessionStart hook — bootstrapa ambiente e dá orientação inicial
set -u

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

echo "────────────────────────────────────────────────────────────"
echo " AlertPort Admin Web · sessão iniciada"
echo "────────────────────────────────────────────────────────────"

# 1. Node version
if command -v nvm >/dev/null 2>&1 && [ -f .nvmrc ]; then
  # shellcheck disable=SC1090
  nvm use >/dev/null 2>&1 || true
fi
NODE_V=$(node -v 2>/dev/null || echo "<sem node>")
echo " node: $NODE_V (esperado ≥ v22)"

# 2. Deps
if [ ! -d node_modules ]; then
  echo " ⚠ node_modules ausente — rode 'npm ci'"
elif [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo " ⚠ package-lock.json mais novo que node_modules — considere 'npm ci'"
fi

# 3. .env.local
if [ ! -f .env.local ] && [ -f .env.example ]; then
  cp .env.example .env.local 2>/dev/null && \
    echo " ✓ .env.local criado a partir de .env.example (preencha placeholders)"
fi

# 4. Git state
BRANCH=$(git branch --show-current 2>/dev/null || echo "<sem branch>")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
echo " branch: $BRANCH · arquivos não commitados: $DIRTY"

# 5. Pre-warm typecheck em background
if [ -f tsconfig.json ] && command -v npx >/dev/null 2>&1; then
  (npx tsc --noEmit --pretty false > .claude/agent-memory/last-typecheck.txt 2>&1 &) >/dev/null 2>&1
fi

# 6. Surfaces últimas learnings
if [ -f .claude/agent-memory/learned.md ]; then
  echo ""
  echo " últimas lições (agent-memory/learned.md):"
  tail -n 10 .claude/agent-memory/learned.md | sed 's/^/  /'
fi

echo "────────────────────────────────────────────────────────────"

exit 0
