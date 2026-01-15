# Task Breakdown: [Feature Name]

**PRD:** Link para PRD
**Epic:** JIRA-XXX (se aplicável)
**Sprint:** Sprint XX
**Created:** YYYY-MM-DD

---

## Task Hierarchy

```
Epic: [Feature Name]
├── Story 1: Foundation
│   ├── Task 1.1: Setup database
│   ├── Task 1.2: Create models
│   └── Task 1.3: Write migrations
├── Story 2: API Layer
│   ├── Task 2.1: Create endpoints
│   ├── Task 2.2: Validation middleware
│   └── Task 2.3: Error handling
└── Story 3: Testing
    ├── Task 3.1: Unit tests
    ├── Task 3.2: Integration tests
    └── Task 3.3: E2E tests
```

---

## Detailed Tasks

### Story 1: Foundation

#### Task 1.1: [Task Name]
**Type:** Technical | Feature | Bug | **Story Points:** X | **Priority:** P0-P4

**Description:**
[Descrição detalhada da task]

**Acceptance Criteria:**
- [ ] Critério 1
- [ ] Critério 2
- [ ] Critério 3

**Technical Details:**
```
[Código, queries, ou especificações técnicas]
```

**Dependencies:**
- Task X.Y
- External API Z

**Estimate:** X hours

**Claude Code Prompt:**
```bash
claude "
Task: [Nome da task]

Context:
- [Contexto relevante]
- [Arquivos relacionados]

Requirements:
1. [Requisito 1]
2. [Requisito 2]

Validação:
- [Como validar]
"
```

---

## Task Tracking

### Sprint Board

| Status | Task ID | Task Name | Assignee | SP | Priority |
|--------|---------|-----------|----------|----|----|
| Todo | 1.1 | Setup Database | - | 3 | P0 |
| In Progress | 1.2 | Domain Models | - | 2 | P0 |
| Done | 1.3 | Migrations | - | 1 | P0 |

### Burndown

```
Story Points Remaining:
Day 1: 20
Day 2: 18
Day 3: 15
...
```

---

## Daily Stand-up Template

**What was done yesterday:**
- [Task completada]
- [Progresso em task X]

**What will be done today:**
- [Task a iniciar]
- [Task a continuar]

**Blockers:**
- None / [Describe blocker]

---

## Definition of Done

Para uma task ser considerada "Done":

- [ ] Código implementado
- [ ] Unit tests escritos (coverage >= 80%)
- [ ] Integration tests (se aplicável)
- [ ] Code review aprovado
- [ ] Documentação atualizada
- [ ] Lint/format passou
- [ ] CI pipeline verde
- [ ] Deployed to dev environment
- [ ] Acceptance criteria validados

---

## Retrospective Notes

**O que funcionou bem:**
- [Preencher após sprint]

**O que pode melhorar:**
- [Preencher após sprint]

**Action items:**
- [Preencher após sprint]
