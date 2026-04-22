'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Shield, Trash2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { lgpdService } from '@/services/lgpd.service';

/**
 * LGPD self-service page. Exposes the two data-subject rights every
 * brasilian SaaS is required to offer by law (art. 18 LGPD):
 *   • direito de acesso (export) - dumps everything we hold on the
 *     user as a JSON download they can take anywhere.
 *   • direito de eliminação (delete) - requires password re-entry,
 *     anonymizes the row, soft-deletes linked company/customer
 *     membership, logs the subject out.
 *
 * Accessible to every authenticated role because LGPD rights are
 * individual, not hierarchical - an OPERATOR must be able to export
 * and delete THEIR own data just like an ADMIN.
 */
export default function AccountPage() {
  const t = useTranslations();
  const { user, logout } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');

  const exportMutation = useMutation({
    mutationFn: () => lgpdService.exportMyData(),
    onSuccess: (snapshot) => {
      // Materialize the JSON as a Blob so the browser downloads it
      // without ever round-tripping back to the server. The filename
      // encodes the subject id so auditors can trace the export later.
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const subjectId = (snapshot.subject as { id?: string })?.id ?? 'me';
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `alertport-data-export-${subjectId}-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t('account.export.toastSuccess'));
    },
    onError: () => toast.error(t('notifications.errorOccurred')),
  });

  const deleteMutation = useMutation({
    mutationFn: (pwd: string) => lgpdService.deleteMyAccount(pwd),
    onSuccess: () => {
      toast.success(t('account.delete.toastSuccess'));
      setDeleteOpen(false);
      setPassword('');
      // Tear down the session locally and route to /login. The
      // backend already archived the row so any cached tokens are
      // tied to an ARCHIVED user and will fail on next request
      // anyway; logout() just makes the transition instant.
      setTimeout(() => logout(), 600);
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        toast.error(t('account.delete.wrongPassword'));
      } else {
        toast.error(t('notifications.errorOccurred'));
      }
    },
  });

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || '-';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('account.title')}
        description={t('account.description')}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-500" />
            {t('account.profile.title')}
          </CardTitle>
          <CardDescription>{t('account.profile.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-text-muted">{t('common.name')}</dt>
              <dd className="text-white">{displayName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-text-muted">{t('common.email')}</dt>
              <dd className="text-white">{user?.email ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-text-muted">{t('users.role')}</dt>
              <dd className="text-white">{user?.companyUser?.subtype ?? '-'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-4 w-4 text-brand-500" />
            {t('account.export.title')}
          </CardTitle>
          <CardDescription>{t('account.export.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            <Download className="h-4 w-4" />
            {exportMutation.isPending ? t('common.loading') : t('account.export.cta')}
          </Button>
          <p className="mt-3 text-xs text-text-muted">{t('account.export.note')}</p>
        </CardContent>
      </Card>

      <Card className="border-red-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-300">
            <Trash2 className="h-4 w-4" />
            {t('account.delete.title')}
          </CardTitle>
          <CardDescription className="text-red-300/70">
            {t('account.delete.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setDeleteOpen(true)}
            className="border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
          >
            <Trash2 className="h-4 w-4" />
            {t('account.delete.cta')}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={(next) => {
        if (!deleteMutation.isPending) {
          setDeleteOpen(next);
          if (!next) setPassword('');
        }
      }}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-5 w-5" />
              {t('account.delete.confirmTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('account.delete.confirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <ul className="list-disc space-y-1 pl-5 text-xs text-text-secondary">
              <li>{t('account.delete.bullet1')}</li>
              <li>{t('account.delete.bullet2')}</li>
              <li>{t('account.delete.bullet3')}</li>
            </ul>
            <div className="space-y-1.5">
              <Label htmlFor="delete-password">{t('auth.password')}</Label>
              <Input
                id="delete-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('account.delete.passwordPlaceholder')}
                autoComplete="current-password"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDeleteOpen(false);
                setPassword('');
              }}
              disabled={deleteMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => deleteMutation.mutate(password)}
              disabled={!password || deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-500"
            >
              <Trash2 className="h-4 w-4" />
              {deleteMutation.isPending
                ? t('common.loading')
                : t('account.delete.confirmCta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
