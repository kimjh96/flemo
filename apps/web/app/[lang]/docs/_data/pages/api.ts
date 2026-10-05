import type { LocalizedDocPage } from "../docTypes";

const page: LocalizedDocPage = {
  en: {
    slug: "api",
    title: "API reference",
    summary:
      "Every public export of `@flemo/react`, grouped by job, with a one-line description and the page that explains it.",
    blocks: [
      {
        type: "p",
        text: "Import everything from `@flemo/react`. Its only peer dependencies are `react` and `react-dom` 19 (`^19.2.8`); `<Morph>` needs no animation library beside it."
      },
      { type: "h", text: "Components" },
      {
        type: "table",
        headers: ["Name", "What it is", "Page"],
        rows: [
          [
            "`Router`",
            "Manages one screen stack with its transitions, gestures and history",
            "[Router](router)"
          ],
          ["`Route`", "Maps a path pattern to an element", "[Router](router)"],
          [
            "`Slot`",
            "Marks the moving region; everything else in the Router stays mounted",
            "[Slot](slot)"
          ],
          [
            "`Screen`",
            "The per-route container, with bars, shared bars and safe areas",
            "[Screen](screen)"
          ],
          ["`Part`", "Runs a named part transition on one element of a screen", "[Part](part)"],
          [
            "`Morph`",
            "A shared element: one thing on two screens, paired by `layoutId`",
            "[Morph](morph)"
          ],
          [
            "`Layer`",
            "Renders an overlay outside its screen's content so it can cover the shared header and tab bar",
            "[Layer](layer)"
          ]
        ]
      },
      { type: "h", text: "Hooks" },
      {
        type: "table",
        headers: ["Name", "What it is", "Page"],
        rows: [
          [
            "`useNavigate(options?)`",
            "`{ push, replace, pop }` for one Router; `{ router }` picks which",
            "[Navigation](navigation)"
          ],
          [
            '`useParams<"/path/:id">()`',
            "The enclosing screen's params, typed by a registered route",
            "[Navigation](navigation)"
          ],
          [
            "`useStep()`",
            "`{ step, pushStep, replaceStep, popStep }`: history sub-states without a new screen",
            "[Navigation](navigation)"
          ],
          [
            "`useScreen()`",
            "The enclosing screen's id, route and position in the stack, such as whether it is the top screen",
            "[Screen](screen)"
          ],
          [
            "`usePathname()`",
            "The nearest Router's pathname, for a header or tab bar outside a `Screen`. During a pop it reports the destination path from the first frame",
            "[Navigation](navigation)"
          ],
          [
            "`useViewportScrollHeight()`",
            "The visual viewport's scroll height and its change from the app-wide baseline, for keyboard handling",
            "[Screen](screen)"
          ]
        ]
      },
      {
        type: "details",
        title: "useScreen fields",
        blocks: [
          {
            type: "table",
            headers: ["Field", "What it is"],
            rows: [
              ["`id`", "The screen's history entry id"],
              [
                "`isActive`",
                "Whether this is the top screen. It follows the stack, so a screen that is closing during a pop is still active"
              ],
              ["`isRoot`", "Whether this is the root screen of its stack"],
              [
                "`isPrev`",
                "Whether this screen sits deeper than the one directly below the top, so it does not move during a transition"
              ],
              ["`zIndex`", "Stack depth; `0` is the root, higher is newer"],
              ["`pathname` / `params`", "The resolved pathname and route params"],
              ["`routePath`", "The matched route pattern, such as `/album/:id`"],
              ["`transitionName` / `prevTransitionName`", "The resolved transition names"]
            ]
          },
          {
            type: "p",
            text: "Outside a `Screen` the fields hold empty values instead of being missing, so a header or tab bar beside a `Slot` can read them safely."
          }
        ]
      },
      { type: "h", text: "Transition factories" },
      {
        type: "table",
        headers: ["Name", "What it is", "Page"],
        rows: [
          [
            "`createTransition` / `createRawTransition`",
            "Screen transitions, registered with `Router transitions`",
            "[Transitions](transitions)"
          ],
          [
            "`createDecorator` / `createRawDecorator`",
            "A dim or color wash drawn over the screens during a transition, registered with `Router decorators` and selected by a transition's `decoratorName`",
            "[Transitions](transitions)"
          ],
          [
            "`createPartTransition` / `createRawPartTransition`",
            "Part transitions, registered with `Router partTransitions`",
            "[Part](part)"
          ],
          [
            "`createMorphTransition` / `createRawMorphTransition`",
            "Shared-element morphs, registered with `Router morphTransitions`",
            "[Morph](morph)"
          ]
        ]
      },
      { type: "h", text: "Presets" },
      {
        type: "table",
        headers: ["Name", "What it is", "Page"],
        rows: [
          [
            "`cupertino` (default), `material`, `layout`, `none`",
            "Built-in screen transitions, selected by name",
            "[Transitions](transitions)"
          ],
          ["`overlay`", "Built-in decorator", "[Transitions](transitions)"],
          [
            "`shared` (default), `text`, `zoom`",
            "Built-in morphs, selected with `<Morph name>`",
            "[Morph](morph)"
          ]
        ]
      },
      { type: "h", text: "History drivers" },
      {
        type: "table",
        headers: ["Name", "What it is", "Page"],
        rows: [
          [
            '`Router history="browser"`',
            "The default. Reads and writes `window.history`, so the URL and browser back work, even when nested",
            "[Router](router)"
          ],
          [
            '`Router history="memory"`',
            "An isolated in-memory stack that never touches the URL or browser back",
            "[Router](router)"
          ],
          [
            "`Router createDriver`",
            'Overrides the browser backend; receives the Router\'s key and returns a `HistoryDriver`. Ignored with `history="memory"`',
            "[Router](router)"
          ],
          [
            "`createBrowserHistoryDriver(routerKey?)`",
            "The default browser driver, for wrapping in `createDriver` (for example a locale prefix)",
            "[Router](router)"
          ]
        ]
      },
      { type: "h", text: "Types" },
      {
        type: "table",
        headers: ["Name", "What it is", "Page"],
        rows: [
          [
            "`RegisterRoute`",
            "Augment it to type paths for `push` and `useParams`",
            "[Router](router)"
          ],
          ["`RegisterRouter`", "Augment it to type `router` targets", "[Navigation](navigation)"],
          [
            "`RegisterTransition`, `RegisterDecorator`, `RegisterPartTransition`, `RegisterMorphTransition`",
            "Augment them to type your own transition names",
            "[Transitions](transitions)"
          ],
          [
            "`RouterTarget`, `RouterName`, `RouterScopeKeyword`, `UseNavigateOptions`",
            "Values accepted by `useNavigate({ router })`",
            "[Navigation](navigation)"
          ],
          [
            "`TransitionName`, `DecoratorName`, `PartTransitionName`, `MorphTransitionName`",
            "Registered names plus the built-ins",
            "[Transitions](transitions)"
          ],
          [
            "`PartTransitionOptions`, `MorphTransitionOptions`",
            "Options of part and morph transitions",
            "[Morph](morph)"
          ],
          [
            "`SwipeOptions`, `SwipeStop`, `SwipeInfo`",
            "Swipe configuration, styles applied at set points along the drag, and the gesture data passed to callbacks",
            "[Transitions](transitions)"
          ],
          [
            "`SlotProps`, `ScreenProps`, `PartProps`, `LayerProps`, `MorphProps`",
            "Component props",
            "[API reference](api)"
          ],
          ["`HistoryDriver`, `HistoryNavEvent`", "The history backend contract", "[Router](router)"]
        ]
      },
      {
        type: "details",
        title: "Low-level exports",
        blocks: [
          {
            type: "p",
            text: "Apps rarely need these. They exist for custom hosts, tooling, and transitions that decide for themselves what happens when a swipe is released."
          },
          {
            type: "table",
            headers: ["Name", "What it is"],
            rows: [
              [
                "`ScreenMotion`",
                "The moving container `Screen` renders. Use it only when replacing the freeze policy"
              ],
              [
                "`ScreenFreeze`",
                "Suspends a covered screen with React's `Activity`, keeping state and scroll"
              ],
              [
                "`ScreenDecorator`",
                "The box over a screen that a transition's decorator renders into"
              ],
              ["`ScreenContext`, `ScreenContextProps`", "The context `useScreen` reads"],
              [
                "`RouterScopeProvider`",
                "Hosts a Router's stores above it, so siblings outside the Router can read and drive them. Browser history only"
              ],
              [
                "`useStores`, `useHistoryStore`, `useNavigateStore`, `useScreenStore`",
                "Imperative and selector access to a Router's stores"
              ],
              [
                "`FlemoStores`, `RouterScopeNode`, `SharedBarId`, `SharedBarMetadata`, `SharedBarPresence`, `SharedBarsMetadata`",
                "Store and shared-bar types"
              ],
              [
                "`partTransitionMap`, `morphTransitionMap`",
                "The registries of part and morph transitions"
              ],
              [
                "`DEFAULT_COMMIT_FRACTION`, `DEFAULT_COMMIT_VELOCITY`",
                "The default distance fraction and velocity that decide whether a released swipe goes back, used when a transition sets neither. For an `onEnd` that keeps the default rule"
              ]
            ]
          },
          {
            type: "p",
            text: "`@flemo/core` is the framework-agnostic engine behind `@flemo/react`. It also exports the preset objects (`cupertino`, `material`, `layout`, `none`, `overlay`, `shared`, `textMorph`, `zoomMorph`), `createMemoryHistoryDriver` and the engine APIs a framework binding uses."
          }
        ]
      }
    ]
  },
  ko: {
    slug: "api",
    title: "API reference",
    summary:
      "`@flemo/react`가 공개하는 모든 export를 용도별로 묶었어요. 항목마다 한 줄 설명과 자세히 다루는 문서 링크가 있어요.",
    blocks: [
      {
        type: "p",
        text: "모든 API는 `@flemo/react`에서 가져와요. peer dependency는 `react`와 `react-dom` 19(`^19.2.8`)뿐이고, `<Morph>`를 쓸 때도 애니메이션 라이브러리를 따로 설치하지 않아도 돼요."
      },
      { type: "h", text: "컴포넌트" },
      {
        type: "table",
        headers: ["이름", "설명", "문서"],
        rows: [
          [
            "`Router`",
            "화면 스택 하나를 관리해요. 화면 전환, 제스처, 히스토리도 여기서 처리해요",
            "[Router](router)"
          ],
          ["`Route`", "경로 패턴과 렌더링할 엘리먼트를 연결해요", "[Router](router)"],
          [
            "`Slot`",
            "화면이 바뀌는 영역을 지정해요. Router 안의 나머지 요소는 마운트된 채로 남아요",
            "[Slot](slot)"
          ],
          [
            "`Screen`",
            "라우트마다 쓰는 화면 컨테이너예요. 상단·하단 바, 공유 바, 세이프 에어리어를 다뤄요",
            "[Screen](screen)"
          ],
          [
            "`Part`",
            "화면 안의 요소 하나에 이름으로 지정한 Part 트랜지션을 적용해요",
            "[Part](part)"
          ],
          [
            "`Morph`",
            "공유 요소예요. 두 화면에 있는 같은 요소를 `layoutId`로 짝지어요",
            "[Morph](morph)"
          ],
          [
            "`Layer`",
            "오버레이를 화면 콘텐츠 바깥에 그려서 공유 헤더와 탭 바까지 덮을 수 있게 해요",
            "[Layer](layer)"
          ]
        ]
      },
      { type: "h", text: "훅" },
      {
        type: "table",
        headers: ["이름", "설명", "문서"],
        rows: [
          [
            "`useNavigate(options?)`",
            "Router 하나의 `{ push, replace, pop }`을 돌려줘요. 어느 Router를 움직일지는 `{ router }`로 골라요",
            "[Navigation](navigation)"
          ],
          [
            '`useParams<"/path/:id">()`',
            "현재 화면의 파라미터를 등록한 라우트의 타입으로 돌려줘요",
            "[Navigation](navigation)"
          ],
          [
            "`useStep()`",
            "`{ step, pushStep, replaceStep, popStep }`을 돌려줘요. 새 화면을 열지 않고 히스토리에 단계를 쌓을 때 써요",
            "[Navigation](navigation)"
          ],
          [
            "`useScreen()`",
            "현재 화면의 id, 라우트, 스택 안의 위치를 알려줘요. 맨 위 화면인지도 여기서 확인해요",
            "[Screen](screen)"
          ],
          [
            "`usePathname()`",
            "가장 가까운 Router의 pathname이에요. `Screen` 바깥의 헤더나 탭 바에서 써요. pop할 때는 첫 프레임부터 돌아갈 경로를 알려줘요",
            "[Navigation](navigation)"
          ],
          [
            "`useViewportScrollHeight()`",
            "visual viewport의 스크롤 높이와, 앱 전체 기준값에서 달라진 만큼을 알려줘요. 키보드가 올라올 때 레이아웃을 맞추는 데 써요",
            "[Screen](screen)"
          ]
        ]
      },
      {
        type: "details",
        title: "useScreen 필드",
        blocks: [
          {
            type: "table",
            headers: ["필드", "설명"],
            rows: [
              ["`id`", "화면의 히스토리 항목 id"],
              [
                "`isActive`",
                "맨 위 화면인지 여부예요. 스택 기준이라 pop으로 닫히고 있는 화면도 아직 `true`예요"
              ],
              ["`isRoot`", "스택의 첫 화면인지 여부"],
              [
                "`isPrev`",
                "맨 위 화면 바로 아래보다 더 깊이 있는 화면인지 여부예요. 이런 화면은 화면 전환 중에도 움직이지 않아요"
              ],
              ["`zIndex`", "스택 깊이예요. 첫 화면이 `0`이고, 나중에 열린 화면일수록 커요"],
              ["`pathname` / `params`", "실제 pathname과 라우트 파라미터"],
              ["`routePath`", "매칭된 라우트 패턴. 예: `/album/:id`"],
              ["`transitionName` / `prevTransitionName`", "실제로 적용된 트랜지션 이름"]
            ]
          },
          {
            type: "p",
            text: "`Screen` 바깥에서도 필드가 빠지지 않고 빈 값으로 들어 있어요. 그래서 `Slot` 옆에 둔 헤더나 탭 바에서 읽어도 안전해요."
          }
        ]
      },
      { type: "h", text: "트랜지션 팩토리" },
      {
        type: "table",
        headers: ["이름", "설명", "문서"],
        rows: [
          [
            "`createTransition` / `createRawTransition`",
            "화면 전환을 만들어요. `Router transitions`에 등록해요",
            "[Transitions](transitions)"
          ],
          [
            "`createDecorator` / `createRawDecorator`",
            "화면 전환 중에 화면 위로 어둡게 깔리거나 색이 덮이는 효과를 만들어요. `Router decorators`에 등록하고, 트랜지션의 `decoratorName`으로 지정해요",
            "[Transitions](transitions)"
          ],
          [
            "`createPartTransition` / `createRawPartTransition`",
            "Part 트랜지션을 만들어요. `Router partTransitions`에 등록해요",
            "[Part](part)"
          ],
          [
            "`createMorphTransition` / `createRawMorphTransition`",
            "Morph 트랜지션을 만들어요. `Router morphTransitions`에 등록해요",
            "[Morph](morph)"
          ]
        ]
      },
      { type: "h", text: "프리셋" },
      {
        type: "table",
        headers: ["이름", "설명", "문서"],
        rows: [
          [
            "`cupertino` (기본값), `material`, `layout`, `none`",
            "기본으로 들어 있는 화면 전환이에요. 이름으로 골라요",
            "[Transitions](transitions)"
          ],
          ["`overlay`", "기본으로 들어 있는 데코레이터", "[Transitions](transitions)"],
          [
            "`shared` (기본값), `text`, `zoom`",
            "기본으로 들어 있는 Morph 트랜지션이에요. `<Morph name>`으로 골라요",
            "[Morph](morph)"
          ]
        ]
      },
      { type: "h", text: "히스토리 드라이버" },
      {
        type: "table",
        headers: ["이름", "설명", "문서"],
        rows: [
          [
            '`Router history="browser"`',
            "기본값이에요. `window.history`를 읽고 쓰기 때문에 중첩된 Router에서도 URL과 브라우저 뒤로 가기가 동작해요",
            "[Router](router)"
          ],
          [
            '`Router history="memory"`',
            "메모리에만 있는 독립된 스택이에요. URL도, 브라우저 뒤로 가기도 건드리지 않아요",
            "[Router](router)"
          ],
          [
            "`Router createDriver`",
            '브라우저 히스토리 구현을 바꿔요. Router의 키를 받아 `HistoryDriver`를 반환하고, `history="memory"`일 때는 무시돼요',
            "[Router](router)"
          ],
          [
            "`createBrowserHistoryDriver(routerKey?)`",
            "기본 브라우저 드라이버예요. 로캘 접두사처럼 `createDriver`에서 감싸 확장할 때 써요",
            "[Router](router)"
          ]
        ]
      },
      { type: "h", text: "타입" },
      {
        type: "table",
        headers: ["이름", "설명", "문서"],
        rows: [
          [
            "`RegisterRoute`",
            "확장하면 `push`와 `useParams`의 경로에 타입이 붙어요",
            "[Router](router)"
          ],
          [
            "`RegisterRouter`",
            "확장하면 `router`로 지정하는 대상에 타입이 붙어요",
            "[Navigation](navigation)"
          ],
          [
            "`RegisterTransition`, `RegisterDecorator`, `RegisterPartTransition`, `RegisterMorphTransition`",
            "확장하면 직접 만든 트랜지션 이름에 타입이 붙어요",
            "[Transitions](transitions)"
          ],
          [
            "`RouterTarget`, `RouterName`, `RouterScopeKeyword`, `UseNavigateOptions`",
            "`useNavigate({ router })`에 넘길 수 있는 값",
            "[Navigation](navigation)"
          ],
          [
            "`TransitionName`, `DecoratorName`, `PartTransitionName`, `MorphTransitionName`",
            "등록한 이름과 기본 제공 이름",
            "[Transitions](transitions)"
          ],
          [
            "`PartTransitionOptions`, `MorphTransitionOptions`",
            "Part 트랜지션과 Morph 트랜지션의 옵션",
            "[Morph](morph)"
          ],
          [
            "`SwipeOptions`, `SwipeStop`, `SwipeInfo`",
            "스와이프 설정, 드래그 중 지정한 지점마다 적용할 스타일, 콜백으로 전달되는 제스처 정보",
            "[Transitions](transitions)"
          ],
          [
            "`SlotProps`, `ScreenProps`, `PartProps`, `LayerProps`, `MorphProps`",
            "컴포넌트 props",
            "[API reference](api)"
          ],
          [
            "`HistoryDriver`, `HistoryNavEvent`",
            "히스토리 구현이 따라야 하는 인터페이스",
            "[Router](router)"
          ]
        ]
      },
      {
        type: "details",
        title: "저수준 export",
        blocks: [
          {
            type: "p",
            text: "앱 코드에서는 쓸 일이 거의 없어요. 직접 만드는 호스트나 개발 도구, 스와이프를 놓았을 때의 동작을 직접 정하는 트랜지션에서 써요."
          },
          {
            type: "table",
            headers: ["이름", "설명"],
            rows: [
              [
                "`ScreenMotion`",
                "`Screen`이 렌더링하는, 실제로 움직이는 컨테이너예요. freeze 정책을 바꿀 때만 직접 쓰세요"
              ],
              [
                "`ScreenFreeze`",
                "가려진 화면을 React `Activity`로 멈춰 두고, 상태와 스크롤 위치는 그대로 유지해요"
              ],
              ["`ScreenDecorator`", "트랜지션의 데코레이터가 화면 위에 그려지는 박스"],
              ["`ScreenContext`, `ScreenContextProps`", "`useScreen`이 읽는 컨텍스트"],
              [
                "`RouterScopeProvider`",
                "Router의 스토어를 Router보다 위에 두어서, Router 바깥의 형제 컴포넌트도 상태를 읽고 이동시킬 수 있게 해요. 브라우저 히스토리에서만 쓸 수 있어요"
              ],
              [
                "`useStores`, `useHistoryStore`, `useNavigateStore`, `useScreenStore`",
                "Router 스토어에 직접 접근하거나 selector로 구독해요"
              ],
              [
                "`FlemoStores`, `RouterScopeNode`, `SharedBarId`, `SharedBarMetadata`, `SharedBarPresence`, `SharedBarsMetadata`",
                "스토어와 공유 바 관련 타입"
              ],
              [
                "`partTransitionMap`, `morphTransitionMap`",
                "등록된 Part 트랜지션과 Morph 트랜지션 목록"
              ],
              [
                "`DEFAULT_COMMIT_FRACTION`, `DEFAULT_COMMIT_VELOCITY`",
                "스와이프를 놓았을 때 뒤로 가기를 확정할지 정하는 기본 거리 비율과 속도예요. 트랜지션에서 둘 다 지정하지 않으면 이 값을 써요. `onEnd`를 직접 구현하면서 기본 규칙을 그대로 쓰고 싶을 때 참고하세요"
              ]
            ]
          },
          {
            type: "p",
            text: "`@flemo/core`는 `@flemo/react` 아래에서 동작하는, 프레임워크에 묶이지 않은 엔진이에요. 프리셋 객체(`cupertino`, `material`, `layout`, `none`, `overlay`, `shared`, `textMorph`, `zoomMorph`)와 `createMemoryHistoryDriver`, 프레임워크 바인딩이 쓰는 엔진 API도 export해요."
          }
        ]
      }
    ]
  }
};

export default page;
