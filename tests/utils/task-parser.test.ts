import { describe, it, expect } from '@jest/globals'

describe('TaskParser', () => {
  describe('parseTasksFile', () => {
    it('should parse empty file and return empty TasksDocument', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = ''
      const result = parseTasksFile(content)

      expect(result).toEqual({
        tasks: [],
        acceptanceCriteria: [],
      })
    })

    it('should parse single task with pending status [ ]', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
## Tasks
- [ ] Implement feature X
`
      const result = parseTasksFile(content)

      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0]).toMatchObject({
        name: 'Implement feature X',
        status: 'pending',
      })
    })

    it('should parse task with completed status [x]', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
- [x] Completed task
`
      const result = parseTasksFile(content)

      expect(result.tasks[0].status).toBe('completed')
    })

    it('should parse task with in_progress status [~]', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
- [~] In progress task
`
      const result = parseTasksFile(content)

      expect(result.tasks[0].status).toBe('in_progress')
    })

    it('should parse task with blocked status [!]', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
- [!] Blocked task
`
      const result = parseTasksFile(content)

      expect(result.tasks[0].status).toBe('blocked')
    })

    it('should extract P0, P1, P2 priorities', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
- [ ] P0: Critical task
- [ ] P1: Important task
- [ ] P2: Nice to have
- [ ] No priority task
`
      const result = parseTasksFile(content)

      expect(result.tasks[0].priority).toBe(0)
      expect(result.tasks[1].priority).toBe(1)
      expect(result.tasks[2].priority).toBe(2)
      expect(result.tasks[3].priority).toBeUndefined()
    })

    it('should handle malformed lines gracefully', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
This is not a task
- Not a checkbox
[ ] Missing dash
- [ Missing bracket
Random text
- [x] Valid task
`
      const result = parseTasksFile(content)

      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].name).toBe('Valid task')
    })

    it('should parse nested subtasks', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
- [ ] Parent task
  - [ ] Subtask 1
  - [ ] Subtask 2
    - [ ] Sub-subtask
`
      const result = parseTasksFile(content)

      expect(result.tasks).toHaveLength(4)
      expect(result.tasks[0].name).toContain('Parent task')
      expect(result.tasks[1].name).toContain('Subtask 1')
    })

    it('should parse multiple tasks with mixed statuses', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
## Phase 1: Setup
- [x] P0: Initialize project
- [~] P0: Configure dependencies
- [ ] P1: Setup tests

## Phase 2: Implementation
- [ ] P0: Implement core logic
- [!] P2: Add documentation (blocked: waiting for review)
`
      const result = parseTasksFile(content)

      expect(result.tasks).toHaveLength(5)

      const statuses = result.tasks.map(t => t.status)
      expect(statuses).toContain('completed')
      expect(statuses).toContain('in_progress')
      expect(statuses).toContain('pending')
      expect(statuses).toContain('blocked')
    })
  })

  describe('extractAcceptanceCriteria', () => {
    it('should extract criteria with [ ] format', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
## Task 1
- [x] Task one

**Acceptance Criteria:**
- [ ] All tests passing
- [ ] Coverage >= 80%
`
      const result = parseTasksFile(content)

      expect(result.acceptanceCriteria).toHaveLength(2)
      expect(result.acceptanceCriteria[0]).toMatchObject({
        description: 'All tests passing',
        met: false,
      })
    })

    it('should extract criteria with checkbox markers', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
## Acceptance Criteria
- [x] Criterion 1 (met)
- [ ] Criterion 2 (not met)
`
      const result = parseTasksFile(content)

      expect(result.acceptanceCriteria[0].met).toBe(true)
      expect(result.acceptanceCriteria[1].met).toBe(false)
    })

    it('should handle criteria without status markers', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
**Acceptance Criteria:**
- No checkbox criterion
`
      const result = parseTasksFile(content)

      // Should be parsed as a task instead
      expect(result.tasks.length + result.acceptanceCriteria.length).toBeGreaterThan(0)
    })
  })

  describe('extractTaskNotes', () => {
    it('should extract notes from task block', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
- [ ] Task with notes
  Note: This is a note
  Another note here
`
      const result = parseTasksFile(content)

      // Notes should be included in task metadata or separate field
      expect(result.tasks).toHaveLength(1)
    })

    it('should preserve task details in parentheses', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
- [~] Task in progress (started: 2026-01-20)
- [x] Completed task (completed: 2026-01-19)
- [!] Blocked task (blocked: waiting for API)
`
      const result = parseTasksFile(content)

      expect(result.tasks).toHaveLength(3)
      // Details should be preserved
      expect(result.tasks.some(t => t.notes)).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle tasks.md with only headers', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
# Tasks: My Feature
## Phase 1
## Phase 2
`
      const result = parseTasksFile(content)

      expect(result.tasks).toEqual([])
      expect(result.acceptanceCriteria).toEqual([])
    })

    it('should handle very long task descriptions', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const longDescription = 'A'.repeat(500)
      const content = `- [ ] ${longDescription}`

      const result = parseTasksFile(content)

      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].name.length).toBeGreaterThan(400)
    })

    it('should handle tasks with special characters', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
- [ ] Task with @mentions and #tags
- [ ] Task with [links](http://example.com)
- [ ] Task with \`code\` snippets
- [ ] Task with émojis 🚀
`
      const result = parseTasksFile(content)

      expect(result.tasks).toHaveLength(4)
      expect(result.tasks[3].name).toContain('🚀')
    })

    it('should handle mixed indentation (tabs and spaces)', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
- [ ] Task with spaces
\t- [ ] Task with tab
  \t- [ ] Mixed indentation
`
      const result = parseTasksFile(content)

      expect(result.tasks.length).toBeGreaterThan(0)
    })

    it('should return null for completely unparseable content', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = '@@#$%^&*(@#$%^'
      const result = parseTasksFile(content)

      // Should return empty document instead of throwing
      expect(result).toBeDefined()
      expect(result.tasks).toEqual([])
    })
  })

  describe('Real-world Examples', () => {
    it('should parse ADK-style tasks.md', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
# Tasks: progress-sync

## Phase 1: Foundation
- [x] P0: Define core types
- [~] P0: Implement task parser
- [ ] P1: Create state manager

## Phase 2: Integration
- [ ] P0: Add sync command
- [ ] P2: Update documentation

**Acceptance Criteria:**
- [ ] All tests passing
- [ ] Coverage >= 85%
- [ ] No regressions
`
      const result = parseTasksFile(content)

      expect(result.tasks.length).toBeGreaterThanOrEqual(5)
      expect(result.acceptanceCriteria.length).toBeGreaterThanOrEqual(3)

      const p0Tasks = result.tasks.filter(t => t.priority === 0)
      expect(p0Tasks.length).toBeGreaterThanOrEqual(3)
    })

    it('should parse generic markdown checklist', async () => {
      const { parseTasksFile } = await import('../../src/utils/task-parser')

      const content = `
# TODO List

- [x] Buy groceries
- [ ] Call dentist
- [ ] Fix bug in production
- [!] Deploy (blocked: waiting for approval)
`
      const result = parseTasksFile(content)

      expect(result.tasks).toHaveLength(4)
      expect(result.tasks[0].status).toBe('completed')
      expect(result.tasks[3].status).toBe('blocked')
    })
  })

  describe('extractTaskStatus', () => {
    it('should extract status from checkbox character', async () => {
      const { extractTaskStatus } = await import('../../src/utils/task-parser')

      expect(extractTaskStatus('- [ ] Task')).toBe('pending')
      expect(extractTaskStatus('- [x] Task')).toBe('completed')
      expect(extractTaskStatus('- [~] Task')).toBe('in_progress')
      expect(extractTaskStatus('- [!] Task')).toBe('blocked')
    })

    it('should default to pending for unrecognized status', async () => {
      const { extractTaskStatus } = await import('../../src/utils/task-parser')

      expect(extractTaskStatus('- [?] Task')).toBe('pending')
      expect(extractTaskStatus('- Task without checkbox')).toBe('pending')
    })
  })

  describe('extractPriority', () => {
    it('should extract P0, P1, P2 from task text', async () => {
      const { extractPriority } = await import('../../src/utils/task-parser')

      expect(extractPriority('P0: Critical task')).toBe(0)
      expect(extractPriority('P1: Important task')).toBe(1)
      expect(extractPriority('P2: Nice to have')).toBe(2)
    })

    it('should return undefined for tasks without priority', async () => {
      const { extractPriority } = await import('../../src/utils/task-parser')

      expect(extractPriority('Regular task')).toBeUndefined()
    })

    it('should handle priority in middle of text', async () => {
      const { extractPriority } = await import('../../src/utils/task-parser')

      expect(extractPriority('Some text P1: with priority')).toBe(1)
    })
  })
})
