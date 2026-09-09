import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitalResolutionBudget } from './orbital-performance.ts'

export default function OrbitalPerformance({ onResolution }: { onResolution: (dpr: number) => void }) {
  const budget = useMemo(() => new OrbitalResolutionBudget(), [])
  useFrame(({ viewport }, delta) => {
    const next = budget.sample(delta, viewport.dpr, Math.min(1.5, window.devicePixelRatio || 1))
    if (next !== viewport.dpr) onResolution(next)
  })
  return null
}
