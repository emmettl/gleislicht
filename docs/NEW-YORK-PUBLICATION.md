# Local / Express publication review

Reviewed 6 September 2026. This is an engineering release decision, not legal advice.

## Decision

Keep **Local / Express** available as a local, reproducible study, but do not merge or publish its derived MTA artifacts, and do not include `/new-york.html` in the public GitHub Pages bundle, until MTA provides written clarification or an appropriate licence. The current repository is public, so committing a derived fixture is itself publication; the workspace proof must remain uncommitted until this gate is resolved.

The ambiguity is narrow but material. The [MTA data-feed agreement](https://www.mta.info/developers/terms-and-conditions), updated 13 March 2024, expressly allows a developer to download and host feed data on a non-MTA server and to use only part of a feed. It also says that a developer must not modify or delete feed data. The corridor artifact selects trips, converts the ZIP tables into a compact application schema, derives indexes and scheduled-order-reversal events, and simplifies fields. That is a transformation even though source values and provenance remain traceable.

The [MTA developer page](https://www.mta.info/developers) says its feeds are free to use while separately requiring a licence for logos, maps, symbols and other MTA intellectual property. The linked [MTA Licensing Program](https://www.mta.info/doing-business-with-us/licensing-program) lists maps, station names, subway route indicators and rolling stock among its licensing categories. The study uses plain station names and route numerals but no MTA logo, route bullet, map artwork, signage system, rolling-stock likeness or official line-colour specification. That reduces confusion and copying risk; it does not resolve whether the separate licence requirement applies.

## Conditions already met

- Data is fetched during compilation and served only from a project-controlled host.
- The interface identifies MTA as the source without stating or implying MTA endorsement, approval or hosting.
- The study is labelled scheduled and not realtime; it does not claim completeness, observed operation or physical track assignment.
- The original archive URL, retrieval time, feed version and SHA-256 are retained in the artifact metadata.
- The visual system, diagram geometry and colour treatment are original rather than copied from an MTA map or identity asset.
- Keyboard navigation, reduced motion, non-WebGL fallback and phone viewport checks are part of the browser gate.

## Clarification to request

Before public release, ask `MTALicensing@nyct.com` whether a free, non-commercial browser artwork may:

1. publish a compact transformed subset of regular Subway GTFS on its own static host;
2. display plain station names and route numerals without MTA route bullets, logos, colours or map artwork;
3. retain derived service-pattern comparisons and interpolation while clearly labelling them as the application's analysis rather than MTA data; and
4. distribute the compiler source and reproducibility metadata without redistributing the original ZIP.

If MTA requires a licence, retain the response and agreement alongside the source manifest before enabling Pages publication. If MTA permits feed transformation under the existing agreement, record that clarification and remove the explicit publication exclusion. If neither is available, replace the public proof with generated or separately licensed data rather than weakening the provenance language.

## Build gate

`npm run pages:prepare` removes the New York HTML entry, morning data, authored context and progressive-day files from `dist`; the local page also carries `noindex,nofollow`. CI is shaped to run New York compilation, integrity, payload and browser checks before that step once the proof is eligible to merge. Removing the gate requires a deliberate change to the exclusion manifest and this review.
