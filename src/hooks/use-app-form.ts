'use client';

import { useMemo } from 'react';
import {
  useForm as rhfUseForm,
  type FieldValues,
  type SubmitErrorHandler,
  type SubmitHandler,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { toastFirstError } from '@/lib/form-errors';

/**
 * Project-wide replacement for `react-hook-form`'s `useForm`.
 *
 * Why it exists: a plain `handleSubmit(onValid)` call silently drops the
 * submit whenever zod validation fails — the user clicks Save, the mutation
 * never fires, and nothing tells them why. That bug bit us on /company and
 * /equipment (enum mismatch, null personType), and would keep biting with
 * new schemas.
 *
 * `useAppForm` fixes this at the source: the returned `handleSubmit`
 * **always** injects a `toastFirstError` invalid-handler when the caller
 * didn't pass one. Forms can still override by passing their own `onInvalid`.
 *
 * An ESLint rule bans the raw `useForm` import from `react-hook-form`, so
 * every form in the app flows through this wrapper.
 */
export function useAppForm<
  TFieldValues extends FieldValues = FieldValues,
  TContext = unknown,
>(
  props?: UseFormProps<TFieldValues, TContext>,
): UseFormReturn<TFieldValues, TContext> {
  const form = rhfUseForm<TFieldValues, TContext>(props);
  const t = useTranslations();

  const originalHandleSubmit = form.handleSubmit;

  const wrappedHandleSubmit = useMemo(() => {
    const fn: UseFormReturn<TFieldValues, TContext>['handleSubmit'] = (
      onValid: SubmitHandler<TFieldValues>,
      onInvalid?: SubmitErrorHandler<TFieldValues>,
    ) => {
      const invalidHandler = onInvalid ?? (toastFirstError(t) as SubmitErrorHandler<TFieldValues>);
      return originalHandleSubmit(onValid, invalidHandler);
    };
    return fn;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalHandleSubmit]);

  return { ...form, handleSubmit: wrappedHandleSubmit };
}

/**
 * Narrow re-exports that are safe to import directly — they don't carry the
 * silent-submit trap. Anything that returns a form state (`useForm`,
 * `useFormContext`) must go through `useAppForm`.
 */
export {
  Controller,
  FormProvider,
  useController,
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
  type ControllerRenderProps,
  type FieldErrors,
  type FieldValues,
  type SubmitErrorHandler,
  type SubmitHandler,
  type UseFormProps,
  type UseFormReturn,
} from 'react-hook-form';
