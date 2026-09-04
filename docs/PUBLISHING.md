# Publishing

The intended public home for Gleislicht is GitHub Pages. During development, private previews may be used for feedback, but they are not the canonical deployment.

## Why the build is Pages-ready

- Vite emits a static `dist/` directory.
- `base: './'` keeps scripts, styles and data assets working both at a domain root and beneath `/gleislicht/`.
- The GTFS pipeline runs before release; the published site reads only the committed compact snapshot and needs no server or secret.

## Release shape

The public repository is `emmettl/gleislicht`, and its canonical site is:

<https://emmettl.github.io/gleislicht/>

The Pages workflow installs with `npm ci`, runs tests, typechecking and linting, builds the static client, and uploads only `dist/`. It deploys on every push to `main` and can also be started manually. GitHub's `github-pages` environment records the public URL and prevents a partially validated build from replacing the current site.
