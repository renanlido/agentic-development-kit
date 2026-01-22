import path from 'node:path'
import fs from 'fs-extra'
import type { PhaseType } from '../../src/types/model'
import {
  getFallbackTemplatePath,
  getFallbackTemplates,
  initializeFallbackTemplates,
  loadFallbackTemplate,
  validateFallbackTemplate,
} from '../../src/utils/fallback-templates'

describe('fallback-templates', () => {
  const testDir = path.join(process.cwd(), '.test-fallback')
  const templatesDir = path.join(testDir, 'templates', 'fallback')

  beforeEach(async () => {
    jest.clearAllMocks()
    await fs.ensureDir(templatesDir)
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await fs.remove(testDir)
  })

  describe('loadFallbackTemplate', () => {
    it('should load fallback template for prd phase', async () => {
      const templateContent = '# PRD Fallback Template\n\n[Feature Name]\n'
      await fs.writeFile(path.join(templatesDir, 'prd.md'), templateContent)

      const template = loadFallbackTemplate('prd')

      expect(template).toBeDefined()
      expect(template?.phase).toBe('prd')
      expect(template?.content).toContain('PRD Fallback Template')
      expect(template?.isReadOnly).toBe(true)
    })

    it('should load fallback template for research phase', async () => {
      const templateContent = '# Research Fallback Template\n'
      await fs.writeFile(path.join(templatesDir, 'research.md'), templateContent)

      const template = loadFallbackTemplate('research')

      expect(template).toBeDefined()
      expect(template?.phase).toBe('research')
    })

    it('should load fallback template for implement phase', async () => {
      const templateContent = '# Implementation Fallback Template\n'
      await fs.writeFile(path.join(templatesDir, 'implement.md'), templateContent)

      const template = loadFallbackTemplate('implement')

      expect(template).toBeDefined()
      expect(template?.phase).toBe('implement')
    })

    it('should load fallback template for planning phase', async () => {
      const templateContent = '# Planning Fallback Template\n'
      await fs.writeFile(path.join(templatesDir, 'planning.md'), templateContent)

      const template = loadFallbackTemplate('planning')

      expect(template).toBeDefined()
      expect(template?.phase).toBe('planning')
    })

    it('should return undefined for non-existent template', () => {
      const template = loadFallbackTemplate('qa')

      expect(template).toBeUndefined()
    })

    it('should return template with isReadOnly flag', async () => {
      const templateContent = '# Test Template\n'
      await fs.writeFile(path.join(templatesDir, 'prd.md'), templateContent)

      const template = loadFallbackTemplate('prd')

      expect(template?.isReadOnly).toBe(true)
    })

    it('should include lastValidated timestamp', async () => {
      const templateContent = '# Test Template\n'
      await fs.writeFile(path.join(templatesDir, 'prd.md'), templateContent)

      const template = loadFallbackTemplate('prd')

      expect(template?.lastValidated).toBeDefined()
    })
  })

  describe('getFallbackTemplates', () => {
    it('should return all available fallback templates', async () => {
      await fs.writeFile(path.join(templatesDir, 'prd.md'), '# PRD\n')
      await fs.writeFile(path.join(templatesDir, 'research.md'), '# Research\n')
      await fs.writeFile(path.join(templatesDir, 'implement.md'), '# Implement\n')

      const templates = getFallbackTemplates()

      expect(templates.length).toBeGreaterThanOrEqual(3)
    })

    it('should return empty array when no templates exist', async () => {
      await fs.emptyDir(templatesDir)
      await fs.remove(templatesDir)

      const templates = getFallbackTemplates()

      expect(templates).toEqual([])
    })

    it('should filter out non-markdown files', async () => {
      await fs.writeFile(path.join(templatesDir, 'prd.md'), '# PRD\n')
      await fs.writeFile(path.join(templatesDir, 'config.json'), '{}')

      const templates = getFallbackTemplates()

      expect(templates.every((t) => t.phase !== ('config' as PhaseType))).toBe(true)
    })
  })

  describe('validateFallbackTemplate', () => {
    it('should return true for valid template with required sections', async () => {
      const validContent =
        '# Template\n\n## Overview\n\n## Requirements\n\n## Acceptance Criteria\n'
      await fs.writeFile(path.join(templatesDir, 'prd.md'), validContent)

      const template = loadFallbackTemplate('prd')
      const isValid = validateFallbackTemplate(template!)

      expect(isValid).toBe(true)
    })

    it('should return true for minimal valid template', async () => {
      const minimalContent = '# Template\n\n[Feature Name]\n'
      await fs.writeFile(path.join(templatesDir, 'prd.md'), minimalContent)

      const template = loadFallbackTemplate('prd')
      const isValid = validateFallbackTemplate(template!)

      expect(isValid).toBe(true)
    })

    it('should return false for empty content', () => {
      const template = {
        phase: 'prd' as PhaseType,
        content: '',
        isReadOnly: true,
      }

      const isValid = validateFallbackTemplate(template)

      expect(isValid).toBe(false)
    })

    it('should return false for null template', () => {
      const isValid = validateFallbackTemplate(
        null as unknown as ReturnType<typeof loadFallbackTemplate>
      )

      expect(isValid).toBe(false)
    })

    it('should validate template integrity', async () => {
      const validContent = '# PRD\n\n## Description\n\n## Tasks\n'
      await fs.writeFile(path.join(templatesDir, 'prd.md'), validContent)

      const template = loadFallbackTemplate('prd')
      const isValid = validateFallbackTemplate(template!)

      expect(isValid).toBe(true)
    })
  })

  describe('initializeFallbackTemplates', () => {
    it('should create fallback templates directory', async () => {
      await fs.remove(templatesDir)

      await initializeFallbackTemplates()

      expect(await fs.pathExists(templatesDir)).toBe(true)
    })

    it('should create default templates for main phases', async () => {
      await fs.remove(templatesDir)

      await initializeFallbackTemplates()

      const phases: PhaseType[] = ['prd', 'research', 'planning', 'implement']
      for (const phase of phases) {
        const templatePath = path.join(templatesDir, `${phase}.md`)
        expect(await fs.pathExists(templatePath)).toBe(true)
      }
    })

    it('should not overwrite existing templates', async () => {
      const customContent = '# Custom PRD Template\n'
      await fs.writeFile(path.join(templatesDir, 'prd.md'), customContent)

      await initializeFallbackTemplates()

      const content = await fs.readFile(path.join(templatesDir, 'prd.md'), 'utf-8')
      expect(content).toBe(customContent)
    })

    it('should create templates with placeholder markers', async () => {
      await fs.remove(templatesDir)

      await initializeFallbackTemplates()

      const template = loadFallbackTemplate('prd')
      expect(template?.content).toContain('[Feature Name]')
    })
  })

  describe('getFallbackTemplatePath', () => {
    it('should return correct path for phase', () => {
      const prdPath = getFallbackTemplatePath('prd')

      expect(prdPath).toContain('templates')
      expect(prdPath).toContain('fallback')
      expect(prdPath).toContain('prd.md')
    })

    it('should handle all phase types', () => {
      const phases: PhaseType[] = [
        'prd',
        'research',
        'planning',
        'implement',
        'qa',
        'validation',
        'docs',
      ]

      for (const phase of phases) {
        const templatePath = getFallbackTemplatePath(phase)
        expect(templatePath).toContain(`${phase}.md`)
      }
    })
  })

  describe('template content structure', () => {
    it('should have header section', async () => {
      await initializeFallbackTemplates()

      const template = loadFallbackTemplate('prd')

      expect(template?.content.startsWith('#')).toBe(true)
    })

    it('should have feature name placeholder', async () => {
      await initializeFallbackTemplates()

      const template = loadFallbackTemplate('prd')

      expect(template?.content).toContain('[Feature Name]')
    })

    it('should have date placeholder', async () => {
      await initializeFallbackTemplates()

      const template = loadFallbackTemplate('prd')

      expect(template?.content.includes('YYYY-MM-DD') || template?.content.includes('[Date]')).toBe(
        true
      )
    })
  })

  describe('error handling', () => {
    it('should handle corrupted template file gracefully', async () => {
      await fs.ensureDir(templatesDir)
      await fs.chmod(templatesDir, 0o000)

      const template = loadFallbackTemplate('prd')

      await fs.chmod(templatesDir, 0o755)

      expect(template).toBeUndefined()
    })
  })
})
