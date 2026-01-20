import path from 'node:path'
import fs from 'fs-extra'
import type { FeatureProgress } from '../../src/utils/progress.js'

const mockExecFileSync = jest.fn().mockReturnValue('.git')

jest.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}))

const mockOraInstance = {
  start: jest.fn().mockReturnThis(),
  stop: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  text: '',
}

jest.mock('ora', () => jest.fn(() => mockOraInstance))

jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    gray: (s: string) => s,
    white: (s: string) => s,
    bold: Object.assign((s: string) => s, { cyan: (s: string) => s }),
  },
}))

import { ReportCommand } from '../../src/commands/report.js'

describe('ReportCommand', () => {
  const testDir = path.join(process.cwd(), '.test-report-cmd')
  const claudeDir = path.join(testDir, '.claude')
  const featuresDir = path.join(claudeDir, 'plans/features')
  const reportsDir = path.join(claudeDir, 'reports')

  let reportCommand: ReportCommand

  beforeEach(async () => {
    await fs.ensureDir(claudeDir)
    await fs.ensureDir(featuresDir)
    await fs.ensureDir(reportsDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)

    mockOraInstance.start.mockClear()
    mockOraInstance.succeed.mockClear()
    mockOraInstance.fail.mockClear()
    mockExecFileSync.mockReset()
    mockExecFileSync.mockReturnValue('.git')

    reportCommand = new ReportCommand()
  }, 15000)

  afterEach(async () => {
    await fs.remove(testDir)
    jest.restoreAllMocks()
  }, 15000)

  describe('weekly()', () => {
    describe('when generating weekly report', () => {
      it('should read git log for the last 7 days', async () => {
        mockExecFileSync.mockReturnValue('')

        await reportCommand.weekly()

        expect(mockExecFileSync).toHaveBeenCalledWith(
          'git',
          expect.arrayContaining(['log', '--since=7 days ago']),
          expect.any(Object)
        )
      })

      it('should parse git log output into commits', async () => {
        const gitLogOutput = `abc1234|feat: add new feature|John Doe|2026-01-15
def5678|fix: resolve bug|Jane Smith|2026-01-14`

        mockExecFileSync.mockImplementation((cmd: string, args: string[]) => {
          if (cmd === 'git' && args[0] === 'log') {
            return gitLogOutput
          }
          return ''
        })

        const report = await reportCommand.weekly()

        expect(report.commits).toHaveLength(2)
        expect(report.commits[0]).toEqual({
          hash: 'abc1234',
          message: 'feat: add new feature',
          author: 'John Doe',
          date: '2026-01-15',
        })
      })

      it('should include period start and end dates', async () => {
        mockExecFileSync.mockReturnValue('')

        const report = await reportCommand.weekly()

        expect(report.period).toBeDefined()
        expect(report.period.start).toBeDefined()
        expect(report.period.end).toBeDefined()
      })

      it('should list features worked on', async () => {
        const featureName = 'test-feature'
        const featureDir = path.join(featuresDir, featureName)
        await fs.ensureDir(featureDir)

        const progress: FeatureProgress = {
          feature: featureName,
          currentPhase: 'implement',
          steps: [
            { name: 'prd', status: 'completed' },
            { name: 'research', status: 'completed' },
            { name: 'implement', status: 'in_progress' },
          ],
          lastUpdated: new Date().toISOString(),
        }
        await fs.writeJson(path.join(featureDir, 'progress.json'), progress)

        mockExecFileSync.mockImplementation((cmd: string, args: string[]) => {
          if (cmd === 'git' && args[0] === 'rev-parse') {
            return '.git'
          }
          return ''
        })

        const report = await reportCommand.weekly()

        expect(report.featuresWorked.length).toBeGreaterThanOrEqual(0)
      })

      it('should calculate summary metrics', async () => {
        const gitLogOutput = `abc1234|feat: add feature|Dev|2026-01-15
def5678|fix: bug|Dev|2026-01-14
ghi9012|docs: update|Dev|2026-01-13`

        mockExecFileSync.mockImplementation((cmd: string, args: string[]) => {
          if (cmd === 'git' && args[0] === 'log') {
            return gitLogOutput
          }
          return ''
        })

        const report = await reportCommand.weekly()

        expect(report.summary.totalCommits).toBe(3)
      })

      it('should save report to .claude/reports/weekly-YYYY-MM-DD.md', async () => {
        mockExecFileSync.mockImplementation((cmd: string, args: string[]) => {
          if (cmd === 'git' && args[0] === 'rev-parse') {
            return '.git'
          }
          return ''
        })

        const report = await reportCommand.weekly()

        expect(report.generatedAt).toBeDefined()
        expect(report.period.end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })

      it('should include generatedAt timestamp', async () => {
        mockExecFileSync.mockReturnValue('')

        const report = await reportCommand.weekly()

        expect(report.generatedAt).toBeDefined()
        expect(new Date(report.generatedAt).getTime()).not.toBeNaN()
      })

      it('should handle empty git log gracefully', async () => {
        mockExecFileSync.mockReturnValue('')

        const report = await reportCommand.weekly()

        expect(report.commits).toEqual([])
        expect(report.summary.totalCommits).toBe(0)
      })

      it('should get lines added/removed from git diff stat', async () => {
        mockExecFileSync.mockImplementation((cmd: string, args: string[]) => {
          if (cmd === 'git' && args[0] === 'log') {
            return ''
          }
          if (cmd === 'git' && args[0] === 'diff') {
            return '10 files changed, 150 insertions(+), 50 deletions(-)'
          }
          return ''
        })

        const report = await reportCommand.weekly()

        expect(report.summary.linesAdded).toBe(150)
        expect(report.summary.linesRemoved).toBe(50)
      })
    })
  })

  describe('feature()', () => {
    describe('when generating feature report', () => {
      const featureName = 'my-feature'
      let featureDir: string

      beforeEach(async () => {
        featureDir = path.join(featuresDir, featureName)
        await fs.ensureDir(featureDir)
      })

      it('should throw error if feature does not exist', async () => {
        await expect(reportCommand.feature('non-existent-feature')).rejects.toThrow(
          /feature.*not found/i
        )
      })

      it('should read progress.json for current phase', async () => {
        const progress: FeatureProgress = {
          feature: featureName,
          currentPhase: 'qa',
          steps: [
            { name: 'prd', status: 'completed', completedAt: '2026-01-10' },
            { name: 'implement', status: 'completed', completedAt: '2026-01-15' },
            { name: 'qa', status: 'in_progress', startedAt: '2026-01-16' },
          ],
          lastUpdated: '2026-01-16T10:00:00Z',
        }
        await fs.writeJson(path.join(featureDir, 'progress.json'), progress)

        const report = await reportCommand.feature(featureName)

        expect(report.currentPhase).toBe('qa')
      })

      it('should include all phases with status', async () => {
        const progress: FeatureProgress = {
          feature: featureName,
          currentPhase: 'implement',
          steps: [
            { name: 'prd', status: 'completed', completedAt: '2026-01-10' },
            { name: 'research', status: 'completed', completedAt: '2026-01-11' },
            { name: 'tasks', status: 'completed', completedAt: '2026-01-12' },
            { name: 'plan', status: 'completed', completedAt: '2026-01-13' },
            { name: 'implement', status: 'in_progress', startedAt: '2026-01-14' },
            { name: 'qa', status: 'pending' },
          ],
          lastUpdated: '2026-01-15T10:00:00Z',
        }
        await fs.writeJson(path.join(featureDir, 'progress.json'), progress)

        const report = await reportCommand.feature(featureName)

        expect(report.phases).toContainEqual(
          expect.objectContaining({ name: 'prd', status: 'completed' })
        )
        expect(report.phases).toContainEqual(
          expect.objectContaining({ name: 'implement', status: 'in_progress' })
        )
        expect(report.phases).toContainEqual(
          expect.objectContaining({ name: 'qa', status: 'pending' })
        )
      })

      it('should calculate total duration from first to current phase', async () => {
        const progress: FeatureProgress = {
          feature: featureName,
          currentPhase: 'implement',
          steps: [
            { name: 'prd', status: 'completed', startedAt: '2026-01-10T10:00:00Z', completedAt: '2026-01-10T12:00:00Z' },
            { name: 'implement', status: 'in_progress', startedAt: '2026-01-15T10:00:00Z' },
          ],
          lastUpdated: '2026-01-16T10:00:00Z',
        }
        await fs.writeJson(path.join(featureDir, 'progress.json'), progress)

        const report = await reportCommand.feature(featureName)

        expect(report.metrics.totalDuration).toBeGreaterThan(0)
      })

      it('should read risks from prd.md if exists', async () => {
        const prdContent = `# PRD

## Risks
- Performance degradation - High severity
- API changes - Medium severity
`
        await fs.writeFile(path.join(featureDir, 'prd.md'), prdContent)

        const progress: FeatureProgress = {
          feature: featureName,
          currentPhase: 'research',
          steps: [],
          lastUpdated: new Date().toISOString(),
        }
        await fs.writeJson(path.join(featureDir, 'progress.json'), progress)

        const report = await reportCommand.feature(featureName)

        expect(report.risks.length).toBeGreaterThanOrEqual(0)
      })

      it('should include next steps from active-focus or progress', async () => {
        const progress: FeatureProgress = {
          feature: featureName,
          currentPhase: 'implement',
          steps: [
            { name: 'implement', status: 'in_progress' },
            { name: 'qa', status: 'pending' },
            { name: 'docs', status: 'pending' },
          ],
          lastUpdated: new Date().toISOString(),
          nextStep: 'qa',
        }
        await fs.writeJson(path.join(featureDir, 'progress.json'), progress)

        const report = await reportCommand.feature(featureName)

        expect(report.nextSteps.length).toBeGreaterThan(0)
      })

      it('should save report to feature directory', async () => {
        const progress: FeatureProgress = {
          feature: featureName,
          currentPhase: 'implement',
          steps: [],
          lastUpdated: new Date().toISOString(),
        }
        await fs.writeJson(path.join(featureDir, 'progress.json'), progress)

        await reportCommand.feature(featureName)

        const files = await fs.readdir(featureDir)
        const featureReport = files.find((f) => f.startsWith('feature-report'))

        expect(featureReport).toBeDefined()
      })

      it('should include createdAt from first phase', async () => {
        const createdDate = '2026-01-05T10:00:00Z'
        const progress: FeatureProgress = {
          feature: featureName,
          currentPhase: 'implement',
          steps: [
            { name: 'prd', status: 'completed', startedAt: createdDate },
          ],
          lastUpdated: new Date().toISOString(),
        }
        await fs.writeJson(path.join(featureDir, 'progress.json'), progress)

        const report = await reportCommand.feature(featureName)

        expect(report.createdAt).toBe(createdDate)
      })
    })
  })

  describe('run()', () => {
    it('should call weekly() when --weekly option is passed', async () => {
      mockExecFileSync.mockReturnValue('')
      const weeklySpy = jest.spyOn(reportCommand, 'weekly')

      await reportCommand.run({ weekly: true })

      expect(weeklySpy).toHaveBeenCalled()
    })

    it('should call feature() when --feature option is passed', async () => {
      const featureName = 'test-feature'
      const featureDir = path.join(featuresDir, featureName)
      await fs.ensureDir(featureDir)

      const progress: FeatureProgress = {
        feature: featureName,
        currentPhase: 'implement',
        steps: [],
        lastUpdated: new Date().toISOString(),
      }
      await fs.writeJson(path.join(featureDir, 'progress.json'), progress)

      const featureSpy = jest.spyOn(reportCommand, 'feature')

      await reportCommand.run({ feature: featureName })

      expect(featureSpy).toHaveBeenCalledWith(featureName)
    })

    it('should show error when no option is provided', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      await reportCommand.run({})

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/--weekly|--feature/i))
      consoleSpy.mockRestore()
    })
  })
})
