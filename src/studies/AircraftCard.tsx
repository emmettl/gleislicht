import type { AirTrack, AirPosition } from '@motionstudies/core/domain/air'
import type { UiText } from '../locales/en.ts'

interface Props {
  selectedAirTrack: AirTrack
  selectedAirPosition?: AirPosition
  numberFormat: Intl.NumberFormat
  text: UiText
}

export default function AircraftCard({ selectedAirTrack, selectedAirPosition, numberFormat, text }: Props) {
  return (
        <section
          className="journey-card selected-card air-card"
          aria-label={text.observedAircraft}
        >
          <div className="service-row">
            <span className="air-card-mark" aria-hidden="true">
              ✦
            </span>
            <span className="service">{selectedAirTrack.callsign}</span>
            <span className="arrow">↗</span>
            <span>{text.luftraum}</span>
          </div>
          <p className="between">
            {selectedAirPosition
              ? `${text.heading} ${Math.round(selectedAirPosition.headingDegrees)
                  .toString()
                  .padStart(3, '0')}°`
              : text.signalGap}{' '}
            <span>/</span>{' '}
            {(selectedAirTrack.icaoAddress ?? selectedAirTrack.id).toUpperCase()}
          </p>
          <p className="air-compact-metrics">
            {selectedAirPosition
              ? `${numberFormat.format(
                  Math.round(selectedAirPosition.altitudeFeet / 100) * 100,
                )} ft · ${numberFormat.format(
                  Math.round(selectedAirPosition.groundSpeedKnots),
                )} kt`
              : text.signalGap}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.altitude}</span>
              <strong>
                {selectedAirPosition
                  ? numberFormat.format(
                      Math.round(selectedAirPosition.altitudeFeet / 100) * 100,
                    )
                  : '—'}
              </strong>
              <small>ft</small>
            </div>
            <div>
              <span>{text.groundSpeed}</span>
              <strong>
                {selectedAirPosition
                  ? numberFormat.format(
                      Math.round(selectedAirPosition.groundSpeedKnots),
                    )
                  : '—'}
              </strong>
              <small>kt</small>
            </div>
          </div>
        </section>
  )
}
