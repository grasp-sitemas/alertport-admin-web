# Invariants — o que nunca muda

> Se você quiser quebrar um item daqui, pare e pergunte ao usuário.

## Backend / HTTP

- Token no header `Authorization` é **literal** — sem prefix `Bearer`. (`src/lib/api-client.ts`)
- `skip` é **page number 1-indexed**. Não é offset. (`src/hooks/use-pagination.ts`)
- Endpoints de filtro são **POST com JSON body**. Não GET.
- `x-correlation-id` propagado quando disponível.
- 401 destrói sessão e redireciona. Não retry em 401.
- Retry 5xx/408/429 é feito **pelo interceptor** — não configurar retry em `useQuery`.
- 2 falhas 5xx/rede consecutivas → evento `service:unavailable`. Não retry-bomb.

## Sessão

- Vive em `sessionStorage['alertport_session']`. Morre com a aba.
- Nunca em cookie, nunca em `localStorage`.

## Next.js

- Rotas em `src/app/(app)/` são sempre `force-dynamic`.
- App Router only. Sem Pages Router.

## Forms

- `useAppForm` obrigatório. ESLint bloqueia `useForm` cru.
- Resolver: `zodResolver` — nunca outro.

## i18n

- 5 locales: pt (canônica) + en + es + ja + zh.
- Chave nova = editar os 5 arquivos.
- next-intl **sem routing** — sem `/pt/...`.

## Design

- Tokens em `@theme` em `src/app/globals.css`. Sem `tailwind.config.js`.
- Fontes: Sora (heading) + Manrope (body) via `next/font`.
- Ícones: Lucide React exclusivamente.

## Firestore realtime

- Documentos são deletados após processamento.
- Filtrar `source === 'ALERTPORT'` em `notifications/`.
