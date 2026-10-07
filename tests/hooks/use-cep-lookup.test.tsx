import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { toast } from 'sonner';
import type { ReactNode } from 'react';
import { useCepLookup } from '@/hooks/use-cep-lookup';
import { helpersService } from '@/services/helpers.service';
import pt from '@/messages/pt.json';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <NextIntlClientProvider locale="pt" messages={pt}>{children}</NextIntlClientProvider>
  </QueryClientProvider>;
}

describe('CEP lookup feedback', () => {
  it('distinguishes an unavailable service from an invalid postal code', async () => {
    vi.spyOn(helpersService, 'lookupCep').mockRejectedValue(new Error('Network Error'));
    const feedback = vi.spyOn(toast, 'error');
    const setValue = vi.fn();
    const { result } = renderHook(() => useCepLookup(setValue), { wrapper });
    act(() => result.current.lookupIfComplete('01001-000'));
    await waitFor(() => expect(feedback).toHaveBeenCalledWith('Não foi possível consultar o CEP. Tente novamente ou preencha o endereço manualmente.'));
    expect(setValue).not.toHaveBeenCalled();
  });

  it('marks a postal code invalid only when the service rejects that code', async () => {
    vi.spyOn(helpersService, 'lookupCep').mockResolvedValue({ erro: true });
    const feedback = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useCepLookup(vi.fn()), { wrapper });
    act(() => result.current.lookupIfComplete('00000-000'));
    await waitFor(() => expect(feedback).toHaveBeenCalledWith('CEP inválido'));
  });
});
