import type { PhaseType } from '../types/model.js'
import type { HealthProbe, HealthStatus, HealthMetrics, HealthProbeConfig } from '../types/cdr.js'
import { DEFAULT_HEALTH_PROBE_CONFIG } from '../types/cdr.js'

interface InternalProbe {
  probe: HealthProbe
  intervalId: NodeJS.Timeout | null
  callback?: (probe: HealthProbe) => void
  config: HealthProbeConfig
}

const probes: Map<string, InternalProbe> = new Map()
const TOKEN_ESTIMATE_MAX = 100000

function generateId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  return 'hp-' + timestamp + '-' + random
}

function determineStatus(metrics: HealthMetrics, config: HealthProbeConfig): HealthStatus {
  if (metrics.errorCount >= 3) {
    return 'critical'
  }

  if (metrics.durationMs > config.maxDurationMs) {
    return 'critical'
  }

  const tokenRatio = metrics.tokenEstimate / TOKEN_ESTIMATE_MAX
  if (tokenRatio >= config.tokenWarningThreshold) {
    return 'warning'
  }

  const durationRatio = metrics.durationMs / config.maxDurationMs
  if (durationRatio >= 0.9) {
    return 'warning'
  }

  return 'healthy'
}

export function startHealthProbe(
  phase: PhaseType,
  callback?: (probe: HealthProbe) => void,
  configOverrides?: Partial<HealthProbeConfig>
): HealthProbe {
  const config: HealthProbeConfig = {
    ...DEFAULT_HEALTH_PROBE_CONFIG,
    ...configOverrides,
  }

  const probe: HealthProbe = {
    id: generateId(),
    phase,
    status: 'healthy',
    metrics: {
      durationMs: 0,
      tokenEstimate: 0,
      errorCount: 0,
      lastChecked: new Date().toISOString(),
    },
    startedAt: new Date().toISOString(),
  }

  const intervalId = setInterval(() => {
    const internal = probes.get(probe.id)
    if (internal && internal.callback) {
      internal.probe.metrics.lastChecked = new Date().toISOString()
      internal.callback(internal.probe)
    }
  }, config.intervalMs)

  probes.set(probe.id, {
    probe,
    intervalId,
    callback,
    config,
  })

  return probe
}

export function stopHealthProbe(id: string): boolean {
  const internal = probes.get(id)

  if (!internal) {
    return false
  }

  if (internal.intervalId) {
    clearInterval(internal.intervalId)
    internal.intervalId = null
  }

  internal.probe.stoppedAt = new Date().toISOString()

  return true
}

export function getHealthProbe(id: string): HealthProbe | undefined {
  const internal = probes.get(id)
  return internal?.probe
}

export function getAllHealthProbes(): HealthProbe[] {
  return Array.from(probes.values()).map((internal) => internal.probe)
}

export function clearHealthProbes(): void {
  for (const internal of probes.values()) {
    if (internal.intervalId) {
      clearInterval(internal.intervalId)
    }
  }
  probes.clear()
}

export function updateHealthMetrics(id: string, updates: Partial<HealthMetrics>): boolean {
  const internal = probes.get(id)

  if (!internal) {
    return false
  }

  const { probe, config, callback } = internal
  const previousStatus = probe.status

  if (updates.durationMs !== undefined) {
    probe.metrics.durationMs = updates.durationMs
  }

  if (updates.tokenEstimate !== undefined) {
    probe.metrics.tokenEstimate = updates.tokenEstimate
  }

  if (updates.errorCount !== undefined) {
    probe.metrics.errorCount = updates.errorCount
  }

  probe.metrics.lastChecked = new Date().toISOString()
  probe.status = determineStatus(probe.metrics, config)

  if (callback && probe.status !== previousStatus && probe.status !== 'healthy') {
    callback(probe)
  }

  return true
}

export function checkTokenPressure(id: string, threshold?: number): boolean {
  const internal = probes.get(id)

  if (!internal) {
    return false
  }

  const effectiveThreshold = threshold ?? internal.config.tokenWarningThreshold
  const tokenRatio = internal.probe.metrics.tokenEstimate / TOKEN_ESTIMATE_MAX

  return tokenRatio >= effectiveThreshold
}
