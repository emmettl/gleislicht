# Alpha.31 dependency refresh

30 September 2026. Exact published Motion Studies alpha.31 packages, React 19.3.0, React Three Fiber 9.8.1 and Three.js 0.186.1; Vite 8.3.1, Vitest 5.0.3, Oxlint 1.86.0 and npm 11.21.0.

Opening JavaScript rises from 359.6 to 375.2 KiB gzip. Its ceiling moves from 360 to 380 KiB; the 792 KiB total ceiling and CSS/data/optional-helper budgets remain unchanged. The current fixture total is 776.9 KiB. The frequency-card DOM test now waits for its lazy-loaded translation, preserving the same required text.

Before and after builds used identical committed fixtures and application source (apart from the documented renderer-adapter compatibility change), on Node 24.21.0 / npm 11.21.0. The approximately 15.7 KiB increase is the shared/rendering dependency refresh, not additional downloaded data. These measured baselines retain explicit transfer limits.
