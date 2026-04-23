# TypeScript — strict, sem `any`

## Config

- `strict: true` em `tsconfig.json`.
- Alias: `@/*` → `./src/*`.
- `noEmit` (Next.js faz o build).

## Regras

- **Zero `any`** em código novo. Se inevitável, anotar `// eslint-disable-next-line` com motivo.
- **Zero `@ts-ignore`**. Usar `@ts-expect-error` só com comentário de motivo.
- Preferir `type` a `interface` (exceto quando precisar de `extends`).
- Types de API: derivar via `z.infer<typeof schema>` em vez de duplicar.
- Discriminated unions para estados (`type State = { kind: 'idle' } | { kind: 'loading' } | ...`).

## Boas práticas

- **Nunca tipar o retorno de hooks TanStack Query** — a inferência é boa o suficiente e quebra quando a API muda.
- Evite `as` — prefira `satisfies` ou narrowing.
- Para unused vars em discriminated unions: `_var`.
- Generics nomeados: `TUser`, não `T`, quando houver mais de um.

## Verificação

`npm run typecheck` é parte de `npm run validate`. Nenhum TS error entra em `main`.
