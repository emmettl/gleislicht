import { useMemo, type ComponentProps } from 'react'
import { AirportHeroCard } from '@motionstudies/web/components/AirportHeroCard'
import { airportBoardMovements } from '@motionstudies/core/domain/airport'
import type { UiLanguage } from '../i18n.ts'
import { AIRPORT_LABELS, AIRPORT_NOTES } from './airport-copy.ts'
import '@motionstudies/web/airport-hero-card.css'
import './airport-card.css'
type Props = Omit<ComponentProps<typeof AirportHeroCard>, 'departures' | 'arrivals' | 'note' | 'labels' | 'airport'> & {
  airport: Parameters<typeof airportBoardMovements>[1]
  language: UiLanguage
  aircraft: Parameters<typeof airportBoardMovements>[0]
}
export default function AirportCard({ language, aircraft, ...props }: Props) {
  const movements = useMemo(() => airportBoardMovements(aircraft, props.airport), [aircraft, props.airport])
  return <AirportHeroCard {...props} {...movements} labels={AIRPORT_LABELS[language]} note={<><a href="https://www.adsb.lol/docs/open-data/historical/">ADSB.lol</a> · ODbL · <a href="https://ourairports.com/data/">OurAirports</a> · {AIRPORT_NOTES[language]}</>} />
}
