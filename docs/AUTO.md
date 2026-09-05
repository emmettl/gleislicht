# AUTO — Road Study 001

AUTO is Gleislicht's third transport grammar. It does not pretend to track cars. It reconstructs a moving field from aggregate road-counter flow and speed, preserving the distinction between three ways movement becomes legible as data.

| Mode | What is known | What Gleislicht constructs |
| --- | --- | --- |
| Rail | Timetabled stop events | Interpolated journeys |
| LUFT | Broadcast position and velocity | Smoothed observed trajectories |
| AUTO | Aggregate directional flow and mean speed | Synthetic traffic particles |

## Road Study 001

The first study follows the A1 through the Zürich region, from the Aargau side through Zürich to Winterthur. Its path is anchored by georeferenced sites in the current ASTRA / Federal Roads Office Measurement Site Table. It shares the national 06:45–08:45 clock and is a separately loaded static JSON artifact, so the railway-first opening payload is unchanged.

The committed traffic values are **representative calibration**, not historical observations. ASTRA's realtime feed retains only the latest complete minute. Gleislicht has not yet accumulated an authenticated archive, so the prototype uses deterministic morning curves to test the visual and interaction model over authentic detector geography.

The artifact says this in machine-readable metadata:

```text
measurementKind: representative-calibration
model: Traffic-flow reconstruction / no vehicle tracking
```

## Reconstruction

For flow `q` in vehicles/hour and mean speed `v` in kilometres/hour, the estimated density is `k = q / v` vehicles per kilometre. The renderer takes a stable visual sample from that density, spaces marks along the physical corridor and advances them using the interpolated mean speed. Light vehicles appear as warm-white streaks; heavy vehicles are larger amber marks. Speed is integrated through the minute samples so neither scrubbing nor a new counter minute makes the stream jump.

The number shown in the status card is an approximate corridor occupancy derived from density and corridor length. A rendered mark represents part of an aggregate flow, never a particular road user.

## Artifact

- Builder: `npm run data:road`
- Output: `public/data/swiss-road-morning.json`
- Cadence: one minute
- Window: 06:45–08:45 on the shared study day
- Loading: only after AUTO is selected

## From calibration to recorded data

The next data step is a small authenticated recorder which makes one permitted SOAP/DATEX II pull per minute and writes append-only snapshots with receipt time, source publication time and detector-table version. Once a continuous hour passes completeness checks, it can replace the calibration samples without changing the browser contract or renderer.

Possible later studies include the A2 Gotthard approach and a full recorded day. `Fahrstrom` remains an appealing artwork title, but AUTO is the unambiguous interface name while the project also depicts railway traction infrastructure.
