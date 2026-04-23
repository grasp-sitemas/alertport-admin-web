# Testing — Vitest + Playwright

## Escopo

| Camada | Ferramenta | Local |
|---|---|---|
| Utilities puras | **Vitest** | `src/**/*.test.ts` colocados |
| Zod schemas | **Vitest** | `src/features/<x>/schemas.test.ts` |
| Roles / permissions | **Vitest** | `src/config/roles.test.ts` |
| Contract tests (parity com fixtures) | **Vitest** | `tests/contracts/*.test.ts` |
| E2E críticos | **Playwright** | `tests/e2e/*.spec.ts` |

## Quando adicionar teste

- **Sempre** para nova regra de validação Zod.
- **Sempre** para helper/utility pura.
- **Sempre** para lógica de autorização/permissão.
- **Playwright** para jornada nova ou crítica (login, criar entidade principal, fluxo de atendimento).

## Fixtures

- `tests/fixtures/` contém snapshots de respostas legadas (shieldgo) — fonte de verdade para contract tests.
- Atualizar via `npm run test:fixtures:snapshot` (revise o diff antes de commitar).

## Playwright

- Config em `playwright.config.ts`.
- Roda contra dev server (`npm run dev` em paralelo).
- Use `data-testid` em elementos instáveis de CSS.

## Scripts

- `npm test` — unit + integration
- `npm run test:watch`
- `npm run test:e2e`
- `npm run validate` — roda tudo + build

## Padrões

- `describe` por função/hook/componente, `it` por caso.
- Arrange/Act/Assert explicito.
- Mock mínimo: apenas HTTP via `msw` ou axios adapter.
