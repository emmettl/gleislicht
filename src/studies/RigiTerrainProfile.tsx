import { useMemo } from 'react'
import './rigi-terrain-profile.css'
import type { CorridorSnapshot } from '@motionstudies/core/domain/corridor'
import type { UiLanguage } from '../i18n.ts'
import { RIGI_TERRAIN_COPY } from './rigi-terrain.ts'

export default function RigiTerrainProfile({ corridor, progress, language }: { corridor: CorridorSnapshot; progress: number; language: UiLanguage }) {
  const copy = RIGI_TERRAIN_COPY[language]
  const profile = useMemo(() => {
    const points = corridor.route.points
    const samples = points.reduce<{ distance: number; elevation: number }[]>((result, p, i) => {
      const distance = i ? result[i - 1].distance + Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) : 0
      result.push({ distance, elevation: p[2] })
      return result
    }, [])
    const length = samples.at(-1)!.distance
    const min = Math.min(...samples.map(s => s.elevation)), max = Math.max(...samples.map(s => s.elevation))
    return { samples, length, min, range: Math.max(1, max - min) }
  }, [corridor])
  const fraction = Math.max(0, Math.min(1, progress))
  const distance = fraction * profile.length
  const endIndex = profile.samples.findIndex(s => s.distance >= distance)
  const end = profile.samples[endIndex < 0 ? profile.samples.length - 1 : endIndex]
  const start = profile.samples[Math.max(0, endIndex - 1)]
  const elevation = start.elevation + (end.elevation - start.elevation) * (distance - start.distance) / Math.max(1, end.distance - start.distance)
  const y = (height: number) => 54 - 48 * (height - profile.min) / profile.range
  return <div className="rigi-terrain-profile">
    <div className="metric-grid">
      <div><span>{copy.ground}</span><strong>{Math.round(elevation)}</strong><small>m · LN02</small></div>
      <div><span>{copy.rise}</span><strong>{Math.round(elevation - profile.samples[0].elevation)}</strong><small>m</small></div>
    </div>
    <svg viewBox="0 0 260 60" role="img" aria-label={copy.profile} style={{ display: 'block', width: '100%', height: 52, marginTop: 12 }}>
      <polyline points={profile.samples.map(s => `${4 + 252 * s.distance / profile.length},${y(s.elevation)}`).join(' ')} fill="none" stroke="#fff3a6" strokeWidth="1.5" />
      <circle cx={4 + 252 * fraction} cy={y(elevation)} r="3" fill="#8dfaff" />
    </svg>
    <p className="between">{copy.model}</p>
  </div>
}
