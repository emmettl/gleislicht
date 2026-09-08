import type { HubCall, HubDefinition } from '@motionstudies/core/domain/hub'
import { platformCodeForCall } from '@motionstudies/core/domain/hub'
import { formatServiceTime } from '@motionstudies/core/domain/network'
import type { SwitzerlandHubId } from '../editions/switzerland.ts'
import type { UiText } from '../locales/en.ts'

interface Props {
  selectedHub: HubDefinition<SwitzerlandHubId>
  hubStudy: 'pulse' | 'station'
  setHubStudy: (study: 'pulse' | 'station') => void
  showTaktOverlay: boolean
  onToggleGrid: () => void
  nearbyCallCount: number
  platformCount: number
  callCount: number
  upcomingHubCall?: HubCall
  numberFormat: Intl.NumberFormat
  text: UiText
}

export default function HubCard({ selectedHub, hubStudy, setHubStudy, showTaktOverlay, onToggleGrid, nearbyCallCount, platformCount, callCount, upcomingHubCall, numberFormat, text }: Props) {
  return (
        <section
          className="journey-card hub-card"
          aria-label={`${selectedHub.name} ${hubStudy === 'pulse' ? text.pulse : text.stationFlow}`}
        >
          <div className="hub-card-header">
            <p className="hub-kicker">
              {hubStudy === 'pulse' ? text.taktLoop : text.stationPlatforms}
            </p>
            <div className="hub-study-picker" aria-label={text.taktVisualisation}>
              <button
                type="button"
                data-tooltip={text.controlHelp.pulse}
                aria-pressed={hubStudy === 'pulse'}
                onClick={() => setHubStudy('pulse')}
              >
                {text.pulse}
              </button>
              <button
                type="button"
                data-tooltip={text.controlHelp.tracks}
                aria-pressed={hubStudy === 'station'}
                onClick={() => setHubStudy('station')}
              >
                {text.tracks}
              </button>
              {hubStudy === 'pulse' && (
                <button
                  type="button"
                  data-tooltip={showTaktOverlay ? text.controlHelp.gridOff : text.controlHelp.gridOn}
                  aria-pressed={showTaktOverlay}
                  onClick={() => onToggleGrid()}
                >
                  {text.quarterGrid}
                </button>
              )}
            </div>
          </div>
          <div className="network-count-row">
            <strong>{nearbyCallCount}</strong>
            <span>
              {hubStudy === 'pulse'
                ? text.orbitMovements
                : text.stationMovements}
            </span>
          </div>
          <p className="between">
            {text.hubCharacter[selectedHub.id]} <span>/</span>{' '}
            {hubStudy === 'station'
              ? text.scheduledTracks(platformCount)
              : text.callsToday(numberFormat.format(callCount))}
          </p>
          <div className="metric-grid">
            <div>
              <span>{text.nextStrike}</span>
              <strong>
                {upcomingHubCall ? formatServiceTime(upcomingHubCall.arrival) : '—'}
              </strong>
              <small>
                {upcomingHubCall
                  ? `${upcomingHubCall.train.route} · ${text.trackShort} ${platformCodeForCall(upcomingHubCall)}`
                  : text.end}
              </small>
            </div>
            <div>
              <span>{text.direction}</span>
              <strong className="destination-metric">
                {upcomingHubCall?.train.headsign ?? '—'}
              </strong>
            </div>
          </div>
        </section>
  )
}
