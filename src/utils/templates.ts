import path from 'node:path'
import fs from 'fs-extra'

const TEMPLATES_DIR = path.join(__dirname, '../../templates')

export async function loadTemplate(templateName: string): Promise<string> {
  const templatePath = path.join(TEMPLATES_DIR, templateName)

  if (!(await fs.pathExists(templatePath))) {
    throw new Error(`Template não encontrado: ${templateName}`)
  }

  return await fs.readFile(templatePath, 'utf-8')
}

export function getTemplateDir(): string {
  return TEMPLATES_DIR
}

export async function copyTemplate(templateType: string, targetDir: string): Promise<void> {
  const templateDir = path.join(TEMPLATES_DIR, 'projects', templateType)

  if (!(await fs.pathExists(templateDir))) {
    throw new Error(`Template ${templateType} não encontrado`)
  }

  const jestConfigExists =
    (await fs.pathExists(path.join(targetDir, 'jest.config.js'))) ||
    (await fs.pathExists(path.join(targetDir, 'jest.config.ts')))

  await fs.copy(templateDir, targetDir, {
    overwrite: false,
    filter: (src) => {
      if (src.includes('.git') || src.includes('node_modules')) {
        return false
      }
      if (jestConfigExists && path.basename(src).startsWith('jest.config.')) {
        return false
      }
      return true
    },
  })
}

export async function listAvailableTemplates(): Promise<string[]> {
  const projectsDir = path.join(TEMPLATES_DIR, 'projects')

  if (!(await fs.pathExists(projectsDir))) {
    return []
  }

  const items = await fs.readdir(projectsDir)
  const templates: string[] = []

  for (const item of items) {
    const itemPath = path.join(projectsDir, item)
    const stats = await fs.stat(itemPath)

    if (stats.isDirectory()) {
      templates.push(item)
    }
  }

  return templates
}

export async function copyClaudeStructure(targetDir: string): Promise<void> {
  const claudeStructureDir = path.join(TEMPLATES_DIR, 'claude-structure')

  if (!(await fs.pathExists(claudeStructureDir))) {
    return
  }

  const targetClaudeDir = path.join(targetDir, '.claude')

  const directoriesToMerge = ['agents', 'skills', 'commands', 'rules', 'hooks']

  const filesToCopy = ['settings.json', 'README.md', 'active-focus.md']

  for (const dir of directoriesToMerge) {
    const srcDir = path.join(claudeStructureDir, dir)
    const destDir = path.join(targetClaudeDir, dir)

    if (await fs.pathExists(srcDir)) {
      await fs.ensureDir(destDir)

      const files = await fs.readdir(srcDir)
      for (const file of files) {
        const srcFile = path.join(srcDir, file)
        const destFile = path.join(destDir, file)

        const stat = await fs.stat(srcFile)
        if (stat.isFile() && !(await fs.pathExists(destFile))) {
          await fs.copy(srcFile, destFile)
        }
      }
    }
  }

  for (const file of filesToCopy) {
    const srcPath = path.join(claudeStructureDir, file)
    const destPath = path.join(targetClaudeDir, file)

    if ((await fs.pathExists(srcPath)) && !(await fs.pathExists(destPath))) {
      await fs.copy(srcPath, destPath)
    }
  }
}
