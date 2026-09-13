# Publishing

The public home for Gleislicht is https://motionstudies.app/gleislicht/. GitHub Pages remains an available mirror and the validated artifact source for Cloudflare publication. Private Sites previews are development surfaces, not the canonical deployment.

## Why the build is Pages-ready

- Vite emits a static `dist/` directory.
- `base: './'` keeps scripts, styles and data assets working both at a domain root and beneath `/gleislicht/`.
- The GTFS pipeline runs before release. The static client reads validated timetable artifacts and the public realtime endpoint; upstream credentials remain in the separate Worker.

## Release shape

The public repository is `emmettl/gleislicht`. Its canonical site is <https://motionstudies.app/gleislicht/> and the Pages mirror is <https://emmettl.github.io/gleislicht/>.

After a successful main-branch Pages release, `.github/workflows/cloudflare.yml` publishes that exact validated artifact using trusted main-branch publishing tools. It verifies the source run, release provenance and live headers. Failed browser or data gates retain the previous public release. The canonical site exposes `/_release.json` beneath `/gleislicht/`, recording the actual deployed commit and source run; repository HEAD alone does not establish publication. The existing GitHub environment is still named `cloudflare-pilot`, but it now serves production publication.

The Pages workflow installs with `npm ci`, regenerates national rail/PostBus and Zürich city, ZVV, Geneva and Lausanne for both today and tomorrow in Europe/Zurich, runs tests, typechecking and linting, and publishes a verified immutable R2 data release. The static client is pinned to that release; only the app's `dist/` artifact is uploaded to Pages. It deploys on every push to `main`, runs at 03:37 and 18:37 UTC, and can also be started manually. Calendar builds configure LIVE as a runtime capability; the browser applies corrections only when the Worker response is fresh and exactly matches the displayed feed and date. GitHub's `github-pages` environment records the mirror URL and prevents a partially validated build from replacing the current site. See [regular refreshes](REGULAR-REFRESHES.md) for the completed rollout, midnight behavior and monitoring.

Regional sources come from the official national GTFS permalink, the matching annual [ZVV catalogue resource](https://data.stadt-zuerich.ch/dataset/vbz_fahrplandaten_gtfs), [SITG TPG lines](https://sitg.ge.ch/donnees/tpg-lignes), and FOT rail geometry. Download failures may recover verified published artifacts with their original dates, geometry references, chunk hashes and transfer budgets. The calendar still requires the exact two requested dates, so an older fallback for a daily feed stops publication. Basel, Bern, Solothurn, Nyon and Riviera follow their reviewed-date policies. Generation or validation failures retain the existing public release. See [EXPLORATION.md](EXPLORATION.md).
