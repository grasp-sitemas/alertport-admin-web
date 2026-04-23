#!/usr/bin/env bash
# PostToolUse(Write|Edit) — formata arquivo recém-alterado com prettier
set -u

# O harness passa info sobre a tool call via stdin (JSON).
# Extrai o file_path se presente; senão, sai silencioso.
INPUT=$(cat)
FILE=$(echo "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' | head -1)

[ -z "$FILE" ] && exit 0
[ ! -f "$FILE" ] && exit 0

# Só formata tipos suportados pelo prettier do projeto
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md|*.mjs|*.cjs)
    # Só dentro do repo
    ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
    case "$FILE" in
      "$ROOT"/*|./*)
        npx --no-install prettier --write --loglevel warn "$FILE" 2>/dev/null || true
        ;;
    esac
    ;;
esac

exit 0
