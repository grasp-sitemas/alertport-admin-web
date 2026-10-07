import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { CompanyListFormDialog } from '@/features/company/company-form-dialog';
import { companyService } from '@/services/company.service';
import { auditLogService } from '@/services/audit-log.service';
import type { Company } from '@/types/api';
import pt from '@/messages/pt.json';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('sends explicit empty values when the operator clears optional company fields', async () => {
  const company: Company = {
    _id: 'company-1', name: 'Review Company', type: 'ACCOUNT', status: 'ACTIVE',
    fantasyName: 'Old name', personType: 'LEGAL', document: '11222333000181',
    email: 'old@example.com', primaryPhone: '11987654321', timezone: 'America/Sao_Paulo',
  };
  const update = vi.spyOn(companyService, 'update').mockResolvedValue({ status: 200, result: company });
  vi.spyOn(auditLogService, 'capture').mockResolvedValue(true);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="pt" messages={pt}>
        <CompanyListFormDialog open onOpenChange={() => {}} company={company} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  for (const name of ['fantasyName', 'document', 'email']) {
    fireEvent.change(document.querySelector(`input[name="${name}"]`)!, { target: { value: '' } });
  }
  fireEvent.change(screen.getByPlaceholderText('(11) 99999-9999'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(update).toHaveBeenCalledWith('company-1', expect.objectContaining({
    fantasyName: '', document: '', email: '', primaryPhone: '',
  })));
}, 15_000);
