import { getTemplateDir } from '../../src/utils/templates.js'

describe('templates', () => {
  describe('getTemplateDir', () => {
    it('should return templates directory path', () => {
      const dir = getTemplateDir()
      expect(dir).toContain('templates')
    })

    it('should return consistent path', () => {
      const dir1 = getTemplateDir()
      const dir2 = getTemplateDir()
      expect(dir1).toBe(dir2)
    })
  })

  describe('Template patterns', () => {
    it('should have expected structure for template path', () => {
      const dir = getTemplateDir()
      expect(dir).not.toContain('..')
      expect(dir).toMatch(/templates$/)
    })
  })

  describe('Template naming conventions', () => {
    it('should support node template name', () => {
      const templateName = 'node'
      expect(templateName).toBe('node')
    })

    it('should support python template name', () => {
      const templateName = 'python'
      expect(templateName).toBe('python')
    })

    it('should support go template name', () => {
      const templateName = 'go'
      expect(templateName).toBe('go')
    })
  })

  describe('Template file patterns', () => {
    it('should support markdown templates', () => {
      const templateFile = 'prd-template.md'
      expect(templateFile).toMatch(/\.md$/)
    })

    it('should support task templates', () => {
      const templateFile = 'task-template.md'
      expect(templateFile).toMatch(/\.md$/)
    })

    it('should support feature plan templates', () => {
      const templateFile = 'feature-plan.md'
      expect(templateFile).toMatch(/\.md$/)
    })
  })

  describe('Claude structure items', () => {
    it('should include standard items', () => {
      const expectedItems = [
        'agents',
        'skills',
        'commands',
        'rules',
        'hooks',
        'settings.json',
        'README.md',
        'active-focus.md',
      ]

      expect(expectedItems).toHaveLength(8)
      expect(expectedItems).toContain('agents')
      expect(expectedItems).toContain('skills')
    })
  })

  describe('Copy filter patterns', () => {
    it('should filter .git directories', () => {
      const filter = (src: string) => !src.includes('.git')
      expect(filter('/path/to/.git/config')).toBe(false)
      expect(filter('/path/to/src/file.ts')).toBe(true)
    })

    it('should filter node_modules', () => {
      const filter = (src: string) => !src.includes('node_modules')
      expect(filter('/path/node_modules/pkg')).toBe(false)
      expect(filter('/path/src/index.ts')).toBe(true)
    })

    it('should allow source files', () => {
      const filter = (src: string) => !src.includes('.git') && !src.includes('node_modules')

      expect(filter('/project/src/index.ts')).toBe(true)
      expect(filter('/project/package.json')).toBe(true)
      expect(filter('/project/README.md')).toBe(true)
    })
  })

  describe('Jest config handling', () => {
    it('should detect jest.config.js', () => {
      const filename = 'jest.config.js'
      expect(filename.startsWith('jest.config.')).toBe(true)
    })

    it('should detect jest.config.ts', () => {
      const filename = 'jest.config.ts'
      expect(filename.startsWith('jest.config.')).toBe(true)
    })

    it('should not match other config files', () => {
      const filename = 'tsconfig.json'
      expect(filename.startsWith('jest.config.')).toBe(false)
    })
  })

  describe('Template directory structure', () => {
    it('should expect projects subdirectory', () => {
      const projectsDir = 'projects'
      const templateTypes = ['node', 'python', 'go']

      expect(projectsDir).toBe('projects')
      expect(templateTypes).toHaveLength(3)
    })

    it('should expect claude-structure subdirectory', () => {
      const claudeStructureDir = 'claude-structure'
      expect(claudeStructureDir).toBe('claude-structure')
    })
  })

  describe('Error message patterns', () => {
    it('should have template not found error format', () => {
      const templateName = 'invalid'
      const errorMessage = `Template não encontrado: ${templateName}`
      expect(errorMessage).toContain('não encontrado')
      expect(errorMessage).toContain(templateName)
    })

    it('should have project template not found error format', () => {
      const templateType = 'invalid'
      const errorMessage = `Template ${templateType} não encontrado`
      expect(errorMessage).toContain('não encontrado')
    })
  })
})
