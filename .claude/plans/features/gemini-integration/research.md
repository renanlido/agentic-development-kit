# Research: gemini-integration

**Data**: 2026-01-28
**Status**: Research Complete
**Feature**: Multi AI Provider Support (gemini-integration)

---

## Current State Analysis

### How Claude Integration Works Today

The ADK currently has a single-provider architecture centered on Claude CLI:

1. **Entry Point**: `src/utils/claude.ts` exports `executeClaudeCommand()` which is the primary execution interface
2. **Execution Modes**:
   - **Interactive Mode**: Uses `spawnSync` with stdin, streams output to console directly
   - **Headless Mode**: Uses `spawn` with `--output-format stream-json`, parses NDJSON events
3. **Stream Parsing**: `src/utils/stream-parser.ts` handles NDJSON event parsing with real-time formatted display
4. **Model Routing**: `src/utils/model-router.ts` maps phases (research, implement, qa) to models (opus, sonnet, haiku)

**Current Execution Flow**:
```
CLI Command → getModelForPhase() → executeClaudeCommand() → spawn('claude', args)
                                              ↓
                               parseAndDisplayStream() ← readline on stdout
                                              ↓
                               getCollectedMetrics() → return result
```

### Claude CLI Flags Currently Used

```bash
claude -p "prompt"                    # Prompt mode (stdin)
claude --model opus|sonnet|haiku      # Model selection
claude --output-format stream-json    # Streaming JSON output
claude --dangerously-skip-permissions # Skip safety confirmations
claude --verbose                      # Detailed logging
```

---

## Similar Components

### 1. Project Provider Pattern (src/providers/)

The codebase already has a robust provider abstraction for **project management platforms**:

```typescript
export interface ProjectProvider {
  readonly name: string
  readonly displayName: string

  isConfigured(): Promise<boolean>
  testConnection(): Promise<ProviderConnectionResult>
  connect(credentials: ProviderCredentials): Promise<ProviderConnectionResult>
  disconnect(): Promise<void>

  createFeature(feature: LocalFeature): Promise<RemoteFeature>
  updateFeature(remoteId: string, feature: Partial<LocalFeature>): Promise<RemoteFeature>
  syncFeature(feature: LocalFeature, remoteId?: string): Promise<SyncResult>
}
```

**Registry Pattern** (`src/providers/index.ts`):
```typescript
class ProviderRegistryImpl implements ProviderRegistry {
  private providers = new Map<string, ProjectProvider>()

  register(provider: ProjectProvider): void
  get(name: string): ProjectProvider | undefined
  getAll(): ProjectProvider[]
  getConfigured(): Promise<ProjectProvider | undefined>
}
```

**This pattern should be directly adapted for AI providers.**

### 2. Model Routing System (src/utils/model-router.ts)

Phase-based model selection with configuration override support:

```typescript
export function getModelForPhase(phase: PhaseType, override?: ModelType): ModelType {
  // Priority: CLI override > config per phase > default mapping
}
```

Current `PhaseModelMapping`:
```typescript
const DEFAULT_MODEL_MAPPING = {
  research: 'opus',    // High tier
  planning: 'opus',    // High tier
  prd: 'opus',         // High tier
  implement: 'sonnet', // Medium tier
  qa: 'haiku',         // Low tier
  validation: 'haiku', // Low tier
  docs: 'sonnet',      // Medium tier
  default: 'sonnet'    // Medium tier
}
```

### 3. Configuration System (src/utils/config.ts)

Hierarchical configuration with merge strategy:

```typescript
export interface AdkConfig {
  version: string
  integration: IntegrationConfig
  providers: Record<string, ProviderSpecificConfig>
  hooks?: HooksConfig
  modelRouting?: ModelRoutingConfig
  compaction?: CompactionConfig
}
```

**Priority**: CLI Flag > Env Var > Project Config > Global Config > Defaults

### 4. Metrics Collection (src/types/parallel.ts)

Standardized metrics interface:

```typescript
export interface CollectedMetrics {
  toolCount: number
  tokenCount: number
  durationMs: number
  costUsd?: number
}
```

---

## Technical Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Runtime | Node.js | >= 18.0.0 |
| Language | TypeScript | ^5.3.3 |
| CLI Framework | Commander.js | ^14.0.2 |
| Spinners | Ora | ^9.0.0 |
| Styling | Chalk | ^5.6.2 |
| File System | fs-extra | ^11.3.3 |
| Interactive Prompts | Inquirer | ^13.2.0 |
| Schema Validation | Zod | ^4.3.5 |
| Token Counting | tiktoken | ^1.0.22 |
| Linting/Formatting | Biome | ^2.3.11 |

---

## Files to Create

### Core AI Provider Abstraction

- [ ] `src/ai-providers/types.ts` - Core interfaces (AIProvider, AIProviderOptions, AIProviderResult, AIProviderModel)
- [ ] `src/ai-providers/index.ts` - AIProviderRegistry, getAIProvider(), registerAIProvider(), getConfiguredAIProvider()
- [ ] `src/ai-providers/base-provider.ts` - BaseAIProvider abstract class with common functionality

### Provider Implementations

- [ ] `src/ai-providers/claude-provider.ts` - ClaudeProvider class implementing AIProvider
- [ ] `src/ai-providers/gemini-provider.ts` - GeminiProvider class implementing AIProvider

### Stream Parsers

- [ ] `src/ai-providers/stream-parsers/types.ts` - StreamEvent interface, ParsedOutput
- [ ] `src/ai-providers/stream-parsers/base-parser.ts` - BaseStreamParser abstract class
- [ ] `src/ai-providers/stream-parsers/claude-parser.ts` - ClaudeStreamParser (extract from stream-parser.ts)
- [ ] `src/ai-providers/stream-parsers/gemini-parser.ts` - GeminiStreamParser

### Type Exports

- [ ] `src/types/ai-provider.ts` - Re-export types for external use

### Tests

- [ ] `tests/ai-providers/claude-provider.test.ts`
- [ ] `tests/ai-providers/gemini-provider.test.ts`
- [ ] `tests/ai-providers/registry.test.ts`
- [ ] `tests/ai-providers/stream-parsers/claude-parser.test.ts`
- [ ] `tests/ai-providers/stream-parsers/gemini-parser.test.ts`

---

## Files to Modify

### Core Integration

| File | Change | Impact |
|------|--------|--------|
| `src/utils/claude.ts` | Add deprecation notice, proxy to new system | Low - Retrocompatibility |
| `src/utils/stream-parser.ts` | Extract Claude-specific logic to parser | Medium - Refactor |
| `src/utils/model-router.ts` | Add provider-aware tier mapping | Medium - Extension |

### Configuration

| File | Change | Impact |
|------|--------|--------|
| `src/providers/types.ts` | Add AIProviderConfig interface | Low - Addition |
| `src/utils/config.ts` | Add aiProvider config loading/saving | Low - Extension |

### CLI Commands

| File | Change | Impact |
|------|--------|--------|
| `src/cli.ts` | Add --provider and --model flags globally | Medium - All commands |
| `src/commands/feature.ts` | Use provider abstraction | Medium - Core command |
| `src/commands/agent.ts` | Use provider abstraction | Low - Simple command |
| `src/commands/workflow.ts` | Use provider abstraction | Low - Uses executeClaudeCommand |
| `src/commands/config.ts` | Add `adk config providers` subcommand | Low - New command |

### Types

| File | Change | Impact |
|------|--------|--------|
| `src/types/model.ts` | Add AIProviderName type, extend PhaseModelMapping | Low - Type additions |

---

## Dependencies

### External (NPM packages)

| Package | Purpose | Status |
|---------|---------|--------|
| `@anthropic-ai/sdk` | Claude SDK (already installed, may not be directly used) | ✅ Existing |
| `gemini-cli` | Gemini CLI binary | ⏳ Not a dependency, installed globally |

**Note**: Both Claude and Gemini CLIs are installed globally, not as npm dependencies. The ADK spawns them as child processes.

### Internal (ADK modules)

| Module | Dependency For |
|--------|---------------|
| `src/utils/logger.ts` | All providers (logging) |
| `src/types/parallel.ts` | CollectedMetrics interface |
| `src/utils/config.ts` | Configuration loading |
| `src/utils/git-paths.ts` | Working directory resolution |

---

## Risks

### Risk 1: Stream JSON Format Differences
**Description**: Claude and Gemini may have different NDJSON event structures
**Probability**: High
**Impact**: Medium
**Mitigation**: Provider-specific stream parsers with normalization layer

**Claude Stream Event Structure**:
```typescript
interface ClaudeStreamEvent {
  type: 'system' | 'assistant' | 'user' | 'result'
  subtype?: string
  message?: { content: StreamEventContent[] }
  session_id?: string
  duration_ms?: number
  num_turns?: number
  total_cost_usd?: number
}
```

**Gemini Stream Event Structure** (based on documentation):
```typescript
interface GeminiStreamEvent {
  type: 'init' | 'message' | 'tool_use' | 'tool_result' | 'error' | 'result'
  timestamp: string
  session_id?: string
  // Additional fields per event type
}
```

### Risk 2: Gemini CLI Not Installed
**Description**: Users may not have Gemini CLI installed
**Probability**: High (initially)
**Impact**: Low
**Mitigation**:
- Graceful fallback to Claude (default provider)
- Clear installation instructions via `getInstallationGuide()`
- `isInstalled()` check before execution

### Risk 3: Rate Limits on Gemini Free Tier
**Description**: 60 requests/min, 1000 requests/day limits
**Probability**: Medium (for heavy users)
**Impact**: Medium
**Mitigation**:
- Auto-fallback to Claude when rate limited
- Exponential backoff retry strategy
- Clear error messages about limits

### Risk 4: Behavioral Differences Between Models
**Description**: Same prompts may yield different results across providers
**Probability**: High
**Impact**: High
**Mitigation**:
- Extensive integration testing comparing outputs
- Consider provider-specific prompt adaptations (future)
- Documentation about expected differences

### Risk 5: Breaking Changes in CLI APIs
**Description**: Claude or Gemini CLI updates may break parsing
**Probability**: Low
**Impact**: High
**Mitigation**:
- Provider versioning support
- Integration tests in CI
- Quick patch release process

---

## Patterns to Follow

### 1. Provider Registry Pattern

From `src/providers/index.ts`:
```typescript
class ProviderRegistryImpl {
  private providers = new Map<string, Provider>()
  register(provider): void
  get(name: string): Provider | undefined
  getConfigured(): Promise<Provider | undefined>
}
```

### 2. Configuration Merge Pattern

From `src/utils/config.ts`:
```typescript
function mergeWithDefaults(config: Partial<Config>): Config {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    nested: { ...DEFAULT_CONFIG.nested, ...config.nested }
  }
}
```

### 3. Error Handling Pattern

```typescript
const spinner = ora('Executing...').start()
try {
  // ... execution
  spinner.succeed('Done')
} catch (error) {
  spinner.fail('Failed')
  logger.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
```

### 4. CLI Option Pattern

From `src/cli.ts`:
```typescript
feature
  .command('research <name>')
  .option('-m, --model <model>', 'Model override')
  .option('--headless', 'Headless mode')
  .option('--provider <provider>', 'AI Provider (claude, gemini)')  // NEW
  .action((name, options) => featureCommand.research(name, options))
```

### 5. Stream Parsing Pattern

From `src/utils/stream-parser.ts`:
```typescript
export function parseAndDisplayStream(line: string): void {
  try {
    const event = JSON.parse(line)
    displayEvent(event)
  } catch {
    // Ignore invalid JSON lines
  }
}
```

---

## Performance Considerations

### 1. Installation Check Caching
**Current**: `isClaudeInstalled()` runs `which claude` every time
**Improvement**: Cache result per session to avoid repeated shell calls

```typescript
let installedCache: Map<string, boolean> | null = null

function isInstalled(provider: string): boolean {
  if (!installedCache) installedCache = new Map()
  if (!installedCache.has(provider)) {
    installedCache.set(provider, checkInstallation(provider))
  }
  return installedCache.get(provider)!
}
```

### 2. Stream Processing Overhead
**Requirement**: < 50ms overhead per execution (RNF01 from PRD)
**Strategy**:
- Use readline interface for line-by-line NDJSON parsing (already implemented)
- Avoid buffering entire output in memory
- Process events immediately as they arrive

### 3. Fallback Detection Speed
**Requirement**: Fallback in < 2 seconds (RNF04 from PRD)
**Strategy**:
- Detect CLI errors early via stderr monitoring
- Use process timeout with Promise.race
- Pre-check provider availability before long operations

### 4. Configuration Loading
**Current**: Sync file reads for config
**Improvement**: Already uses async `fs.pathExists` and `fs.readJson`

---

## Security Considerations

### 1. API Key Protection
**RNF13**: API keys must NEVER be logged
**Implementation**:
- Sanitize config before logging/saving
- Use environment variables for sensitive credentials
- Never include keys in error messages

### 2. Permission Flags
**RNF15**: Dangerous flags must be explicitly opt-in
**Implementation**:
- `--dangerously-skip-permissions` is already required explicitly
- Document the implications clearly
- Consider per-provider permission handling

### 3. Command Injection Prevention
**Implementation**:
- Use array-based `spawn()` arguments (already done)
- Never interpolate user input into shell commands
- Validate model names against whitelist

### 4. Secure Configuration Storage
**Implementation**:
- Config files stored in project directory (`.adk/config.json`)
- Tokens/secrets filtered from saved config (already implemented)
- Support for environment variable references

---

## Gemini CLI Stream Format Details

Based on web research ([GitHub Issue #8203](https://github.com/google-gemini/gemini-cli/issues/8203), [Headless Docs](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md)):

### Event Types

| Event | Purpose | Key Fields |
|-------|---------|------------|
| `init` | Session start | session_id, model |
| `message` | User/assistant messages | role, content |
| `tool_use` | Tool call request | name, parameters |
| `tool_result` | Tool execution result | success/error, output |
| `error` | Non-fatal errors | message, code |
| `result` | Final summary | duration, tokens, tool_calls |

### Gemini CLI Flags

```bash
gemini -p "prompt"                    # Prompt mode
gemini --model gemini-2.5-pro         # Model selection
gemini --output-format stream-json    # NDJSON streaming
gemini --include-directories dir1,dir2 # Include directories
gemini --sandbox                      # Sandbox mode (safe)
gemini --yolo                         # Skip confirmations (like --dangerously-skip-permissions)
```

### Model Mapping by Tier

| Tier | Claude | Gemini | Context |
|------|--------|--------|---------|
| High | opus | gemini-2.5-pro | 200K / 1M |
| Medium | sonnet | gemini-2.5-flash | 200K / 1M |
| Low | haiku | gemini-2.0-flash-lite | 200K / 1M |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         ADK Commands                             │
│            (feature, agent, workflow, config, etc.)              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Provider Abstraction                       │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  AIProviderRegistry                        │  │
│  │  - register(provider)                                      │  │
│  │  - get(name): AIProvider                                   │  │
│  │  - getConfigured(): AIProvider                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              ▼                               ▼                   │
│  ┌─────────────────────┐       ┌─────────────────────┐         │
│  │   ClaudeProvider    │       │   GeminiProvider    │         │
│  │   - isInstalled()   │       │   - isInstalled()   │         │
│  │   - execute()       │       │   - execute()       │         │
│  │   - executeHeadless │       │   - executeHeadless │         │
│  │   - mapModelTier()  │       │   - mapModelTier()  │         │
│  └──────────┬──────────┘       └──────────┬──────────┘         │
│             │                              │                     │
│             ▼                              ▼                     │
│  ┌─────────────────────┐       ┌─────────────────────┐         │
│  │ ClaudeStreamParser  │       │ GeminiStreamParser  │         │
│  │ - parse(line)       │       │ - parse(line)       │         │
│  │ - normalize()       │       │ - normalize()       │         │
│  └─────────────────────┘       └─────────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Configuration Layer                           │
│                                                                  │
│  Priority: CLI Flag > ENV > Project Config > Global > Default    │
│                                                                  │
│  AIProviderConfig {                                              │
│    default: 'claude' | 'gemini'                                  │
│    fallback?: 'claude' | 'gemini'                                │
│    autoFallback: boolean                                         │
│    preferFreeWhenAvailable: boolean                              │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases (from PRD)

### Phase 1: Foundation
- AIProvider interface
- BaseAIProvider abstract class
- AIProviderRegistry
- Unit tests for abstraction

### Phase 2: Claude Provider Refactor
- Extract ClaudeProvider from existing code
- ClaudeStreamParser extraction
- Proxy in `src/utils/claude.ts` for retrocompatibility
- Integration tests

### Phase 3: Gemini Provider
- GeminiProvider implementation
- GeminiStreamParser
- Installation detection
- Model tier mapping

### Phase 4: Integration
- CLI flags (`--provider`, `--model`)
- Configuration system extension
- Fallback mechanism
- Command updates

### Phase 5: Polish
- `adk config providers` command
- Documentation
- Metrics display
- End-to-end tests

---

## References

- [Gemini CLI - GitHub](https://github.com/google-gemini/gemini-cli)
- [Gemini CLI Stream JSON Issue #8203](https://github.com/google-gemini/gemini-cli/issues/8203)
- [Gemini CLI Headless Docs](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md)
- [Gemini CLI Configuration](https://github.com/google-gemini/gemini-cli/blob/main/docs/get-started/configuration.md)
- [ADK existing multi-ai-provider research](../../multi-ai-provider/research.md)

---

*Research completed: 2026-01-28*
