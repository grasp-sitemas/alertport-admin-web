'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, Scale, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type LegalKind = 'terms' | 'privacy';

interface LegalModalProps {
  kind: LegalKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional acceptance callback — shown as the primary CTA when provided. */
  onAccept?: () => void;
}

/**
 * Premium legal document modal. Used for:
 *   - Terms of Use (kind="terms")
 *   - Privacy Policy (kind="privacy")
 *
 * Content is the canonical PT-BR version (legal text is not auto-translated to
 * avoid introducing liability drift between locales). UI chrome — titles,
 * CTAs, "last updated" — is i18n-driven.
 */
export function LegalModal({ kind, open, onOpenChange, onAccept }: LegalModalProps) {
  const t = useTranslations();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Always scroll to the top when the modal opens so long documents start at
  // their beginning (and screen readers announce the title first).
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [open]);

  const isTerms = kind === 'terms';
  const Icon = isTerms ? Scale : ShieldCheck;
  const title = isTerms ? t('legal.terms.title') : t('legal.privacy.title');
  const subtitle = isTerms ? t('legal.terms.subtitle') : t('legal.privacy.subtitle');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-3xl p-0 overflow-hidden border border-white/10',
          'bg-gradient-to-b from-bg-secondary to-bg-primary',
          'sm:rounded-3xl',
        )}
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-56 w-[130%] -translate-x-1/2 rounded-full bg-brand-600/15 blur-3xl" />
        </div>

        {/* Header */}
        <DialogHeader className="relative z-10 px-8 pt-8 pb-5 sm:px-10">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ring-1',
                isTerms
                  ? 'bg-brand-500/10 ring-brand-500/30'
                  : 'bg-emerald-500/10 ring-emerald-500/30',
              )}
            >
              <Icon
                className={cn('h-5 w-5', isTerms ? 'text-brand-400' : 'text-emerald-400')}
              />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold text-white">{title}</DialogTitle>
              <DialogDescription className="text-sm text-text-secondary">
                {subtitle}
              </DialogDescription>
              <p className="text-[11px] uppercase tracking-wider text-text-muted">
                {t('legal.lastUpdated', { date: 'Abril de 2026' })}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          className="relative z-10 max-h-[60vh] overflow-y-auto px-8 sm:px-10 pb-6 prose-legal"
        >
          {isTerms ? <TermsBody /> : <PrivacyBody />}
        </div>

        {/* Footer */}
        <div className="relative z-10 flex flex-col-reverse gap-3 border-t border-white/[0.06] bg-white/[0.02] px-8 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <p className="text-xs text-text-muted">
            {t('legal.footerNote')}
          </p>
          <div className="flex gap-3">
            {onAccept ? (
              <>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  {t('common.close')}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    onAccept();
                    onOpenChange(false);
                  }}
                >
                  {t('legal.acceptCta')}
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t('common.close')}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Canonical legal content (pt-BR). Edit here when legal team signs off.
// ────────────────────────────────────────────────────────────────────────

function Section({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2 mb-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[11px] font-semibold text-text-secondary ring-1 ring-white/10">
          {index}
        </span>
        {title}
      </h3>
      <div className="space-y-2 pl-8 text-sm leading-relaxed text-text-secondary">{children}</div>
    </section>
  );
}

function TermsBody() {
  return (
    <div className="pt-1">
      <p className="mb-6 text-sm text-text-secondary">
        Estes Termos de Uso (&quot;Termos&quot;) regulam o acesso e a utilização da plataforma{' '}
        <strong className="text-white">AlertPort</strong>, disponibilizada como software-as-a-service
        (SaaS) por sua empresa controladora. Ao criar uma conta, o Usuário declara ter lido,
        compreendido e concordado integralmente com estes Termos.
      </p>

      <Section index={1} title="Cadastro e contas">
        <p>
          O Usuário é responsável pela veracidade das informações fornecidas no cadastro,
          pela guarda das credenciais e por todas as ações realizadas em sua conta. A
          AlertPort poderá recusar, suspender ou encerrar contas criadas com dados falsos,
          em duplicidade ou de forma abusiva.
        </p>
      </Section>

      <Section index={2} title="Licença de uso">
        <p>
          A AlertPort concede ao Usuário uma licença limitada, pessoal, não-exclusiva,
          revogável e intransferível para utilizar a plataforma, restrita ao escopo dos
          planos e funcionalidades contratadas. Todo o código, marca, logotipos e
          conteúdo da plataforma permanecem de propriedade da AlertPort.
        </p>
      </Section>

      <Section index={3} title="Período de teste gratuito (trial)">
        <p>
          Novos cadastros recebem automaticamente acesso a funcionalidades premium
          durante o período de teste indicado no momento do registro. Ao final do
          período, o acesso será restrito até a contratação de um plano pago. Dados
          permanecem preservados conforme a cláusula de retenção desta política.
        </p>
      </Section>

      <Section index={4} title="Responsabilidades do Usuário">
        <p>
          O Usuário compromete-se a utilizar a plataforma em conformidade com as leis
          aplicáveis, especialmente no tocante a proteção de dados, propriedade
          intelectual e regulamentações setoriais. É vedado:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>explorar vulnerabilidades, fazer engenharia reversa ou contornar limites de plano;</li>
          <li>utilizar a plataforma para atividades ilícitas ou que infrinjam direitos de terceiros;</li>
          <li>compartilhar credenciais, transferir licenças sem autorização prévia ou revender o acesso.</li>
        </ul>
      </Section>

      <Section index={5} title="Disponibilidade e suporte">
        <p>
          A AlertPort empreenderá esforços razoáveis para manter a plataforma operacional,
          ressalvadas janelas de manutenção programadas, falhas de terceiros e eventos de
          força maior. Os níveis de serviço (SLA), quando aplicáveis, são definidos nos
          respectivos planos contratados.
        </p>
      </Section>

      <Section index={6} title="Pagamentos e cancelamento">
        <p>
          Planos pagos são cobrados recorrentemente conforme a periodicidade escolhida. O
          Usuário poderá cancelar a qualquer momento — o cancelamento interrompe a próxima
          renovação, sem reembolso proporcional salvo disposição legal em contrário.
        </p>
      </Section>

      <Section index={7} title="Limitação de responsabilidade">
        <p>
          A AlertPort não responderá por lucros cessantes, danos indiretos ou consequenciais
          decorrentes do uso ou da impossibilidade de uso da plataforma, no limite máximo
          permitido pela legislação aplicável.
        </p>
      </Section>

      <Section index={8} title="Alterações destes Termos">
        <p>
          A AlertPort poderá atualizar estes Termos a qualquer tempo. Alterações materiais
          serão comunicadas com antecedência razoável por e-mail ou aviso na plataforma. A
          continuidade de uso após a vigência configura aceitação dos novos Termos.
        </p>
      </Section>

      <Section index={9} title="Lei aplicável e foro">
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica
          eleito o foro da comarca de São Paulo/SP como competente para dirimir quaisquer
          controvérsias, com renúncia a qualquer outro, por mais privilegiado que seja.
        </p>
      </Section>
    </div>
  );
}

function PrivacyBody() {
  return (
    <div className="pt-1">
      <p className="mb-6 text-sm text-text-secondary">
        Esta Política de Privacidade descreve como a{' '}
        <strong className="text-white">AlertPort</strong> coleta, utiliza, armazena e
        protege dados pessoais de seus Usuários, em observância à Lei Geral de Proteção de
        Dados (Lei nº 13.709/2018) e a demais normas aplicáveis.
      </p>

      <Section index={1} title="Dados coletados">
        <p>
          Coletamos informações fornecidas diretamente pelo Usuário (nome, e-mail,
          telefone, CPF/CNPJ, dados da empresa) e informações geradas durante o uso
          (eventos de segurança, registros de auditoria, logs técnicos, localização de
          dispositivos quando permitida).
        </p>
      </Section>

      <Section index={2} title="Finalidades do tratamento">
        <ul className="list-disc list-inside space-y-1">
          <li>autenticação, controle de acesso e operação da plataforma;</li>
          <li>emissão e entrega de notificações, relatórios e alertas contratados;</li>
          <li>cumprimento de obrigações legais, regulatórias e contratuais;</li>
          <li>melhoria contínua do produto, com uso de dados agregados e anonimizados;</li>
          <li>comunicação com o Usuário e suporte técnico.</li>
        </ul>
      </Section>

      <Section index={3} title="Base legal">
        <p>
          O tratamento é realizado com base na execução do contrato firmado com o Usuário,
          no consentimento expresso quando exigido, no cumprimento de obrigação legal ou
          no legítimo interesse da AlertPort, sempre respeitando os direitos e liberdades
          fundamentais do titular.
        </p>
      </Section>

      <Section index={4} title="Compartilhamento">
        <p>
          Dados pessoais poderão ser compartilhados com provedores de infraestrutura,
          processadores de pagamento e parceiros tecnológicos estritamente necessários à
          operação do serviço, todos sujeitos a obrigações contratuais de confidencialidade
          e segurança. Não comercializamos dados pessoais.
        </p>
      </Section>

      <Section index={5} title="Segurança e retenção">
        <p>
          Adotamos controles técnicos e administrativos apropriados — criptografia em
          trânsito e em repouso, segregação de ambientes, revisão de acessos e registros
          de auditoria — para proteger os dados contra acessos não autorizados. Os dados
          são retidos pelo tempo necessário ao cumprimento das finalidades e das
          obrigações legais aplicáveis.
        </p>
      </Section>

      <Section index={6} title="Direitos do titular">
        <p>
          Conforme a LGPD, o Usuário pode requisitar a qualquer tempo a confirmação de
          existência de tratamento, o acesso, a correção, a anonimização, a portabilidade,
          a eliminação e a revogação do consentimento de seus dados, pelo canal de
          atendimento indicado na plataforma.
        </p>
      </Section>

      <Section index={7} title="Transferência internacional">
        <p>
          A AlertPort pode armazenar ou processar dados em infraestrutura localizada fora
          do Brasil, sempre adotando mecanismos de proteção adequados previstos na LGPD
          para transferências internacionais.
        </p>
      </Section>

      <Section index={8} title="Atualizações desta Política">
        <p>
          Esta Política pode ser atualizada periodicamente. Alterações relevantes serão
          comunicadas ao Usuário. A data da última atualização está indicada no topo deste
          documento.
        </p>
      </Section>

      <Section index={9} title="Contato">
        <p>
          Dúvidas, solicitações ou exercício de direitos podem ser encaminhados ao
          Encarregado de Proteção de Dados da AlertPort pelo e-mail{' '}
          <span className="text-white">privacidade@alertport.com.br</span>.
        </p>
      </Section>
    </div>
  );
}
