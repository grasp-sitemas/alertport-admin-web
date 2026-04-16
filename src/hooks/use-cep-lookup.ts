'use client';

import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { UseFormSetValue, FieldValues, Path, PathValue } from 'react-hook-form';
import { helpersService, type ViaCepResponse } from '@/services/helpers.service';

/**
 * Shared ViaCEP lookup hook. Mirrors the legacy `loadInfosByCEP` helper:
 * - fires on 9-char CEP (############ or xxxxx-xxx)
 * - auto-fills the form's address.{address,neighborhood,city,state,ibge,gia}
 * - shows a toast if the CEP is invalid
 *
 * Works with any React Hook Form where the address lives under a prefix
 * (e.g. `address.cep`, `address.address`, …). Pass the `setValue` function
 * and, optionally, a custom prefix.
 */
export function useCepLookup<T extends FieldValues>(
  setValue: UseFormSetValue<T>,
  prefix: string = 'address',
) {
  const t = useTranslations();

  const mutation = useMutation({
    mutationFn: (cep: string) => helpersService.lookupCep(cep),
    onSuccess: (data: ViaCepResponse) => {
      if (data.erro) {
        toast.error(t('sites.cepInvalid'));
        return;
      }
      const set = (field: string, value: string | undefined) => {
        if (value === undefined) return;
        setValue(`${prefix}.${field}` as Path<T>, value as PathValue<T, Path<T>>, {
          shouldDirty: true,
          shouldValidate: false,
        });
      };
      set('address', data.logradouro);
      set('neighborhood', data.bairro);
      set('city', data.localidade);
      set('state', data.uf);
      set('ibge', data.ibge);
      set('gia', data.gia);
    },
    onError: () => toast.error(t('sites.cepInvalid')),
  });

  /**
   * Trigger lookup when the CEP value reaches 8 digits (the legacy trigger
   * condition). Safe to call in an `onChange` / `onBlur`.
   */
  const lookupIfComplete = useCallback(
    (cep: string | undefined | null) => {
      if (!cep) return;
      const digits = cep.replace(/\D/g, '');
      if (digits.length === 8) {
        mutation.mutate(digits);
      }
    },
    [mutation],
  );

  return {
    lookup: mutation.mutate,
    lookupIfComplete,
    isLoading: mutation.isPending,
  };
}
