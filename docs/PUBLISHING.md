# Publishing

The intended public home for Gleislicht is GitHub Pages. During development, private previews may be used for feedback, but they are not the canonical deployment.

## Why the build is Pages-ready

- Vite emits a static `dist/` directory.
- `base: './'` keeps scripts, styles and data assets working both at a domain root and beneath `/gleislicht/`.
- The GTFS pipeline runs before release; the published site reads only the validated static artifacts and needs no server or secret.

## Release shape

The public repository is `emmettl/gleislicht`, and its canonical site is:

<https://emmettl.github.io/gleislicht/>

The Pages workflow installs with `npm ci`, regenerates national rail/PostBus and the three regional morning/full-day studies in parallel for one Europe/Zurich service day, runs tests, typechecking and linting, builds the static client, and uploads only `dist/`. It deploys on every push to `main`, runs once each morning and can also be started manually. LIVE is compiled into a deployment only when the Cloudflare health metadata exactly matches the regenerated timetable; otherwise the deterministic operations demo remains available. GitHub's `github-pages` environment records the public URL and prevents a partially validated build from replacing the current site.

Regional sources come from the official national GTFS permalink, the matching annual [ZVV catalogue resource](https://data.stadt-zuerich.ch/dataset/vbz_fahrplandaten_gtfs), [SITG TPG lines](https://sitg.ge.ch/donnees/tpg-lignes), and FOT rail geometry. Download failures recover the last published regional set only after verifying all 42 files, matching morning/day dates, geometry references, chunk hashes and transfer budgets. Generation or validation failures stop publication. Dates are never relabelled as current. If recovery also fails, the existing site remains deployed. See [EXPLORATION.md](EXPLORATION.md).
