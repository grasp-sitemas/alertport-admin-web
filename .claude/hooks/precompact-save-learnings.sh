#!/usr/bin/env bash
# PreCompact hook — avisa para rodar /context-reset antes da compactação
set -u

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 0

MEMO=".claude/agent-memory/learned.md"
mkdir -p "$(dirname "$MEMO")"

if [ ! -f "$MEMO" ]; then
  cat > "$MEMO" <<'EOF'
# Learned — log incremental de lições de sessão

Formato: cada sessão acrescenta um bloco com data.

EOF
fi

echo "ℹ Contexto será compactado."
echo "  Para preservar lições: rode '/context-reset' antes."
echo "  Arquivo alvo: $MEMO"

exit 0
