# Publishing

The public home for Gleislicht is https://motionstudies.app/gleislicht/. GitHub Pages remains an available mirror and the validated artifact source for Cloudflare publication. Private Sites previews are development surfaces, not the canonical deployment.

## Why the build is Pages-ready

- Vite emits a static `dist/` directory.
- `base: './'` keeps scripts, styles and data assets working both at a domain root and beneath `/gleislicht/`.
- The GTFS pipeline runs before release; the published site reads only the validated static artifacts and needs no server or secret.

## Release shape

The public repository is `emmettl/gleislicht`. Its canonical site is <https://motionstudies.app/gleislicht/> and the Pages mirror is <https://emmettl.github.io/gleislicht/>.

After a successful main-branch Pages release, `.github/workflows/cloudflare.yml` publishes that exact validated artifact using the pinned Motion Studies hosting tools. It verifies the source run, release provenance and live headers. Failed browser or data gates retain the previous public release. The canonical site exposes `/_release.json` beneath `/gleislicht/`, recording the actual deployed commit and source run; repository HEAD alone does not establish publication. The existing GitHub environment is still named `cloudflare-pilot`, but it now serves production publication.

The Pages workflow installs with `npm ci`, regenerates national rail/PostBus and the three regional morning/full-day studies in parallel for one Europe/Zurich service day, runs tests, typechecking and linting, builds the static client, and uploads only `dist/`. It deploys on every push to `main`, runs once each morning and can also be started manually. LIVE is compiled into a deployment only when the Cloudflare health metadata exactly matches the regenerated timetable; otherwise the deterministic operations demo remains available. GitHub's `github-pages` environment records the public URL and prevents a partially validated build from replacing the current site.

Regional sources come from the official national GTFS permalink, the matching annual [ZVV catalogue resource](https://data.stadt-zuerich.ch/dataset/vbz_fahrplandaten_gtfs), [SITG TPG lines](https://sitg.ge.ch/donnees/tpg-lignes), and FOT rail geometry. Download failures recover the last published regional set only after verifying all 42 files, matching morning/day dates, geometry references, chunk hashes and transfer budgets. Generation or validation failures stop publication. Dates are never relabelled as current. If recovery also fails, the existing site remains deployed. See [EXPLORATION.md](EXPLORATION.md).
