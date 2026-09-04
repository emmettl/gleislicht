# Publishing

The intended public home for Gleislicht is GitHub Pages. During development, private previews may be used for feedback, but they are not the canonical deployment.

## Why the build is Pages-ready

- Vite emits a static `dist/` directory.
- `base: './'` keeps scripts, styles and data assets working both at a domain root and beneath `/gleislicht/`.
- The GTFS pipeline runs before release; the published site reads only the committed compact snapshot and needs no server or secret.

## Release shape—when the project is ready

1. Create or connect the GitHub repository.
2. Add a GitHub Actions Pages workflow that installs with `npm ci`, runs the checks, builds, and uploads `dist/`.
3. Protect the production environment and publish only from `main` after the data snapshot and attribution are reviewed.
4. Set the repository's Pages source to GitHub Actions.

The workflow is intentionally not added yet: pushing source should not make the current study public before it is ready.
