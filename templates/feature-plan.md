# Feature Implementation Plan: [Feature Name]

**Based on PRD:** [link]
**Tasks:** [link]
**Start Date:** YYYY-MM-DD
**Target Date:** YYYY-MM-DD

---

## Phase 0: Research & Context

### Objectives
- Entender estado atual do sistema
- Identificar componentes relacionados
- Listar dependências e riscos

### Claude Code Workflow

```bash
# Step 1: Context Loading
adk feature research [feature-name]

# Step 2: Plan Creation
adk feature plan [feature-name]
```

---

## Phase 1: Foundation

### Objectives
- Setup base structure
- Database schemas
- Core models
- Basic services

### Tasks
1. Database setup e migrations
2. Domain models com TDD
3. Repository layer
4. Basic service layer

### Validation
- [ ] Migrations executam sem erro
- [ ] Models testados (100% coverage)
- [ ] Repository CRUD funcional

---

## Phase 2: Business Logic

### Objectives
- Core service layer
- Business rules implementation
- Use cases

### Tasks
1. Implementar business rules
2. Service layer completo
3. Error handling
4. Logging

### Validation
- [ ] Todas business rules implementadas
- [ ] Testes cobrem edge cases
- [ ] Error handling robusto

---

## Phase 3: API Layer

### Objectives
- REST endpoints
- Validation
- Error handling
- Documentation

### Tasks
1. Controllers
2. Routes
3. Validation (Joi/Zod)
4. OpenAPI documentation

### Validation
- [ ] Endpoints funcionam conforme spec
- [ ] Validation completa
- [ ] OpenAPI docs geradas
- [ ] E2E tests passam

---

## Phase 4: Integration & Testing

### Objectives
- Integration tests
- E2E tests
- Performance tests
- Security audit

### Tasks
1. Integration tests completos
2. E2E test suite
3. Load tests (k6/artillery)
4. Security audit

### Validation
- [ ] Coverage >= 80% all layers
- [ ] Performance targets met
- [ ] Security audit passed
- [ ] No critical vulnerabilities

---

## Phase 5: Documentation

### Objectives
- Complete documentation
- User guides
- Developer docs
- Runbook

### Tasks
1. API documentation
2. User guide
3. Developer guide
4. Deployment runbook

### Validation
- [ ] Docs completos e atualizados
- [ ] Code examples funcionam
- [ ] Runbook testado

---

## Phase 6: Pre-deployment

### Checklist

Run: `adk workflow pre-deploy [feature-name]`

- [ ] All tests passing
- [ ] Coverage >= 80%
- [ ] Lint/format clean
- [ ] Security audit passed
- [ ] Performance tests passed
- [ ] Documentation complete
- [ ] Feature flag configured
- [ ] Rollback plan ready
- [ ] Monitoring configured

---

## Phase 7: Deployment

### Strategy

```bash
# Staging
adk deploy staging [feature-name]

# Production (gradual)
adk deploy production [feature-name] --percentage 10

# Monitor, then increase
adk deploy production [feature-name] --percentage 50

# Full rollout
adk deploy production [feature-name] --percentage 100
```

### Monitoring
- Error rates
- Latencies (p50, p95, p99)
- Throughput
- Business metrics

### Rollback
```bash
# Se necessário
adk deploy rollback [feature-name]
```

---

## Success Metrics

### Week 1
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Adoption Rate | 60% | __% | 🔄 |
| Error Rate | <0.5% | __% | 🔄 |
| p95 Latency | <100ms | __ms | 🔄 |

### Week 4
[Mesma estrutura]

---

## Lessons Learned

**What went well:**
- [Preencher após conclusão]

**What could be improved:**
- [Preencher após conclusão]

**Action items for next feature:**
- [Preencher após conclusão]
