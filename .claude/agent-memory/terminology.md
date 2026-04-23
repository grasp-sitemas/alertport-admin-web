# Terminology — glossário de domínio

> Termos usados no código/UI que não são óbvios para quem chega novo.

## Eventos AlertPort

| Termo | Significado |
|---|---|
| **SOS** | Alerta de emergência disparado pelo usuário no dispositivo |
| **INCIDENT** | Evento genérico de incidente |
| **CRASH** | Impacto/queda detectado pelo acelerômetro |
| **LOWVOLTAGE** | Bateria do dispositivo crítica |
| **TIME_ENTRY** | Registro de presença (ponto) |

## Agendamento / ocorrência

| Termo | Significado |
|---|---|
| **appointment** | Agendamento base (genérico, compartilhado com shieldgo) |
| **schedule** | Plano de alertas recorrente (cadastro) |
| **occurrence** | Instância de execução do schedule (PENDING / RESPONDED / MISSED) |
| **attendance** | Atendimento ao vivo de um evento pelo operador |

## Usuários

| Role | Descrição |
|---|---|
| `SUPER_ADMIN_MASTER` | Admin do sistema (whitelist de email) |
| `ADMIN_MASTER` | Admin com poder máximo dentro de um client |
| `ADMIN` | Admin padrão |
| `MANAGER` | Gerente operacional |
| `OPERATOR` | Monitor ao vivo |
| `AUDITOR` | Leitura apenas |

| Tipo backend | UI |
|---|---|
| `COMPANY_USER` | "Usuário" (colaborador admin da plataforma) |
| `VIGILANT` | "Colaborador" (vigia de campo) |

## Tempo real

| Termo | Significado |
|---|---|
| **ms-chat** | Microserviço de Socket.IO que intermedia chamadas |
| **NORMAL call** | Chamada com áudio bidirecional |
| **SILENT_LISTEN** | Escuta SOS com mic travado do operador |
| **ICE** | Candidatos WebRTC para NAT traversal |

## Hierarquia

| Termo | Significado |
|---|---|
| **account** | Conta raiz (tenant) |
| **client** | Cliente (sub-tenant sob account) |
| **site** | Posto físico (sob client) |
| **siteGroup** | Agrupamento de sites |
