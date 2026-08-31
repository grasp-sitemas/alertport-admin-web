import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/config/endpoints';

/**
 * Per-account module (plan) management.
 *
 * Modules are server-authored feature toggles stored in the dedicated
 * `account-modules` collection. Only SUPER_ADMIN_MASTER can read or
 * write. The backend enforces the role check; the frontend still
 * gates the page with a RoleGuard for a clean 403 experience.
 */

export type AccountModuleCategory =
  | 'operations'
  | 'calls'
  | 'reports'
  | 'management'
  | 'admin';

export interface AccountModuleDefinition {
  key: string;
  category: AccountModuleCategory;
  defaultEnabled: boolean;
}

export interface AccountModulesState {
  accountId: string;
  modules: Record<string, boolean>;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface CatalogEnvelope {
  status: number;
  result?: { catalog: AccountModuleDefinition[] };
}

interface StateEnvelope {
  status: number;
  result?: AccountModulesState;
}

export const accountModulesService = {
  /**
   * Fetch the canonical list of modules. Cached by the caller (TanStack
   * query) since the catalog is a constant for the lifetime of the
   * session.
   */
  async getCatalog(): Promise<AccountModuleDefinition[]> {
    const { data } = await apiClient.get<CatalogEnvelope>(endpoints.accountModulesCatalog);
    return data?.result?.catalog ?? [];
  },

  /**
   * Fetch the per-account module map. Missing catalog keys are filled
   * with defaults on the server, so the returned `modules` always has
   * a boolean for every catalog key.
   */
  async getByAccount(accountId: string): Promise<AccountModulesState> {
    const { data } = await apiClient.get<StateEnvelope>(
      endpoints.accountModulesByAccount(accountId),
      { retry: false },
    );
    if (!data?.result) {
      return { accountId, modules: {}, updatedAt: null, updatedBy: null };
    }
    return data.result;
  },

  /**
   * Upsert the per-account module map. Keys not in `modules` are left
   * untouched by the server (partial PATCH semantics via $set with
   * dotted paths). Passing the full map is the expected shape from
   * the UI and avoids surprises.
   */
  async saveByAccount(
    accountId: string,
    modules: Record<string, boolean>,
  ): Promise<AccountModulesState> {
    const { data } = await apiClient.put<StateEnvelope>(
      endpoints.accountModulesByAccount(accountId),
      { modules },
    );
    if (!data?.result) {
      return { accountId, modules, updatedAt: null, updatedBy: null };
    }
    return data.result;
  },
};
