import * as fs from 'fs-extra'
import * as path from 'node:path'
import type { StateSyncResult } from '../types/hooks'

export async function syncStateAfterWrite(
  filePath: string,
  cwd: string = process.cwd()
): Promise<StateSyncResult> {
  const result: StateSyncResult = {
    synced: false,
    filesUpdated: [],
    errors: [],
  }

  try {
    const activeFocusPath = path.join(cwd, '.claude', 'active-focus.md')

    if (!(await fs.pathExists(activeFocusPath))) {
      return result
    }

    const activeFocusContent = await fs.readFile(activeFocusPath, 'utf-8')
    const featureMatch = activeFocusContent.match(/^Feature:\s+(.+)$/m)

    if (!featureMatch) {
      return result
    }

    const featureName = featureMatch[1].trim()
    const featureDir = path.join(cwd, '.claude', 'plans', 'features', featureName)

    if (!(await fs.pathExists(featureDir))) {
      result.errors.push(`Feature directory not found: ${featureDir}`)
      return result
    }

    const progressPath = path.join(featureDir, 'progress.md')
    const statePath = path.join(featureDir, 'state.json')

    let progressContent = await fs.readFile(progressPath, 'utf-8')

    const timestamp = new Date().toISOString()
    const fileEntry = `- ${filePath} (${timestamp})`

    if (!progressContent.includes('## Files Modified')) {
      progressContent += `\n\n## Files Modified\n${fileEntry}\n`
    } else if (!progressContent.includes(filePath)) {
      const filesSection = progressContent.split('## Files Modified')
      filesSection[1] = `\n${fileEntry}\n${filesSection[1]}`
      progressContent = filesSection.join('## Files Modified')
    }

    await fs.writeFile(progressPath, progressContent)
    result.filesUpdated.push('progress.md')

    let state: any = {}
    if (await fs.pathExists(statePath)) {
      state = await fs.readJSON(statePath)
    }

    state.lastModified = timestamp
    state.lastModifiedFile = filePath

    await fs.writeJSON(statePath, state, { spaces: 2 })
    result.filesUpdated.push('state.json')

    result.synced = true
    return result
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error))
    return result
  }
}
