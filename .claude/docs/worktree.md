# Worktree Symlink Architecture

ADK creates isolated worktrees for features. Each needs access to `.claude/` structure via symlinks.

## How It Works

`setupClaudeSymlink()` in `src/utils/worktree-utils.ts` creates **individual symlinks**:

```
.worktrees/feature-name/.claude/
├── agents → /main/repo/.claude/agents
├── skills → /main/repo/.claude/skills
├── commands → /main/repo/.claude/commands
├── hooks → /main/repo/.claude/hooks
├── rules → /main/repo/.claude/rules
├── memory → /main/repo/.claude/memory
├── plans → /main/repo/.claude/plans
├── templates → /main/repo/.claude/templates
├── scripts → /main/repo/.claude/scripts
├── settings.json → /main/repo/.claude/settings.json
└── README.md → /main/repo/.claude/README.md
```

## Adding New .claude/ Directories

**CRITICAL:** Update **TWO** places:

1. **`src/utils/worktree-utils.ts`** - Add to `subdirectoriesToLink`:
```typescript
const subdirectoriesToLink = [
  'agents', 'skills', // ...
  'your-new-directory',  // ← Add here
]
```

2. **`src/commands/init.ts`** - Add to `createCADDStructure()`:
```typescript
const dirs = [
  '.claude/memory', // ...
  '.claude/your-new-directory',  // ← Add here
]
```

## Why Individual Symlinks?

Original single symlink `.claude → /main/.claude` failed when main repo lacked subdirectories. Individual symlinks only link what exists.

## Testing

```bash
npm run build && npm run link

mkdir /tmp/test-adk && cd /tmp/test-adk
git init && echo "# Test" > README.md && git add . && git commit -m "init"
adk init -n test
adk feature new my-feature --no-sync

cd .worktrees/my-feature
ls -la .claude/skills  # Should show skills from main
```
