import * as path from 'node:path'
import * as fs from 'fs-extra'
import type { SessionBootstrapResult } from '../types/hooks'

export async function loadSessionContext(
  cwd: string = process.cwd()
): Promise<SessionBootstrapResult> {
  const result: SessionBootstrapResult = {
    context: '',
    loaded: [],
    warnings: [],
  }

  const activeFocusPath = path.join(cwd, '.claude', 'active-focus.md')

  if (!(await fs.pathExists(activeFocusPath))) {
    result.warnings.push('active-focus.md not found')
    return result
  }

  const activeFocusContent = await fs.readFile(activeFocusPath, 'utf-8')
  result.context += activeFocusContent
  result.loaded.push(activeFocusPath)

  const featureMatch = activeFocusContent.match(/^Feature:\s+(.+)$/m)
  if (!featureMatch) {
    return result
  }

  const featureName = featureMatch[1].trim()
  const constraintsPath = path.join(
    cwd,
    '.claude',
    'plans',
    'features',
    featureName,
    'constraints.md'
  )

  if (await fs.pathExists(constraintsPath)) {
    const constraintsContent = await fs.readFile(constraintsPath, 'utf-8')
    result.context += `\n\n${constraintsContent}`
    result.loaded.push(constraintsPath)
  }

  return result
}
