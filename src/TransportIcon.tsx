import type { CSSProperties } from 'react'
import type { ServiceCategory } from '@motionstudies/core/domain/network'
import train from './assets/sbb/train-small.svg?no-inline'
import tram from './assets/sbb/tram-small.svg?no-inline'
import bus from './assets/sbb/bus-small.svg?no-inline'
import boat from './assets/sbb/boat-profile-small.svg?no-inline'
import cableCar from './assets/sbb/cable-car-profile-small.svg?no-inline'
import funicular from './assets/sbb/funicular-profile-small.svg?no-inline'
import cogwheel from './assets/sbb/rack-railaway-profile-small.svg?no-inline'
import airplane from './assets/sbb/airplane-small.svg?no-inline'
import car from './assets/sbb/car-small.svg?no-inline'
import other from './assets/sbb/circle-question-mark-small.svg?no-inline'
import './transport-icon.css'

type TransportMode = ServiceCategory | 'cogwheel' | 'air' | 'road'

const icons: Record<TransportMode, string> = {
  international: train,
  intercity: train,
  interregio: train,
  'regional-express': train,
  's-bahn': train,
  regional: train,
  metro: train,
  tram,
  bus,
  ferry: boat,
  cableway: cableCar,
  funicular,
  cogwheel,
  air: airplane,
  road: car,
  other,
}

/** Official SBB artwork; the adjacent label supplies the accessible name. */
export function TransportIcon({ mode, color }: { mode: TransportMode; color?: string }) {
  return (
    <span
      className="transport-icon"
      aria-hidden="true"
      style={{ '--transport-icon': `url("${icons[mode]}")`, color } as CSSProperties}
    />
  )
}
