import {
  startHealthProbe,
  stopHealthProbe,
  getHealthProbe,
  getAllHealthProbes,
  clearHealthProbes,
  updateHealthMetrics,
  checkTokenPressure,
} from '../../src/utils/health-probes'
import { DEFAULT_HEALTH_PROBE_CONFIG } from '../../src/types/cdr'

describe('health-probes', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    clearHealthProbes()
  })

  afterEach(() => {
    jest.useRealTimers()
    clearHealthProbes()
  })

  describe('startHealthProbe', () => {
    it('should create a new health probe for a phase', () => {
      const probe = startHealthProbe('implement')

      expect(probe.id).toBeDefined()
      expect(probe.phase).toBe('implement')
      expect(probe.status).toBe('healthy')
      expect(probe.startedAt).toBeDefined()
    })

    it('should initialize metrics with zero values', () => {
      const probe = startHealthProbe('research')

      expect(probe.metrics.durationMs).toBe(0)
      expect(probe.metrics.tokenEstimate).toBe(0)
      expect(probe.metrics.errorCount).toBe(0)
      expect(probe.metrics.lastChecked).toBeDefined()
    })

    it('should generate unique IDs for each probe', () => {
      const probe1 = startHealthProbe('implement')
      const probe2 = startHealthProbe('qa')

      expect(probe1.id).not.toBe(probe2.id)
    })

    it('should call callback on interval check', () => {
      const callback = jest.fn()
      startHealthProbe('implement', callback)

      jest.advanceTimersByTime(DEFAULT_HEALTH_PROBE_CONFIG.intervalMs)

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should call callback multiple times on multiple intervals', () => {
      const callback = jest.fn()
      startHealthProbe('implement', callback)

      jest.advanceTimersByTime(DEFAULT_HEALTH_PROBE_CONFIG.intervalMs * 3)

      expect(callback).toHaveBeenCalledTimes(3)
    })

    it('should pass probe to callback', () => {
      const callback = jest.fn()
      const probe = startHealthProbe('implement', callback)

      jest.advanceTimersByTime(DEFAULT_HEALTH_PROBE_CONFIG.intervalMs)

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: probe.id,
          phase: 'implement',
        })
      )
    })

    it('should use custom config when provided', () => {
      const callback = jest.fn()
      startHealthProbe('implement', callback, { intervalMs: 5000 })

      jest.advanceTimersByTime(5000)

      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('stopHealthProbe', () => {
    it('should stop the health probe by ID', () => {
      const callback = jest.fn()
      const probe = startHealthProbe('implement', callback)

      stopHealthProbe(probe.id)
      jest.advanceTimersByTime(DEFAULT_HEALTH_PROBE_CONFIG.intervalMs * 2)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should set stoppedAt timestamp', () => {
      const probe = startHealthProbe('implement')

      stopHealthProbe(probe.id)
      const stoppedProbe = getHealthProbe(probe.id)

      expect(stoppedProbe?.stoppedAt).toBeDefined()
    })

    it('should return false for non-existent probe', () => {
      const result = stopHealthProbe('non-existent-id')

      expect(result).toBe(false)
    })

    it('should return true for stopped probe', () => {
      const probe = startHealthProbe('implement')

      const result = stopHealthProbe(probe.id)

      expect(result).toBe(true)
    })
  })

  describe('getHealthProbe', () => {
    it('should return probe by ID', () => {
      const probe = startHealthProbe('implement')

      const retrieved = getHealthProbe(probe.id)

      expect(retrieved).toEqual(probe)
    })

    it('should return undefined for non-existent ID', () => {
      const retrieved = getHealthProbe('non-existent')

      expect(retrieved).toBeUndefined()
    })
  })

  describe('getAllHealthProbes', () => {
    it('should return empty array when no probes exist', () => {
      const probes = getAllHealthProbes()

      expect(probes).toEqual([])
    })

    it('should return all active probes', () => {
      startHealthProbe('implement')
      startHealthProbe('qa')
      startHealthProbe('research')

      const probes = getAllHealthProbes()

      expect(probes).toHaveLength(3)
    })
  })

  describe('updateHealthMetrics', () => {
    it('should update duration metric', () => {
      const probe = startHealthProbe('implement')

      updateHealthMetrics(probe.id, { durationMs: 5000 })
      const updated = getHealthProbe(probe.id)

      expect(updated?.metrics.durationMs).toBe(5000)
    })

    it('should update token estimate', () => {
      const probe = startHealthProbe('implement')

      updateHealthMetrics(probe.id, { tokenEstimate: 10000 })
      const updated = getHealthProbe(probe.id)

      expect(updated?.metrics.tokenEstimate).toBe(10000)
    })

    it('should increment error count', () => {
      const probe = startHealthProbe('implement')

      updateHealthMetrics(probe.id, { errorCount: 1 })
      updateHealthMetrics(probe.id, { errorCount: 2 })
      const updated = getHealthProbe(probe.id)

      expect(updated?.metrics.errorCount).toBe(2)
    })

    it('should update lastChecked timestamp', () => {
      const probe = startHealthProbe('implement')
      const originalChecked = probe.metrics.lastChecked

      jest.advanceTimersByTime(1000)
      updateHealthMetrics(probe.id, { durationMs: 1000 })
      const updated = getHealthProbe(probe.id)

      expect(updated?.metrics.lastChecked).not.toBe(originalChecked)
    })

    it('should return false for non-existent probe', () => {
      const result = updateHealthMetrics('non-existent', { durationMs: 1000 })

      expect(result).toBe(false)
    })
  })

  describe('status transitions', () => {
    it('should transition to warning on high token usage', () => {
      const probe = startHealthProbe('implement')

      updateHealthMetrics(probe.id, { tokenEstimate: 85000 })
      const updated = getHealthProbe(probe.id)

      expect(updated?.status).toBe('warning')
    })

    it('should transition to critical on max duration exceeded', () => {
      const probe = startHealthProbe('implement')

      updateHealthMetrics(probe.id, {
        durationMs: DEFAULT_HEALTH_PROBE_CONFIG.maxDurationMs + 1000,
      })
      const updated = getHealthProbe(probe.id)

      expect(updated?.status).toBe('critical')
    })

    it('should transition to critical on multiple errors', () => {
      const probe = startHealthProbe('implement')

      updateHealthMetrics(probe.id, { errorCount: 3 })
      const updated = getHealthProbe(probe.id)

      expect(updated?.status).toBe('critical')
    })

    it('should remain healthy within normal parameters', () => {
      const probe = startHealthProbe('implement')

      updateHealthMetrics(probe.id, {
        durationMs: 10000,
        tokenEstimate: 50000,
        errorCount: 0,
      })
      const updated = getHealthProbe(probe.id)

      expect(updated?.status).toBe('healthy')
    })
  })

  describe('checkTokenPressure', () => {
    it('should return false when below threshold', () => {
      const probe = startHealthProbe('implement')
      updateHealthMetrics(probe.id, { tokenEstimate: 50000 })

      const result = checkTokenPressure(probe.id)

      expect(result).toBe(false)
    })

    it('should return true when at or above 80% threshold', () => {
      const probe = startHealthProbe('implement')
      updateHealthMetrics(probe.id, { tokenEstimate: 85000 })

      const result = checkTokenPressure(probe.id)

      expect(result).toBe(true)
    })

    it('should return false for non-existent probe', () => {
      const result = checkTokenPressure('non-existent')

      expect(result).toBe(false)
    })

    it('should use custom threshold from config', () => {
      const probe = startHealthProbe('implement', undefined, {
        tokenWarningThreshold: 0.5,
      })
      updateHealthMetrics(probe.id, { tokenEstimate: 55000 })

      const result = checkTokenPressure(probe.id, 0.5)

      expect(result).toBe(true)
    })
  })

  describe('callback behavior', () => {
    it('should receive updated metrics in callback', () => {
      const callback = jest.fn()
      const probe = startHealthProbe('implement', callback)

      updateHealthMetrics(probe.id, { durationMs: 5000, tokenEstimate: 20000 })
      jest.advanceTimersByTime(DEFAULT_HEALTH_PROBE_CONFIG.intervalMs)

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            durationMs: 5000,
            tokenEstimate: 20000,
          }),
        })
      )
    })

    it('should trigger callback on status change to warning', () => {
      const callback = jest.fn()
      const probe = startHealthProbe('implement', callback)

      updateHealthMetrics(probe.id, { tokenEstimate: 85000 })

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'warning',
        })
      )
    })

    it('should trigger callback on status change to critical', () => {
      const callback = jest.fn()
      const probe = startHealthProbe('implement', callback)

      updateHealthMetrics(probe.id, { errorCount: 3 })

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'critical',
        })
      )
    })
  })

  describe('clearHealthProbes', () => {
    it('should clear all probes', () => {
      startHealthProbe('implement')
      startHealthProbe('qa')

      clearHealthProbes()

      expect(getAllHealthProbes()).toEqual([])
    })

    it('should stop all interval timers', () => {
      const callback = jest.fn()
      startHealthProbe('implement', callback)
      startHealthProbe('qa', callback)

      clearHealthProbes()
      jest.advanceTimersByTime(DEFAULT_HEALTH_PROBE_CONFIG.intervalMs * 2)

      expect(callback).not.toHaveBeenCalled()
    })
  })
})
