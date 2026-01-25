const createChainableMock = () => {
  const fn = (s: string) => s
  const proxy = new Proxy(fn, {
    get: () => proxy,
    apply: (_target, _thisArg, args) => args[0],
  })
  return proxy
}

jest.mock('chalk', () => {
  const mock = createChainableMock()
  return {
    __esModule: true,
    default: mock,
    blue: mock,
    green: mock,
    yellow: mock,
    red: mock,
    gray: mock,
  }
})

jest.unmock('../../src/utils/logger')

import { logger } from '../../src/utils/logger'

describe('Logger', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.DEBUG
  })

  describe('info', () => {
    it('should log info message', () => {
      logger.info('test info')
      expect(console.log).toHaveBeenCalled()
    })
  })

  describe('success', () => {
    it('should log success message', () => {
      logger.success('test success')
      expect(console.log).toHaveBeenCalled()
    })
  })

  describe('warn', () => {
    it('should log warning message', () => {
      logger.warn('test warning')
      expect(console.log).toHaveBeenCalled()
    })
  })

  describe('error', () => {
    it('should log error message', () => {
      logger.error('test error')
      expect(console.log).toHaveBeenCalled()
    })
  })

  describe('debug', () => {
    it('should not log debug message when DEBUG is not set', () => {
      logger.debug('test debug')
      expect(console.log).not.toHaveBeenCalled()
    })

    it('should log debug message when DEBUG is set', () => {
      process.env.DEBUG = 'true'
      logger.debug('test debug')
      expect(console.log).toHaveBeenCalled()
    })
  })
})
