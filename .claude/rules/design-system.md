# Design System — 3 camadas + tokens do brand

## Camadas

1. **UI primitives** (`src/components/ui/`) — Button, Input, Dialog, Table, Select, Dropdown. Construídos em cima de Radix. Variantes via `class-variance-authority`.
2. **Shared** (`src/components/shared/`) — componentes cross-feature: DataTable, FilterPanel, PageHeader, ConfirmDialog, StatusBadge, RoleGuard.
3. **Feature** (`src/features/<nome>/`) — dialogs e componentes específicos do domínio.

## Regra de escopo

- Precisa em 2+ features → vai para `shared/`.
- Precisa em 2+ shared components → vai para `ui/`.
- Sem especulação: só sobe quando o segundo uso aparecer.

## Tokens

Definidos em `src/app/globals.css` com `@theme`. Ver `.claude/rules/tailwind-v4.md`.

## Tipografia

- **Sora** — headings (`font-heading`), pesos 600/700.
- **Manrope** — body (`font-body`), pesos 400/500/600.
- Nunca importar fontes direto no CSS — usar `next/font` em `src/app/layout.tsx`.

## Ícones

- **Lucide React** é o único pack. Importar por nome: `import { AlertCircle } from 'lucide-react'`.
- Não misturar com Heroicons, FontAwesome, etc.

## Variantes

- `class-variance-authority` (`cva`) para todas as variantes de componente.
- Type-safe: CVA gera o tipo das props automaticamente.

## Acessibilidade

Radix cobre ARIA/keyboard por padrão. Ver `.claude/rules/accessibility.md` para casos que exigem atenção manual.
