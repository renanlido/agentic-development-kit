# PRD: project-management

**Data:** 2026-01-16
**Status:** Draft
**Autor:** Auto-generated

## 1. Problema

Atualmente o ADK mantém todo o estado e gerenciamento de features dentro da estrutura `.claude/`, utilizando arquivos markdown locais para rastrear progresso, PRDs, tasks e planos de implementação. Esta abordagem apresenta as seguintes limitações:

### 1.1 Limitações de Visibilidade
- **Visibilidade restrita**: Apenas quem tem acesso ao repositório consegue ver o status das features
- **Sem dashboard**: Não há uma visão consolidada do progresso de múltiplas features
- **Dificuldade de comunicação**: Stakeholders não-técnicos não conseguem acompanhar o progresso facilmente
- **Histórico limitado**: Alterações de status não são facilmente rastreáveis ao longo do tempo

### 1.2 Limitações de Colaboração
- **Sem notificações**: Mudanças de status não geram alertas para interessados
- **Sem atribuição visual**: Difícil visualizar quem está trabalhando em quê
- **Integração manual**: Necessidade de copiar informações entre sistemas

### 1.3 Limitações de Gestão
- **Sem métricas automatizadas**: Velocidade, lead time e cycle time não são calculados
- **Sem visualização Kanban/Gantt**: Planejamento visual inexistente
- **Rastreamento manual**: Dependências e bloqueios são difíceis de visualizar

## 2. Solução Proposta

Implementar uma camada de integração opcional com plataformas de gestão de projetos, começando pelo **ClickUp** (selecionado por ser "BBB" - bom, bonito e barato). A solução deve:

### 2.1 Princípios de Design
- **Opt-in**: Integração completamente opcional, usuários podem continuar usando apenas arquivos locais
- **Transparente**: Sincronização automática entre estado local e ClickUp
- **Resiliente**: Funciona offline com sync posterior
- **Extensível**: Arquitetura preparada para outras plataformas (Jira, Linear, Notion) no futuro

### 2.2 Modelo de Integração
```
ADK Local (.claude/)          ClickUp
─────────────────────         ──────────────────
Feature Directory    ←───→    List (or Task)
├── prd.md          ←───→    Task Description
├── tasks.md        ←───→    Subtasks/Checklist
├── progress.md     ←───→    Task Status + Custom Fields
└── memory.md       ←───→    Task Comments
```

### 2.3 Mapeamento de Estrutura

| ADK Concept | ClickUp Equivalent | Notes |
|-------------|-------------------|-------|
| Projeto | Workspace/Space | Configurado na inicialização |
| Feature | List ou Task | Configurável pelo usuário |
| Task (dentro de feature) | Subtask ou Checklist Item | Dependendo do modo |
| Fase (prd, research, etc.) | Status ou Custom Field | Rastreamento de progresso |
| Progresso | Custom Fields (%) | Atualização automática |

## 3. Requisitos Funcionais

### RF01: Configuração de Integração
O sistema deve permitir configurar credenciais e preferências de integração via `adk config` ou `adk init`:
- API Token do ClickUp (Personal Token ou OAuth)
- Workspace ID padrão
- Space ID padrão
- Modo de sincronização (automático/manual)
- Mapeamento de estrutura (feature→list ou feature→task)

### RF02: Autenticação Segura
O sistema deve:
- Armazenar tokens de forma segura (não em arquivos versionados)
- Suportar Personal Tokens (pk_*) para uso individual
- Suportar OAuth 2.0 para aplicações multi-usuário
- Validar tokens antes de operações
- Renovar tokens automaticamente quando necessário

### RF03: Sincronização de Features
Ao criar, atualizar ou completar uma feature, o sistema deve:
- Criar/atualizar item correspondente no ClickUp
- Sincronizar título, descrição e status
- Mapear fases do ADK para status do ClickUp
- Preservar IDs de mapeamento local↔remoto

### RF04: Sincronização de Tasks
O sistema deve sincronizar a decomposição de tasks:
- Criar subtasks ou checklist items no ClickUp
- Atualizar status individual de cada task
- Sincronizar prioridades (P0, P1, P2)
- Mapear dependências quando possível

### RF05: Sincronização de Progresso
O sistema deve manter o progresso sincronizado:
- Calcular % de completude baseado em steps completados
- Atualizar Custom Fields com fase atual
- Registrar timestamps de início/fim de fases
- Gerar timeline visual no ClickUp

### RF06: Modo Offline/Local
O sistema deve funcionar quando:
- Sem conectividade de rede
- Sem integração configurada
- Com integração desabilitada temporariamente
- Sincronizando mudanças pendentes ao reconectar

### RF07: Comandos CLI para Gestão
Novos comandos/flags para gestão:
- `adk config integration` - Configurar integração
- `adk feature sync <name>` - Sincronizar feature específica
- `adk sync` - Sincronizar todas as features pendentes
- `adk feature create --no-sync` - Criar sem sincronizar
- `adk status --remote` - Verificar status remoto

### RF08: Importação de Projetos Existentes
O sistema deve permitir:
- Importar features existentes do ClickUp para estrutura local
- Exportar features locais existentes para ClickUp
- Mapeamento inicial em bulk
- Resolução de conflitos

### RF09: Webhooks (Bidirecional)
Para sincronização em tempo real:
- Registrar webhooks no ClickUp para mudanças de status
- Processar eventos de webhook
- Atualizar estado local quando remoto mudar
- Endpoint local ou integração via polling

### RF10: Relatórios e Métricas
Integração com sistema de reports:
- Velocity de features
- Lead time por fase
- Cycle time total
- Burndown de tasks

## 4. Requisitos Não-Funcionais

### RNF01: Performance
- Operações de sync não devem bloquear CLI por mais de 2 segundos
- Sync em background para operações longas
- Cache de dados para evitar requests repetidos
- Respeitar rate limits do ClickUp (100 requests/minuto por token)

### RNF02: Segurança
- Tokens nunca em código versionado
- Uso de variáveis de ambiente ou arquivos ignorados (.env, .adk-credentials)
- Comunicação via HTTPS apenas
- Validação de SSL certificates
- Sanitização de dados antes de envio

### RNF03: Confiabilidade
- Retry automático em falhas de rede (max 3 tentativas)
- Exponential backoff entre retries
- Log de operações para debugging
- Rollback local em caso de falha de sync

### RNF04: Usabilidade
- Mensagens claras de erro
- Progress indicators durante sync
- Confirmação antes de operações destrutivas
- Help contextual para configuração

### RNF05: Manutenibilidade
- Arquitetura plugável para novos providers
- Interface abstrata para operações de gestão
- Testes unitários para cada provider
- Documentação de API interna

### RNF06: Compatibilidade
- Node.js >= 18.0.0
- Compatível com estrutura ADK existente
- Sem breaking changes em comandos existentes
- Backward compatible com projetos sem integração

## 5. User Stories

### US01: Configurar Integração com ClickUp
**Como** desenvolvedor usando ADK
**Quero** configurar a integração com ClickUp
**Para** ter visibilidade do progresso das features em uma plataforma visual

**Critérios de Aceitação:**
- [ ] Comando `adk config integration clickup` disponível
- [ ] Prompt interativo para token, workspace e space
- [ ] Validação de credenciais antes de salvar
- [ ] Arquivo de configuração criado em local seguro (.adk/config.json ou .env)
- [ ] Mensagem de sucesso com próximos passos

### US02: Criar Feature Sincronizada
**Como** desenvolvedor usando ADK
**Quero** que features criadas sejam automaticamente sincronizadas
**Para** não precisar criar itens manualmente no ClickUp

**Critérios de Aceitação:**
- [ ] `adk feature new <name>` cria item no ClickUp automaticamente
- [ ] ID do item remoto salvo em metadata local
- [ ] Status inicial "To Do" ou equivalente
- [ ] Link para item do ClickUp exibido no terminal
- [ ] Flag `--no-sync` disponível para pular sincronização

### US03: Atualizar Status Automaticamente
**Como** desenvolvedor usando ADK
**Quero** que mudanças de fase atualizem o ClickUp automaticamente
**Para** stakeholders acompanharem sem eu precisar atualizar manualmente

**Critérios de Aceitação:**
- [ ] Mudança de fase (research→tasks→plan) atualiza status remoto
- [ ] Custom field "Fase ADK" atualizado com fase atual
- [ ] Custom field "Progresso" atualizado com % de completude
- [ ] Comentário automático no item com detalhes da mudança
- [ ] Timestamp de última sincronização salvo localmente

### US04: Trabalhar Offline
**Como** desenvolvedor usando ADK
**Quero** continuar trabalhando sem internet
**Para** não ser bloqueado por problemas de conectividade

**Critérios de Aceitação:**
- [ ] Operações locais funcionam sem rede
- [ ] Mudanças pendentes salvas em queue local
- [ ] Comando `adk sync` envia mudanças pendentes
- [ ] Detecção automática de reconexão (opcional)
- [ ] Resolução de conflitos quando remoto diverge

### US05: Sincronizar Feature Existente
**Como** desenvolvedor com features locais
**Quero** sincronizar features já criadas com ClickUp
**Para** migrar projetos existentes para gestão visual

**Critérios de Aceitação:**
- [ ] Comando `adk feature sync <name>` disponível
- [ ] Criação de item no ClickUp com estado atual
- [ ] Importação de PRD como descrição
- [ ] Tasks importadas como subtasks/checklist
- [ ] Confirmação antes de sobrescrever dados existentes

### US06: Escolher Não Usar Integração
**Como** desenvolvedor usando ADK
**Quero** poder optar por não usar integração
**Para** manter workflow simples quando não preciso de gestão visual

**Critérios de Aceitação:**
- [ ] ADK funciona normalmente sem configuração de integração
- [ ] Nenhuma mensagem de erro sobre integração não configurada
- [ ] Comandos de sync informam que integração não está configurada
- [ ] Possibilidade de desabilitar integração após configurar

### US07: Importar do ClickUp
**Como** desenvolvedor
**Quero** importar um projeto existente do ClickUp
**Para** começar a usar ADK em projeto já gerenciado no ClickUp

**Critérios de Aceitação:**
- [ ] Comando `adk import clickup <list-id>` disponível
- [ ] Criação de estrutura de feature para cada task
- [ ] Importação de descrição como PRD inicial
- [ ] Importação de subtasks como tasks.md
- [ ] Mapeamento de IDs preservado

### US08: Visualizar Status Remoto
**Como** desenvolvedor
**Quero** ver o status do ClickUp direto do terminal
**Para** verificar se sincronização está funcionando

**Critérios de Aceitação:**
- [ ] `adk status --remote` mostra status do ClickUp
- [ ] Indica se há divergências local/remoto
- [ ] Mostra link direto para item no ClickUp
- [ ] Lista mudanças pendentes de sync

## 6. Escopo

### Incluído
- Integração completa com ClickUp API v2
- Autenticação via Personal Token
- Sincronização bidirecional de features
- Mapeamento feature→list e feature→task
- Sincronização de tasks como subtasks
- Custom fields para rastreamento de fase
- Modo offline com queue de sync
- Comandos CLI para gestão da integração
- Testes unitários e de integração
- Documentação de uso e configuração

### Excluído (Out of Scope)
- Integração com outras plataformas (Jira, Linear, Notion) - futuras versões
- OAuth 2.0 completo (apenas Personal Token nesta versão)
- Webhooks para sync em tempo real (polling apenas nesta versão)
- Interface gráfica para gerenciamento
- Sincronização de anexos/arquivos
- Integração com time tracking do ClickUp
- Sincronização de comentários do ClickUp para local
- Múltiplos workspaces simultâneos
- Automations/triggers do ClickUp

## 7. Riscos e Mitigações

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Rate limiting da API ClickUp | Alto | Média | Implementar cache, batching e respeitar limites (100 req/min) |
| Mudanças na API do ClickUp | Médio | Baixa | Versionar API client, testes de integração, monitorar changelog |
| Conflitos de sincronização | Médio | Alta | Implementar estratégia de resolução (local-wins, remote-wins, merge) |
| Exposição de tokens | Alto | Baixa | Nunca versionar, usar env vars, validar .gitignore |
| Perda de dados em sync | Alto | Baixa | Backup local antes de operações destrutivas, log de operações |
| Complexidade de mapeamento | Médio | Média | Começar com mapeamento simples, evoluir baseado em feedback |
| Performance degradada | Médio | Média | Sync assíncrono, cache agressivo, operações em batch |
| Adoção baixa | Médio | Média | Tornar opcional, UX simples, documentação clara |

## 8. Métricas de Sucesso

### Métricas de Adoção
- **Taxa de configuração**: % de novos projetos que configuram integração (meta: >30%)
- **Features sincronizadas**: # de features com sync ativo por projeto (meta: >80% quando configurado)
- **Sync manual vs automático**: % de syncs automáticos vs manuais (meta: >90% automático)

### Métricas de Qualidade
- **Taxa de sucesso de sync**: % de operações sem erro (meta: >99%)
- **Latência de sync**: Tempo médio de sincronização (meta: <2s para operação individual)
- **Conflitos resolvidos automaticamente**: % de conflitos sem intervenção (meta: >95%)

### Métricas de Valor
- **Redução de tempo de report**: Tempo economizado em comunicação de status (meta: -50%)
- **Visibilidade de stakeholders**: # de visualizações no ClickUp por sprint
- **NPS de desenvolvedores**: Satisfação com a integração (meta: >7)

## 9. Dependências

### Dependências Técnicas
- **ClickUp API v2**: Documentação em https://developer.clickup.com/docs
- **Node.js fetch/axios**: Para requisições HTTP
- **dotenv**: Para gerenciamento de variáveis de ambiente (já existe no projeto)
- **fs-extra**: Para operações de arquivo (já existe no projeto)
- **keytar** (opcional): Para armazenamento seguro de credenciais no OS

### Dependências de Projeto
- **Estrutura ADK existente**: Sistema de features, progress.ts, memory
- **CLI Commander.js**: Para novos comandos
- **Inquirer**: Para prompts interativos de configuração
- **Ora**: Para indicadores de progresso durante sync

### Dependências Externas
- **Conta ClickUp**: Usuário precisa ter conta (gratuita disponível)
- **API Token**: Gerado pelo usuário no ClickUp
- **Workspace/Space existente**: Usuário precisa criar estrutura inicial no ClickUp

## 10. Timeline (Sugestão)

### Fase 1: Fundação (Core)
**Objetivo**: Infraestrutura básica e autenticação
- Arquitetura de providers (interface abstrata)
- Implementação ClickUp provider base
- Sistema de configuração de integração
- Autenticação via Personal Token
- Armazenamento seguro de credenciais
- Testes unitários de fundação

### Fase 2: Sincronização Básica
**Objetivo**: Criar e atualizar features no ClickUp
- Criação de feature → criação de item no ClickUp
- Atualização de status → atualização de status remoto
- Comando `adk feature sync`
- Comando `adk config integration`
- Mapeamento feature↔item
- Testes de integração

### Fase 3: Sincronização Avançada
**Objetivo**: Tasks, progresso e custom fields
- Sincronização de tasks como subtasks
- Custom fields para fase e progresso
- Cálculo automático de % completude
- Update de descrição com PRD
- Comentários automáticos em mudanças

### Fase 4: Robustez
**Objetivo**: Modo offline, conflitos e UX
- Queue de operações offline
- Detecção e resolução de conflitos
- Retry com exponential backoff
- Mensagens de erro amigáveis
- Logs detalhados para debugging
- Documentação completa

### Fase 5: Extras
**Objetivo**: Features adicionais de valor
- Importação de projetos existentes
- Comando `adk status --remote`
- Integração com `adk report`
- Métricas de velocity/lead time
- Dashboard de sync status

---

## Anexos

### A. Estrutura de Arquivos Proposta

```
src/
├── providers/
│   ├── index.ts              # Interface base e factory
│   ├── local.ts              # Provider local (atual)
│   ├── clickup/
│   │   ├── index.ts          # ClickUp provider
│   │   ├── client.ts         # HTTP client para API
│   │   ├── mapper.ts         # Mapeamento ADK↔ClickUp
│   │   └── types.ts          # Tipos TypeScript
│   └── types.ts              # Tipos compartilhados
├── utils/
│   ├── sync.ts               # Lógica de sincronização
│   ├── queue.ts              # Queue offline
│   └── config.ts             # Gerenciamento de config
└── commands/
    ├── config.ts             # Comando config (novo)
    └── sync.ts               # Comando sync (novo)
```

### B. Exemplo de Configuração

```json
// .adk/config.json (não versionado)
{
  "integration": {
    "provider": "clickup",
    "enabled": true,
    "autoSync": true
  },
  "clickup": {
    "workspaceId": "123456",
    "spaceId": "789012",
    "defaultListId": "345678",
    "mapping": "feature-as-task"
  }
}
```

```bash
# .env (não versionado)
CLICKUP_API_TOKEN=pk_12345678_XXXXXXXXXXXXXXXXXXXX
```

### C. Exemplo de Metadata Local

```markdown
<!-- .claude/plans/features/my-feature/sync.md -->
# Sync Metadata

- **Provider**: clickup
- **Remote ID**: abc123xyz
- **Remote URL**: https://app.clickup.com/t/abc123xyz
- **Last Synced**: 2026-01-16T10:30:00Z
- **Sync Status**: synced | pending | conflict
- **Pending Changes**: []
```

### D. Endpoints ClickUp Principais

| Operação | Endpoint | Método |
|----------|----------|--------|
| Listar Workspaces | /v2/team | GET |
| Listar Spaces | /v2/team/{team_id}/space | GET |
| Listar Lists | /v2/folder/{folder_id}/list | GET |
| Criar Task | /v2/list/{list_id}/task | POST |
| Atualizar Task | /v2/task/{task_id} | PUT |
| Obter Task | /v2/task/{task_id} | GET |
| Criar Subtask | /v2/list/{list_id}/task (com parent) | POST |
| Custom Fields | /v2/task/{task_id}/field/{field_id} | POST |
| Listar Custom Fields | /v2/list/{list_id}/field | GET |
