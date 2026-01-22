# MCP Memory System

Semantic memory system using MCP (Model Context Protocol) for RAG capabilities and intelligent context retrieval.

## Architecture

| Component | Purpose |
|-----------|---------|
| `memory-mcp.ts` | MCP wrapper, `index()` and `recall()` methods |
| `memory-config.ts` | Config from `.adk/memory-config.json` |
| `memory-index-queue.ts` | Debounced queue (2s) for batch indexing |
| `post-write-index.sh` | Hook for auto-indexation of `.claude/**/*.md` |

## CLI Commands

```bash
# Index
adk memory index <file>                 # Single file
adk memory index --tags auth,security   # With tags
adk memory index --feature my-feature   # Associate with feature

# Recall
adk memory recall "query"               # Search
adk memory recall "auth" --limit 10     # Limit results
adk memory recall "api" --threshold 0.8 # Filter by similarity

# Queue
adk memory queue <file>                 # Enqueue for indexation
adk memory process-queue                # Process immediately
```

## Configuration

**Environment:**
```bash
MEMORY_PROVIDER=mcp
MEMORY_MCP_SERVER_PATH=/path/to/server
MEMORY_LOCAL_PATH=.claude/memory
```

**File:** `.adk/memory-config.json`
```json
{
  "version": "1.0.0",
  "provider": "mcp-memory",
  "storage": { "path": ".adk/memory.db", "maxSize": "500MB" },
  "embedding": { "model": "nomic-embed-text-v1.5", "chunkSize": 512 },
  "retrieval": { "topK": 10, "finalK": 5, "threshold": 0.65 },
  "hybridSearch": { "enabled": true, "weights": { "semantic": 0.7, "keyword": 0.3 } },
  "indexPatterns": [".claude/**/*.md"],
  "ignorePatterns": ["**/.env*", "**/credentials*", "**/*.key"]
}
```

## Types

```typescript
interface MemoryDocument {
  id: string
  content: string
  score: number
  metadata: { source: string; tags?: string[]; feature?: string }
}

interface MemoryResult {
  documents: MemoryDocument[]
  timings?: { total: number; embedding?: number; search?: number }
  meta: { provider: string; query: string; mode: 'hybrid' | 'semantic' }
}
```

## Performance

| Operation | Time |
|-----------|------|
| Index single file | ~100-300ms |
| Index 10 files | ~1-3s |
| Recall query | ~50-200ms |
| Queue processing | ~2s debounce |

## Usage Patterns

**Automatic (recommended):** Hook system auto-indexes `.claude/**/*.md` files on write.

**Manual:** `adk memory index <file>` for explicit control.

**Search:** `adk memory recall "authentication patterns" --threshold 0.7`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Files not indexed | Check hook executable: `chmod +x .claude/hooks/post-write-index.sh` |
| No recall results | Try `--threshold 0.5` or verify files were indexed |
| Queue stuck | Run `adk memory process-queue` manually |

## Provider Fallback

Falls back from MCP to local storage when:
- MCP server not configured
- Connection fails
- Server path invalid
