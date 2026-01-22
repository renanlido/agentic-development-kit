import * as path from 'node:path'
import * as fs from 'fs-extra'
import type { TDDValidationResult } from '../types/hooks'

export async function validateTDD(
  filePath: string,
  cwd: string = process.cwd()
): Promise<TDDValidationResult> {
  const result: TDDValidationResult = {
    isValid: true,
    warnings: [],
  }

  const normalizedPath = path.normalize(filePath)
  const isSrcFile = normalizedPath.startsWith('src/')
  const isTypeScriptFile = normalizedPath.endsWith('.ts') || normalizedPath.endsWith('.tsx')

  if (!isSrcFile || !isTypeScriptFile) {
    return result
  }

  const possibleTestPaths = generateTestPaths(normalizedPath)

  for (const testPath of possibleTestPaths) {
    const fullTestPath = path.join(cwd, testPath)
    if (await fs.pathExists(fullTestPath)) {
      return result
    }
  }

  result.testFile = possibleTestPaths[0]
  result.warnings.push(
    `⚠️  TDD Warning: Creating file in src/ without corresponding test.\n` +
      `   Expected test at: ${possibleTestPaths[0]}\n` +
      `   Alternative patterns: ${possibleTestPaths.slice(1).join(', ')}`
  )

  return result
}

function generateTestPaths(srcPath: string): string[] {
  const parsed = path.parse(srcPath)
  const relativePath = srcPath.replace(/^src\//, '')
  const baseName = parsed.name

  return [
    path.join('tests', relativePath.replace(parsed.base, `${baseName}.test.ts`)),
    path.join('tests', relativePath.replace(parsed.base, `${baseName}.spec.ts`)),
    path.join(parsed.dir, '__tests__', `${baseName}.test.ts`),
    path.join(parsed.dir, '__tests__', `${baseName}.spec.ts`),
  ]
}
