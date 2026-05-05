'use client';

import { useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import { useTranslations } from 'next-intl';
import { Check, Copy, Download, Printer } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { copySiteCodeToClipboard, formatSiteCodeForDisplay } from '@/lib/site-code';
import type { Company } from '@/types/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site?: Company;
}

/**
 * QR code modal for a site. Mirrors `QrCodeModal.vue` from shieldgo-admin-web.
 *
 * The equipment login endpoint (`/api/company/equipments/login/v1/`) expects
 * the site's Mongo `_id` in `req.body.site`. If we emit legacyId first, the
 * mobile app forwards a value that cannot be resolved by `getByPK({ _id })`
 * and device registration/persistence fails with `site.not.found`.
 */
export function SiteQrDialog({ open, onOpenChange, site }: Props) {
  const t = useTranslations();
  const qrRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);

  const payload = useMemo(() => {
    if (!site) return '';
    const legacyId = (site as unknown as { legacyId?: string }).legacyId;
    return site._id || legacyId || '';
  }, [site]);

  const codeDisplay = formatSiteCodeForDisplay(site?.siteCode);

  async function handleCopyCode() {
    const ok = await copySiteCodeToClipboard(site?.siteCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  function handleDownload() {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrcode-${site?.name ?? 'site'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const html = `
      <html>
        <head>
          <title>${site?.name ?? ''}</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px; }
            h1 { font-size: 20px; margin-bottom: 16px; }
            .qr { padding: 16px; background: white; border-radius: 12px; }
            .meta { margin-top: 16px; font-size: 14px; color: #555; }
          </style>
        </head>
        <body>
          <h1>${site?.name ?? ''}</h1>
          <div class="qr">${svg.outerHTML}</div>
          <p class="meta">${payload}</p>
          <script>window.onload = () => setTimeout(() => window.print(), 100)</script>
        </body>
      </html>
    `;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('sites.qrTitle')}</DialogTitle>
          <DialogDescription>{site?.name ?? ''}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {payload ? (
            <div
              ref={qrRef}
              className="rounded-2xl bg-white p-4 shadow-[0_0_60px_rgba(179,38,30,0.08)]"
            >
              <QRCode value={payload} size={220} bgColor="#ffffff" fgColor="#0a0e1a" />
            </div>
          ) : (
            <p className="text-text-muted py-8 text-sm">{t('common.noData')}</p>
          )}
          <p className="text-text-muted text-center font-mono text-[10px] break-all">{payload}</p>
          {codeDisplay ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-text-muted text-xs">{t('sites.manualCodeLabel')}</span>
              <code className="bg-bg-tertiary text-text-primary rounded-lg px-3 py-1 font-mono text-sm tracking-widest">
                {codeDisplay}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyCode}
                aria-label={t('sites.copyCode')}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={handleDownload} disabled={!payload}>
            <Download className="h-4 w-4" />
            {t('sites.qrDownload')}
          </Button>
          <Button type="button" onClick={handlePrint} disabled={!payload}>
            <Printer className="h-4 w-4" />
            {t('sites.qrPrint')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
