import type { LocalizedDocPage } from "../docTypes";

const HEADER_TITLE_EN = `import { createPartTransition } from "@flemo/react";

// cupertino's easing, so the title moves in step with the screen on swipes too.
// No durations: each variant uses the screen's duration and delay.
const EASE = [0.32, 0.72, 0, 1] as const;

export const headerTitle = createPartTransition({
  name: "header-title",
  initial: { opacity: 0, x: 72 },
  idle: { value: { opacity: 1, x: 0 }, options: { ease: EASE } },
  enter: { value: { opacity: 0, x: -72 }, options: { ease: EASE } },
  exit: { value: { opacity: 1, x: 0 }, options: { ease: EASE } },
  dismiss: { value: { opacity: 0, x: 72 }, options: { ease: EASE } }
});

declare module "@flemo/react" {
  interface RegisterPartTransition {
    "header-title": "header-title";
  }
}`;

const HEADER_TITLE_KO = `import { createPartTransition } from "@flemo/react";

// cupertino와 같은 easing이라 스와이프할 때도 제목이 화면과 함께 움직여요.
// duration을 적지 않으면 variant마다 화면의 타이밍을 그대로 따라가요.
const EASE = [0.32, 0.72, 0, 1] as const;

export const headerTitle = createPartTransition({
  name: "header-title",
  initial: { opacity: 0, x: 72 },
  idle: { value: { opacity: 1, x: 0 }, options: { ease: EASE } },
  enter: { value: { opacity: 0, x: -72 }, options: { ease: EASE } },
  exit: { value: { opacity: 1, x: 0 }, options: { ease: EASE } },
  dismiss: { value: { opacity: 0, x: 72 }, options: { ease: EASE } }
});

declare module "@flemo/react" {
  interface RegisterPartTransition {
    "header-title": "header-title";
  }
}`;

const SCREEN_EN = `import { Part, Screen } from "@flemo/react";

function Header({ title }: { title: string }) {
  return (
    <header className="app-header">
      <Part name="header-title">
        <h1>{title}</h1>
      </Part>
    </header>
  );
}

export default function Inbox() {
  return (
    <Screen sharedTopBar={<Header title="Inbox" />} sharedTopBarId="app-header">
      <MailList />
    </Screen>
  );
}`;

const SCREEN_KO = `import { Part, Screen } from "@flemo/react";

function Header({ title }: { title: string }) {
  return (
    <header className="app-header">
      {/* 헤더는 제자리에 있고 제목만 움직여요 */}
      <Part name="header-title">
        <h1>{title}</h1>
      </Part>
    </header>
  );
}

export default function Inbox() {
  return (
    <Screen sharedTopBar={<Header title="받은편지함" />} sharedTopBarId="app-header">
      <MailList />
    </Screen>
  );
}`;

const ROUTER = `<Router partTransitions={[headerTitle]}>
  <Route path="/" element={<Inbox />} />
  <Route path="/mail/:id" element={<Mail />} />
</Router>`;

const AFTER_TRANSITION_EN = `import { createPartTransition } from "@flemo/react";

const SHOWN = { opacity: 1, y: 0 };
const HIDDEN = { opacity: 0, y: -24 };

export const detailChrome = createPartTransition({
  name: "detail-chrome",
  initial: HIDDEN,
  // Waits until the screen transition ends, then lowers the header.
  idle: { value: SHOWN, options: { duration: 0.32, after: "transition", ease: [0, 0, 0.2, 1] } },
  enter: { value: SHOWN, options: { duration: 0 } },
  exit: { value: SHOWN, options: { duration: 0 } },
  dismiss: { value: HIDDEN, options: { duration: 0.16, ease: [0.4, 0, 1, 1] } }
});`;

const AFTER_TRANSITION_KO = `import { createPartTransition } from "@flemo/react";

const SHOWN = { opacity: 1, y: 0 };
const HIDDEN = { opacity: 0, y: -24 };

export const detailChrome = createPartTransition({
  name: "detail-chrome",
  initial: HIDDEN,
  // 어떤 화면 전환이든 끝날 때까지 기다렸다가 헤더를 내려요.
  idle: { value: SHOWN, options: { duration: 0.32, after: "transition", ease: [0, 0, 0.2, 1] } },
  enter: { value: SHOWN, options: { duration: 0 } },
  exit: { value: SHOWN, options: { duration: 0 } },
  dismiss: { value: HIDDEN, options: { duration: 0.16, ease: [0.4, 0, 1, 1] } }
});`;

const SWIPE_HOOKS_EN = `import { createPartTransition } from "@flemo/react";

const EASE = [0.32, 0.72, 0, 1] as const;

export const panelTitle = createPartTransition({
  name: "panel-title",
  initial: { opacity: 1, y: 0 },
  idle: { value: { opacity: 1, y: 0 }, options: { duration: 0 } },
  enter: { value: { opacity: 0.35, y: -10 }, options: { ease: EASE } },
  exit: { value: { opacity: 1, y: 0 }, options: { ease: EASE } },
  options: {
    onSwipe: (_, progress, { animate, element, active }) => {
      if (active) return;
      const travelled = Math.min(1, Math.max(0, progress / 100));
      const faded = Math.min(1, travelled / 0.55);
      animate(
        element,
        { opacity: 0.35 + 0.65 * faded, y: -10 * (1 - travelled) },
        { duration: 0 }
      );
    },
    onSwipeEnd: (triggered, { animate, element, active }) => {
      if (active) return;
      animate(element, triggered ? { opacity: 1, y: 0 } : { opacity: 0.35, y: -10 }, {
        duration: 0.3,
        ease: EASE
      });
    }
  }
});`;

const SWIPE_HOOKS_KO = `import { createPartTransition } from "@flemo/react";

const EASE = [0.32, 0.72, 0, 1] as const;

export const panelTitle = createPartTransition({
  name: "panel-title",
  initial: { opacity: 1, y: 0 },
  idle: { value: { opacity: 1, y: 0 }, options: { duration: 0 } },
  enter: { value: { opacity: 0.35, y: -10 }, options: { ease: EASE } },
  exit: { value: { opacity: 1, y: 0 }, options: { ease: EASE } },
  options: {
    onSwipe: (_, progress, { animate, element, active }) => {
      // 닫히는 화면의 제목은 스타일을 건드리지 않아요
      if (active) return;
      const travelled = Math.min(1, Math.max(0, progress / 100));
      const faded = Math.min(1, travelled / 0.55);
      animate(
        element,
        { opacity: 0.35 + 0.65 * faded, y: -10 * (1 - travelled) },
        { duration: 0 }
      );
    },
    onSwipeEnd: (triggered, { animate, element, active }) => {
      if (active) return;
      // 뒤로 가기가 확정되든 취소되든 마지막 값으로 마무리해요
      animate(element, triggered ? { opacity: 1, y: 0 } : { opacity: 0.35, y: -10 }, {
        duration: 0.3,
        ease: EASE
      });
    }
  }
});`;

const page: LocalizedDocPage = {
  en: {
    slug: "part",
    title: "Part",
    summary:
      "Part animates one element inside a screen or its shared bar, such as a header title, in step with the screen transition.",
    blocks: [
      {
        type: "demo",
        demo: "part",
        caption:
          "Push the detail and watch only the title change while the bar stays still, then swipe back slowly."
      },
      { type: "h", text: "What a Part is" },
      {
        type: "p",
        text: "`<Part name>` wraps its children in a `div` and runs a registered part transition on that element alone. `name` is its only own prop; every other prop is a normal `div` prop."
      },
      {
        type: "table",
        headers: ["Use", "When"],
        rows: [
          ["`Part`", "One element changes on each screen: a title, an action, a line of copy"],
          ["[Morph](morph)", "One element is the same thing on two screens and moves between them"],
          ["Fixed UI beside the [Slot](slot)", "UI identical on every route. It never moves"],
          ["A screen transition", "The whole screen moves"]
        ]
      },
      { type: "h", text: "Shared bars and Part" },
      {
        type: "p",
        text: "A bar that looks fixed but whose title changes belongs to each [Screen](screen). Render it with `sharedTopBar`, give every screen the same `sharedTopBarId`, and wrap what changes in a `Part`."
      },
      {
        type: "code",
        lang: "ts",
        title: "parts/headerTitle.ts",
        code: HEADER_TITLE_EN,
        highlight: [5, 13]
      },
      { type: "code", lang: "tsx", title: "Inbox.tsx", code: SCREEN_EN, highlight: [6, 15] },
      {
        type: "p",
        text: "Register part transitions on the Router, beside `transitions` and `decorators`. The `RegisterPartTransition` augmentation gives `name` autocomplete."
      },
      { type: "code", lang: "tsx", code: ROUTER },
      {
        type: "details",
        title: "How a shared bar changes between screens",
        blocks: [
          {
            type: "list",
            items: [
              "Two bars are treated as the same bar only when their ids are equal. Two bars without an id match by position, but a bar with an id never matches one without",
              "Each screen renders its own copy of the bar. While the transition runs, the Parts of a matched bar are moved into a separate part layer, so the copy on the screen underneath is not hidden under the other screen's opaque background. They move back when the transition ends",
              "A Part follows the transition of the Router that renders the screen around it. A Part in a nested Router's fixed UI follows the outer Router's transition. Outside every screen, it follows the nearest Router",
              "A part transition is found by name under any transition in the Router. Its timing is resolved separately for each transition",
              "A `Part` whose `name` is not registered does not move. Development warns once and points at `partTransitions`"
            ]
          }
        ]
      },
      { type: "h", text: "Part slots" },
      {
        type: "p",
        text: "`createPartTransition` reuses screen slot names with different meanings. Read each slot by what the Part's screen is doing."
      },
      {
        type: "table",
        headers: ["Slot", "The Part's screen", "Animates from"],
        rows: [
          ["`initial`", "The new screen's starting style on push or replace", "Not animated"],
          [
            "`idle`",
            "At rest, and the new screen on push or replace",
            "`initial`, on the new screen"
          ],
          [
            "`enter`",
            "The previous screen on push or replace, moving behind or staying there",
            "`idle`"
          ],
          ["`exit`", "The previous screen coming back on pop", "`enter`"],
          [
            "`dismiss`",
            "Optional. The top screen closing on pop. Omitted, it keeps `idle`",
            "`idle`"
          ]
        ]
      },
      {
        type: "p",
        text: "Parts animate from the previous variant's values, not from `initial`. Match `exit` to `idle` so the returning Part ends without a jump."
      },
      {
        type: "note",
        kind: "warn",
        text: "Without `dismiss`, the closing screen's Part stays fully opaque while the returning one fades in, so only one side of a matched pair moves. Set all five, as `headerTitle` does."
      },
      {
        type: "details",
        title: "Status and slot table",
        blocks: [
          {
            type: "table",
            headers: ["Status", "active", "Screen role", "Screen slot", "Part slot"],
            rows: [
              ["PUSHING", "true", "New screen, now on top", "`enter`", "`idle`"],
              ["PUSHING", "false", "Previous screen, moving behind", "`exit`", "`enter`"],
              ["REPLACING", "true", "New screen", "`enter`", "`idle`"],
              ["REPLACING", "false", "Screen being replaced", "`exit`", "`enter`"],
              [
                "POPPING",
                "true",
                "Closing screen, still on top",
                "`enterBack`",
                "`dismiss`, else `idle`"
              ],
              ["POPPING", "false", "Previous screen, coming back", "`exitBack`", "`exit`"],
              ["COMPLETED", "true", "Active, transition ended", "`enter`", "`idle`"],
              ["COMPLETED", "false", "Behind, transition ended", "`exit`", "`enter`"]
            ]
          },
          {
            type: "list",
            items: [
              "`active` follows the stack, not the direction of motion. On pop, the closing screen stays on top and `true`",
              "Applying screen slot meanings to a Part animates the wrong side and can look like it fades only one way",
              "POPPING-false starts where PUSHING-false ended, which is why `exit` animates from `enter`",
              "Before `dismiss` existed, fading both halves of a pair on pop meant restating all ten variants through `createRawPartTransition`",
              "On a programmatic push, replace or pop, a Part animates with its screen's transition from compiled keyframes. There is no per-frame code"
            ]
          }
        ]
      },
      { type: "h", text: "Timing" },
      {
        type: "p",
        text: "Leave `duration` out of a Part. It takes the screen's timing variant by variant, so `material` Parts run 0.35s on push and 0.25s on pop."
      },
      {
        type: "table",
        headers: ["", "Part"],
        rows: [
          ["Duration", "Authored, else the screen's same variant key"],
          [
            "Delay",
            "Authored, else the screen's. `after: \"transition\"` adds the screen's delay plus duration"
          ],
          [
            "Ease",
            "Authored only, never inherited. To stay in step, use the screen's easing, such as `cupertino`'s `[0.32, 0.72, 0, 1]`"
          ]
        ]
      },
      { type: "h3", text: "Starting after the transition ends" },
      {
        type: "p",
        text: 'UI that appears once the transition ends cannot know how long the transition takes. `after: "transition"` means "start after the screen transition ends", under any transition.'
      },
      {
        type: "code",
        lang: "ts",
        title: "parts/detailChrome.ts",
        code: AFTER_TRANSITION_EN,
        highlight: [10]
      },
      {
        type: "p",
        text: '`delay` adds to it: `{ after: "transition", delay: 0.04 }` starts 40ms after the transition ends. Under `none` the transition takes no time, so the variant starts at once.'
      },
      {
        type: "note",
        kind: "warn",
        text: "A Part that runs longer than its screen keeps the whole transition running until the Part finishes, and swipe-back is disabled until then."
      },
      {
        type: "details",
        title: "Timing inheritance",
        blocks: [
          {
            type: "list",
            items: [
              "Inheritance uses the same variant key. A Part's PUSHING-false runs with the timing of the screen's PUSHING-false",
              "An explicit `duration` wins, including `0` to change instantly. Resolution uses `??`, not `||`, so an authored `0` survives",
              "A Part outside any screen has no screen transition to take timing from and keeps what it authored. An omitted duration there resolves to zero, so the Part changes instantly",
              "Do not copy screen durations into Parts to keep them in sync. Copied numbers drift apart",
              "Easing is not inherited because a Part is found by name under any transition. Taking each transition's easing would move the same Part differently on every transition",
              "Equal duration does not mean the Part is at the same point along its path as the screen. See Swipe below"
            ]
          }
        ]
      },
      { type: "h", text: "Swipe" },
      {
        type: "p",
        text: "The pop you declare is already the swipe animation. A Part with no swipe hooks follows the same POPPING progress as its screen, with the timing resolved for that Part, while dragging and when the swipe goes back or is cancelled. No per-frame code is required."
      },
      {
        type: "p",
        text: "During a swipe, the Part's position follows the finger. A programmatic pop plays the easing over time. Give the Part's variants the screen's easing, or the two will not match."
      },
      {
        type: "note",
        kind: "warn",
        text: "`onSwipeStart`, `onSwipe` and `onSwipeEnd` replace the built-in swipe tracking. You do not need them to turn tracking on. Adding any one of them stops that Part from following the swipe on its own, on both screens."
      },
      {
        type: "details",
        title: "Custom swipe hooks",
        blocks: [
          {
            type: "p",
            text: "With a hook, you control the Part's style during the drag and how it ends, both when the swipe goes back and when it is cancelled. Use hooks only when the Part should move differently from the declared pop."
          },
          {
            type: "p",
            text: "Each hook receives `(triggered, { animate, element, active })`. `onSwipe` also receives progress from 0 to 100, as `(triggered, progress, { animate, element, active })`."
          },
          {
            type: "code",
            lang: "ts",
            title: "parts/panelTitle.ts",
            code: SWIPE_HOOKS_EN,
            highlight: [12, 22]
          },
          {
            type: "p",
            text: "This finishes the opacity change in the first 55% of the gesture while the position keeps moving across the whole drag. The built-in swipe tracking cannot split them like that."
          },
          {
            type: "p",
            text: "`if (active) return;` keeps the closing screen's title under custom control without setting any style on it. The title on the inactive, returning screen is animated and brought to its final values whether the swipe goes back or is cancelled."
          },
          {
            type: "p",
            text: "Remove the whole `options` block when both properties should follow the declared pop."
          }
        ]
      },
      { type: "h", text: "Pitfalls" },
      {
        type: "table",
        headers: ["Symptom", "Fix"],
        rows: [
          ["A Part never moves", "Pass its transition to `<Router partTransitions>`"],
          ["Only one side of a pair fades on pop", "Add `dismiss`"],
          [
            "The Part changes instantly while the screen takes 0.7s",
            "It sits outside any screen. Give it a `duration`"
          ],
          [
            "The Part travels a different distance on swipe and on the back button",
            "Give its variants the screen's easing"
          ],
          [
            "Swipe-back stays disabled after a navigation",
            "Shorten Parts that outlast their screen"
          ]
        ]
      },
      {
        type: "details",
        title: "Parts inside a Morph",
        blocks: [
          {
            type: "list",
            items: [
              "Body copy inside a [Morph](morph) that re-wraps and then jumps belongs in a `Part`. A Part lays out once at its width at rest, and while the Morph grows it is clipped instead of re-wrapped",
              "If a container Morph shows old and new copy together, the copy that differs is being shown by the fading copy of the old element. Keep the shared item as a nested Morph and put the changing copy in a sibling Part",
              "That Part does not wrap a nested Morph that stays visible throughout, and the shared Morph's parent does not fade"
            ]
          }
        ]
      },
      {
        type: "details",
        title: "Raw part transitions",
        blocks: [
          {
            type: "p",
            text: "`createRawPartTransition` sets every status like `createRawTransition`: `idle`, `pushOnEnter` / `pushOnExit`, `replaceOnEnter` / `replaceOnExit`, `popOnEnter` / `popOnExit`, and `completedOnEnter` / `completedOnExit`."
          },
          {
            type: "p",
            text: "Raw Parts still take the screen's matching timing and follow its swipe. Any `onSwipe*` callback replaces that built-in swipe tracking. Easing is still not inherited."
          }
        ]
      }
    ]
  },
  ko: {
    slug: "part",
    title: "Part",
    summary:
      "Part는 헤더 제목처럼 화면이나 공유 바 안의 요소 하나만 골라서 화면 전환에 맞춰 움직여요.",
    blocks: [
      {
        type: "demo",
        demo: "part",
        caption:
          "상세 화면을 push하면 헤더는 제자리에 있고 제목만 바뀌어요. 그다음 천천히 스와이프해서 돌아와 보세요."
      },
      { type: "h", text: "Part란" },
      {
        type: "p",
        text: "`<Part name>`은 자식을 `div` 하나로 감싸고, 등록해 둔 Part 트랜지션을 그 요소에만 적용해요. Part 전용 prop은 `name` 하나뿐이고, 나머지 prop은 모두 일반 `div`의 prop이에요."
      },
      {
        type: "table",
        headers: ["무엇을 쓸까", "언제"],
        rows: [
          ["`Part`", "화면마다 내용이 바뀌는 요소 하나. 제목, 액션 버튼, 문구 한 줄 등"],
          [
            "[Morph](morph)",
            "두 화면에 같은 요소가 있고, 그 요소가 한 화면에서 다른 화면으로 이동할 때"
          ],
          ["[Slot](slot) 옆의 고정 UI", "모든 경로에서 똑같은 UI. 전혀 움직이지 않아요"],
          ["화면 트랜지션", "화면 전체가 움직일 때"]
        ]
      },
      { type: "h", text: "공유 바와 Part" },
      {
        type: "p",
        text: "헤더 틀은 고정된 것처럼 보이고 제목만 바뀐다면, 그 헤더는 각 [Screen](screen)이 직접 그려요. `sharedTopBar`로 헤더를 넘기고 모든 화면에 같은 `sharedTopBarId`를 준 다음, 바뀌는 부분만 `Part`로 감싸세요."
      },
      {
        type: "code",
        lang: "ts",
        title: "parts/headerTitle.ts",
        code: HEADER_TITLE_KO,
        highlight: [5, 13]
      },
      { type: "code", lang: "tsx", title: "Inbox.tsx", code: SCREEN_KO, highlight: [7, 16] },
      {
        type: "p",
        text: "Part 트랜지션은 `transitions`, `decorators`와 함께 Router에 등록해요. `RegisterPartTransition`을 확장해 두면 `name`이 자동완성돼요."
      },
      { type: "code", lang: "tsx", code: ROUTER },
      {
        type: "details",
        title: "공유 바가 화면마다 바뀌는 방식",
        blocks: [
          {
            type: "list",
            items: [
              "두 바는 id가 같을 때만 같은 바로 취급해요. id가 없는 바끼리는 위치로 짝을 짓지만, id가 있는 바와 없는 바는 짝이 되지 않아요",
              "바는 화면마다 따로 그려져요. 전환 중에는 짝이 된 바의 Part를 별도의 Part 레이어로 옮겨서, 아래쪽 화면의 바가 위 화면의 불투명한 배경에 가려지지 않게 해요. 전환이 끝나면 원래 자리로 돌아가요",
              "Part는 자신을 감싼 화면을 그리는 Router의 화면 전환을 따라가요. 중첩 Router의 고정 UI 안에 있으면 바깥 Router의 화면 전환을 따라가고, 어떤 화면에도 속하지 않으면 가장 가까운 Router를 따라가요",
              "Part 트랜지션은 Router에 있는 어떤 트랜지션에서든 이름으로 찾아 써요. 타이밍은 트랜지션마다 따로 정해져요",
              "등록되지 않은 `name`을 가진 `Part`는 움직이지 않아요. 개발 모드에서는 한 번 경고하면서 `partTransitions`를 확인하라고 알려 줘요"
            ]
          }
        ]
      },
      { type: "h", text: "Part 슬롯" },
      {
        type: "p",
        text: "`createPartTransition`은 화면 트랜지션과 같은 슬롯 이름을 쓰지만 뜻이 달라요. 각 슬롯은 Part가 들어 있는 화면이 지금 무엇을 하고 있는지를 기준으로 읽으세요."
      },
      {
        type: "table",
        headers: ["슬롯", "Part가 들어 있는 화면", "시작 값"],
        rows: [
          ["`initial`", "push·replace로 들어오는 새 화면의 시작 스타일", "애니메이션 없음"],
          [
            "`idle`",
            "멈춰 있는 화면, 그리고 push·replace로 들어오는 새 화면",
            "새 화면이면 `initial`"
          ],
          ["`enter`", "push·replace 때 뒤로 물러나거나 뒤에 머무는 이전 화면", "`idle`"],
          ["`exit`", "pop으로 다시 돌아오는 이전 화면", "`enter`"],
          [
            "`dismiss`",
            "선택 사항. pop으로 닫히는 맨 위 화면. 생략하면 `idle` 그대로예요",
            "`idle`"
          ]
        ]
      },
      {
        type: "p",
        text: "Part는 `initial`이 아니라 직전 variant 값에서 시작해요. `exit`을 `idle`과 같은 값으로 맞춰야 돌아오는 Part가 끝에서 튀지 않아요."
      },
      {
        type: "note",
        kind: "warn",
        text: "`dismiss`가 없으면 닫히는 화면의 Part는 불투명한 채로 남고 돌아오는 화면의 Part만 나타나서, 짝 중 한쪽만 움직이게 돼요. `headerTitle`처럼 다섯 슬롯을 모두 지정하세요."
      },
      {
        type: "details",
        title: "상태별 슬롯 표",
        blocks: [
          {
            type: "table",
            headers: ["상태", "active", "화면 역할", "화면 슬롯", "Part 슬롯"],
            rows: [
              ["PUSHING", "true", "새 화면, 맨 위로 올라옴", "`enter`", "`idle`"],
              ["PUSHING", "false", "이전 화면, 뒤로 물러남", "`exit`", "`enter`"],
              ["REPLACING", "true", "새 화면", "`enter`", "`idle`"],
              ["REPLACING", "false", "교체되어 사라지는 화면", "`exit`", "`enter`"],
              [
                "POPPING",
                "true",
                "닫히는 화면, 아직 맨 위",
                "`enterBack`",
                "`dismiss`, 없으면 `idle`"
              ],
              ["POPPING", "false", "이전 화면, 아래에서 돌아옴", "`exitBack`", "`exit`"],
              ["COMPLETED", "true", "활성 화면, 전환 끝남", "`enter`", "`idle`"],
              ["COMPLETED", "false", "뒤에 있는 화면, 전환 끝남", "`exit`", "`enter`"]
            ]
          },
          {
            type: "list",
            items: [
              "`active`는 움직이는 방향이 아니라 스택 위치를 따라요. 그래서 pop 중에도 닫히는 화면이 맨 위에 있고 `true`예요",
              "화면 슬롯의 뜻대로 Part 슬롯을 채우면 엉뚱한 화면의 Part가 움직여서, 한쪽 방향으로만 페이드되는 것처럼 보일 수 있어요",
              "POPPING-false는 PUSHING-false가 끝난 자리에서 시작해요. 그래서 `exit`은 `enter` 값에서 출발해요",
              "`dismiss`가 생기기 전에는 pop에서 두 Part를 모두 페이드하려면 `createRawPartTransition`으로 variant 열 개를 전부 다시 적어야 했어요",
              "코드로 push·replace·pop하면 Part는 미리 컴파일된 키프레임으로 화면 전환과 함께 움직여요. 프레임마다 실행되는 코드는 없어요"
            ]
          }
        ]
      },
      { type: "h", text: "타이밍" },
      {
        type: "p",
        text: "Part에는 `duration`을 적지 마세요. variant마다 화면의 같은 variant 타이밍을 그대로 쓰기 때문에, `material`에서는 Part도 push에 0.35초, pop에 0.25초 걸려요."
      },
      {
        type: "table",
        headers: ["", "Part"],
        rows: [
          ["Duration", "직접 적은 값. 없으면 화면의 같은 variant 키 값"],
          [
            "Delay",
            '직접 적은 값. 없으면 화면의 값. `after: "transition"`를 쓰면 화면의 delay와 duration을 더한 만큼 기다려요'
          ],
          [
            "Ease",
            "직접 적은 값만 쓰고 화면에서 가져오지 않아요. 화면과 맞추려면 `cupertino`의 `[0.32, 0.72, 0, 1]`처럼 화면과 같은 easing을 쓰세요"
          ]
        ]
      },
      { type: "h3", text: "화면 전환이 끝난 뒤에 시작하기" },
      {
        type: "p",
        text: '전환이 끝난 뒤에 나타나야 하는 UI는 전환이 얼마나 걸리는지 알 수 없어요. `after: "transition"`는 "화면 전환이 끝난 뒤에 시작"이라는 뜻이라서, 어떤 트랜지션을 쓰든 전환이 끝나는 시점에 variant가 시작돼요.'
      },
      {
        type: "code",
        lang: "ts",
        title: "parts/detailChrome.ts",
        code: AFTER_TRANSITION_KO,
        highlight: [10]
      },
      {
        type: "p",
        text: '`delay`와 함께 쓸 수도 있어요. `{ after: "transition", delay: 0.04 }`는 전환이 끝나고 40ms 뒤에 시작해요. `none`은 전환 시간이 0이라 바로 시작해요.'
      },
      {
        type: "note",
        kind: "warn",
        text: "Part가 화면보다 오래 움직이면 Part가 끝날 때까지 화면 전환도 끝나지 않고, 그동안 스와이프 뒤로 가기가 막혀요."
      },
      {
        type: "details",
        title: "타이밍 상속 규칙",
        blocks: [
          {
            type: "list",
            items: [
              "같은 variant 키끼리 상속해요. Part의 PUSHING-false는 화면의 PUSHING-false와 같은 타이밍으로 움직여요",
              "`duration`을 직접 적으면 그 값이 우선이에요. 바로 바뀌게 하려면 `0`을 적어도 돼요. `||`가 아니라 `??`로 처리해서 직접 적은 `0`도 그대로 적용돼요",
              "어떤 화면에도 속하지 않은 Part는 타이밍을 가져올 화면 전환이 없어서 직접 적은 값만 써요. 이때 duration을 생략하면 0이 되어 Part가 바로 바뀌어요",
              "화면과 맞추겠다고 화면의 duration을 Part에 복사하지 마세요. 같은 숫자를 두 군데 적으면 언젠가 어긋나요",
              "Part는 어떤 트랜지션에서든 이름으로 찾아 쓰기 때문에 easing은 상속하지 않아요. 트랜지션마다 easing을 가져오면 같은 Part가 트랜지션마다 다르게 움직여요",
              "duration이 같아도 Part가 화면과 같은 시점에 같은 위치에 있다는 보장은 없어요. 아래 스와이프 섹션을 보세요"
            ]
          }
        ]
      },
      { type: "h", text: "스와이프" },
      {
        type: "p",
        text: "선언한 pop 애니메이션이 그대로 스와이프에도 쓰여요. 스와이프 훅이 없는 Part는 화면과 같은 POPPING 진행도를 따라 움직이고, 타이밍은 그 Part에 정해진 값을 써요. 드래그하는 동안은 물론 뒤로 가기가 확정되거나 취소될 때도 마찬가지라서, 프레임마다 실행할 코드를 따로 작성할 필요가 없어요."
      },
      {
        type: "p",
        text: "스와이프 중에는 손가락 위치에 맞춰 Part가 움직이고, 코드로 pop하면 easing에 따라 시간이 흐르며 움직여요. 그래서 Part variant에 화면과 같은 easing을 주지 않으면 두 경우의 움직임이 달라져요."
      },
      {
        type: "note",
        kind: "warn",
        text: "`onSwipeStart`, `onSwipe`, `onSwipeEnd`는 스와이프 추적을 켜는 옵션이 아니라 기본 동작을 대체하는 훅이에요. 하나라도 지정하면 그 Part는 양쪽 화면 모두에서 더 이상 스와이프를 자동으로 따라가지 않아요."
      },
      {
        type: "details",
        title: "스와이프 훅 직접 작성하기",
        blocks: [
          {
            type: "p",
            text: "훅을 쓰면 드래그하는 동안의 Part 스타일과, 뒤로 가기가 확정되거나 취소됐을 때 마무리하는 동작을 모두 직접 처리해야 해요. 제스처에 따른 움직임이 선언한 pop과 달라야 할 때만 쓰세요."
          },
          {
            type: "p",
            text: "각 훅은 `(triggered, { animate, element, active })`를 받아요. `onSwipe`는 0부터 100까지의 progress를 함께 받아서 `(triggered, progress, { animate, element, active })` 형태예요."
          },
          {
            type: "code",
            lang: "ts",
            title: "parts/panelTitle.ts",
            code: SWIPE_HOOKS_KO,
            highlight: [12, 23]
          },
          {
            type: "p",
            text: "이 예시는 opacity 변화를 제스처의 처음 55% 안에 끝내고, 위치는 드래그 전체에 걸쳐 움직여요. 기본 스와이프 추적으로는 이렇게 나눌 수 없어요."
          },
          {
            type: "p",
            text: "`if (active) return;` 덕분에 닫히는 화면의 제목은 훅이 맡되 스타일은 건드리지 않아요. 애니메이션은 비활성 화면, 즉 돌아오는 화면의 제목에만 적용되고, 뒤로 가기가 확정되든 취소되든 마지막 값까지 마무리해요."
          },
          {
            type: "p",
            text: "두 속성 모두 선언한 pop을 그대로 따라가도 된다면 `options` 블록을 통째로 지우세요."
          }
        ]
      },
      { type: "h", text: "자주 하는 실수" },
      {
        type: "table",
        headers: ["증상", "해결"],
        rows: [
          ["Part가 전혀 움직이지 않아요", "트랜지션을 `<Router partTransitions>`에 등록하세요"],
          ["pop할 때 짝 중 한쪽만 페이드돼요", "`dismiss`를 추가하세요"],
          [
            "화면은 0.7초 동안 움직이는데 Part는 바로 바뀌어요",
            "어떤 화면에도 속하지 않은 Part예요. `duration`을 지정하세요"
          ],
          [
            "스와이프할 때와 뒤로 버튼을 눌렀을 때 Part의 이동 거리가 달라요",
            "variant에 화면과 같은 easing을 주세요"
          ],
          [
            "화면을 이동한 뒤 한동안 스와이프 뒤로 가기가 안 돼요",
            "화면보다 오래 움직이는 Part의 길이를 줄이세요"
          ]
        ]
      },
      {
        type: "details",
        title: "Morph 안의 Part",
        blocks: [
          {
            type: "list",
            items: [
              "[Morph](morph) 안의 본문이 크기가 바뀌는 동안 줄바꿈이 계속 달라지다가 마지막에 튄다면, 그 본문을 `Part`로 감싸세요. Part는 멈춰 있을 때의 너비로 한 번만 레이아웃하고, Morph가 커지는 동안에는 줄바꿈을 다시 하지 않고 잘라서 보여줘요",
              "컨테이너 Morph에서 이전 문구와 새 문구가 함께 보인다면, 서로 다른 문구를 이전 요소의 페이드 복사본이 보여주고 있는 거예요. 두 화면에 공통인 요소는 중첩 Morph로 두고, 바뀌는 문구는 그 옆의 Part로 처리하세요",
              "이때 Part로 계속 보이는 중첩 Morph를 감싸지 않고, 공유 Morph의 부모도 페이드하지 않아요"
            ]
          }
        ]
      },
      {
        type: "details",
        title: "Raw Part 트랜지션",
        blocks: [
          {
            type: "p",
            text: "`createRawPartTransition`은 `createRawTransition`처럼 상태마다 값을 직접 지정해요. `idle`, `pushOnEnter` / `pushOnExit`, `replaceOnEnter` / `replaceOnExit`, `popOnEnter` / `popOnExit`, `completedOnEnter` / `completedOnExit`를 적어요."
          },
          {
            type: "p",
            text: "raw Part도 화면의 같은 상태 타이밍을 그대로 쓰고 스와이프를 따라가요. `onSwipe*` 콜백을 하나라도 지정하면 이 기본 스와이프 추적을 대체해요. easing은 여기서도 상속하지 않아요."
          }
        ]
      }
    ]
  }
};

export default page;
