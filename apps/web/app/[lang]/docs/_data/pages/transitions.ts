import type { LocalizedDocPage } from "../docTypes";

const SLIDE_EN = `import { createTransition } from "@flemo/react";

const DURATION = 0.5;
const EASE = [0.32, 0.72, 0, 1] as const;

export const slide = createTransition({
  name: "slide",
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: DURATION, ease: EASE } },
  exit: { value: { x: "-30%", opacity: 0.6 }, options: { duration: DURATION, ease: EASE } },
  enterBack: { value: { x: "100%" }, options: { duration: DURATION, ease: EASE } },
  exitBack: { value: { x: 0, opacity: 1 }, options: { duration: DURATION, ease: EASE } },
  options: { swipe: { direction: "x" } }
});

declare module "@flemo/react" {
  interface RegisterTransition {
    slide: "slide";
  }
}`;

const SLIDE_KO = `import { createTransition } from "@flemo/react";

const DURATION = 0.5;
const EASE = [0.32, 0.72, 0, 1] as const;

export const slide = createTransition({
  name: "slide",
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  enter: { value: { x: 0 }, options: { duration: DURATION, ease: EASE } },
  exit: { value: { x: "-30%", opacity: 0.6 }, options: { duration: DURATION, ease: EASE } },
  enterBack: { value: { x: "100%" }, options: { duration: DURATION, ease: EASE } },
  exitBack: { value: { x: 0, opacity: 1 }, options: { duration: DURATION, ease: EASE } },
  options: { swipe: { direction: "x" } }
});

// transitionName 자동완성용 타입 등록
declare module "@flemo/react" {
  interface RegisterTransition {
    slide: "slide";
  }
}`;

const APP = `import { Route, Router } from "@flemo/react";

import Home from "./Home";
import { slide } from "./transitions/slide";

export default function App() {
  return (
    <Router transitions={[slide]} defaultTransitionName="slide">
      <Route path="/" element={<Home />} />
    </Router>
  );
}`;

const PER_NAV_EN = `const navigate = useNavigate();

// this push only
navigate.push("/posts/:slug", { slug: "hello" }, { transitionName: "material" });

// overrides the transition the closing screen was opened with
navigate.pop({ transitionName: "none" });`;

const PER_NAV_KO = `const navigate = useNavigate();

// 이 push에만 적용
navigate.push("/posts/:slug", { slug: "hello" }, { transitionName: "material" });

// 닫히는 화면이 열릴 때 썼던 트랜지션 대신 이 트랜지션을 사용
navigate.pop({ transitionName: "none" });`;

const WIPE = `import { createTransition } from "@flemo/react";

const EASE = [0.65, 0, 0.35, 1] as const;

export const wipe = createTransition({
  name: "wipe",
  initial: { clipPath: "inset(0 0 0 100%)" },
  idle: { value: { clipPath: "inset(0)", scale: 1, opacity: 1 }, options: { duration: 0 } },
  enter: { value: { clipPath: "inset(0)" }, options: { duration: 0.45, ease: EASE } },
  enterBack: { value: { clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.38, ease: EASE } },
  exit: { value: { scale: 0.96, opacity: 0.8 }, options: { duration: 0.45, ease: EASE } },
  exitBack: { value: { scale: 1, opacity: 1 }, options: { duration: 0.38, ease: EASE } }
});

declare module "@flemo/react" {
  interface RegisterTransition {
    wipe: "wipe";
  }
}`;

const MATERIAL_SWIPE_EN = `import type { SwipeOptions } from "@flemo/react";

const PULL = 56;

// One for one up to PULL, then a square-root falloff.
const pull = (dragY: number) => {
  const followed = Math.max(0, Math.min(PULL, dragY));
  const over = Math.max(0, dragY - PULL);
  return followed + Math.sqrt(Math.min(1, over / 160)) * 12;
};

export const swipe: SwipeOptions = {
  direction: "y",
  threshold: PULL,
  progress: (info, span) => {
    const pulled = pull(info.offset.y);
    return {
      current: span > 0 ? pulled / span : 0,
      prev: Math.min(PULL, pulled) / PULL
    };
  }
};`;

const MATERIAL_SWIPE_KO = `import type { SwipeOptions } from "@flemo/react";

const PULL = 56;

// PULL까지는 1:1로 따라가고, 그 뒤로는 제곱근으로 저항
const pull = (dragY: number) => {
  const followed = Math.max(0, Math.min(PULL, dragY));
  const over = Math.max(0, dragY - PULL);
  return followed + Math.sqrt(Math.min(1, over / 160)) * 12;
};

export const swipe: SwipeOptions = {
  direction: "y",
  threshold: PULL,
  progress: (info, span) => {
    const pulled = pull(info.offset.y);
    return {
      current: span > 0 ? pulled / span : 0,
      prev: Math.min(PULL, pulled) / PULL
    };
  }
};`;

const STOPS_EN = `import type { SwipeOptions } from "@flemo/react";

export const swipe: SwipeOptions = {
  direction: "x",
  // opacity is spent by 30% of the drag; x keeps going to the end
  current: [
    { at: 0.3, value: { x: "30%", opacity: 0 } },
    { value: { x: "100%", opacity: 0 } }
  ]
};`;

const STOPS_KO = `import type { SwipeOptions } from "@flemo/react";

export const swipe: SwipeOptions = {
  direction: "x",
  // opacity는 드래그 30% 지점에서 다 쓰고, x는 끝까지 이동
  current: [
    { at: 0.3, value: { x: "30%", opacity: 0 } },
    { value: { x: "100%", opacity: 0 } }
  ]
};`;

const SHOVE = `import { createRawTransition } from "@flemo/react";

const DURATION = 0.4;

export const shove = createRawTransition({
  name: "shove",
  initial: { x: "100%" },
  idle: { value: { x: 0 }, options: { duration: 0 } },
  pushOnEnter: { value: { x: 0 }, options: { duration: DURATION } },
  pushOnExit: { value: { x: "-30%" }, options: { duration: DURATION } },
  replaceOnEnter: { value: { x: 0 }, options: { duration: DURATION } },
  replaceOnExit: { value: { x: "-100%" }, options: { duration: DURATION } },
  popOnEnter: { value: { x: "100%" }, options: { duration: DURATION } },
  popOnExit: { value: { x: 0 }, options: { duration: DURATION } },
  completedOnEnter: { value: { x: 0 }, options: { duration: 0 } },
  completedOnExit: { value: { x: "-30%" }, options: { duration: 0 } }
});

declare module "@flemo/react" {
  interface RegisterTransition {
    shove: "shove";
  }
}`;

const page: LocalizedDocPage = {
  en: {
    slug: "transitions",
    title: "Transitions",
    summary:
      "Animate the screens of a stack with a built-in preset or your own createTransition, pick one per navigation, add a swipe gesture, and add a decorator such as a dim over the previous screen.",
    blocks: [
      {
        type: "demo",
        demo: "cupertino",
        caption:
          "Open a row, then drag the detail screen to the right and let go early to watch it return."
      },
      { type: "h", text: "Presets" },
      {
        type: "p",
        text: "Four presets are built in and need no registration. `cupertino` is the Router default when you omit `defaultTransitionName`."
      },
      {
        type: "table",
        headers: ["Preset", "Motion", "Gesture"],
        rows: [
          [
            "`cupertino`",
            "Slides in from the right over 0.7s on `[0.32, 0.72, 0, 1]`. The previous screen moves back 30% under the `overlay` dim",
            "Drag right (`x`). Goes back past the default distance"
          ],
          [
            "`material`",
            "Rises from the bottom over 0.35s while the previous screen lifts 56px and fades. Pop runs 0.25s",
            "Drag down (`y`). Goes back at 56px and resists past it"
          ],
          [
            "`layout`",
            "A 0.4s fade that does most of its change early. Only the new screen or the closing screen moves, leaving room for a [Morph](morph)",
            "Drag down (`y`) pulls the screen away. Goes back at 56px"
          ],
          ["`none`", "The screen changes at once. Every variant has zero duration", "None"]
        ]
      },
      {
        type: "note",
        kind: "tip",
        text: "Use `layout` under shared elements: its fade is nearly over a third of the way through the transition. Use `none` when a [Morph](morph) should be the only thing that moves."
      },
      {
        type: "details",
        title: "Preset details",
        blocks: [
          {
            type: "list",
            items: [
              "`cupertino` follows the measured iOS push: Ionic replicates UIKit at 540ms on the same curve. flemo runs it over 0.7s as an authored choice for a calmer glide. The native shadow on the new screen's leading edge is deliberately not replicated",
              "`material` pushes on `[0, 0, 0.2, 1]` and `[0.4, 0, 1, 1]`. Its push and pop lengths differ, so every Part and decorator inherits the same asymmetry",
              "`layout` fades the new screen in over the previous one, which stays still, on push. On pop, the closing screen fades out while the previous screen stays still. It sets no decorator, because a dim adds change where the eye should follow the shared element",
              '`layout`\'s drag is not its pop. It declares `current: { y: "100%", opacity: 0.96 }` and `prev: {}`, so the sheet slides down while the previous screen stays still',
              "`none` is also what an unregistered name resolves to. A misspelled name reads as a screen that simply appears, and development warns once per name"
            ]
          }
        ]
      },
      { type: "h", text: "Choosing a transition per navigation" },
      {
        type: "p",
        text: "Set the default on the Router with `defaultTransitionName`. Override a single navigation with `transitionName`. There is no per-`Route` transition: motion belongs to the navigation, not the destination."
      },
      { type: "code", lang: "tsx", code: PER_NAV_EN, highlight: [4, 7] },
      {
        type: "p",
        text: "A `pop` without `transitionName` runs the transition the closing screen was opened with. See [Navigation](navigation) for the other navigation options."
      },
      { type: "h", text: "Authoring a transition" },
      {
        type: "p",
        text: "`createTransition` takes six variants. Each slot except `initial` is `{ value, options }`: a CSS target and its timing."
      },
      {
        type: "table",
        headers: ["Slot", "Which screen", "Animates from"],
        rows: [
          ["`initial`", "The style a new screen has before it animates", "Not animated"],
          ["`idle`", "Either screen at rest", "Not animated"],
          [
            "`enter`",
            "The new top screen on push or replace. It keeps this style after the transition ends",
            "`initial`"
          ],
          [
            "`exit`",
            "The previous screen moving behind on push or replace. It keeps this style after the transition ends",
            "`idle`"
          ],
          ["`enterBack`", "The top screen closing on pop", "`idle`"],
          ["`exitBack`", "The previous screen coming back on pop", "`exit`"]
        ]
      },
      { type: "code", lang: "ts", title: "transitions/slide.ts", code: SLIDE_EN },
      {
        type: "p",
        text: "Register it on the Router. The `RegisterTransition` augmentation makes `transitionName` and `defaultTransitionName` autocomplete."
      },
      { type: "code", lang: "tsx", title: "App.tsx", code: APP, highlight: [8] },
      {
        type: "table",
        headers: ["Option", "Meaning"],
        rows: [
          ["`duration`", "Seconds"],
          ["`delay`", "Seconds"],
          [
            "`ease`",
            "A named ease (`linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `backIn`, `backOut`, `anticipate`), a CSS keyword, `cubic-bezier()`, `steps()`, `linear()`, or a four-number tuple. Defaults to `ease`"
          ]
        ]
      },
      {
        type: "note",
        kind: "warn",
        text: "`active` follows stack position, not travel direction. On pop, the closing screen is still the active top, so it plays `enterBack`."
      },
      {
        type: "details",
        title: "Status and slot table",
        blocks: [
          {
            type: "p",
            text: "Every screen carries a status and an `active` flag. This table maps each pair to the slot every factory reads."
          },
          {
            type: "table",
            headers: [
              "Status",
              "active",
              "Screen role",
              "`createTransition`",
              "`createRawTransition`",
              "Decorator"
            ],
            rows: [
              ["PUSHING", "true", "New screen, new top", "`enter`", "`pushOnEnter`", "`idle`"],
              [
                "PUSHING",
                "false",
                "Previous screen, moving behind",
                "`exit`",
                "`pushOnExit`",
                "`enter`"
              ],
              ["REPLACING", "true", "New screen", "`enter`", "`replaceOnEnter`", "`idle`"],
              ["REPLACING", "false", "Replaced screen", "`exit`", "`replaceOnExit`", "`enter`"],
              ["POPPING", "true", "Closing, still on top", "`enterBack`", "`popOnEnter`", "`idle`"],
              [
                "POPPING",
                "false",
                "Previous screen, coming back",
                "`exitBack`",
                "`popOnExit`",
                "`exit`"
              ],
              [
                "COMPLETED",
                "true",
                "Active, transition ended",
                "`enter`",
                "`completedOnEnter`",
                "`idle`"
              ],
              [
                "COMPLETED",
                "false",
                "Behind, transition ended",
                "`exit`",
                "`completedOnExit`",
                "`enter`"
              ],
              ["IDLE", "either", "At rest", "`idle`", "`idle`", "`idle`"]
            ]
          },
          {
            type: "list",
            items: [
              "Where each animation starts is fixed. PUSHING-true and REPLACING-true start from `initial`",
              "PUSHING-false, REPLACING-false and POPPING-true start from the `idle` style",
              "POPPING-false starts where PUSHING-false ended. With raw slots, `popOnExit` starts from `pushOnExit`",
              "IDLE and COMPLETED are rest styles and never animate. A variant with zero duration and zero delay does not animate either",
              '`enterBack` is the active screen leaving on pop. In `cupertino` it is `x: "100%"`',
              'Reading `active === "true"` as the new screen pairs morphs backwards on every pop. [Part](part) and [Morph](morph) slots differ again; check their pages'
            ]
          }
        ]
      },
      { type: "h3", text: "What you can animate" },
      {
        type: "p",
        text: "A target accepts any animatable CSS property, with autocomplete. Transform shortcuts `x`, `y`, `z`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY` and `rotateZ` compile into one `transform`."
      },
      {
        type: "details",
        title: "Values and interpolation",
        blocks: [
          {
            type: "list",
            items: [
              "Targets cover the CSS surface: `clipPath`, `filter`, `borderRadius`, `boxShadow`, `color` and `--custom` properties, camelCased like React's `style`",
              'Bare numbers get units: `px` for lengths, `deg` for rotations, unitless where CSS is unitless. Strings pass through verbatim, such as `"100%"` or `"1rem"`',
              "Endpoints may differ in shape. A `clip-path` can go from `inset(0 0 0 100%)` to `inset(0)`, values can be `calc()`, and units can mix (`50%` to `200px`)",
              "You may leave a property off one end. `transform` channels and `opacity` fall back to neutral (identity, fully opaque). Any other property starts from its current on-screen value",
              "Option fields written on `initial` are ignored; only its target is read",
              "An ease string unknown to flemo and CSS compiles to `ease` and warns once in development"
            ]
          },
          {
            type: "note",
            kind: "warn",
            text: "Values use the browser's own CSS interpolation. A pair CSS can only change discretely jumps at the midpoint, as native CSS would. Two `inset()` values tween; `inset()` to `circle()` jumps."
          },
          {
            type: "p",
            text: "This `wipe` reveals the new screen with a `clip-path` that opens left to right. The previous screen recedes with a little scale and opacity."
          },
          { type: "code", lang: "ts", title: "transitions/wipe.ts", code: WIPE, highlight: [7, 9] }
        ]
      },
      { type: "h", text: "Swipe" },
      {
        type: "p",
        text: "Add `swipe: { direction }` to `options` and the transition becomes draggable, as `slide` above is. Dragging plays the transition's own pop, following the finger. There is no per-frame code."
      },
      {
        type: "p",
        text: "On release, the screen goes back if the gesture went past `threshold` **or** the finger was still moving faster than `velocity`. Either alone is enough. A transition without `swipe` has no gesture."
      },
      {
        type: "table",
        headers: ["Option", "Type", "Default", "Role"],
        rows: [
          ["`direction`", '`"x"` or `"y"`', "Required", "The axis the gesture travels"],
          [
            "`threshold`",
            "`number` or `(span) => number`",
            "50px on a 390px screen, scaled to the span",
            "How far, in px, the gesture must carry the screen to go back"
          ],
          [
            "`velocity`",
            "`number`",
            "`20`",
            "How fast the finger must still be moving to go back however little it travelled"
          ],
          [
            "`progress`",
            "`(info, span) => number` or `{ current, prev }`",
            "Distance carried over the screen's own width or height",
            "Where each screen is along its travel, 0 to 1. Write it for a drag that resists or clamps"
          ],
          [
            "`current` / `prev`",
            "`TransitionTarget` or `SwipeStop[]`",
            "The pop's own targets",
            "Where the drag carries each screen, when that is not where the pop takes it"
          ],
          ["`onStart`", "hook", "None", "Accept or refuse the gesture before anything moves"],
          ["`onMove` / `onEnd`", "hooks", "None", "Drive the drag yourself. See the warning below"]
        ]
      },
      {
        type: "p",
        text: "The progress flemo computes also drives the transition's decorator and every [Part](part) on both screens, so they all follow the same gesture."
      },
      {
        type: "note",
        kind: "warn",
        text: "Writing `onMove` or `onEnd` without setting `current` or `prev` leaves both screens and the decision to go back to you. Set a destination instead whenever the drag only moves the screens to a fixed style."
      },
      {
        type: "details",
        title: "Swipe recipes",
        blocks: [
          {
            type: "p",
            text: '`cupertino`\'s whole gesture is `swipe: { direction: "x" }`. Its drag follows the finger one for one, which is the geometric default.'
          },
          {
            type: "p",
            text: "`material` needs `progress` because its two screens move at different rates. The dragged screen travels its own height and keeps moving as the rubber band stretches. The previous screen travels 56px and stops."
          },
          {
            type: "code",
            lang: "ts",
            title: "material's swipe",
            code: MATERIAL_SWIPE_EN,
            highlight: [15, 16, 17, 18, 19, 20]
          },
          {
            type: "p",
            text: "When properties travel at different rates, list stops. `at` is where along the drag a style is reached, 0 to 1. The last stop is the end."
          },
          { type: "code", lang: "ts", code: STOPS_EN },
          {
            type: "list",
            items: [
              "You set only the destination. The drag starts where the screen already is, which is where the pop starts",
              "An empty target, such as `prev: {}`, means that screen does not move and flemo leaves it untouched",
              "`progress` returns one number for both screens or `{ current, prev }`. Results clamp to 0 to 1, and `NaN` reads as 0",
              "`current` is the screen under the finger. `prev` is the previous screen revealed behind it"
            ]
          }
        ]
      },
      {
        type: "details",
        title: "Swipe internals and hooks",
        blocks: [
          {
            type: "p",
            text: "Whoever moves the screens also handles the release. With `current` or `prev` set, flemo moves the screens, decides whether the swipe goes back and sets the timing of the animation after release. Your `onEnd` then receives that decision as `triggered`, and its return value is not read."
          },
          {
            type: "p",
            text: "A hook written without a destination beside it leaves the screens and the decision to you. That is right only for a drag that moves the screens themselves to arbitrary places. Writing `onStart` never takes the screens away from flemo."
          },
          {
            type: "table",
            headers: ["Hook", "Signature", "Role"],
            rows: [
              [
                "`onStart`",
                "`(event, info, { animate, currentScreen, prevScreen, onStart }) => Promise<boolean>`",
                "Resolve `true` to begin the swipe, `false` to leave the drag alone"
              ],
              [
                "`onMove`",
                "`(event, info, { animate, currentScreen, prevScreen, onProgress }) => number`",
                "Fires every drag frame. Without a declared destination, you move both screens. `onProgress(triggered)` reports the decision so the decorator and Parts follow; a second argument is accepted and not read"
              ],
              [
                "`onEnd`",
                "`(event, info, { animate, currentScreen, prevScreen, triggered, onStart }) => Promise<boolean | void>`",
                "When you move the screens: decide from `info.offset` and `info.velocity`, report the decision through `onStart`, finish both screens' animation, and return it"
              ]
            ]
          },
          {
            type: "list",
            items: [
              "`info` is `{ point, offset, velocity, delta }`, each an `{ x, y }` pair. `event` is a `PointerEvent`",
              "`animate(element, target, options?)` writes a target to an element. Pass `{ duration: 0 }` to follow the finger, and a short `duration` with an `ease` to finish after release",
              "Setting `current` or `prev` keeps flemo moving the screens whatever hooks you write. Hook writes to the screens are refused. Writes to other elements, such as a morphing element, go through",
              "The cost of hooks: the browser's compositor does not see a drag written a value at a time as an animation, so it has to start one on release. Measured on an iPhone at 41 to 49ms of dropped frames on every release. A declared drag does not pay it",
              "`DEFAULT_COMMIT_FRACTION` (`50 / 390`) and `DEFAULT_COMMIT_VELOCITY` (`20`) are exported for an `onEnd` that wants flemo's own rule",
              "The duration of the animation after release is the shorter of two lengths: the authored curve's time for the remaining distance, or the time the finger's speed needs. It never exceeds the authored duration and is never under 0.12s",
              "A drag needs 8px of movement in the positive direction (right for `x`, down for `y`) with a 3:1 lead over the other axis. Otherwise it stays a scroll for that pointer",
              "A drag that begins inside a scroller on the swipe axis normally scrolls. A vertical scroller already at its top lets a `y` swipe start",
              "Navigation input that arrives while a transition is running is ignored, not queued"
            ]
          }
        ]
      },
      { type: "h", text: "Decorators" },
      {
        type: "p",
        text: "A transition can add a decorator, a dim or tint over the previous screen, set with `options.decoratorName`. `cupertino` sets the built-in `overlay`. See [Decorator](decorator) for writing one, its timing and how it follows a swipe."
      },
      { type: "h", text: "Raw transitions" },
      {
        type: "p",
        text: "`createTransition` derives push, replace and pop from one symmetric set. `createRawTransition` has a slot for every status and side, so each operation can move differently."
      },
      { type: "code", lang: "ts", title: "transitions/shove.ts", code: SHOVE, highlight: [10, 12] },
      {
        type: "p",
        text: "Here a replace pushes the old screen fully off, while a push moves it back only 30%. `createRawDecorator` and `createRawPartTransition` use the same slot names."
      },
      {
        type: "details",
        title: "Raw slots and advanced options",
        blocks: [
          {
            type: "list",
            items: [
              "`pushOnEnter` / `pushOnExit`: PUSHING, the new screen and the previous screen",
              "`replaceOnEnter` / `replaceOnExit`: REPLACING, the new screen and the replaced screen",
              "`popOnEnter` / `popOnExit`: POPPING, the closing top screen and the previous screen coming back. `popOnEnter` is not the new screen",
              "`completedOnEnter` / `completedOnExit`: the styles after a navigation ends. They are rest styles and do not animate",
              "Verify status mappings in declaration JSDoc rather than inferring them from `Enter` or `Exit`"
            ]
          },
          {
            type: "p",
            text: '`options.driver: "native"` lets the engine adjust the timing of this transition\'s running animation. It may hold the first frame, re-align the animation to the start of the transition, and re-align it after a stall.'
          },
          {
            type: "p",
            text: "By default, flemo protects the start of a transition by scheduling when animations start, and never touches a running animation. On WebKit, any such touch loses the accelerated out-of-process animation path. Opt in only after verifying the trade on real devices."
          }
        ]
      }
    ]
  },
  ko: {
    slug: "transitions",
    title: "Transitions",
    summary:
      "내장 프리셋이나 `createTransition`으로 화면 전환 애니메이션을 정하고, 이동할 때마다 다른 트랜지션을 고르거나 스와이프 뒤로 가기와 데코레이터를 더할 수 있어요.",
    blocks: [
      {
        type: "demo",
        demo: "cupertino",
        caption:
          "항목을 하나 열고 상세 화면을 오른쪽으로 끌어 보세요. 조금만 끌다 손을 떼면 화면이 제자리로 돌아와요."
      },
      { type: "h", text: "프리셋" },
      {
        type: "p",
        text: "프리셋 네 개가 내장돼 있어서 따로 등록하지 않아도 돼요. `defaultTransitionName`을 생략하면 Router는 `cupertino`를 써요."
      },
      {
        type: "table",
        headers: ["프리셋", "움직임", "제스처"],
        rows: [
          [
            "`cupertino`",
            "새 화면이 `[0.32, 0.72, 0, 1]` easing으로 0.7초 동안 오른쪽에서 밀려 들어와요. 이전 화면은 `overlay` 딤 아래에서 30% 뒤로 물러나요",
            "오른쪽으로 드래그(`x`). 기본 뒤로 가기 기준 거리를 넘으면 뒤로 가요"
          ],
          [
            "`material`",
            "새 화면이 0.35초 동안 아래에서 올라오고, 이전 화면은 56px 올라가면서 흐려져요. pop은 0.25초예요",
            "아래로 드래그(`y`). 56px을 넘으면 뒤로 가고, 그보다 더 끌면 저항이 생겨요"
          ],
          [
            "`layout`",
            "초반에 대부분 진행되는 0.4초 페이드예요. 새 화면이나 닫히는 화면만 움직여서 [Morph](morph)와 함께 쓰기 좋아요",
            "아래로 드래그(`y`)하면 화면이 끌려 내려가요. 56px을 넘으면 뒤로 가요"
          ],
          ["`none`", "화면이 바로 바뀌어요. 모든 variant의 duration이 0이에요", "없음"]
        ]
      },
      {
        type: "note",
        kind: "tip",
        text: "공유 요소가 있는 화면에는 `layout`을 쓰세요. 페이드가 화면 전환의 3분의 1 지점에서 거의 끝나요. [Morph](morph)만 움직이고 화면은 그대로 두고 싶다면 `none`을 쓰세요."
      },
      {
        type: "details",
        title: "프리셋 세부 사항",
        blocks: [
          {
            type: "list",
            items: [
              "`cupertino`는 실측한 iOS push 동작을 따라요. Ionic은 같은 곡선에 540ms로 UIKit을 재현하는데, flemo는 더 차분하게 움직이도록 0.7초를 골랐어요. 새 화면 왼쪽 가장자리에 생기는 iOS의 그림자는 일부러 넣지 않았어요",
              "`material`은 `[0, 0, 0.2, 1]`과 `[0.4, 0, 1, 1]` easing을 써요. push와 pop의 길이가 달라서, 함께 움직이는 Part와 데코레이터도 똑같이 길이가 달라져요",
              "`layout`은 push할 때 이전 화면을 가만히 두고 그 위로 새 화면을 페이드 인해요. pop할 때는 닫히는 화면이 페이드 아웃하고 이전 화면은 그대로 있어요. 시선이 공유 요소를 따라가야 하는데 딤은 화면에 변화만 더해서, 데코레이터를 지정하지 않았어요",
              '`layout`은 드래그할 때 pop과 다르게 움직여요. `current: { y: "100%", opacity: 0.96 }`와 `prev: {}`를 선언해서, 화면은 시트처럼 아래로 내려가고 이전 화면은 그대로 있어요',
              "등록되지 않은 이름도 `none`으로 처리돼요. 이름에 오타가 있으면 화면이 애니메이션 없이 그냥 나타나고, 개발 모드에서 이름마다 한 번 경고해요"
            ]
          }
        ]
      },
      { type: "h", text: "이동마다 트랜지션 고르기" },
      {
        type: "p",
        text: "기본 트랜지션은 Router의 `defaultTransitionName`으로 정하고, 특정 이동만 바꾸려면 `transitionName`을 넘겨요. `Route`마다 트랜지션을 정하는 방법은 없어요. 애니메이션은 목적지 화면이 아니라 이동 자체에 붙기 때문이에요."
      },
      { type: "code", lang: "tsx", code: PER_NAV_KO, highlight: [4, 7] },
      {
        type: "p",
        text: "`transitionName` 없이 `pop`하면 닫히는 화면이 열릴 때 썼던 트랜지션으로 돌아가요. 다른 이동 옵션은 [Navigation](navigation)을 보세요."
      },
      { type: "h", text: "트랜지션 만들기" },
      {
        type: "p",
        text: "`createTransition`에는 variant 여섯 개를 적어요. `initial`을 뺀 나머지는 모두 `{ value, options }` 형태로, CSS 값과 타이밍을 함께 적어요."
      },
      {
        type: "table",
        headers: ["슬롯", "적용되는 화면", "시작 스타일"],
        rows: [
          ["`initial`", "새 화면이 애니메이션을 시작하기 전의 스타일", "애니메이션 없음"],
          ["`idle`", "멈춰 있는 화면(양쪽 모두)", "애니메이션 없음"],
          [
            "`enter`",
            "push나 replace로 맨 위에 올라오는 새 화면. 전환이 끝난 뒤에도 이 스타일을 유지해요",
            "`initial`"
          ],
          [
            "`exit`",
            "push나 replace로 뒤로 가려지는 이전 화면. 전환이 끝난 뒤에도 이 스타일을 유지해요",
            "`idle`"
          ],
          ["`enterBack`", "pop으로 닫히는 맨 위 화면", "`idle`"],
          ["`exitBack`", "pop으로 다시 나타나는 이전 화면", "`exit`"]
        ]
      },
      { type: "code", lang: "ts", title: "transitions/slide.ts", code: SLIDE_KO },
      {
        type: "p",
        text: "만든 트랜지션을 Router에 등록하면 돼요. `RegisterTransition`을 확장해 두면 `transitionName`과 `defaultTransitionName`이 자동완성돼요."
      },
      { type: "code", lang: "tsx", title: "App.tsx", code: APP, highlight: [8] },
      {
        type: "table",
        headers: ["옵션", "의미"],
        rows: [
          ["`duration`", "초 단위"],
          ["`delay`", "초 단위"],
          [
            "`ease`",
            "이름 있는 ease(`linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, `circIn`, `circOut`, `backIn`, `backOut`, `anticipate`), CSS 키워드, `cubic-bezier()`, `steps()`, `linear()`, 숫자 네 개짜리 튜플을 쓸 수 있어요. 기본값은 `ease`예요"
          ]
        ]
      },
      {
        type: "note",
        kind: "warn",
        text: "`active`는 이동 방향이 아니라 스택에서의 위치를 나타내요. pop 중에도 닫히는 화면은 여전히 맨 위의 활성 화면이라서 `enterBack`을 재생해요."
      },
      {
        type: "details",
        title: "상태별 슬롯 표",
        blocks: [
          {
            type: "p",
            text: "모든 화면에는 상태와 `active` 값이 있어요. 아래 표는 두 값의 조합마다 각 팩토리가 어떤 슬롯을 쓰는지 보여 줘요."
          },
          {
            type: "table",
            headers: [
              "상태",
              "active",
              "화면 역할",
              "`createTransition`",
              "`createRawTransition`",
              "데코레이터"
            ],
            rows: [
              ["PUSHING", "true", "새 화면, 맨 위", "`enter`", "`pushOnEnter`", "`idle`"],
              ["PUSHING", "false", "이전 화면, 뒤로 가려짐", "`exit`", "`pushOnExit`", "`enter`"],
              ["REPLACING", "true", "새 화면", "`enter`", "`replaceOnEnter`", "`idle`"],
              ["REPLACING", "false", "교체되는 화면", "`exit`", "`replaceOnExit`", "`enter`"],
              ["POPPING", "true", "닫히는 중, 아직 맨 위", "`enterBack`", "`popOnEnter`", "`idle`"],
              ["POPPING", "false", "이전 화면, 다시 나타남", "`exitBack`", "`popOnExit`", "`exit`"],
              ["COMPLETED", "true", "활성, 전환 끝남", "`enter`", "`completedOnEnter`", "`idle`"],
              ["COMPLETED", "false", "뒤쪽, 전환 끝남", "`exit`", "`completedOnExit`", "`enter`"],
              ["IDLE", "둘 다", "멈춤", "`idle`", "`idle`", "`idle`"]
            ]
          },
          {
            type: "list",
            items: [
              "애니메이션이 어떤 스타일에서 시작하는지는 정해져 있어요. PUSHING-true와 REPLACING-true는 `initial`에서 시작해요",
              "PUSHING-false, REPLACING-false, POPPING-true는 `idle` 스타일에서 시작해요",
              "POPPING-false는 PUSHING-false가 끝난 스타일에서 시작해요. raw 슬롯이라면 `popOnExit`이 `pushOnExit`에서 시작해요",
              "IDLE과 COMPLETED는 멈춰 있는 상태라 애니메이션하지 않아요. duration과 delay가 모두 0인 variant도 애니메이션하지 않아요",
              '`enterBack`은 pop할 때 사라지는 활성 화면이에요. `cupertino`에서는 `x: "100%"`예요',
              '`active === "true"`를 새 화면이라는 뜻으로 읽으면 pop할 때마다 Morph 짝이 뒤바뀌어요. [Part](part)와 [Morph](morph)는 슬롯 구성이 또 다르니 각 페이지를 확인하세요'
            ]
          }
        ]
      },
      { type: "h3", text: "애니메이션할 수 있는 속성" },
      {
        type: "p",
        text: "애니메이션 가능한 CSS 속성은 모두 쓸 수 있고 자동완성도 돼요. `x`, `y`, `z`, `scale`, `scaleX`, `scaleY`, `rotate`, `rotateX`, `rotateY`, `rotateZ` 같은 transform 축약 속성은 하나의 `transform`으로 합쳐져요."
      },
      {
        type: "details",
        title: "값과 보간",
        blocks: [
          {
            type: "list",
            items: [
              "`clipPath`, `filter`, `borderRadius`, `boxShadow`, `color`, `--custom` 속성까지 CSS 전반을 쓸 수 있고, React `style`처럼 camelCase로 적어요",
              '숫자만 적으면 단위가 붙어요. 길이는 `px`, 회전은 `deg`이고, CSS에서 단위가 없는 속성은 그대로 둬요. `"100%"`나 `"1rem"` 같은 문자열은 그대로 전달돼요',
              "시작 값과 끝 값의 형태가 달라도 돼요. `clip-path`를 `inset(0 0 0 100%)`에서 `inset(0)`으로 바꿀 수 있고, `calc()` 값이나 서로 다른 단위(`50%`에서 `200px`)도 쓸 수 있어요",
              "속성을 한쪽에만 적어도 돼요. 빠진 쪽은 `transform`과 `opacity`라면 기본값(변형 없음, 완전 불투명)으로 채워지고, 다른 속성은 지금 화면에 보이는 값에서 시작해요",
              "`initial`에 적은 옵션은 무시되고 값만 읽어요",
              "flemo와 CSS 모두 모르는 ease 문자열은 `ease`로 처리되고, 개발 모드에서 한 번 경고해요"
            ]
          },
          {
            type: "note",
            kind: "warn",
            text: "값은 브라우저의 CSS 보간을 그대로 써요. CSS가 연속으로 보간하지 못하는 조합은 네이티브 CSS처럼 중간 지점에서 한 번에 바뀌어요. `inset()`끼리는 부드럽게 변하지만, `inset()`에서 `circle()`로는 바로 바뀌어요."
          },
          {
            type: "p",
            text: "아래 `wipe`는 왼쪽에서 오른쪽으로 열리는 `clip-path`로 새 화면을 드러내요. 이전 화면은 살짝 작아지고 흐려지면서 뒤로 물러나요."
          },
          { type: "code", lang: "ts", title: "transitions/wipe.ts", code: WIPE, highlight: [7, 9] }
        ]
      },
      { type: "h", text: "스와이프" },
      {
        type: "p",
        text: "`options`에 `swipe: { direction }`을 추가하면 위의 `slide`처럼 화면을 끌어서 뒤로 갈 수 있어요. 드래그하는 동안 트랜지션의 pop 애니메이션이 손가락 위치에 맞춰 진행되고, 프레임마다 실행할 코드를 따로 쓸 필요는 없어요."
      },
      {
        type: "p",
        text: "손을 뗐을 때 `threshold`보다 멀리 끌었거나, 손가락이 아직 `velocity`보다 빠르게 움직이고 있었다면 뒤로 가기가 확정돼요. 둘 중 하나만 만족해도 돼요. `swipe`가 없는 트랜지션에는 제스처가 없어요."
      },
      {
        type: "table",
        headers: ["옵션", "타입", "기본값", "역할"],
        rows: [
          ["`direction`", '`"x"` 또는 `"y"`', "필수", "제스처가 움직이는 축"],
          [
            "`threshold`",
            "`number` 또는 `(span) => number`",
            "390px 화면에서 50px, 화면 크기에 비례",
            "뒤로 가기가 확정되려면 화면을 몇 px 끌어야 하는지"
          ],
          [
            "`velocity`",
            "`number`",
            "`20`",
            "조금만 끌었어도 뒤로 가기가 확정되는, 손을 뗄 때의 손가락 속도"
          ],
          [
            "`progress`",
            "`(info, span) => number` 또는 `{ current, prev }`",
            "화면 너비나 높이 대비 끈 거리",
            "각 화면이 이동 경로의 어디쯤 있는지(0~1). 저항이 있거나 중간에 멈추는 드래그에 써요"
          ],
          [
            "`current` / `prev`",
            "`TransitionTarget` 또는 `SwipeStop[]`",
            "pop의 값",
            "드래그할 때 각 화면이 향하는 스타일. pop과 다르게 움직여야 할 때 적어요"
          ],
          ["`onStart`", "훅", "없음", "화면이 움직이기 전에 제스처를 시작할지 정해요"],
          ["`onMove` / `onEnd`", "훅", "없음", "드래그를 직접 처리해요. 아래 경고를 보세요"]
        ]
      },
      {
        type: "p",
        text: "flemo가 계산한 진행도는 트랜지션의 데코레이터와 양쪽 화면의 모든 [Part](part)에도 적용돼서, 모두 같은 제스처를 따라 움직여요."
      },
      {
        type: "note",
        kind: "warn",
        text: "`current`나 `prev` 없이 `onMove`나 `onEnd`를 적으면 두 화면을 움직이는 일과 뒤로 가기 확정 여부를 직접 처리해야 해요. 드래그가 화면을 정해진 스타일로 옮기기만 한다면 훅 대신 목표 스타일을 적으세요."
      },
      {
        type: "details",
        title: "스와이프 예제",
        blocks: [
          {
            type: "p",
            text: '`cupertino`의 제스처 설정은 `swipe: { direction: "x" }`가 전부예요. 화면이 손가락을 1:1로 따라가는 게 기본 동작이에요.'
          },
          {
            type: "p",
            text: "`material`은 두 화면이 서로 다른 속도로 움직여서 `progress`가 필요해요. 끌려 내려가는 화면은 자기 높이만큼 이동해야 해서, 고무줄처럼 늘어나는 구간에서도 계속 움직여요. 이전 화면은 56px만 움직이고 멈춰요."
          },
          {
            type: "code",
            lang: "ts",
            title: "material의 swipe",
            code: MATERIAL_SWIPE_KO,
            highlight: [15, 16, 17, 18, 19, 20]
          },
          {
            type: "p",
            text: "속성마다 진행 속도가 다르면 단계(stop)를 나열해요. `at`은 드래그의 어느 지점(0~1)에서 그 스타일에 도달하는지를 뜻하고, 마지막 단계가 끝 지점이에요."
          },
          { type: "code", lang: "ts", code: STOPS_KO },
          {
            type: "list",
            items: [
              "목표 스타일만 적으면 돼요. 드래그는 화면이 지금 있는 자리, 즉 pop의 시작 스타일에서 출발해요",
              "`prev: {}`처럼 빈 값을 주면 그 화면은 움직이지 않고, flemo도 그 화면을 건드리지 않아요",
              "`progress`는 두 화면에 함께 쓸 숫자 하나나 `{ current, prev }`를 반환해요. 결과는 0~1 범위로 잘리고 `NaN`은 0으로 처리돼요",
              "`current`는 손가락으로 끄는 화면이고, `prev`는 그 뒤에서 드러나는 이전 화면이에요"
            ]
          }
        ]
      },
      {
        type: "details",
        title: "스와이프 훅과 내부 동작",
        blocks: [
          {
            type: "p",
            text: "화면을 움직이는 쪽이 손을 뗐을 때의 처리도 맡아요. `current`나 `prev`를 적으면 flemo가 화면을 움직이고, 뒤로 가기 확정 여부와 손을 뗀 뒤 애니메이션의 타이밍도 정해요. 이때 `onEnd`는 그 결과를 `triggered`로 받기만 하고, 반환값은 쓰이지 않아요."
          },
          {
            type: "p",
            text: "목표 스타일 없이 훅만 적으면 화면을 움직이는 일과 확정 판단을 직접 맡게 돼요. 화면 자체를 자유로운 위치로 옮기는 드래그에만 맞는 방식이에요. `onStart`는 적어도 화면 제어를 가져오지 않아요."
          },
          {
            type: "table",
            headers: ["훅", "시그니처", "역할"],
            rows: [
              [
                "`onStart`",
                "`(event, info, { animate, currentScreen, prevScreen, onStart }) => Promise<boolean>`",
                "`true`로 resolve하면 스와이프를 시작하고, `false`면 드래그를 무시해요"
              ],
              [
                "`onMove`",
                "`(event, info, { animate, currentScreen, prevScreen, onProgress }) => number`",
                "드래그 프레임마다 호출돼요. 목표 스타일을 선언하지 않았다면 두 화면을 직접 움직여야 해요. `onProgress(triggered)`로 확정 여부를 알려 주면 데코레이터와 Part가 따라와요. 두 번째 인자는 받지만 쓰이지 않아요"
              ],
              [
                "`onEnd`",
                "`(event, info, { animate, currentScreen, prevScreen, triggered, onStart }) => Promise<boolean | void>`",
                "화면을 직접 움직인다면 `info.offset`과 `info.velocity`로 확정 여부를 정하고, `onStart`로 알린 뒤, 두 화면의 애니메이션을 마무리하고 결과를 반환해요"
              ]
            ]
          },
          {
            type: "list",
            items: [
              "`info`는 `{ point, offset, velocity, delta }`이고, 각각 `{ x, y }` 값이에요. `event`는 `PointerEvent`예요",
              "`animate(element, target, options?)`는 요소에 스타일을 적용해요. 손가락을 따라가게 하려면 `{ duration: 0 }`을, 손을 뗀 뒤 마무리하려면 짧은 `duration`과 `ease`를 넘겨요",
              "`current`나 `prev`를 적으면 어떤 훅을 쓰든 화면은 flemo가 움직여요. 훅에서 화면에 쓰는 값은 거부되고, Morph 요소처럼 다른 요소에 쓰는 값은 그대로 적용돼요",
              "훅에는 비용이 있어요. 값을 하나씩 직접 쓰는 드래그는 브라우저 컴포지터 입장에서 애니메이션이 아니라서, 손을 뗄 때 애니메이션을 새로 시작해야 해요. iPhone에서 손을 뗄 때마다 41~49ms의 프레임 드랍이 측정됐어요. 선언형 드래그에는 이 비용이 없어요",
              "`onEnd`에서 flemo와 같은 기준을 쓰고 싶다면 export된 `DEFAULT_COMMIT_FRACTION`(`50 / 390`)과 `DEFAULT_COMMIT_VELOCITY`(`20`)를 쓰세요",
              "손을 뗀 뒤 애니메이션의 길이는 두 값 중 짧은 쪽이에요. 하나는 작성한 easing으로 남은 거리를 가는 시간이고, 다른 하나는 손가락 속도로 가는 데 필요한 시간이에요. 작성한 duration보다 길어지지 않고, 0.12초보다 짧아지지도 않아요",
              "드래그로 인정되려면 양의 방향(`x`는 오른쪽, `y`는 아래)으로 8px 이상 움직이고, 다른 축보다 3배 이상 더 움직여야 해요. 그렇지 않으면 그 포인터 입력은 스크롤로 처리돼요",
              "스와이프 방향으로 스크롤되는 영역 안에서 시작한 드래그는 보통 스크롤돼요. 다만 세로 스크롤 영역이 이미 맨 위에 있으면 `y` 스와이프를 시작할 수 있어요",
              "화면 전환 중에 들어온 이동 요청은 대기열에 쌓이지 않고 무시돼요"
            ]
          }
        ]
      },
      { type: "h", text: "데코레이터" },
      {
        type: "p",
        text: "트랜지션에 `options.decoratorName`으로 데코레이터를 지정하면, 화면 전환 중에 이전 화면 위에 딤이나 색 오버레이를 깔 수 있어요. `cupertino`는 내장 `overlay`를 지정해요. 직접 만드는 방법, 타이밍, 스와이프를 따라가는 방식은 [Decorator](decorator)에서 다뤄요."
      },
      { type: "h", text: "Raw 트랜지션" },
      {
        type: "p",
        text: "`createTransition`은 대칭으로 적은 한 세트에서 push, replace, pop 동작을 모두 만들어요. `createRawTransition`은 상태와 화면마다 슬롯을 따로 적어서, push, replace, pop을 각각 다르게 움직이게 할 수 있어요."
      },
      { type: "code", lang: "ts", title: "transitions/shove.ts", code: SHOVE, highlight: [10, 12] },
      {
        type: "p",
        text: "이 예제에서 replace는 이전 화면을 완전히 밀어내고, push는 30%만 밀어내요. `createRawDecorator`와 `createRawPartTransition`도 같은 슬롯 이름을 써요."
      },
      {
        type: "details",
        title: "Raw 슬롯과 고급 옵션",
        blocks: [
          {
            type: "list",
            items: [
              "`pushOnEnter` / `pushOnExit`: PUSHING 상태의 새 화면과 이전 화면",
              "`replaceOnEnter` / `replaceOnExit`: REPLACING 상태의 새 화면과 교체되는 화면",
              "`popOnEnter` / `popOnExit`: POPPING 상태의 닫히는 맨 위 화면과 다시 나타나는 이전 화면. `popOnEnter`는 새 화면이 아니에요",
              "`completedOnEnter` / `completedOnExit`: 이동이 끝난 뒤의 스타일이에요. 멈춰 있는 상태라 애니메이션하지 않아요",
              "어떤 상태에 대응하는지는 `Enter`, `Exit`라는 이름으로 짐작하지 말고 선언의 JSDoc에서 확인하세요"
            ]
          },
          {
            type: "p",
            text: '`options.driver: "native"`를 주면 이 트랜지션에 한해 엔진이 실행 중인 애니메이션의 타이밍을 직접 조정할 수 있어요. 첫 프레임에서 잠시 멈춰 두거나, 화면 전환의 시작 시점에 다시 맞추거나, 프레임이 밀리면 다시 맞추는 식이에요.'
          },
          {
            type: "p",
            text: "기본 동작에서는 애니메이션을 언제 시작할지 조절해서 화면 전환의 시작을 지키고, 이미 실행 중인 애니메이션은 건드리지 않아요. WebKit에서는 실행 중인 애니메이션을 한 번이라도 건드리면 별도 프로세스에서 가속되는 경로를 쓸 수 없게 돼요. 실제 기기에서 장단점을 확인한 뒤에만 쓰세요."
          }
        ]
      }
    ]
  }
};

export default page;
