# Motion Studies packages

Private release candidates for the shared transport instrument. The source workspace and compiled distributions expose the same explicit, extensionless module subpaths. No registry publication is enabled yet.

- `@motionstudies/core`: transport contracts, indexing, interpolation and visual theme contracts; no browser or Node dependencies.
- `@motionstudies/three`: `NationalNetworkScene`, `HubPulseScene`, `StationFlowScene`, camera framing and label-mode contracts. React, React Three Fiber and Three.js are peers; rendering internals are not public subpaths.
- `@motionstudies/web`: picker, theme application, mounting, progressive loaders, observed operations and recording. Import `tokens.css` and `mobile-picker.css` for isolated widgets. `shell.css` is an optional full-page study shell scoped to `.motion-study`; `mountMotionStudy` applies that class. Fonts and edition layouts belong to consumers.
- `@motionstudies/data`: Node-only GTFS readers, network chunking, merging and station ranking. ZIP reading requires `unzip` on the host. Source selection, provenance overrides and compilation commands belong to each edition.

```tsx
import { MobilePicker } from '@motionstudies/web/components/MobilePicker'
import { createDataUrlResolver } from '@motionstudies/web/data-url'
import { useProgressiveNetworkDay } from '@motionstudies/web/use-progressive-network-day'
import '@motionstudies/web/tokens.css'
import '@motionstudies/web/mobile-picker.css'

const resolveData = createDataUrlResolver('/my-edition/data/')
// Inside a React component:
// const day = useProgressiveNetworkDay('day.json', enabled, time, resolveData)
```

Keep the resolver stable across renders. Manifest paths and their chunk paths are relative to the supplied asset root. Changing the resolved manifest URL resets the loader; disabling cancels requests, and re-enabling retries failures. Optional road manifests distinguish a 404 from an error. Observations poll serially; changing their endpoint drops the previous source's state, and disabling/unmounting cancels the request and timer.

Build release candidates with `npm run build:packages`. Distribution manifests and compiled ESM/declarations are written to `.package-dist/`; workspace manifests continue to point at source for fast local iteration. `npm run check:packed` packs and installs those distributions into a separate consumer, builds the lab and validates the public exports. No source aliases or workspace links are used in that consumer.

Publication requires deliberately choosing versions, licence and registry settings and removing the private flag. Candidate packages remain private and unlicensed during preparation.
