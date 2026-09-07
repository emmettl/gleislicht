# Independent edition boundary

Gleislicht owns the Swiss application, translations, soundtrack, regional and corridor studies, data compilers, committed Swiss artifacts, and Swiss realtime/ASTRA workers. It consumes exact `0.1.0-alpha.2` releases of `@motionstudies/core`, `three`, `web` and Node-only `data` from npm. No shared workspaces or widget lab remain here.

[Motion Studies](https://github.com/emmettl/motionstudies) owns package source, public exports, the widget lab, shared regression tests and coordinated releases. [All Change](https://github.com/emmettl/allchange) owns London, including its observation worker. [Correspondances](https://github.com/emmettl/correspondances) owns Paris. Local / Express has a private extraction and retains its publication hold.

`npm run check:architecture` checks exact installed releases against registry lock entries, rejects linked sources and undeclared/private imports. `npm run pages:prepare` requires one Swiss application entry, rejects foreign datasets and New York publication, and verifies the London/Paris compatibility redirects. Swiss browser tests, data budgets and worker checks run in this repository. The daily timetable regeneration and live-feed compatibility gate are preserved.

Update shared code in Motion Studies, exercise the lab and release gates, publish a coordinated version, then update edition pins and lockfiles. Each edition runs its own regression gates before deployment. Package history remains in Motion Studies; edition extractions retain selected Git history. The pre-split readiness report is historical evidence.
