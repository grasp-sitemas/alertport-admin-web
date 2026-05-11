/**
 * Centralized, semantic locator strings for the e2e suite.
 *
 * Preference order (best → worst):
 *   1. data-testid (stable across refactors)
 *   2. ARIA role + accessible name (semantic, survives styling)
 *   3. Locale-aware text regexp (last resort, brittle on i18n changes)
 *
 * Keep this module free of Playwright imports so it can be consumed
 * from both POMs and ad-hoc helpers without circular deps.
 */

/** Login-page selectors. */
export const LOGIN_SELECTORS = {
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  /** Accessible button name matching all 5 locales. */
  submitButton: /entrar|sign in|ingresar|ログイン|登录/i,
  errorText: /obrigatório|required|obligatorio|必須|必填/i,
  invalidCredentialsText:
    /credenciais? inv[aá]lidas?|invalid credentials|cred(?:enciales)? inv[aá]lid|無効|无效/i,
} as const;

/** Sidebar / navigation selectors. */
export const SIDEBAR_SELECTORS = {
  /**
   * Sidebar nav-item hrefs. We match by href because the link text is
   * localized but the route is stable.
   */
  hrefs: {
    dashboard: '/dashboard',
    scheduling: '/alerts/scheduling',
    users: '/users',
    companies: '/companies',
    clients: '/clients',
    sites: '/sites',
    equipment: '/equipment',
    company: '/company',
  },
  /** Logout trigger lives in the user menu — match by accessible name. */
  logoutButton: /sair|log ?out|cerrar sesi[oó]n|ログアウト|退出/i,
} as const;

/** Toast (Sonner) selectors — Sonner renders into [data-sonner-toaster]. */
export const TOAST_SELECTORS = {
  toaster: '[data-sonner-toaster]',
  toast: '[data-sonner-toast]',
  toastSuccess: '[data-sonner-toast][data-type="success"]',
  toastError: '[data-sonner-toast][data-type="error"]',
} as const;

/** Dialog / form selectors that recur across CRUD features. */
export const DIALOG_SELECTORS = {
  any: '[role="dialog"]',
  closeButton: /fechar|close|cerrar|閉じる|关闭/i,
  saveButton: /salvar|save|guardar|保存/i,
  updateButton: /atualizar|update|actualizar|更新/i,
  cancelButton: /cancelar|cancel|キャンセル|取消/i,
  confirmDeleteButton: /sim, excluir|yes, delete|confirmar|confirm|确认/i,
} as const;

/** Routes the suite hits directly. */
export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  scheduling: '/alerts/scheduling',
  users: '/users',
  companies: '/companies',
} as const;
