# Changelog: ADK v2

## [Fase 0] - 2026-01-21 - Enforcement Hooks ✅

### Added

**Hooks:**
- `session-bootstrap.sh` - SessionStart hook for context injection
- `session-checkpoint.sh` - Stop hook for automatic snapshots
- `validate-tdd.sh` - PreToolUse hook for TDD reminders
- `sync-state.sh` - PostToolUse hook for state synchronization

**Configuration:**
- Updated `.claude/settings.json` with 4 new hooks
- Registered hooks for SessionStart, Stop, PreToolUse, PostToolUse events

**Templates:**
- Copied hooks to `templates/claude-structure/hooks/` for `adk init`
- Updated `templates/claude-structure/settings.json` with new hooks
- Created `templates/claude-structure/hooks/README.md`

**Documentation:**
- Created `.claude/plans/features/adk-v2/README.md` (feature guide)
- Updated `CLAUDE.md` with "ADK v2: Enforcement Hooks" section
- Documented design principles: fail-silent, fast, defensive, non-blocking

### Changed

**Behavior:**
- Claude Code now automatically receives feature context on session start
- Snapshots created automatically when session ends
- TDD warnings displayed when creating src/ files without tests
- File modifications tracked automatically in progress.md and state.json

### Technical Details

**Hook Performance:**
- session-bootstrap.sh: ~30ms
- session-checkpoint.sh: ~50ms
- validate-tdd.sh: ~10ms
- sync-state.sh: ~20ms

**Test Coverage:**
- Fase 0: Manual testing (shell scripts)
- Overall project: 97%+ (1242 tests passing)

### Impact

**Before Fase 0:**
- Context manually specified each session
- Easy to forget which feature is active
- No automatic recovery points
- Manual state sync required

**After Fase 0:**
- Context automatically injected every session
- TDD reminders on every src/ file creation
- Snapshots created every session end
- State synchronized automatically on every write

---

## [Fase 1] - Planned - MCP Memory RAG

**Status:** Tasks defined (1.1-1.11), awaiting benchmark of MCP providers

### Planned Features

- Semantic search via embeddings
- Commands: `adk memory index`, `adk memory recall`
- Automatic indexing via post-write hook
- Hybrid search (semantic + keyword)
- Cross-language query support (auth → autenticacao)

---

## [Fase 2] - Planned - Session Management

**Status:** Tasks defined (2.1-2.10)

### Planned Features

- `StateManager.resumeFromSnapshot()`
- Flag `--resume` in `adk agent run`
- Template `claude-progress.txt` (plain text)
- Command `adk agent sessions <feature>`

---

## [Fase 3] - Planned - Context Compactor

**Status:** Tasks defined (3.1-3.10)

### Planned Features

- Token counting via Anthropic API (95%+ accuracy)
- Hierarchical compaction: raw → reversible → summarization
- Handoff document generator (plain text)
- Integration with MCP Memory for archiving

---

## [Fase 4] - Planned - Constitution/Steering

**Status:** Tasks defined (4.1-4.9)

### Planned Features

- Template `constitution.md` (immutable principles)
- Directory `.claude/context/` (mutable context)
- Powers pattern for dynamic context loading
- Command `adk validate` (validate against constitution)

---

## [Fase 5] - Planned - Git Commits as Checkpoints

**Status:** Tasks defined (5.1-5.8)

### Planned Features

- Hook `task-complete.sh` (atomic commits per task)
- Hook `check-task-complete.sh` (detect task completion)
- `StateManager.completeTask()`
- Flag `--commit` in `adk feature implement`

---

## [Fase 6] - Planned - Resilience & Observability

**Status:** Tasks defined (6.1-6.11)

### Planned Features

- Circuit breaker pattern (5 failures → open, 1 min timeout)
- Retry with jitter (exponential backoff)
- Memory pruner (max 500 lines in project-context.md)
- Command `adk diagnostics` (health check)
- Integration with Arize Phoenix (observability)

---

**Total Progress:** 1/6 phases complete (17%)
**Next Up:** Fase 1 - MCP Memory RAG benchmark
