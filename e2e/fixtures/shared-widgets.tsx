import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MobilePicker } from '@motionstudies/web/components/MobilePicker'
import { createDataUrlResolver } from '@motionstudies/web/data-url'
import { useProgressiveNetworkDay } from '@motionstudies/web/use-progressive-network-day'
import { useProgressiveAirDay } from '@motionstudies/web/use-progressive-air-day'
import { useProgressiveRoadStudy } from '@motionstudies/web/use-progressive-road-study'
import { useObservedOperations } from '@motionstudies/web/use-observed-operations'
import '@motionstudies/web/tokens.css'
import '@motionstudies/web/mobile-picker.css'

function ObservationFixture() {
  const [enabled, setEnabled] = useState(false)
  const [endpoint, setEndpoint] = useState('a')
  const state = useObservedOperations(`/observation-data/${endpoint}.json`, enabled, 40)
  return <section>
    <select aria-label="Observation endpoint" value={endpoint} onChange={(event) => setEndpoint(event.target.value)}>
      {['a', 'b', 'slow', 'fail'].map((value) => <option key={value}>{value}</option>)}
    </select>
    <button onClick={() => setEnabled((value) => !value)}>{enabled ? 'Stop observations' : 'Start observations'}</button>
    <output data-testid="observations" data-source={state.snapshot?.metadata.publisher ?? ''} data-loading={state.loading} data-error={state.error} />
  </section>
}

// Deliberately imports no edition code, app stylesheet, provider or real dataset.
export function SharedWidgets() {
  const [observationsMounted, setObservationsMounted] = useState(true)
  const [kind, setKind] = useState('network')
  const [dataset, setDataset] = useState('a')
  const [root, setRoot] = useState('/lab-data/primary/')
  const [active, setActive] = useState(false)
  const [time, setTime] = useState(5)
  const [choice, setChoice] = useState('one')
  const resolveAssetUrl = useMemo(() => createDataUrlResolver(root), [root])
  const network = useProgressiveNetworkDay(`network/${dataset}.json`, active && kind === 'network', time, resolveAssetUrl)
  const air = useProgressiveAirDay(`air/${dataset}.json`, active && kind === 'air', time, resolveAssetUrl)
  const road = useProgressiveRoadStudy(`road/${dataset}.json`, active && kind === 'road', time, resolveAssetUrl)
  const state = kind === 'network' ? network : kind === 'air' ? air : road
  const snapshot = kind === 'network' ? network.network : kind === 'air' ? air.snapshot : road.snapshot
  return (
    <main style={{ padding: 24, display: 'grid', gap: 20, maxWidth: 600 }}>
      <button onClick={() => setObservationsMounted((value) => !value)}>{observationsMounted ? 'Unmount observations' : 'Mount observations'}</button>
      {observationsMounted && <ObservationFixture />}
      <MobilePicker ariaLabel="Example picker" value={choice} onChange={setChoice} options={[
        { value: 'one', label: 'One', detail: 'First option' },
        { value: 'two', label: 'Two', detail: 'Second option' },
      ]} />
      <MobilePicker ariaLabel="Empty picker" value="" onChange={() => {}} options={[]} triggerLabel="No options" />
      <output data-testid="choice">{choice}</output>
      <label>Loader <select value={kind} onChange={(event) => setKind(event.target.value)}>
        {['network', 'air', 'road'].map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <label>Dataset <select value={dataset} onChange={(event) => setDataset(event.target.value)}>
        {['a', 'b', 'slow', 'missing', 'empty'].map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <button onClick={() => setActive((value) => !value)}>{active ? 'Disable' : 'Enable'}</button>
      <button onClick={() => setRoot('/lab-data/alternate/')}>Change asset root</button>
      <button onClick={() => setTime(15)}>Next chunk</button>
      <button onClick={() => setTime(5)}>First chunk</button>
      <output data-testid="state" data-model={snapshot?.metadata.model ?? ''}
        data-ready={state.chunkReady} data-error={state.error}
        data-loading={state.loading} data-unavailable={state.unavailable}>
        {JSON.stringify({ ready: state.chunkReady, model: snapshot?.metadata.model, error: state.error })}
      </output>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><SharedWidgets /></StrictMode>)
