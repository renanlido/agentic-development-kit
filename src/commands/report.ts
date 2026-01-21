import { execFileSync } from 'node:child_process'
import path from 'node:path'
import chalk from 'chalk'
import fs from 'fs-extra'
import ora from 'ora'
import type {
  FeatureReport,
  FeatureReportMetrics,
  FeatureReportPhase,
  FeatureReportRisk,
  ReportOptions,
  WeeklyReport,
  WeeklyReportCommit,
  WeeklyReportFeature,
} from '../types/report.js'
import { getClaudePath, getFeaturesBasePath, getMainRepoPath } from '../utils/git-paths.js'
import type { FeatureProgress, StepProgress } from '../utils/progress.js'

export class ReportCommand {
  async run(options: ReportOptions): Promise<void> {
    if (options.weekly) {
      await this.weekly()
      return
    }

    if (options.feature) {
      await this.feature(options.feature)
      return
    }

    console.log(chalk.yellow('Use --weekly ou --feature <nome> para gerar um relatório'))
  }

  async weekly(): Promise<WeeklyReport> {
    const spinner = ora('Gerando relatório semanal...').start()

    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)

      const commits = this.getCommitsFromLastWeek()
      const featuresWorked = await this.getFeaturesWorkedOn()
      const { linesAdded, linesRemoved } = this.getLinesChanged()

      const report: WeeklyReport = {
        period: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
        },
        commits,
        featuresWorked,
        summary: {
          totalCommits: commits.length,
          featuresStarted: featuresWorked.filter((f) => f.progress < 100).length,
          featuresCompleted: featuresWorked.filter((f) => f.progress === 100).length,
          linesAdded,
          linesRemoved,
        },
        generatedAt: new Date().toISOString(),
      }

      await this.saveWeeklyReport(report)

      spinner.succeed('Relatório semanal gerado')

      return report
    } catch (error) {
      spinner.fail('Falha ao gerar relatório semanal')
      throw error
    }
  }

  async feature(featureName: string): Promise<FeatureReport> {
    const spinner = ora(`Gerando relatório para ${featureName}...`).start()

    try {
      const featureDir = path.join(getFeaturesBasePath(), featureName)

      if (!(await fs.pathExists(featureDir))) {
        throw new Error(`Feature "${featureName}" not found`)
      }

      const progressPath = path.join(featureDir, 'progress.json')
      let progress: FeatureProgress

      if (await fs.pathExists(progressPath)) {
        progress = await fs.readJson(progressPath)
      } else {
        progress = {
          feature: featureName,
          currentPhase: 'prd',
          steps: [],
          lastUpdated: new Date().toISOString(),
        }
      }

      const phases = this.mapStepsToPhases(progress.steps)
      const metrics = this.calculateMetrics(progress)
      const risks = await this.extractRisks(featureDir)
      const createdAt = this.getCreatedAt(progress)
      const nextSteps = this.getNextSteps(progress)

      const report: FeatureReport = {
        feature: featureName,
        createdAt,
        currentPhase: progress.currentPhase as FeatureReportPhase['name'],
        phases,
        metrics,
        risks,
        blockers: [],
        nextSteps,
        generatedAt: new Date().toISOString(),
      }

      await this.saveFeatureReport(featureDir, report)

      spinner.succeed(`Relatório gerado para ${featureName}`)

      return report
    } catch (error) {
      spinner.fail(`Falha ao gerar relatório para ${featureName}`)
      throw error
    }
  }

  private getCommitsFromLastWeek(): WeeklyReportCommit[] {
    try {
      const output = execFileSync(
        'git',
        ['log', '--since=7 days ago', '--pretty=format:%h|%s|%an|%ad', '--date=short'],
        { encoding: 'utf-8', cwd: getMainRepoPath() }
      )

      if (!output.trim()) {
        return []
      }

      return output
        .trim()
        .split('\n')
        .filter((line) => line.includes('|'))
        .map((line) => {
          const [hash, message, author, date] = line.split('|')
          return { hash, message, author, date }
        })
    } catch {
      return []
    }
  }

  private async getFeaturesWorkedOn(): Promise<WeeklyReportFeature[]> {
    const featuresDir = getFeaturesBasePath()
    const features: WeeklyReportFeature[] = []

    if (!(await fs.pathExists(featuresDir))) {
      return features
    }

    const dirs = await fs.readdir(featuresDir)

    for (const dir of dirs) {
      const progressPath = path.join(featuresDir, dir, 'progress.json')

      if (await fs.pathExists(progressPath)) {
        try {
          const progress: FeatureProgress = await fs.readJson(progressPath)
          const completedCount = progress.steps.filter((s) => s.status === 'completed').length
          const totalSteps = progress.steps.length || 1

          features.push({
            name: progress.feature || dir,
            phase: progress.currentPhase as WeeklyReportFeature['phase'],
            progress: Math.round((completedCount / totalSteps) * 100),
            lastUpdated: progress.lastUpdated,
          })
        } catch {
          continue
        }
      }
    }

    return features
  }

  private getLinesChanged(): { linesAdded: number; linesRemoved: number } {
    try {
      const output = execFileSync('git', ['diff', '--stat', '--since=7 days ago', 'HEAD~100'], {
        encoding: 'utf-8',
        cwd: getMainRepoPath(),
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const match = output.match(/(\d+) insertions?\(\+\), (\d+) deletions?\(-\)/)

      if (match) {
        return {
          linesAdded: parseInt(match[1], 10),
          linesRemoved: parseInt(match[2], 10),
        }
      }

      return { linesAdded: 0, linesRemoved: 0 }
    } catch {
      return { linesAdded: 0, linesRemoved: 0 }
    }
  }

  private mapStepsToPhases(steps: StepProgress[]): FeatureReportPhase[] {
    return steps.map((step) => ({
      name: step.name as FeatureReportPhase['name'],
      status: step.status === 'failed' ? 'pending' : step.status,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
    }))
  }

  private calculateMetrics(progress: FeatureProgress): FeatureReportMetrics {
    let totalDuration = 0

    const firstStep = progress.steps.find((s) => s.startedAt)
    if (firstStep?.startedAt) {
      const start = new Date(firstStep.startedAt).getTime()
      const now = Date.now()
      totalDuration = Math.round((now - start) / 1000 / 60)
    }

    return {
      totalDuration,
      testsWritten: 0,
      testsPassing: 0,
      coverage: 0,
      linesAdded: 0,
      linesRemoved: 0,
      filesChanged: 0,
    }
  }

  private async extractRisks(featureDir: string): Promise<FeatureReportRisk[]> {
    const prdPath = path.join(featureDir, 'prd.md')
    const risks: FeatureReportRisk[] = []

    if (!(await fs.pathExists(prdPath))) {
      return risks
    }

    try {
      const content = await fs.readFile(prdPath, 'utf-8')
      const risksSection = content.match(/## Risks?\s*\n([\s\S]*?)(?=\n## |$)/i)

      if (risksSection) {
        const riskLines = risksSection[1].split('\n').filter((line) => line.trim().startsWith('-'))

        for (const line of riskLines) {
          const description = line.replace(/^-\s*/, '').trim()
          let severity: FeatureReportRisk['severity'] = 'medium'

          if (/high/i.test(description)) {
            severity = 'high'
          } else if (/low/i.test(description)) {
            severity = 'low'
          }

          risks.push({
            description,
            severity,
            mitigated: false,
          })
        }
      }
    } catch {
      return risks
    }

    return risks
  }

  private getCreatedAt(progress: FeatureProgress): string {
    const firstStep = progress.steps.find((s) => s.startedAt)
    return firstStep?.startedAt || progress.lastUpdated || new Date().toISOString()
  }

  private getNextSteps(progress: FeatureProgress): string[] {
    const nextSteps: string[] = []
    const pendingSteps = progress.steps.filter((s) => s.status === 'pending')

    for (const step of pendingSteps.slice(0, 3)) {
      nextSteps.push(`Complete ${step.name} phase`)
    }

    if (progress.nextStep) {
      nextSteps.unshift(`Continue with ${progress.nextStep}`)
    }

    return nextSteps
  }

  private async saveWeeklyReport(report: WeeklyReport): Promise<void> {
    const reportsDir = getClaudePath('reports')
    await fs.ensureDir(reportsDir)

    const filename = `weekly-${report.period.end}.md`
    const filepath = path.join(reportsDir, filename)

    const content = this.formatWeeklyReport(report)
    await fs.writeFile(filepath, content)
  }

  private formatWeeklyReport(report: WeeklyReport): string {
    const lines = [
      `# Weekly Report: ${report.period.start} to ${report.period.end}`,
      '',
      `> Generated: ${report.generatedAt}`,
      '',
      '## Summary',
      '',
      `- **Total Commits:** ${report.summary.totalCommits}`,
      `- **Features Started:** ${report.summary.featuresStarted}`,
      `- **Features Completed:** ${report.summary.featuresCompleted}`,
      `- **Lines Added:** ${report.summary.linesAdded}`,
      `- **Lines Removed:** ${report.summary.linesRemoved}`,
      '',
      '## Commits',
      '',
    ]

    if (report.commits.length === 0) {
      lines.push('No commits in this period.')
    } else {
      for (const commit of report.commits) {
        lines.push(`- \`${commit.hash}\` ${commit.message} (${commit.author}, ${commit.date})`)
      }
    }

    lines.push('', '## Features', '')

    if (report.featuresWorked.length === 0) {
      lines.push('No features tracked in this period.')
    } else {
      for (const feature of report.featuresWorked) {
        lines.push(`- **${feature.name}**: ${feature.phase} (${feature.progress}%)`)
      }
    }

    lines.push('')

    return lines.join('\n')
  }

  private async saveFeatureReport(featureDir: string, report: FeatureReport): Promise<void> {
    const filename = `feature-report-${new Date().toISOString().split('T')[0]}.md`
    const filepath = path.join(featureDir, filename)

    const content = this.formatFeatureReport(report)
    await fs.writeFile(filepath, content)
  }

  private formatFeatureReport(report: FeatureReport): string {
    const lines = [
      `# Feature Report: ${report.feature}`,
      '',
      `> Generated: ${report.generatedAt}`,
      '',
      '## Overview',
      '',
      `- **Created:** ${report.createdAt}`,
      `- **Current Phase:** ${report.currentPhase}`,
      `- **Total Duration:** ${report.metrics.totalDuration} minutes`,
      '',
      '## Phases',
      '',
    ]

    for (const phase of report.phases) {
      const status =
        phase.status === 'completed' ? '✅' : phase.status === 'in_progress' ? '🔄' : '⏳'
      lines.push(`- ${status} **${phase.name}**: ${phase.status}`)
    }

    lines.push('', '## Metrics', '')
    lines.push(`- Tests Written: ${report.metrics.testsWritten}`)
    lines.push(`- Tests Passing: ${report.metrics.testsPassing}`)
    lines.push(`- Coverage: ${report.metrics.coverage}%`)
    lines.push(`- Files Changed: ${report.metrics.filesChanged}`)

    if (report.risks.length > 0) {
      lines.push('', '## Risks', '')
      for (const risk of report.risks) {
        const icon = risk.mitigated ? '✅' : '⚠️'
        lines.push(`- ${icon} [${risk.severity}] ${risk.description}`)
      }
    }

    if (report.nextSteps.length > 0) {
      lines.push('', '## Next Steps', '')
      for (const step of report.nextSteps) {
        lines.push(`- [ ] ${step}`)
      }
    }

    lines.push('')

    return lines.join('\n')
  }
}

export const reportCommand = new ReportCommand()
