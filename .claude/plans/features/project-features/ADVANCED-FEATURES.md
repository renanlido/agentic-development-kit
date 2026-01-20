# Funcionalidades Avancadas do ADK

Este documento detalha as funcionalidades avancadas implementadas na feature project-features.

## Sistema de Memoria Hierarquica

O ADK implementa memoria em 4 niveis: Project > Feature > Phase > Session

### API Publica

src/utils/tiered-memory.ts
- loadMemoryHierarchy(feature?, phase?)
- flattenHierarchy(hierarchy)
- calculateFreshnessScore(updatedAt)
- SessionMemoryCache class

## Agentic RAG

Recuperacao dinamica de contexto baseada na task atual.

### API Publica

src/utils/dynamic-context.ts
- dynamicContextRetrieval(task, options?)
- extractKeywords(task)
- calculateRelevanceScore(content, keywords)
- ContextCache class

## Roteamento de Modelos

Selecao automatica do modelo Claude ideal para cada fase.

### API Publica

src/utils/model-router.ts
- getModelForPhase(phase, override?)
- getModelRouterConfig()
- setModelRouterConfig(config)
- resetModelRouterConfig()

## CDR - Cognitive Degradation Resilience

### Health Probes

src/utils/health-probes.ts
- HealthProbeManager class

### Retry com Backoff

src/utils/retry.ts
- withRetry(operation, config)

### Fallback Templates

src/utils/fallback-templates.ts
- executeWithFallback(operation, templatePath, phase)

### Recovery Checkpoints

src/utils/recovery.ts
- createCheckpoint(feature, phase)
- loadCheckpoint(id)
- listCheckpoints(feature)
- recoverFromCheckpoint(id)

## AI-on-AI Review

src/utils/ai-review.ts
- runPrimaryReview(feature)
- runSecondaryReview(feature)
- consolidateReviews(primary, secondary)

## Quality Gates

src/utils/quality-gates.ts
- calculateRiskScore(inputs)
- calculateConfidenceScore(inputs)
- extractConfidence(response)
- detectDebt(files)
- loadDebtRegistry(feature)
- addDebtItem(feature, item)
- resolveDebtItem(feature, itemId)
