# Tailwind CSS v4 — `@theme` em vez de config JS

## Fonte única de verdade

`src/app/globals.css`. Não existe `tailwind.config.js` neste projeto.

```css
@theme {
  --color-brand-500: #B3261E;
  --color-brand-600: #8C1D18;
  --color-bg-primary: #0a0e1a;
  --color-bg-secondary: #111827;
  --color-bg-tertiary: #1a2234;
  --color-text-primary: #f8fafc;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --font-heading: var(--font-sora);
  --font-body: var(--font-manrope);
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-3xl: 24px;
}
```

Tokens definidos no `@theme` geram utilitários automaticamente (`bg-brand-500`, `text-text-primary`, `font-heading`).

## Utilitários custom

- `.glass-card` — card com blur + border sutil (usado em dialogs, KPIs).
- `.glow-red` — sombra brand para botões de destaque.
- `.bg-grid-pattern` — fundo de grid discreto.
- `.bg-app-gradient` — gradiente canônico da shell.

## Ordem de classes

`prettier-plugin-tailwindcss` já está instalado. Não ordenar à mão — o formatter reescreve.

## Fontes

- Heading: **Sora** (600/700) — via `--font-sora` (definido em `src/app/layout.tsx` com `next/font`).
- Body: **Manrope** (400/500/600) — via `--font-manrope`.

## Regra

- **Nunca hardcodar cores** (`bg-[#B3261E]`, `color: #0a0e1a`) em JSX/CSS. Sempre via token (`bg-brand-500`, `text-text-primary`). `design-token-auditor` reporta infrações.
