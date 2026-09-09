# Orbital rendering performance

September 2026 pass: preserve terrain detail, cloud shaders, lighting, transport
coverage, tunnel masking and the 20 segments per trail while avoiding repeated work.

- Movement buffers are reused when time, terrain and controls are unchanged.
  Category fades settle to exact endpoints. A pending trail refresh is flushed
  when playback pauses; seeks and control changes bypass the cadence limit.
- Markers update every display frame. Trails use the existing adaptive frame
  budget: at most 30 Hz, dropping to 15 Hz under sustained load and leaving
  alternate frames free even below 15 FPS. Only populated buffer ranges upload;
  an empty draw range never triggers a full-capacity upload.
- The terrain shadow map refreshes after 30 seconds of simulated sun movement,
  terrain replacement or sunlight returning. It is reused while paused and
  during the night. Cloud shadows remain part of the terrain shader.
- Canvas uses the supported PCF mode explicitly. The previous boolean setting
  repeatedly reapplied deprecated PCFSoft mode during stats updates; Three
  converted it back to PCF and invalidated shadow materials.
- Sustained slow frames reduce pixel ratio in 0.25 steps, down to 0.75. Ten seconds
  of fast frames allow a recovery step, up to device resolution capped at 1.5.
  Cooldowns prevent rapid changes. Resolution is controlled by React so Canvas
  reconfiguration cannot reset adaptation during clock/stats updates. DOM controls
  and labels keep their native resolution; Standard/Fine remains the user's choice.
- Hidden tabs stop the orbital render loop. Labels only project while the pointer
  is eligible and only the selected label receives positioning writes. Paused
  cloud uniforms and the altitude number formatter are reused.

## Measurements and regression coverage

`e2e/orbital-performance.spec.ts` samples the actual R3F buffers and renderer in a
local browser at 07:45, standard terrain, sunlight and clouds enabled. In the
Chromium baseline, one second paused rebuilt both point and trail buffers ten
times. After this pass their versions remain unchanged, as does the shadow pass
counter. Both versions retain 4,493 point vertices and 173,900 trail vertices.
Submitted triangles on a cached-shadow frame fall from 852,578 to 570,014 (33%).
In a two-second playback sample under load, markers updated 14 times and trails
7 times. These are work counters, not a prediction of FPS on another laptop.
The adaptive pixel ratio reached and retained 0.75 in the slow-renderer run.

The browser regression also checks that seeking invalidates paused buffers and
shadows, playback resumes, and setting trail duration to zero clears the draw
range. Unit tests cover resolution backoff, recovery, slow rendering, background
gaps, shadow invalidation and the shared adaptive trail scheduler. Existing
terrain interpolation and transport/tunnel tests protect geometry semantics.

Run `npx playwright test e2e/orbital-performance.spec.ts --workers=1` for the
browser regression. CI's Node 24 production build and unchanged first-view bundle
budgets must still pass; orbital additions remain loaded on demand.
