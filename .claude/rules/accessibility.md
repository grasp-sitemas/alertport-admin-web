# Accessibility — A11y checklist

## Base

Radix UI cobre ARIA e keyboard navigation por padrão nos primitivos (Dialog, Select, Dropdown, Tabs). **Não remover** `aria-*` gerados pelo Radix.

## Requisitos manuais

- **Contraste** — texto sobre `--color-bg-primary (#0a0e1a)` deve atingir AA. `--color-text-muted` é limite; conferir antes de usar em texto essencial.
- **Focus ring** — usar tokens de focus da shell (`ring-brand-500/40`). Nunca `outline: none` sem substituto visível.
- **`aria-label`** em botões icon-only (sem texto visível).
- **`aria-live`** em regiões que mudam dinamicamente (toasts, contadores).
- **Labels de formulário** — `<label htmlFor>` obrigatório, não placeholder como label.

## Dialogs

- Foco volta para o trigger ao fechar.
- `Esc` fecha (Radix cuida).
- Primeiro campo recebe foco ao abrir.

## Tabelas

- `<th scope="col">` em headers.
- Ordenação: `aria-sort` no header ativo.

## LocaleSwitcher

Caso crítico — manter `aria-label` descritivo (`"Alterar idioma"`), e `lang` atualizado no `<html>` ao trocar.

## Verificação

Agente `accessibility-reviewer` roda em PRs que tocam `components/ui/` ou qualquer dialog/table. Playwright tem testes com axe-core (quando aplicável).
