import type {
  ConflictStrategy,
  LocalFeature,
  RemoteFeature,
  SyncConflict,
} from '../../src/types/provider.js'

jest.mock('node:child_process', () => ({
  execFileSync: jest.fn().mockReturnValue('.git'),
}))

import {
  type ConflictResolution,
  createConflictReport,
  detectConflicts,
  resolveConflicts,
} from '../../src/utils/sync-conflict.js'

describe('Sync Conflict Detection and Resolution', () => {
  describe('detectConflicts', () => {
    it('should return empty array when no conflicts', async () => {
      const local: LocalFeature = {
        name: 'feature-1',
        phase: 'implement',
        progress: 50,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const remote: RemoteFeature = {
        id: 'remote-1',
        name: 'feature-1',
        status: 'in progress',
        phase: 'implement',
        progress: 50,
        url: 'https://app.clickup.com/t/remote-1',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-16T10:00:00Z',
      }

      const conflicts = await detectConflicts(local, remote)
      expect(conflicts).toEqual([])
    })

    it('should detect phase conflict', async () => {
      const local: LocalFeature = {
        name: 'feature-1',
        phase: 'qa',
        progress: 50,
        lastUpdated: '2026-01-16T12:00:00Z',
      }

      const remote: RemoteFeature = {
        id: 'remote-1',
        name: 'feature-1',
        status: 'in progress',
        phase: 'implement',
        progress: 50,
        url: 'https://app.clickup.com/t/remote-1',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-16T11:00:00Z',
      }

      const conflicts = await detectConflicts(local, remote)

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].field).toBe('phase')
      expect(conflicts[0].localValue).toBe('qa')
      expect(conflicts[0].remoteValue).toBe('implement')
    })

    it('should detect progress conflict', async () => {
      const local: LocalFeature = {
        name: 'feature-1',
        phase: 'implement',
        progress: 80,
        lastUpdated: '2026-01-16T12:00:00Z',
      }

      const remote: RemoteFeature = {
        id: 'remote-1',
        name: 'feature-1',
        status: 'in progress',
        phase: 'implement',
        progress: 50,
        url: 'https://app.clickup.com/t/remote-1',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-16T11:00:00Z',
      }

      const conflicts = await detectConflicts(local, remote)

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].field).toBe('progress')
      expect(conflicts[0].localValue).toBe(80)
      expect(conflicts[0].remoteValue).toBe(50)
    })

    it('should detect multiple conflicts', async () => {
      const local: LocalFeature = {
        name: 'feature-1',
        phase: 'qa',
        progress: 90,
        lastUpdated: '2026-01-16T14:00:00Z',
      }

      const remote: RemoteFeature = {
        id: 'remote-1',
        name: 'feature-1',
        status: 'in progress',
        phase: 'implement',
        progress: 60,
        url: 'https://app.clickup.com/t/remote-1',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-16T11:00:00Z',
      }

      const conflicts = await detectConflicts(local, remote)

      expect(conflicts).toHaveLength(2)
      expect(conflicts.map((c) => c.field).sort()).toEqual(['phase', 'progress'])
    })

    it('should include timestamps in conflicts', async () => {
      const local: LocalFeature = {
        name: 'feature-1',
        phase: 'qa',
        progress: 75,
        lastUpdated: '2026-01-16T12:00:00Z',
      }

      const remote: RemoteFeature = {
        id: 'remote-1',
        name: 'feature-1',
        status: 'in progress',
        phase: 'implement',
        progress: 75,
        url: 'https://app.clickup.com/t/remote-1',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-16T11:00:00Z',
      }

      const conflicts = await detectConflicts(local, remote)

      expect(conflicts[0].localTimestamp).toBe('2026-01-16T12:00:00Z')
      expect(conflicts[0].remoteTimestamp).toBe('2026-01-16T11:00:00Z')
    })

    it('should not detect conflict for matching phase with different status names', async () => {
      const local: LocalFeature = {
        name: 'feature-1',
        phase: 'implement',
        progress: 50,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const remote: RemoteFeature = {
        id: 'remote-1',
        name: 'feature-1',
        status: 'in progress',
        phase: 'implement',
        progress: 50,
        url: 'https://app.clickup.com/t/remote-1',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-16T10:00:00Z',
      }

      const conflicts = await detectConflicts(local, remote)
      expect(conflicts).toEqual([])
    })

    it('should ignore undefined remote progress', async () => {
      const local: LocalFeature = {
        name: 'feature-1',
        phase: 'implement',
        progress: 50,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const remote: RemoteFeature = {
        id: 'remote-1',
        name: 'feature-1',
        status: 'in progress',
        phase: 'implement',
        progress: undefined,
        url: 'https://app.clickup.com/t/remote-1',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-16T10:00:00Z',
      }

      const conflicts = await detectConflicts(local, remote)
      expect(conflicts).toEqual([])
    })
  })

  describe('resolveConflicts', () => {
    const createConflicts = (): SyncConflict[] => [
      {
        field: 'phase',
        localValue: 'qa',
        remoteValue: 'implement',
        localTimestamp: '2026-01-16T14:00:00Z',
        remoteTimestamp: '2026-01-16T12:00:00Z',
      },
      {
        field: 'progress',
        localValue: 90,
        remoteValue: 60,
        localTimestamp: '2026-01-16T14:00:00Z',
        remoteTimestamp: '2026-01-16T12:00:00Z',
      },
    ]

    describe('local-wins strategy', () => {
      it('should resolve all conflicts with local values', async () => {
        const conflicts = createConflicts()
        const strategy: ConflictStrategy = 'local-wins'

        const resolution = await resolveConflicts(conflicts, strategy)

        expect(resolution.resolvedData.phase).toBe('qa')
        expect(resolution.resolvedData.progress).toBe(90)
      })

      it('should record resolution strategy', async () => {
        const conflicts = createConflicts()
        const strategy: ConflictStrategy = 'local-wins'

        const resolution = await resolveConflicts(conflicts, strategy)

        expect(resolution.strategy).toBe('local-wins')
      })

      it('should include all resolved conflicts in report', async () => {
        const conflicts = createConflicts()
        const strategy: ConflictStrategy = 'local-wins'

        const resolution = await resolveConflicts(conflicts, strategy)

        expect(resolution.resolvedConflicts).toHaveLength(2)
        expect(resolution.resolvedConflicts[0].winner).toBe('local')
        expect(resolution.resolvedConflicts[1].winner).toBe('local')
      })
    })

    describe('remote-wins strategy', () => {
      it('should resolve all conflicts with remote values', async () => {
        const conflicts = createConflicts()
        const strategy: ConflictStrategy = 'remote-wins'

        const resolution = await resolveConflicts(conflicts, strategy)

        expect(resolution.resolvedData.phase).toBe('implement')
        expect(resolution.resolvedData.progress).toBe(60)
      })

      it('should mark all conflicts as remote-won', async () => {
        const conflicts = createConflicts()
        const strategy: ConflictStrategy = 'remote-wins'

        const resolution = await resolveConflicts(conflicts, strategy)

        expect(resolution.resolvedConflicts.every((c) => c.winner === 'remote')).toBe(true)
      })
    })

    describe('newest-wins strategy', () => {
      it('should resolve with newest timestamp (local newer)', async () => {
        const conflicts: SyncConflict[] = [
          {
            field: 'phase',
            localValue: 'qa',
            remoteValue: 'implement',
            localTimestamp: '2026-01-16T14:00:00Z',
            remoteTimestamp: '2026-01-16T12:00:00Z',
          },
        ]
        const strategy: ConflictStrategy = 'newest-wins'

        const resolution = await resolveConflicts(conflicts, strategy)

        expect(resolution.resolvedData.phase).toBe('qa')
        expect(resolution.resolvedConflicts[0].winner).toBe('local')
      })

      it('should resolve with newest timestamp (remote newer)', async () => {
        const conflicts: SyncConflict[] = [
          {
            field: 'phase',
            localValue: 'implement',
            remoteValue: 'qa',
            localTimestamp: '2026-01-16T10:00:00Z',
            remoteTimestamp: '2026-01-16T14:00:00Z',
          },
        ]
        const strategy: ConflictStrategy = 'newest-wins'

        const resolution = await resolveConflicts(conflicts, strategy)

        expect(resolution.resolvedData.phase).toBe('qa')
        expect(resolution.resolvedConflicts[0].winner).toBe('remote')
      })

      it('should handle mixed timestamps per conflict', async () => {
        const conflicts: SyncConflict[] = [
          {
            field: 'phase',
            localValue: 'qa',
            remoteValue: 'implement',
            localTimestamp: '2026-01-16T14:00:00Z',
            remoteTimestamp: '2026-01-16T12:00:00Z',
          },
          {
            field: 'progress',
            localValue: 50,
            remoteValue: 80,
            localTimestamp: '2026-01-16T10:00:00Z',
            remoteTimestamp: '2026-01-16T15:00:00Z',
          },
        ]
        const strategy: ConflictStrategy = 'newest-wins'

        const resolution = await resolveConflicts(conflicts, strategy)

        expect(resolution.resolvedData.phase).toBe('qa')
        expect(resolution.resolvedData.progress).toBe(80)
        expect(resolution.resolvedConflicts[0].winner).toBe('local')
        expect(resolution.resolvedConflicts[1].winner).toBe('remote')
      })

      it('should default to local when timestamps are equal', async () => {
        const conflicts: SyncConflict[] = [
          {
            field: 'phase',
            localValue: 'qa',
            remoteValue: 'implement',
            localTimestamp: '2026-01-16T12:00:00Z',
            remoteTimestamp: '2026-01-16T12:00:00Z',
          },
        ]
        const strategy: ConflictStrategy = 'newest-wins'

        const resolution = await resolveConflicts(conflicts, strategy)

        expect(resolution.resolvedData.phase).toBe('qa')
      })
    })

    describe('manual strategy', () => {
      it('should return unresolved conflicts for manual resolution', async () => {
        const conflicts = createConflicts()
        const strategy: ConflictStrategy = 'manual'

        const resolution = await resolveConflicts(conflicts, strategy)

        expect(resolution.requiresManualResolution).toBe(true)
        expect(resolution.unresolvedConflicts).toHaveLength(2)
      })

      it('should not include resolved data for manual strategy', async () => {
        const conflicts = createConflicts()
        const strategy: ConflictStrategy = 'manual'

        const resolution = await resolveConflicts(conflicts, strategy)

        expect(Object.keys(resolution.resolvedData)).toHaveLength(0)
      })
    })

    it('should handle empty conflicts array', async () => {
      const conflicts: SyncConflict[] = []
      const strategy: ConflictStrategy = 'local-wins'

      const resolution = await resolveConflicts(conflicts, strategy)

      expect(resolution.resolvedConflicts).toHaveLength(0)
      expect(Object.keys(resolution.resolvedData)).toHaveLength(0)
    })
  })

  describe('createConflictReport', () => {
    it('should generate markdown report', async () => {
      const conflicts: SyncConflict[] = [
        {
          field: 'phase',
          localValue: 'qa',
          remoteValue: 'implement',
          localTimestamp: '2026-01-16T14:00:00Z',
          remoteTimestamp: '2026-01-16T12:00:00Z',
        },
      ]

      const resolution: ConflictResolution = {
        strategy: 'local-wins',
        resolvedData: { phase: 'qa' },
        resolvedConflicts: [
          {
            field: 'phase',
            winner: 'local',
            value: 'qa',
          },
        ],
        requiresManualResolution: false,
        unresolvedConflicts: [],
      }

      const report = createConflictReport(conflicts, resolution)

      expect(report).toContain('# Conflict Resolution Report')
      expect(report).toContain('phase')
      expect(report).toContain('local-wins')
    })

    it('should include conflict details', async () => {
      const conflicts: SyncConflict[] = [
        {
          field: 'phase',
          localValue: 'qa',
          remoteValue: 'implement',
          localTimestamp: '2026-01-16T14:00:00Z',
          remoteTimestamp: '2026-01-16T12:00:00Z',
        },
      ]

      const resolution: ConflictResolution = {
        strategy: 'local-wins',
        resolvedData: { phase: 'qa' },
        resolvedConflicts: [{ field: 'phase', winner: 'local', value: 'qa' }],
        requiresManualResolution: false,
        unresolvedConflicts: [],
      }

      const report = createConflictReport(conflicts, resolution)

      expect(report).toContain('qa')
      expect(report).toContain('implement')
    })

    it('should indicate manual resolution required', async () => {
      const conflicts: SyncConflict[] = [
        {
          field: 'phase',
          localValue: 'qa',
          remoteValue: 'implement',
          localTimestamp: '2026-01-16T14:00:00Z',
          remoteTimestamp: '2026-01-16T12:00:00Z',
        },
      ]

      const resolution: ConflictResolution = {
        strategy: 'manual',
        resolvedData: {},
        resolvedConflicts: [],
        requiresManualResolution: true,
        unresolvedConflicts: conflicts,
      }

      const report = createConflictReport(conflicts, resolution)

      expect(report).toContain('manual')
      expect(report.toLowerCase()).toContain('resolution required')
    })

    it('should handle empty conflicts', async () => {
      const conflicts: SyncConflict[] = []
      const resolution: ConflictResolution = {
        strategy: 'local-wins',
        resolvedData: {},
        resolvedConflicts: [],
        requiresManualResolution: false,
        unresolvedConflicts: [],
      }

      const report = createConflictReport(conflicts, resolution)

      expect(report).toContain('No conflicts')
    })
  })

  describe('edge cases', () => {
    it('should handle remote feature without phase', async () => {
      const local: LocalFeature = {
        name: 'feature-1',
        phase: 'implement',
        progress: 50,
        lastUpdated: '2026-01-16T10:00:00Z',
      }

      const remote: RemoteFeature = {
        id: 'remote-1',
        name: 'feature-1',
        status: 'in progress',
        url: 'https://app.clickup.com/t/remote-1',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-16T10:00:00Z',
      }

      const conflicts = await detectConflicts(local, remote)
      expect(conflicts).toEqual([])
    })

    it('should handle invalid timestamps gracefully', async () => {
      const conflicts: SyncConflict[] = [
        {
          field: 'phase',
          localValue: 'qa',
          remoteValue: 'implement',
          localTimestamp: 'invalid-date',
          remoteTimestamp: 'also-invalid',
        },
      ]

      const resolution = await resolveConflicts(conflicts, 'newest-wins')

      expect(resolution.resolvedData.phase).toBeDefined()
    })

    it('should detect name conflict', async () => {
      const local: LocalFeature = {
        name: 'feature-renamed',
        phase: 'implement',
        progress: 50,
        lastUpdated: '2026-01-16T12:00:00Z',
      }

      const remote: RemoteFeature = {
        id: 'remote-1',
        name: 'feature-original',
        status: 'in progress',
        phase: 'implement',
        progress: 50,
        url: 'https://app.clickup.com/t/remote-1',
        createdAt: '2026-01-15T10:00:00Z',
        updatedAt: '2026-01-16T10:00:00Z',
      }

      const conflicts = await detectConflicts(local, remote)

      const nameConflict = conflicts.find((c) => c.field === 'name')
      expect(nameConflict).toBeDefined()
      expect(nameConflict?.localValue).toBe('feature-renamed')
      expect(nameConflict?.remoteValue).toBe('feature-original')
    })
  })
})
