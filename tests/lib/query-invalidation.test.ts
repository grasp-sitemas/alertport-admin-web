import { describe, expect, it } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { invalidateHierarchyAfter } from '@/lib/query-invalidation';

describe('account mutation refresh', () => {
  it.each([
    { surface: 'companies list', key: ['companies', 'accounts', { status: 'ACTIVE' }] },
    { surface: 'company settings', key: ['me'] },
  ])('refetches the active $surface so an edited company is reopened with saved fields', async ({ key }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    let persistedName = 'Original company';
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: async () => [{ _id: 'account-1', name: persistedName }],
    });
    const unsubscribe = observer.subscribe(() => {});
    await observer.refetch();
    persistedName = 'Saved company';
    invalidateHierarchyAfter(client, 'account');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(client.getQueryData(key)).toEqual([{ _id: 'account-1', name: 'Saved company' }]);
    unsubscribe();
    client.clear();
  });
});
