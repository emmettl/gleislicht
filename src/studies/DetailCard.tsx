import PerformanceMonitor from './PerformanceMonitor.tsx'
import TrainCard from './TrainCard.tsx'
import type { ComponentProps } from 'react'
import AircraftCard from './AircraftCard.tsx'
import HubCard from './HubCard.tsx'
import ContrastCard from './ContrastCard.tsx'
import StationCard from './StationCard.tsx'
import RouteCard from './RouteCard.tsx'

type Props =
  | ({ kind: 'TrainCard' } & ComponentProps<typeof TrainCard>)
  | { kind: 'performance' }
  | ({ kind: 'AircraftCard' } & ComponentProps<typeof AircraftCard>)
  | ({ kind: 'HubCard' } & ComponentProps<typeof HubCard>)
  | ({ kind: 'ContrastCard' } & ComponentProps<typeof ContrastCard>)
  | ({ kind: 'StationCard' } & ComponentProps<typeof StationCard>)
  | ({ kind: 'RouteCard' } & ComponentProps<typeof RouteCard>)

// One deferred chunk keeps selection details out of the opening map bundle.
export default function DetailCard(props: Props) {
  switch (props.kind) {
    case 'TrainCard': return <TrainCard {...props} />
    case 'performance': return <PerformanceMonitor />
    case 'AircraftCard': return <AircraftCard {...props} />
    case 'HubCard': return <HubCard {...props} />
    case 'ContrastCard': return <ContrastCard {...props} />
    case 'StationCard': return <StationCard {...props} />
    case 'RouteCard': return <RouteCard {...props} />
  }
}
