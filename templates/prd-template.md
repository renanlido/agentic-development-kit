# PRD: [Nome da Feature]

**Status:** Draft | Review | Approved | In Development | Shipped
**Owner:** [Nome]
**Created:** YYYY-MM-DD
**Last Updated:** YYYY-MM-DD

---

## 1. Contexto e Problema

### 1.1 Situação Atual
[Descreva o estado atual do sistema/produto]

### 1.2 Problema a Resolver
[Qual problema específico esta feature resolve?]

### 1.3 Por Que Agora?
[Justificativa de timing e prioridade]

---

## 2. Objetivos

### 2.1 Objetivo Principal
[Objetivo mensurável principal]

### 2.2 Objetivos Secundários
- [ ] Objetivo 1
- [ ] Objetivo 2
- [ ] Objetivo 3

### 2.3 Non-Goals (Fora do Escopo)
- O que NÃO será feito nesta versão
- Features deixadas para futuro

---

## 3. Métricas de Sucesso

| Métrica | Baseline | Target | Como Medir |
|---------|----------|--------|------------|
| [ex: Response Time] | 500ms | <100ms | APM |
| [ex: Adoption Rate] | 0% | 60% | Analytics |
| [ex: Error Rate] | 2% | <0.5% | Logs |

---

## 4. Requisitos Funcionais

### 4.1 User Stories

**US-01: Como [tipo de usuário], quero [ação], para [benefício]**
```
Dado: [contexto inicial]
Quando: [ação do usuário]
Então: [resultado esperado]
```

### 4.2 Fluxos

```
Fluxo Happy Path:
1. Usuário faz X
2. Sistema valida Y
3. Sistema retorna Z

Fluxos Alternativos:
- Se erro A, então B
- Se condição C, então D
```

### 4.3 Business Rules

| ID | Regra | Prioridade |
|----|-------|------------|
| BR-01 | [Descrição da regra] | Must Have |
| BR-02 | [Descrição da regra] | Should Have |

---

## 5. Requisitos Não-Funcionais

### 5.1 Performance
- Response time: < 100ms (p95)
- Throughput: >= 1000 req/s
- Concurrent users: >= 10k

### 5.2 Segurança
- [ ] Autenticação obrigatória
- [ ] Rate limiting
- [ ] Input validation
- [ ] SQL injection protection
- [ ] XSS protection

### 5.3 Disponibilidade
- Uptime: 99.9%
- Recovery Time: < 5min
- Backup: Diário

### 5.4 Escalabilidade
- Horizontal scaling ready
- Stateless services
- Cache strategy

---

## 6. Design Técnico

### 6.1 Arquitetura

```
[Diagrama de componentes]

Components:
- API Gateway
- Service Layer
- Data Layer
- Cache Layer
```

### 6.2 Data Model

```sql
-- Principais entidades
CREATE TABLE feature_x (
    id UUID PRIMARY KEY,
    ...
);
```

### 6.3 APIs

**Endpoint 1: POST /api/v1/resource**
```json
Request:
{
  "field": "value"
}

Response 200:
{
  "id": "uuid",
  "status": "success"
}

Response 400:
{
  "error": "validation_error",
  "details": []
}
```

### 6.4 Dependências

| Dependência | Versão | Motivo |
|-------------|--------|--------|
| redis | ^7.0 | Caching |
| express | ^4.18 | HTTP Server |

---

## 7. Plano de Implementação

### 7.1 Fases

**Fase 1: Foundation (Sprint 1)**
- [ ] Setup infraestrutura
- [ ] Data model
- [ ] Core services

**Fase 2: Core Feature (Sprint 2)**
- [ ] Implementação principal
- [ ] Testes unitários
- [ ] Testes integração

**Fase 3: Polish (Sprint 3)**
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deploy

### 7.2 Riscos e Mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Performance issues | Medium | High | Load testing early |
| Breaking changes | Low | High | Feature flag |

---

## 8. Rollout Strategy

### 8.1 Feature Flag
```
feature_x: {
  enabled: true,
  rollout_percentage: 10
}
```

### 8.2 Fases de Rollout
1. Internal testing (100% dev team)
2. Beta users (10% users)
3. Gradual rollout (10% → 50% → 100%)
4. Full release

### 8.3 Rollback Plan
[Como reverter se algo der errado]

---

## 9. Documentação

### 9.1 User Documentation
- [ ] User guide
- [ ] FAQ
- [ ] Video tutorial

### 9.2 Developer Documentation
- [ ] API docs
- [ ] Architecture docs
- [ ] Runbook

---

## 10. Aprovações

| Stakeholder | Role | Status | Date |
|-------------|------|--------|------|
| [Nome] | Product | ⏳ | - |
| [Nome] | Engineering | ⏳ | - |
| [Nome] | Security | ⏳ | - |

---

## 11. Changelog

| Date | Author | Change |
|------|--------|--------|
| YYYY-MM-DD | [Nome] | Initial draft |
