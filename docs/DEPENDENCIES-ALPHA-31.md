# Alpha.31 dependency refresh

30 September 2026. Exact published Motion Studies alpha.31 packages, React 19.3.0, React Three Fiber 9.8.1 and Three.js 0.186.1; Vite 8.3.1, Vitest 5.0.3, Oxlint 1.86.0 and npm 11.21.0.

Opening JavaScript rises from 359.6 to 375.2 KiB gzip. Its ceiling moves from 360 to 380 KiB; CSS/data/optional-helper budgets remain unchanged. The fixture total is 776.9 KiB, but the already-published pinned data is 419.8 KiB and gives a production total of 802.7 KiB (approximately 787.0 KiB with the previous renderer). The total ceiling therefore moves from 792 to 808 KiB, adding the same measured 16 KiB renderer increment. Both fixture and pinned-production budget gates are checked. The frequency-card DOM test now waits for its lazy-loaded translation, preserving the same required text.

Before and after builds used identical committed fixtures and application source (apart from the documented renderer-adapter compatibility change), on Node 24.21.0 / npm 11.21.0. The approximately 15.7 KiB increase is the shared/rendering dependency refresh, not additional downloaded data. These measured baselines retain explicit transfer limits.
