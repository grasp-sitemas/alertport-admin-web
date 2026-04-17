import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppForm } from '@/hooks/use-app-form';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from 'sonner';

const messages = {
  validation: { required: 'Campo obrigatório' },
  notifications: { validationFailed: 'Corrija os campos antes de salvar.' },
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

const schema = z.object({
  name: z.string().min(1, { message: 'validation.required' }),
});
type Values = z.infer<typeof schema>;

function TestForm({ onValid }: { onValid: (data: Values) => void }) {
  const { register, handleSubmit } = useAppForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });
  return (
    <form onSubmit={handleSubmit(onValid)}>
      <input aria-label="name" {...register('name')} />
      <button type="submit">Save</button>
    </form>
  );
}

describe('useAppForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toasts when validation fails and no onInvalid is provided', async () => {
    const onValid = vi.fn();
    const user = userEvent.setup();
    render(
      <Wrapper>
        <TestForm onValid={onValid} />
      </Wrapper>,
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onValid).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'Corrija os campos antes de salvar.',
      expect.objectContaining({ description: 'Campo obrigatório' }),
    );
  });

  it('calls onValid when the form is valid', async () => {
    const onValid = vi.fn();
    const user = userEvent.setup();
    render(
      <Wrapper>
        <TestForm onValid={onValid} />
      </Wrapper>,
    );

    await user.type(screen.getByLabelText('name'), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onValid).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ada' }),
      expect.anything(),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('lets callers override onInvalid when explicit behavior is needed', async () => {
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    const user = userEvent.setup();

    function Form() {
      const { register, handleSubmit } = useAppForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: { name: '' },
      });
      return (
        <form onSubmit={handleSubmit(onValid, onInvalid)}>
          <input aria-label="name" {...register('name')} />
          <button type="submit">Save</button>
        </form>
      );
    }

    render(
      <Wrapper>
        <Form />
      </Wrapper>,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
