# AlertPort — revisão de 02/09 e estabilização de 08/09/2026

## Escopo e evidência

Fonte de requisitos: PDF `REVISÃO ALERTPORT 02 SETEMBRO 2026.pdf`, duas páginas, e relato de 03/09 de Flávio sobre registros de usuários indisponíveis em ambos os produtos. O documento foi tratado como evidência funcional; a autorização de execução veio da solicitação do usuário.

Este relatório cobre o frontend `alertport-admin-web`. As correções dos serviços compartilhados são coordenadas separadamente no repositório `shieldgo-microservices`. Testes com respostas HTTP controladas comprovam comportamento da interface e contratos emitidos; não comprovam disponibilidade nem persistência em produção.

## Histórico relevante

| Commit | Data | Alteração relevante |
| --- | --- | --- |
| `f657a8c` | 31/08 | Estabilização de permissões por módulo e mocks de smoke tests. |
| `34283e7` | 29/08 | Impede repetição de mutações de agendas após timeout; a proteção ainda não abrangia os demais cadastros. |
| `ea46149` | 30/06 | Presença indisponível deixa de ser interpretada como lista vazia/offline. |
| `f20e633` | 26/06 | Filtros do monitor, eventos offline, séries de agendas e traduções. |
| `50c604c` | 26/06 | Eventos de energia e bateria no monitor. |

O checkout estava limpo em `f657a8c` antes da intervenção.

## Revisão do cliente e causas

| Item | Diagnóstico | Correção / responsabilidade |
| --- | --- | --- |
| Empresa editada parece não salvar razão, fantasia, tipo, documento, contato, fuso e status | `/companies` usa a chave React Query `['companies', 'accounts', params]`, mas a invalidação após salvar/arquivar/reativar alcançava apenas `['accounts']`. A lista preservava o objeto antigo e reabria o formulário com valores antigos. | Invalidação também de `['companies']` e `['me']`; testes com QueryClient/QueryObserver reais comprovam refetch da lista e das configurações. |
| Configurações de empresa não permitem salvar | O formulário era inicializado vazio antes de `/me` responder. A montagem simultânea de selects Radix e `reset` apagava `personType`, que passava de `LEGAL` a string vazia; o schema recusava salvar. O smoke antigo aceitava esse erro como resultado válido. | Formulário passa a montar com a empresa já carregada e defaults completos. Smoke exige sucesso e valores carregados. |
| Campos opcionais apagados reaparecem na empresa | O payload omitia fantasia, documento, email e telefone quando vazios, impedindo remover valores existentes. | Edição transmite vazio explícito nesses quatro campos; criação continua omitindo opcionais não preenchidos. |
| Cliente/posto: exclusão demora e confirmação permanece | A UI já fecha somente quando a API confirma sucesso. O backend recebe DELETE com apenas `_id`; sua cascata dependia de `body.type` e de filtro mutável compartilhado. | Correção backend atribuída à frente de serviços. UI mantém confirmação aberta em erro para não simular sucesso. Regressão browser exige resposta de sucesso, fechamento e atualização da lista. |
| CEP inválido em postos/usuários | `helpersService.lookupCep` consulta ViaCEP diretamente, mas `connect-src` da CSP não permitia o domínio. Além disso, falha de rede era traduzida como CEP inválido. | Adicionada origem exata `https://viacep.com.br`. Indisponibilidade passa a recomendar nova tentativa ou preenchimento manual; código inválido continua separado. Traduções em pt/en/es/ja/zh. |
| Usuários ADMIN/MANAGER/OPERATOR não salvam, AUDITOR salva | Frontend emite os subtipos existentes e hierarquia account/client/site. Falha por subtipo e indisponibilidade das listagens dependem de validação e implantação do ms-user. | Frente ms-user investiga/repara backend. Regressão browser percorre os quatro formulários e exige POST multipart válido e sucesso antes de fechar. |
| Colaboradores ainda sem uso no AlertPort | Cadastro estava anunciado no menu de gestão apesar de não existir login de colaborador no fluxo AlertPort. | Item ocultado da navegação AlertPort; rota e implementação preservadas para evolução futura. ShieldGo não é alterado. |
| Equipamento com Tipo Outro / Marca Outro não salva | Catálogo do gateway oferece `DEVICE-OTHER`, porém enum do modelo Equipments no CRUD compartilhado só aceitava `DEVICE-PHONE` e `DEVICE-READER`. `OTHER` da marca já era válido. | Correção do modelo atribuída à frente backend. Regressão browser exige envio de `type=DEVICE-OTHER`, `brand=OTHER`. |
| Duplicação ao alterar produtos | Interceptor HTTP fazia até três tentativas inclusive para POST/PUT/DELETE após timeout/5xx. O servidor pode ter persistido a primeira tentativa. | Retry automático restrito por padrão a GET/HEAD/OPTIONS. Requisições explicitamente seguras podem optar por `retry:true`. Mutações de agenda continuam com `retry:false`. |

Hipótese descartada: `_id` ausente no multipart da edição da lista de empresas. O controller genérico utiliza `req.params` para localizar o registro editado, portanto acrescentar `_id` ao body não corrigiria a causa observada.

## Verificação e limites

Regressões novas foram executadas antes da implementação e falharam pelas causas esperadas: três tentativas de mutação, feedback de CEP incorreto, item Colaboradores visível, empresa editada conservada no cache e CSP sem ViaCEP. O browser também reproduziu CEP sem preenchimento antes da mudança da CSP.

`tests/e2e/review-management.spec.ts` usa o Next real, navegador real, autenticação sintética e transporte HTTP controlado. Seus casos exigem resultado específico; erro, validação silenciosa ou ausência de POST não contam como aprovação. Cobrem empresa com reabertura, arquivamento cliente/posto, criação dos quatro perfis, catálogo de equipamento e CEP sob a CSP realmente entregue.

Comandos da intervenção:

```sh
npm run validate
PLAYWRIGHT_EXECUTABLE_PATH=<chromium-local> npm run test:e2e -- tests/e2e/review-management.spec.ts --workers=1
```

O navegador Chromium 1234 já existente no host foi utilizado sem instalar dependências. `PLAYWRIGHT_CHANNEL` e `PLAYWRIGHT_EXECUTABLE_PATH` são opcionais; CI mantém o navegador padrão quando não definidos.

Resultados do candidato de 08/09/2026:

- TypeScript, ESLint (zero erros; nove avisos preexistentes) e verificação estrita de rotas dinâmicas passaram.
- Vitest: **61 arquivos, 463 testes aprovados**, em `/tmp/alertport-review-validate-final.log`.
- O primeiro build dessa execução parou por falta de espaço no host, depois de compilar. Após limpeza de caches regeneráveis, o build completo com configuração HML terminou com **exit 0**, em `/tmp/alertport-hml-build.log`. Variáveis públicas ausentes em HML foram explicitamente esvaziadas para impedir herança de configuração de produção.
- Playwright no build HML servido localmente: **16/16 aprovados**, sem skips, em `/tmp/alertport-review-browser-final.log`: dez regressões da revisão e seis formulários de CRUD exigindo sucesso. Isso inclui a regressão de montagem de `/company`, que falhava antes da correção.
- `git diff --check` passou.

A avaliação live de produção/HML, os testes de isolamento entre produtos e os resultados dos microserviços pertencem ao relatório consolidado `audit-2026-09-08` do workspace. Nenhum resultado hermético é apresentado como garantia de ausência de defeitos em produção.

O runner `scripts/audit-live-routes.mjs` percorre todas as páginas autenticadas presentes em `src/app/(app)`, após login normal. Registra somente caminhos, status HTTP, erros de rede, erros JavaScript e presença de título; não extrai registros pessoais. Exige origem de API explícita e bloqueia chamadas a outra origem, evitando testar acidentalmente produção com o candidato HML. Uma restrição de acesso inesperada, uma rota sem terminar de carregar ou um erro HTTP fazem o processo sair com código 1. Restrições esperadas para testes de perfil devem ser declaradas explicitamente em `ALERTPORT_AUDIT_EXPECT_DENIED`.

## Retomada: login e falha de carregamento da empresa

O ensaio live anterior detectou envio nativo do formulário de login antes de o JavaScript hidratar, levando credenciais para a query string. O HTML inicial agora mantém campos e botão desabilitados até hidratar e declara `method="post"`. O auditor também elimina query strings e credenciais das mensagens de erro persistidas. A regressão sem JavaScript passou; login normal e navegação autenticada passaram com API HML real.

Uma falha ao carregar os dados da empresa agora mostra erro e botão de nova tentativa. O teste inicialmente interceptava `/api/users/me/v1/`, mas a tela usa `/api/users/system/companyuser/me/v1`; esse teste foi corrigido e restringe o seletor de alerta ao conteúdo principal, sem confundi-lo com o anunciador de rotas do Next. Ele comprova falha explícita, nova consulta e recuperação do formulário.

Na retomada, TypeScript, lint (os mesmos nove avisos), 463 testes unitários e verificação das rotas dinâmicas passaram. As 18 regressões de navegador passaram, sem skips, em `/private/tmp/alertport-resume-browser-correct-endpoint.log`. A auditoria do build local com APIs reais de HML passou no login e nas 28 páginas autenticadas, como SUPER_ADMIN_MASTER, sem erros de HTTP, rede ou JavaScript: `audit-2026-09-08/alertport-live-routes-resume.json` no workspace. Essa leitura não substitui a validação de persistência, perfis restritos nem o teste posterior na URL publicada.

Não executar os testes legados de agenda em dados de clientes: alguns deles editam o primeiro evento encontrado. Mutações live desta auditoria devem usar somente fixtures dedicadas `QA-AUDIT`.

## Compatibilidade com cadastros migrados

Cadastros antigos podem fornecer somente `name`. A listagem e a confirmação de exclusão agora usam esse campo quando `fullName` e os nomes separados estão ausentes. A regressão de navegador falhou antes com nome vazio e passou após o ajuste. O novo gate aprovou 19/19 E2E, 463 unitários, TypeScript, lint sem erros e build HML.

## Integração final e escopo de cliente

O commit remoto `47b05fa` foi incorporado integralmente, preservando as correções de datas civis e chaves de idempotência das agendas. Após a integração, passaram 473 testes unitários, 19 E2E e o build HML.

MANAGER mantém a edição dos clientes atribuídos, mas não recebe o botão de criar um novo cliente que ficaria fora desse escopo. ADMIN e os perfis master preservam a criação. Duas regressões de navegador comprovaram essa distinção; o caso MANAGER falhou antes e ambos passaram depois.

O auditor live agora aguarda o fim do corpo das respostas (`requestfinished`) e a renderização do dashboard antes de navegar. Isso evita cancelar consultas ainda em andamento por iniciativa do próprio auditor. Erros de rede continuam reprovando a execução; suspensões do Mac exigem repetir a verificação.

## Publicação e verificação final

O candidato `d534bd406729d1d10dac7e7b21000e03cf48225e` foi publicado nos dois ambientes em 08/09/2026:

| Ambiente | URL pública | Deployment Vercel | Verificação real |
| --- | --- | --- | --- |
| HML | https://admin-hml.alertport.com.br | `dpl_5TrZuEemM47E9ayK3gZQUw1nWfxU` | Login e 28 páginas, zero erros, concluída 12:44 UTC |
| PROD | https://admin.alertport.com.br | `dpl_9unx5CJtz7XFtoVsav8rsqSWCqR9` | Login e 28 páginas, zero erros, concluída 12:59 UTC |

Também passaram **21/21 regressões de navegador na interface HML publicada**, com transporte HTTP controlado, além dos 473 unitários e demais gates descritos acima. As verificações autenticadas reais usaram SUPER_ADMIN_MASTER e somente leitura após o login; não substituem os testes de persistência e isolamento dos serviços.

A auditoria conjunta de CORS cobriu quatro origens principais dos admins: **30/30 preflights e 16/16 verificações Chromium**, incluindo APIs, ViaCEP e chat por polling/WebSocket. Não reproduziu bloqueios CORS/CSP nos fluxos verificados. As evidências JSON estão em `audit-2026-09-08` no workspace; o relatório CORS está no repositório dos microserviços.

A integração de código está no [PR #5 em rascunho](https://github.com/grasp-sitemas/alertport-admin-web/pull/5). A revisão automática recusou o push direto em `main`; essa branch foi preservada. A publicação Vercel foi aprovada após comprovação de que o repositório e o candidato já eram públicos. O deployment PROD anterior `admin-alertport-hvikn2zgl-developmentgraspgmailcoms-projects.vercel.app` permanece identificado para rollback.
