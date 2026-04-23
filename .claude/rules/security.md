# Security — secrets, PII, Sentry

## Secrets

- **Nunca commitar secrets reais** em `.env*`. Usar secret manager do host (Vercel/AWS) para injetar TURN passwords, chaves Firebase privadas etc.
- `.env.example` / `.env.hml` / `.env.production` são templates — contêm placeholders, não valores reais.
- `.env.local` é gitignored e por-dev.

## `NEXT_PUBLIC_*`

- **Público por design** — vai pro bundle client-side. Não colocar nada sensível.
- `NEXT_PUBLIC_MASTER_ADMIN_EMAILS` é whitelist — público ok (só valida entrada no login).

## PII / LGPD

- Endpoints `lgpdExport` e `lgpdDelete` manipulam dados sensíveis. **Não logar payload.**
- Sentry scrubbing configurado em `sentry.*.config.ts` — não desabilitar.
- Ao adicionar logs, evitar email/CPF/telefone em mensagens.

## Auth

- Token vive em `sessionStorage` — nunca cookie (sem HttpOnly disponível), nunca localStorage (persiste além da sessão).
- 401 → destrói sessão + redirect. Ver `api-contracts.md`.

## Uploads

- Validar tipo e tamanho no client antes de POST.
- FormData headers geridos por Axios — não setar manualmente.

## Dependências

- Não adicionar lib sem checar licença e peer deps.
- Nunca `npx <lib> | bash`. Rodar install explícito.
