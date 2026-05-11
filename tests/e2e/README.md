# E2E Suite — alertport-admin-web

Playwright-based end-to-end tests. The suite targets the HML deployment
by default and is structured around the Page Object Model (POM).

## How to run

```bash
# 1. HML (recommended — what CI does)
PLAYWRIGHT_BASE_URL=https://admin-alertport-hml.vercel.app npx playwright test

# 2. Local dev server (auto-spawned by playwright.config.ts when
#    PLAYWRIGHT_BASE_URL is unset)
npm run test:e2e

# 3. Single spec, headed, with browser visible (debug)
npx playwright test tests/e2e/auth/login.spec.ts --headed

# 4. CI — set PLAYWRIGHT_BASE_URL and credentials as repo secrets;
#    config switches to retries=2, workers=1, and forbids `test.only`.
CI=true PLAYWRIGHT_BASE_URL=... npx playwright test
```

After a run, open the HTML report:

```bash
npx playwright show-report
```

## Environment variables

All read by `tests/e2e/fixtures/credentials.ts`. Resolution order:
`process.env` → `.env.test` → `.env.local`.

| Variable                          | Required | Purpose                              |
| --------------------------------- | -------- | ------------------------------------ |
| `PLAYWRIGHT_BASE_URL`             | yes      | Target environment (defaults to HML) |
| `PLAYWRIGHT_SUPER_ADMIN_EMAIL`    | yes      | SUPER_ADMIN_MASTER login             |
| `PLAYWRIGHT_SUPER_ADMIN_PASSWORD` | yes      | SUPER_ADMIN_MASTER password          |
| `PLAYWRIGHT_ADMIN_EMAIL`          | yes      | ADMIN login                          |
| `PLAYWRIGHT_ADMIN_PASSWORD`       | yes      | ADMIN password                       |
| `PLAYWRIGHT_SUPERVISOR_EMAIL`     | no       | SUPERVISOR login (TODO backend)      |
| `PLAYWRIGHT_SUPERVISOR_PASSWORD`  | no       | SUPERVISOR password (none in HML)    |
| `PLAYWRIGHT_TEST_EMAIL`           | legacy   | Falls back to SUPER_ADMIN_MASTER     |
| `PLAYWRIGHT_TEST_PASSWORD`        | legacy   | Falls back to SUPER_ADMIN_MASTER     |

Specs that need a role with no configured credentials `test.skip` with a
clear message — they don't fail.

## Folder structure

```
tests/e2e/
├── README.md                  ← this file
├── fixtures/
│   ├── credentials.ts         ← env + .env.test loader, role → creds
│   ├── auth.fixture.ts        ← Playwright extend(): adminPage, etc.
│   ├── data-seed.fixture.ts   ← seedPrefix stub (TODO seed endpoint)
│   └── session.ts             ← legacy hermetic-mock seeder (CRUD specs)
├── pages/                     ← POMs (one file per surface)
│   ├── login.page.ts
│   ├── dashboard.page.ts
│   └── sidebar.page.ts
├── helpers/
│   ├── selectors.ts           ← centralized locator strings/regex
│   ├── toasts.ts              ← Sonner success / error / either
│   ├── api-watcher.ts         ← request/response logging for debug
│   └── time.ts                ← pt-BR date/time formatters
├── auth/
│   └── login.spec.ts          ← all auth flows
├── audit-smoke.spec.ts        ← (legacy)
├── crud-forms.spec.ts         ← (legacy, hermetic mocks)
├── login.spec.ts              ← (legacy form-render smoke)
├── scheduling.spec.ts         ← schedule CRUD against HML
└── scheduling-and-company.spec.ts ← (legacy)
```

## Conventions

### POM (Page Object Model)

- One class per logical surface. Files in `pages/`.
- Constructor takes `Page` and builds locators eagerly.
- Public methods return `Promise<void>` and assert/click; getters return
  `Locator` for ad-hoc assertions.
- POMs never reach for sibling POMs — specs compose them.

### Fixtures

- Auto-fixtures live in `fixtures/*.fixture.ts` and export a `test`
  that extends `@playwright/test`.
- Credential resolution is centralized — never read `process.env`
  directly in a spec.

### Selectors

Preference order:

1. `data-testid` — most stable.
2. ARIA role + accessible name — semantic, survives styling.
3. Locale-aware text regex — last resort; brittle on i18n drift.

If a spec can only target a brittle selector, **add a `data-testid` to
the source component first** (one-line change, zero ambiguity guarantee).

### Naming

- Specs: `<feature>.spec.ts` in either the root or a feature folder.
- POMs: `<surface>.page.ts`.
- Helpers: kebab-case, single-purpose.

## Spec map

| Spec                              | Path                                                  | Roles                | Backend deps                          | State            |
| --------------------------------- | ----------------------------------------------------- | -------------------- | ------------------------------------- | ---------------- |
| Login flows                       | `tests/e2e/auth/login.spec.ts`                        | SAM, ADMIN           | hp-shield-auth                        | New (this PR)    |
| Login form render                 | `tests/e2e/login.spec.ts`                             | (none — UI only)     | none                                  | Legacy           |
| Schedule CRUD via preview dialog  | `tests/e2e/scheduling.spec.ts`                        | SAM                  | ms-schedule (flaky in HML)            | Stable           |
| Scheduling + Company smoke        | `tests/e2e/scheduling-and-company.spec.ts`            | SAM                  | ms-schedule, hp-shield-crud           | Legacy           |
| CRUD forms (hermetic)             | `tests/e2e/crud-forms.spec.ts`                        | mocked ADMIN         | none (mocked)                         | Stable           |
| Audit smoke                       | `tests/e2e/audit-smoke.spec.ts`                       | mocked               | none (mocked)                         | Stable           |

`SAM` = SUPER_ADMIN_MASTER.

## Known backend bugs (HML)

These produce false failures in CRUD specs. The suite tolerates them by
accepting either a success **or** an error toast via
`helpers/toasts.ts → expectToastEither`.

| Endpoint                  | Symptom                                  | Workaround in suite                 |
| ------------------------- | ---------------------------------------- | ----------------------------------- |
| `PUT /schedules/series`   | 500 "database connection error"          | accept toast-either                 |
| `DELETE /schedules/:id`   | request hangs ≥30s (axios timeout)       | poll dialog-closed OR toast-either  |
| `DELETE /schedules/series`| same hang                                | same                                |

When fixing these, drop the `expectToastEither` tolerance and assert
the success toast strictly.

## Troubleshooting

- **`Timed out waiting for /dashboard` after login** — HML cold start.
  `LoginPage.signIn()` already waits 60s; bump higher with the option
  if you see this on a freshly redeployed branch.
- **`No schedule events visible` skip** — HML schedule data was deleted
  by another operator. Re-seed from the admin UI or wait.
- **`data-sonner-toast` never visible** — global Sonner toaster failed
  to mount. Check `src/app/providers.tsx` and the browser console.
- **Cached old build** — `vercel --prod` is manual for the HML alias
  (see `feedback_alertport_adminweb_hml_deploy.md`). Trigger a deploy
  before re-running.
- **401 redirect loop** — interceptor in `src/lib/api-client.ts` kills
  the session on any 401. Check the test isn't probing an authed
  endpoint without first logging in.

## Roadmap

- [ ] Backfill data-testids for schedule preview dialog buttons (drop
      regex fallback in `scheduling.spec.ts`).
- [ ] Convert `scheduling.spec.ts` to POM (`pages/scheduling.page.ts`).
- [ ] Replace simulated logout (sessionStorage clear) with real UI
      click once header POM ships.
- [ ] Spec for SUPERVISOR role once backend provisions a password.
- [ ] Seed endpoint integration in `data-seed.fixture.ts` (kill
      depletion flakiness).
