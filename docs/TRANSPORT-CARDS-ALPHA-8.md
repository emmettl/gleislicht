# Shared transport cards · alpha.8

Exact npm `0.1.0-alpha.8` packages provide responsive SBB-style rail and matrix bus cards in station selection. Cards use departures from the current snapshot, omit terminal arrivals, preserve missing platforms and status, and select the corresponding train. English, German, French and Italian labels follow the edition language. Other transport summaries and connection actions remain available.

Station movement counts remain visible. Cards scroll within the available panel and adapt row counts to their measured board size. Scheduled/headway provenance remains edition-owned; snapshot-adjusted times are not adjusted twice.

Validation: 1,425 unit/DOM tests, typecheck, lint, architecture, production build and bundle checks; desktop and iPhone station selection and card sizing. jsdom uses a ResizeObserver stub; browser tests exercise real layout.
