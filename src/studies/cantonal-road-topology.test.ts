import { afterEach, describe, expect, it, vi } from 'vitest'
import national from '../../public/data/swiss-road-topology.json'
import cantonal from '../../public/data/zurich-cantonal-road-topology.json'
import type { RoadTopologySnapshot } from '@motionstudies/core/domain/road'
import { loadCantonalRoadGeometry, withCantonalRoadGeometry, type CantonalRoadTopology } from './cantonal-road-topology.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
describe('optional cantonal road geometry', () => {
  it('adds classified roads while keeping every federal site, section and coverage field intact', () => {
    const result = withCantonalRoadGeometry(national as unknown as RoadTopologySnapshot, cantonal as unknown as CantonalRoadTopology)
    expect(result.roads).toHaveLength(national.roads.length + cantonal.roads.length)
    expect(result.sites).toBe(national.sites)
    expect(result.sections).toBe(national.sections)
    expect(result.metadata).toBe(national.metadata)
    expect(cantonal.metadata.coverage.stationStatus.matched).toBe(298)
    expect(result.roads.find(({ id }) => id === 'ZH:17')?.stationCount).toBeGreaterThan(0)
  })
  it('rejects road-ID collisions and premature directional playback data', () => {
    expect(() => withCantonalRoadGeometry(national as unknown as RoadTopologySnapshot, { ...cantonal, roads: [{ ...cantonal.roads[0], id: 'N1' }] } as unknown as CantonalRoadTopology)).toThrow('collision')
    expect(() => withCantonalRoadGeometry(national as unknown as RoadTopologySnapshot, { ...cantonal, sections: [{}] } as unknown as CantonalRoadTopology)).toThrow('Invalid cantonal')
  })
  it('falls back to national roads when the optional source fails, but preserves cancellation', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    const controller = new AbortController()
    await expect(loadCantonalRoadGeometry(national as unknown as RoadTopologySnapshot, '/cantonal.json', controller.signal)).resolves.toBe(national)
    controller.abort()
    await expect(loadCantonalRoadGeometry(national as unknown as RoadTopologySnapshot, '/cantonal.json', controller.signal)).rejects.toThrow()
    vi.restoreAllMocks()
  })
  it('bounds an unresponsive optional request so national geometry remains available', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    const result = loadCantonalRoadGeometry(national as unknown as RoadTopologySnapshot, '/cantonal.json', new AbortController().signal)
    await vi.advanceTimersByTimeAsync(8000)
    await expect(result).resolves.toBe(national)
  })
})
