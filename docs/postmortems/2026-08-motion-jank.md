# Postmortem: the 2026-07/08 motion-jank campaigns

The regression-prevention document. Months of device rounds (desktop Chrome/Safari,
iPhone Safari incl. Low Power Mode, Galaxy Note 9, Pixel 9) produced today's engine
(PR #240, #251, #252, #256, #258) — and an equally valuable _falsification map_. If you
are investigating a motion-jank report, read (a) and (e) first; before designing any
fix, check (c). History below is recorded as history — for what the code does TODAY,
the code and `docs/architecture/*` win.

## (a) Symptom taxonomy

User reports arrive in these Korean words; distinguishing them is half the diagnosis.

| Term                        | English                               | What it actually is                                                                                                                                                                                                                                                                                                                                  | First checks                                                                        |
| --------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 수렴 떨림 / 지글거림 / 시머 | convergence tremor / sizzle / shimmer | A **spatial** artifact of the slow tail: sub-pixel bilinear resampling (fractional layer offsets washing texture/glyph AA per frame), dither grain sliding, or display-pipeline effects. Frame timing is typically PERFECT while it happens — invisible to rAF/trace metrics; only pixel probes (screenshot energy) or the eye see it.               | Viewing config (emulation? HiDPI scaling?), dpr, snap policy, pure-CSS control page |
| 버벅(임)                    | stutter / jank (frame time)           | A **temporal** artifact: missed/uneven presented frames. Sources split by layer: main-thread famine (player), compositor raster stalls, GPU pipeline compiles, or the browser's own present pacing.                                                                                                                                                  | `__flemoPlayerGaps`, trace with non-forcing categories, which driver routed         |
| 씹힘                        | swallowed opening                     | The flight's first 0–70% never presented: the animation clock aged past the opening while nothing new reached the glass (mount/release commit block on a wall-clocked animation), or the content painted late into an already-moving container (Note 9 mode).                                                                                        | Which tier drove; hold/park state; was the settle gate engaged                      |
| 휙휙                        | whoosh / rushed opening               | Related but distinct from 씹힘 (user-defined 2026-08-12): the 0→60% IS shown but as sparse, rushed frames — wall-clock playback through early load drops = coarse sampling of the fast segment. The player's capped clock is structurally immune (load-adaptive time dilation); a wall-clocked compiled animation cannot have that property by spec. | Driver; a pure-CSS mount+start-in-one-commit repro shows it with zero flemo code    |
| 드르륵 / 계단               | stepping / quantization               | Integer-snap stepping on slow tracked motion (≤1 device px/frame presented as stall-then-step). The physical trade opposite shimmer: at the slow tail you get EITHER fractional-blur sizzle OR integer stepping — both were device-judged; the velocity gate default is the reachable floor.                                                         | `flemo:snap` override state, dpr                                                    |
| 멈췄다 휙                   | freeze-then-leap                      | Mid-flight freeze with a catch-up jump at resume — a wall-clocked animation surviving a main-thread block, or (historically) a mid-flight-born animation desyncing WebKit's accelerated re-sync.                                                                                                                                                     | Chain state, driver, suspense commits mid-flight                                    |

## (b) The layered final attributions

The campaign's central lesson: "the jank" was never one thing. Six-plus independent
layers, each proven separately:

1. **Chrome macOS present pipeline (NOT flemo — proven unreachable).** The residual
   convergence trembling on the user's machines (M-series Mac, 120Hz ProMotion AND
   60Hz 4K HiDPI externals) reproduced on a **no-`<script>` pure-CSS control page**
   containing only flemo's own compiled cupertino keyframes — zero web code running,
   still trembles. Passive HUD showed exactly-120Hz rAF with low jitter _while the eye
   saw trembling_ → the fault is below rAF, in scanout/present pacing. Chrome itself
   tracks the defect (CVDisplayLink→CADisplayLink migration: Chromium issues
   **40062488**, **345275139**; flag `kCADisplayLink`, macOS 14+, default-off as of the
   campaign). The "sticky smooth" state = the GPU process flipping to continuous even
   present, triggered only by _browser-process_ per-vsync drawing (DevTools FPS meter,
   `--show-fps-counter`) — pages cannot trigger it by submitting frames.
   **Machine workaround** (dev/demo/recording only):
   `killall "Google Chrome"; open -na "Google Chrome" --args --show-fps-counter`.
   Do not re-investigate from web code; the do-not-retry list below records every
   angle already falsified.
2. **Sub-pixel bilinear resampling (flemo-reachable).** Blink composites transformed
   layers at fractional device-pixel offsets with bilinear filtering; the decelerating
   tail lingers multiple frames per phase → texture/glyph sharpness pulses. Proven
   with static fractional-offset energy tests (energy 0.251 at phase 0 vs 0.030 at
   0.5) and shift-compensated captures (integer-stepped layers diff to exactly zero).
   Addressed by: translate3d-only compilation, the player's snap gate + landing
   governor, and the compiled tier's governed landing easing. The _full-flight_ snap
   was device-judged worse than fractional glide (twice, by the same physics as the
   author's historical 2D-vs-3D transformPart verdict) → opt-in `flemo:landing-snap`.
   A separate contributor at the app layer: Skia renders CSS gradients WITH dither
   grain — a sliding screen-sized gradient decorrelates the grain field every 1-px
   step (duration-invariant, area-proportional); fixed by baking gradients to bitmaps
   in the consumer app (grain is texture-anchored in a bitmap).
3. **Mount-commit opening stalls (settle gate / holds).** A heavy entering screen's
   render+commit is a multi-hundred-ms main task NO driver can hide; the only choice
   is whether it runs BEFORE the flight (settle gate: full-duration flight carrying
   real content, at the cost of start latency) or INSIDE it (swallowed opening). The
   gate was device-rejected as a _data_ wait ("게이트 접근 최종 기각") but shipped as a
   _render-settle-only_ wait (`renderSettleOnly: true` — waits for commit quiescence,
   never for data), default-on for touch WebKit and validated even on a demoted Note 9
   (its 290ms mount task stalls even the compositor's initial layerization).
4. **Image decode (offloader + auto-gate).** 37-megapixel originals painted into 44px
   slots: WebKit decodes synchronously on-main at full resolution (offloader:
   fetch+decode+downscale off-main for CORS-readable oversized sources); Note 9's
   swallow was late content paint from off-main decode+raster landing mid-slide —
   timing/hide/scrub fixes all device-falsified there, only pixel reduction worked →
   offloader auto-gated on `isLegacyAndroidBlink()` (PR #252). `decoding="async"`
   stamping (imageDecodeHygiene) covers the rest.
5. **The device-emulation observation trap.** Weeks of "residual 버벅/지글임" were the
   DevTools device toolbar's scaled rendering path — discovered only when the user's
   phone video showed "Responsive 603×735" in frame; emulation off + narrow window =
   "부드럽네요". Now guarded by `emulationNotice.ts` and rule #1 of the debugging
   checklist.
6. **Display hardware.** One residue tracked to the MacBook Pro 14 XDR mini-LED local
   dimming following a bright sliding panel — backlight-level, invisible to every
   capture, browser-independent. (Environment attribution itself flip-flopped until
   the _docked, external-display_ setup was established — another checklist-#1 case.)

Other standalone real bugs found en route: cold-profile GPU pipeline compile stalls
(→ gpuPipelinePrewarm), COMPLETED-flip layer demotion repaint (→ layerSettleHold),
the swipe-settle takeover race (edge-zone taps with 1-5px wobble registering as grabs;
→ 6px tap slop + `settleScrubber.takeover`), the stale-resolver double resolution
(→ captured task ids), and the compositor wake-up loss (→ warm-up + interaction warm).

## (c) DO-NOT-RETRY list

Each entry was implemented, deployed, and **falsified on real devices** (not in
theory). Do not re-attempt without genuinely new information; if you must, read the
full ledger in the session memories / git history first.

**Clock & animation surgery (WebKit)**

- **Any timing write to a running/pending WebKit accelerated animation** — rewinds,
  `startTime` pins, two-phase holds, pending-clock pins: either loses the race,
  desyncs the out-of-process re-sync, or WebKit cuts the flight to its end (~100ms in,
  trajectory-measured). The narrow exceptions that survive: the one-shot _birth-window_
  rewind (desktop WebKit) and pause/play first-frame hold for authored
  `driver:"native"` pins only.
- **Post-birth `animation-delay` extension** — the UI process counts the delay down
  autonomously and has already presented motion frames; the extension commit snaps
  them back to the from-pose and restarts (tab flash / push stutter). "The hold must
  be fully decided before the animation is born."
- **The three handoff designs** (giving a player-opened flight an accelerated tail):
  1. `scrub.play()` — a paused+scrubbed WAAPI animation loses its accelerated
     representation when played; the remainder rode the wall clock through blocks
     (freeze then leap — worse than the capped player).
  2. Compiled-CSS rebirth with a negative inline `animation-delay` — smooth per
     flight, but intermittently froze-then-rushed when a mid-flight suspense commit
     forced WebKit's accelerated re-sync; the unusual begin time desyncs exactly what
     a naturally-born animation survives. Also revived the engine's `animationend`
     resolver → the double-resolution bug (a duplicate resolution's deferred chain
     cuts the NEXT queued task — fast-back pop completed at ~90ms with no motion).
  3. Fresh remainder animation with `linear()` easing (and the baked-keyframe
     variant) — `linear()` has no Core Animation form → main thread → convergence
     stutter back; the baked accelerated variant hit re-sync desync (2). Net: the
     handoff survives only as a POP-scoped opt-in diagnostic.
- **CSS `calc(var())` in animation timing** — demotes WebKit fades off the compositor
  (2-frame collapse under starvation; bisected in a local rig). Timing must be
  literal; the compiler enforces this.
- **Adaptive/learned hold sizing from gap statistics** — the leisure ledger learns gap
  _length_, but the needed value is trouble-window _position_; every gap statistic
  under-covered (7/7 swallowed below the threshold). Static per-status heads won.
- **Calm-frame release gating by rAF gap evidence** — on high-refresh devices every
  ordinary mount aftermath reads as a storm; the gate rode its bound = pure added
  dead-wait.

**Routing**

- **Touch-Blink blanket compiled routing** — regressed fast Blink (Pixel 9 picked up
  compiled landing artifacts); routing must stay per-signal (high-refresh / demoted /
  legacy), not per-platform. (Note the _touch-WebKit_ side later DID go
  governed-compiled wholesale, with the flat-head kit — same destination, different
  engine, different reasons; don't cite one as precedent for the other.)
- **LPM-detection driver switching, all forms** — LPM caps the whole web process's
  rendering updates at ~30Hz (proven: timer-driven clocks are equally capped, and
  longTasks are EMPTY during the 100-340ms gaps — pure OS governor). Every supervisor
  runs on rAF, so compiled-under-LPM is definitionally unsupervisable; duration
  stretch (静的 2x) was rejected on feel. What finally worked under LPM was NOT
  routing: literal timing + flat-head keyframes (active-from-birth, commit lands in
  the invisible head) — which then generalized to all touch WebKit.
- **`scrub`-on-Note9 / any timing/transform/hide fix for Mode-B swallow** — its
  swallow is late _content paint_, not clock advance; freezing transforms can't touch
  it. Only pixel reduction (offloader downscale) works.
- **park-over (0.02-opacity on-top pre-raster)** — ghosting + stacking side effects;
  its motivating culling theory was a misdiagnosis (real culprit: var-timing). Kept
  only behind `flemo:preraster`.
- **Opacity masking, render-freeze (React visible+frozen), consumer-blur blame** —
  all falsified for the WebKit swallow.
- **content-visibility fold landing (Note 9)** — the deferred unhide's repaint is a
  second hitch on old CPUs.
- **Moving the rest landing commit around (Note 9 / LPM)** — all three placements
  device-judged (mid-flight = least bad, COMPLETED = end hitch, pre-release =
  deadlock era); the early-landing placement stays.

**Chrome-present-pipeline angles (all measured ineffective against layer-1)**

- Driver choice (compiled vs player), every easing shape (snap/governor/60Hz
  cadence-lock/bezier), every warm variant (per-flight, interaction, permanent 1px,
  fullscreen), keepalive rAF on/off, `canvas.captureStream` video, real
  hardware-decoded h264 video, the CADisplayLink flag, page-side present-timing
  compensation (future present times unknowable). **VRR-area hypothesis dead**: VRR
  max-rate is requested by animation _existence_, area-independent — a permanent 1px
  warm already requested it and the tremble persisted.
- (One warm DID survive falsification and shipped: the _never-stopping_ keepalive rAF
  for compiled Blink flights — an on/off per-flight loop barely helped, the permanent
  one device-confirmed. It steadies pacing; it does not fix layer-1.)

**Player micro-policies**

- **Jitter-cap + commit-miss compensation from a synthetic A/B** — real pages carry
  per-frame render cost that reads as a blown commit window; the compensation held
  frames constantly (synthetic win did not transfer). Noted in `stepPlayer`; do not
  re-attempt without an adaptive per-page baseline.
- **MIN-estimator display interval** — one runt gap throttled the whole flight; the
  median with a sustained-slow requirement is deliberate.
- **Per-flight warm variants** as a present-pacing fix — see above; only the
  session-permanent form helps.

## (d) Worked example: the desktop player blank (#256 → #259) — instrument before you revert

Symptom: `?driver=raf`-pinned desktop Chromium, push→pop→push re-entry → detail screen
completely blank. First response (PR #256) _reverted the pin pierce_ — correct triage
(production default was never affected) but it treated the player as the defect.
PR #259 (merged 2026-08-17) then instrumented instead of assuming: a frame-by-frame
trace showed the flight drove perfectly (1280→0, landing inline `none`) and the screen
blanked ONE COMMIT LATER. Root cause was a three-part cleanup interaction, not a
player bug:

1. the player track's detach restored its `transform` lease "original" — which for the
   actively-entered scope is the **flemo-rendered entering-initial from-pose**
   (`translate3d(100%,0,0)`), not a consumer value;
2. the COMPLETED force clear iterates only keys still in the lease map (the restore
   had just dropped the transform entry);
3. the empty-map fallback that strips transform/opacity never runs while any other
   lease survives the flip — and on desktop Blink the governed-easing
   `animation-timing-function` lease always does.
   Touch sessions were saved by accident (empty map → fallback). The shipped fix strips
   the scope's pose channels explicitly at COMPLETED, and the pin pierce was restored on
   the strength of it (with a desktop-chromium e2e guard).
   Lessons: (1) a clean flight + broken rest state means look at the CLEANUP
   path, not the driver; (2) "works on touch" can be an accident of map contents, not a
   design; (3) revert-first is fine for triage but the root cause must be paid down
   before the capability returns.

## (e) Debugging checklist for the NEXT motion-jank report

1. **Establish the viewing configuration FIRST.** Screenshot of the actual setup:
   plain window vs DevTools device emulation, which physical display (internal /
   external, refresh rate, HiDPI scaling mode), docked or not, Low Power Mode.
   The single highest-leverage question of the whole campaign (~10 rounds saved had it
   been asked first).
2. **Check active overrides.** `flemo:*` session/local storage on the affected device;
   any `?flemo-…`/app-level toggle params in the URL; pin warnings in the console.
   Mobile tab restoration resurrects sessionStorage across days.
3. **Read badges/toggles in any user video FIRST** — before analyzing motion. Two
   root causes (emulation toolbar, `?snap=off`) were literally visible in frame.
4. **Classify the symptom** with taxonomy (a): spatial (shimmer) vs temporal (frame
   time) vs opening (씹힘/휙휙) vs stepping. Ask the user which Korean word fits.
5. **Separate flemo from platform with the pure-CSS control.** Regenerate a
   no-`<script>` page from `compileTransitionStyles` output (the compiled keyframes,
   `will-change`, `contain`, an infinite slide loop). If it exhibits the symptom with
   zero web code, the cause is outside flemo — stop engineering and document.
6. **Know which layers are instrument-invisible.** rAF/longtask/trace metrics see the
   main thread only; present-pipeline judder, swallowed compositor frames, bilinear
   shimmer, backlight effects need pixel probes, camera video, or frame-extracted
   recordings. "All metrics clean + user still sees it" is a _layer_ signal, not a
   contradiction.
7. **Identify the routed tier before theorizing** — driver-routing.md decision tree;
   confirm on-device (suppressed `animation` + inline writes = player; `data-flemo-lpm`
   on root = governed compiled).
8. **When verifying through a consumer app via tarballs, fingerprint the served
   bundle** (diagnostics.md pitfall #7) before accepting any verdict — several rounds
   were judged against stale code.
9. **Check the falsification list (c)** before building. If a proposed fix is on it,
   the burden is a _new mechanism_, not a re-run.
10. **Respect the authoring-fidelity principle** (user-stated, standing): the library
    must not silently change the authored motion's meaning (no fade removal, no
    entry-suppression flips, no demands on consumer code like prefetch). Prescriptions
    must take the form "authored motion intact + internal scheduling/raster work";
    explicit user-selected trades are the only exception.

## Addendum — 2026-08-17 evening: the attribution re-verified live, twice refuted defaults

The steady-60 desktop player routing (PR #261) shipped and was feel-tested in plen
(the real consumer app, fully-loaded infinite member list) the same day. Findings,
in order:

1. **Pop unfreeze stall (reachable, fixed).** Every heavy-list pop opened with one
   50-66ms frame gap: the settle gate's wave detector keys on ADDED nodes, and a
   pop's returning screen re-uses its frozen DOM — so the wall-clock give-up timers
   released straight into the unfreeze's style/layout block. Fixed: give-up releases
   now ride two consecutive fast frames (`animStartAnchor.ts`). Hold-aware
   re-measurement: pop post-release max gap 17.7ms, zero 30ms+ gaps, blocks absorbed
   into the hold.
2. **Desktop always-snap default refuted on the player (spatial).** The pop
   parallax's long sub-pixel tail presented as "드르륵" ratcheting under always-snap
   (integer holds-and-steps). Reverted to the velocity gate — consistent with the
   original same-display verdict (fractional glide wins slow tracked motion).
3. **The residual, once frame timing AND value generation were both clean, was
   still felt** — and the falsification triangle closed cleanly: compiled,
   player+always, player+gate, and the historical no-`<script>` pure-CSS control all
   exhibit it; Safari and old Android Chrome (a Note 9!) do not. Forcing continuous
   present made it smooth on the spot, user-confirmed ("매끄럽긴 합니다"):
   **the residual is the macOS Chrome present pipeline. Full stop, re-verified.**

Instrumentation notes for the next round:

- `--show-fps-counter` could NOT be confirmed effective on Chrome 151 (no visible
  HUD in a fresh-profile instance; the user felt no change there — but that instance
  was ALSO a cold GPU-pipeline profile, a double confound; see the cold-cache
  section). The RELIABLE present-forcing switch today: the DevTools "Frame Rate"
  HUD, enable-able remotely via CDP (`DOM.enable` → `Overlay.enable` →
  `Overlay.setShowFPSCounter {show:true}`) with a persistent session holding it on.
- Never hand a fresh-profile browser instance to a user for a jank verdict: cold
  Graphite/Dawn pipeline caches produce real first-flight stalls that read as the
  bug under investigation.
- The @flemo/devtools flight recorder (PR #263) segments frame gaps by
  hold/released phase — measurements that ignore the hold phase misattribute
  absorbed blocks as in-flight jank (this happened in-session).

## Addendum 2 — 2026-08-18: the glass-measurement campaign and the recorder artifact

A full day of closed-loop glass measurement (drive + `screencapture -v` + per-frame
motion/pts analysis) produced one instrument lesson that must not be re-learned:

- **`screencapture -v` (VFR, window or display) injects a metronomic ~1-frame
  "drop" every ~400ms.** It appears as a 33ms pts gap during continuous motion and
  is indistinguishable from a real dropped frame. Proven by parity: the identical
  periodic pattern appears in Chromium, in Playwright-WebKit, in REAL Safari (the
  user's smooth reference), and in a zero-JS pure-CSS compositor slide. Any
  single-frame-level verdict taken through `screencapture -v` is void.
- Playwright's WebKit port is NOT a Safari smoothness proxy (it measured worse
  than Chromium on the same harness).
- macOS Spaces: `screencapture -v` (display mode) records the ACTIVE space — a
  fullscreen IDE means the driven browser is off-glass and possibly throttled;
  window-id mode (`-v -l<id>`) captures across spaces but still carries the VFR
  artifact. AVFoundation CFR capture also sees only the active space.
- Net: after the governor removal, rest-side arrival release, and pre-raster
  rounds, Chromium pristine-compiled == real Safari == pure-CSS control at every
  layer measurable in-machine. The only instruments that can go deeper are a
  visible-space CFR capture (needs the space on glass) or an external camera.

Engine changes that DID move the needle this round (all device-correlated):

1. PR #251's compiled landing-governor easing was itself the reported desktop pop
   "드르륵" — removed for desktop; authored easing runs untouched.
2. Arrival-hold early landing moved off the flight (release at rest) for
   steady-60 desktops — the per-push skipped-frame at the perceptual cut.
3. Pre-raster (will-change through the hold) default for steady-60 desktops —
   the push "뚝뚝" from mid-slide tile rasterization of the occluded parked layer.

---

## 2026-08-18 라이브 유리(glass) 캠페인 — 실결함 7건, 반증 지도, 최종 귀속

하루 동안 42개 라이브 빌드(j2~j42)를 실기기 판정으로 돌린 캠페인. 계측은 디스플레이 캡처
(CFR/AVFoundation·VFR/QuickTime), 배지 마커(비행창·릴리즈 색반전), 포즈 인코더(진행률의
회색조 기록), CDP 트레이스(presentation feedback), 변위 상호상관 프로파일까지 확장됐다.

### 실재했고 수정된 결함 (전부 이 브랜치에 반영)

1. **warm-side 비행 중 이미지 디코드** — 떠나는 리스트의 lazy 아바타가 슬라이딩 레이어
   위에서 디코드→재래스터. CDP presentation 기준 디코드 1건=스킵 1건(1:1)으로 인과 증명.
   → warm 참여자에도 unpainted-only 이미지 홀드.
2. **릴리즈 스월로우(desktop-Blink-compiled)** — state-routed 릴리즈의 클록-첫프레임 간극.
   유리에서 "얼다→곡선 중간 점프"로 관측. → 릴리즈를 readiness rAF 안에서 flushSync로
   원자화(WebKit 원자 플립의 일반화; 플립 자체는 비-Blink 전용 유지).
3. **릴리즈 레이스(전 드라이버)** — 플립과 상태 커밋 사이에 낀 커밋이 낡은 hold 속성을
   되써 달리는 애니메이션을 ~250ms 일시정지. 간헐성("깨끗할 때가 있다")의 정체.
   → flushSync 일원화로 창 자체 제거.
4. **이미지 홀드 이중 캡처 누수** — 연속 비행의 홀드 인스턴스가 서로의 display:none을
   "원본"으로 캡처 → 로드된 아바타 영구 공백(150개 중 130개 재현). → 속성 마커 기반
   단일-소유자 가드.
5. **arrivalHold×이미지홀드 교차 레이스** — in-place 동결이 홀드의 style 쓰기를 비행 중
   되돌리고(무장 해제) rest에서 재생(고아 은닉 ~100/pop). → 홀드 마커 요소의 style 채널
   동결 제외.
6. **GPU 파이프라인 콜드 컴파일 커버리지 구멍** — 신선 프로필 첫 비행에 120–150ms
   GPU-채널 래스터 태스크(트레이스 실측). 기존 프리웜은 이미지 텍스처·원형 클립·그라디언트·
   CJK 글리프·헤어라인·섀도 변형을 안 그렸다. → 장면 확장(트레이스 A/B로 소멸 확인).
7. **프리즈 타이밍 스래시** — push 착지의 hide와 빠른 pop의 unhide가 겹치는 브라우징
   리듬. → ScreenFreeze 디바운스(3s)로 빠른 왕복은 동결 자체를 생략.

부수: 소비자 애니메이션 개입(consumerAnimationPause)은 사용자 지시로 전면 철회 —
flemo는 소비자 authored 상태를 만지지 않는다(항구 원칙).

### 반증 지도 — 재시도 금지 (이번 캠페인 추가분)

- **per-frame `!important` 스냅 마스크(tailSnap)**: 상호상관 프로파일이 직접 반증 —
  느린 구간을 정수 계단(+1/0/+1/0)으로 만들고, rAF 한 박자 밀리면 낡은 포즈가 화면을
  고정(0 다음 2배 점프). 순수 CSS 대조군은 소수점 단조 감속으로 매끄러웠다. 스냅은
  "그 드라이버가 유일한 기록자일 때"만 성립(플레이어의 자기-클록 스냅). 마스크 금지.
- **사전 양자화 step-end WAAPI 사다리**: 라이브 "훨씬 심함" — step 타이밍이 컴포지터에서
  내려와 메인 실패 모드를 상속(재앵커 없이). 금지.
- **pop만 플레이어 라우팅**: 시작 프리즈가 플레이어에서도 그대로(+사용자 기각 텍스처).
  프리즈는 스타일 계층 아래가 아니라(→최종 귀속 참조) 라우팅으로 못 푼다.
- **패럴랙스=0 / cupertino 550ms**: 진단으로는 유효(떨림 부분 기여 확인), 처방으로는
  기각 — 임의 authored 전환 전부에 대비해야 한다는 라이브러리 요구와 충돌.
- **뷰포트 근접 이미지 프리디코드(드라이브 진입 시)**: 행 수만큼 getBoundingClientRect
  강제 레이아웃이 릴리즈 경로에 실려 역효과(라이브 악화 판정). 비행 경로 밖(유휴/IO 기반)
  이 아니면 금지.
- **렌더러 damage 확대(48px raster / 40vw 서피스)·무음 오디오 QoS**: 캡처-클라이언트
  효과(아래 참조)를 페이지에서 재현 못함. 40vw 리사이즈는 상호작용마다 레이어 churn까지
  유발. 유일하게 검증된 페이지-측 완화는 **상주 소형 60fps 비디오 서피스**("좀 더 좋아짐"
  라이브 판정)뿐.

### 계측 함정 (기존 목록에 추가)

- **mtime-기반 캡처 정렬은 ±300~600ms 편향** — 절대 시각 주장 금지. 비행 내부 차분
  구조만 유효. 마커(구석 색반전)만이 편향-제로 동기화다.
- **VFR 녹화(스크린캡처/QuickTime)의 ~2.4/s 주기 가짜 갭** — 기준선 감산 없이 갭 카운트
  금지(Safari 대조로 재확인).
- **디스플레이 캡처는 관찰자다** — 캡처 클라이언트가 WindowServer를 매 vsync 합성으로
  강제해 증상 자체를 억누른다(사용자 독립 관찰로 확인). 캡처 중 판정은 완화된 상태의 판정.
- **화면 밖/부분 가림 창의 계측은 오염** — 좌표 실수로 다수의 "무결" 구동 측정이
  offscreen에서 수행됐었다. 창 좌표는 반드시 디스플레이 폭 안으로.
- **evaluate().click()은 pointerdown을 발화하지 않는다** — pointerdown-armed 기계 전체를
  우회한 검증은 검증이 아니다. 실입력은 page.mouse.
- **창 지오메트리가 다르면 스톨 절대치 비교 무효.**

### 최종 귀속 — 잔여 "버벅/끊김"

모든 코드·프로필·바이너리·시드·캐시·저장소·환경변수 소거 후, 사용자 자신의 이분 실험으로
확정: **DevTools가 열려 있으면 버벅, 닫으면 무결.** 인스펙터 오버헤드(요청 직렬화 + 패널
리페인트)는 열린 세션에만 실리므로 모든 인페이지 계측이 "깨끗"했던 것과 모순되지 않는다.
개발자는 DevTools를 상시 열고 살기에 판정 라운드마다 재발했다.

**판정 프로토콜 규칙: 전환 품질 판정은 반드시 DevTools를 닫고, 캡처 없이, 실입력으로.**
