import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { mockApi, sampleSite, seedSession } from './fixtures/session';
import pt from '../../src/messages/pt.json';
import en from '../../src/messages/en.json';
import es from '../../src/messages/es.json';
import ja from '../../src/messages/ja.json';
import zh from '../../src/messages/zh.json';

for (const [locale, messages] of Object.entries({ pt, en, es, ja, zh })) {
  test(`adherence CSV preserves the translated status shown in the table (${locale})`, async ({ page }) => {
    await seedSession(page);
    await page.addInitScript((value) => localStorage.setItem('alertport_locale', value), locale);
    await mockApi(page, {
      '/api/reports/alertport/adherence/v1/': {
        status: 200, totalCount: 5, generatedAt: new Date().toISOString(), durationMs: 1,
        summary: { total: 5, attended: 1, missed: 1, expired: 1, pending: 1, adherenceRate: 25, avgResponseTimeSec: 10 },
        results: ['PENDING', 'RESPONDED', 'MISSED', 'EXPIRED', 'CANCELLED'].map((status, i) => ({
          _id: `report-${i}`, status, scheduledAt: '2026-10-06T12:00:00Z', site: sampleSite,
        })),
      },
    });
    await page.goto('/reports/adherence');
    const rows = page.getByRole('table').getByRole('row');
    await expect(rows).toHaveCount(6);
    for (const label of [...Object.values(messages.reports.adherence.statusValue), { pt: 'Cancelado', en: 'Cancelled', es: 'Cancelado', ja: 'キャンセル済み', zh: '已取消' }[locale]!]) {
      await expect(page.getByRole('table')).toContainText(label);
    }
    await page.getByRole('button', { name: messages.reports.export.button, exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: messages.reports.export.csv }).click();
    const file = await downloadPromise;
    const csv = await fs.readFile((await file.path())!, 'utf8');
    for (const label of Object.values(messages.reports.adherence.statusValue)) expect(csv).toContain(label);
    expect(csv).not.toMatch(/,RESPONDED,|,MISSED,|,EXPIRED,|,PENDING,|,CANCELLED,/);
  });
}
