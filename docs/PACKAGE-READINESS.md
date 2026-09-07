# Shared package readiness — 7 September 2026

## Decision

The ownership and distribution blockers from the initial review are addressed. The shared code is ready for a controlled first edition migration, with the lab serving as a consumer and release gate. The repositories have not been split and no packages have been published. Candidate manifests remain private at `0.0.0` until release versions, registry and licensing are deliberately configured.

The renderer remains a substantial implementation, but its internal modules are hidden behind explicit exports. Further internal refactoring can happen without changing consumer imports. There is no need to rewrite it before rehearsing the split.

## Boundaries now in place

| Surface | Ownership and verification |
| --- | --- |
| `@motionstudies/core` | Framework-free transport contracts, indexing, interpolation and visual-theme contracts. Independently typechecked without DOM/Node ambient types. |
| `@motionstudies/three` | Three public scenes plus camera/label contracts. React, React Three Fiber and Three.js remain external peers. The public surface is exercised with synthetic network/hub data, selection, layouts, optional layers, linked views, empty data and remounts. |
| `@motionstudies/web` | Reusable controls, theme application, browser mounting, recording and data lifecycle. Asset roots come from consumers. The picker owns its CSS. Optional full-page shell CSS is scoped to `.motion-study`; fonts, local layouts and authored styles stay in editions. |
| `@motionstudies/data` | Node-only GTFS reading, network chunking/merging and station ranking. Source-specific commands import these helpers instead of the Swiss ingestion command. Merging accepts provenance policy from its caller; the London wrapper retains its TfL metadata. |
| Editions | Their entry points, authored applications, themes, source selection, compilation commands, assets, workers and deployment policies. London, New York and Paris no longer import the Swiss stylesheet. |
| `lab` | An independent Vite/React consumer with its own manifest, fixtures, styles and build. It imports only supported package subpaths; it uses no edition files or real datasets. It is not included in edition Pages artifacts. |

The architecture check parses imports, re-exports, dynamic imports and import types; rejects package escapes, undeclared/reverse dependencies and unsupported subpaths; follows the runtime edition graph including stylesheet ownership; and checks that lab imports stay inside the lab or use packages. All package exports are explicit rather than wildcard source paths. Node builtins are allowed only in the data package.

## Lifecycle repairs

The three progressive loaders share one internal lifecycle. A changed resolved manifest URL clears old manifests, chunks and errors before effects run. Cleanup aborts requests; late responses cannot update another source. Empty manifests report errors, optional road 404s remain unavailable, successful adjacent chunks survive neighbouring failures, and disable/re-enable retries failures.

Observed operations now key state by endpoint, poll only after the previous response settles, and cancel both the active request and next timer when disabled or unmounted. Browser regressions cover endpoint changes, delayed responses, failures, recovery, non-overlapping polls and teardown.

The lab also exposed paused renderers continuing to emit their internal clock. All three public scenes now emit `onTime` only while playing; paused and linked secondary scenes follow the consumer's `time`. The browser specimens exercise playback, pause and remount behavior.

The data extraction also exposed and fixed three general-consumer cases: merging networks without geometry now preserves null path mappings; short chunks receive unique IDs while existing whole-hour artifact names remain unchanged; and the ranking CLI works when no optional catalogue argument is supplied. Archive readers now close their child process when a consumer stops reading early. Unit/script tests cover these behaviors.

## Lab

Run `npm run lab` and open the printed local URL. The lab has four specimens:

- **Controls:** two scoped themes, shared picker selection, empty options, long labels, upward menus and keyboard interaction.
- **Network:** a synthetic three-stop network, controlled playback and selection, geography/diagram mixing, camera commands, optional air/road layers, two linked views, empty data and repeated mounting.
- **Hub:** pulse and track views with sparse or empty calls and controlled playback.
- **Data:** local progressive-day fixtures, source switches, invalid responses, integrity errors and observation polling. The separate regression fixture adds deterministic delayed/failing responses.

Storybook is not required for this surface. Its role can be reconsidered if automatic prop controls or generated API documentation become useful. No catalogue or marketing page is coupled to the lab.

## Distribution rehearsal

`npm run build:packages` emits compiled ESM, declarations and CSS into `.package-dist/`. The source workspace and distribution share the same explicit extensionless export keys. Workspace manifests still point at source for fast development; the generated distribution manifests point at emitted files. React and rendering libraries are not bundled into the packages.

`npm run check:packed` performs the release rehearsal:

1. Build and pack all four candidates. Reject TypeScript implementation sources, test files and source directories in tarballs.
2. Install the tarballs and exact installed tool/peer versions in a separate temporary directory, outside the repository, without workspace symlinks.
3. Import every public JavaScript entry in Node and verify that private rendering/loader subpaths are inaccessible.
4. Typecheck the lab and typed Node-tooling consumers against the installed declarations.
5. Build the lab using only the installed distributions and check for workspace source leakage.
6. Serve that production build and run the same lab specimens in Chromium and iPhone WebKit.
7. Stop the temporary server and remove the temporary consumer. Candidate tarballs remain under `.package-dist/tarballs/` for inspection.

Pages CI now runs this rehearsal after installing browser engines, as well as the existing edition checks. The lab has its own production build and is not added to the four edition entry points.

## Validation

- Architecture, lint, app typecheck, independent runtime-package typechecks and lab typecheck pass.
- 248 unit/script tests pass, including negative boundary cases and offline-tool regressions.
- The packed consumer passes public imports, hidden-subpath checks, typed consumer compilation, production build and all 8 lab browser checks.
- Production edition builds and all four payload/proof gates pass. Swiss opening transfer is about 747 KiB against 790 KiB; London about 536 KiB against 650 KiB. London CSS is about 6.6 KiB, down from 13.1 KiB before the split; New York and Paris also shed the Swiss stylesheet.
- The complete edition browser matrix passes: 125 checks passed and 9 expected platform-specific skips. Together with the packed lab, 133 browser checks pass.
- Worker typechecks and all three worker dry-run builds pass; no workers were deployed.

These checks establish the tested ownership, API and distribution behavior. They are not a claim of exhaustive renderer correctness or a registry publication.

## Next operational step

Move the shared packages, their build/check scripts and the lab together into Motion Studies. Use All Change as the first independent edition and pin exact prerelease versions. Carry its local ingestion/provenance wrappers, fixtures, styles, workers and payload/browser checks with it. Rehearse that end-to-end workflow before moving the remaining editions. Configure publication versions/licensing/registry separately; do not publish the source-workspace directories as if they were compiled distributions.
