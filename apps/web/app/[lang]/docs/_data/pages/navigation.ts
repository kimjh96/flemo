import type { LocalizedDocPage } from "../docTypes";

const navigateCode = (c: [string, string, string]) => `const navigate = useNavigate();

navigate.push("/posts/:slug", { slug: "hello" });
navigate.replace("/login");
navigate.pop(); // ${c[0]}
navigate.pop({ skip: 2 }); // ${c[1]}
navigate.pop({ until: "/posts/:slug" }); // ${c[2]}`;

const awaitCode = (comment: string) => `await navigate.push("/posts/:slug", { slug: "hello" });
// ${comment}`;

const routerTargetCode = (c: [string, string, string]) => `// ${c[0]}
const navigate = useNavigate();

// ${c[1]}
navigate.push("/region/people");

// ${c[2]}
navigate.push("/members/:id", { id }, { router: "app" });`;

const hookTargetCode = `const regionNavigate = useNavigate();
const appNavigate = useNavigate({ router: "app" });
const parentNavigate = useNavigate({ router: "parent" });

appNavigate.push("/members/:id", { id });
regionNavigate.replace("/region/people", undefined, { transitionName: "tabForward" });
parentNavigate.pop({ transitionName: "cupertino" });`;

const paramsCode = `function Post() {
  const { slug } = useParams<"/posts/:slug">();
  return <h1>{slug}</h1>;
}`;

const pathnameCode = `function Header() {
  const pathname = usePathname();
  return <nav data-active={pathname}>...</nav>;
}`;

const stepCode = `function Onboarding() {
  const { step = "name" } = useParams<"/onboarding">();
  const stepper = useStep<"/onboarding">();

  if (step === "name") {
    return <button onClick={() => stepper.pushStep({ step: "email" })}>Next</button>;
  }
  return <button onClick={() => stepper.popStep()}>Back</button>;
}`;

const chromeStepCode = `function MenuButton() {
  const { step, pushStep, popStep } = useStep<{ menu: boolean }>();
  const open = step?.menu === true;

  return <button onClick={() => (open ? popStep() : pushStep({ menu: true }))}>Menu</button>;
}`;

const page: LocalizedDocPage = {
  en: {
    slug: "navigation",
    title: "Navigation",
    summary:
      "`useNavigate` pushes, replaces, and pops screens; `useParams`, `usePathname`, and `useStep` read where you are and move within one screen.",
    blocks: [
      {
        type: "demo",
        demo: "cupertino",
        caption:
          "Push the detail screen, then go back with the Back button or a drag from the left edge."
      },
      { type: "h", text: "useNavigate" },
      {
        type: "code",
        lang: "ts",
        code: navigateCode([
          "back one screen",
          "back two screens, one transition",
          "back to the nearest match"
        ])
      },
      {
        type: "p",
        text: "All three return a promise, so you can `await` a move."
      },
      {
        type: "code",
        lang: "ts",
        code: awaitCode("The post screen is now on top.")
      },
      {
        type: "table",
        headers: ["Option", "What it does"],
        rows: [
          ["`transitionName`", "Overrides the default transition (on `pop`, the back animation)"],
          ["`skip` / `until`", "Reach a screen below the top in one transition"],
          ["`router`", "Run on a different Router"]
        ]
      },
      {
        type: "note",
        kind: "tip",
        text: "A call made while a transition is running is ignored, not queued, so only the first tap counts."
      },
      { type: "h", text: "Reaching past the top screen" },
      {
        type: "p",
        text: "`skip` counts screens and `until` takes a route pattern. Either way one transition plays, and the screens in between never appear."
      },
      {
        type: "table",
        headers: ["Method", "At the screen it reaches", "Default `skip`"],
        rows: [
          ["`pop`", "Goes back to it", "`1`"],
          ["`replace`", "Replaces it and everything above", "`0`"],
          ["`push`", "Keeps it and stacks on top", "`0`"]
        ]
      },
      { type: "h", text: "Choosing which Router moves" },
      {
        type: "p",
        text: "`useNavigate` moves the nearest Router that encloses the component. To open a screen over the whole app from inside a nested Router, pass `router`. The move then runs on that Router's history, transition and swipe gestures."
      },
      {
        type: "code",
        lang: "tsx",
        code: routerTargetCode([
          'Inside the nested "region" Router.',
          "Stays in the region Slot.",
          "Takes over the whole screen, on the app Router."
        ]),
        highlight: [8]
      },
      {
        type: "table",
        headers: ["`router`", "Which Router it picks"],
        rows: [
          ["omitted / `current`", "The nearest Router that encloses the call (default)"],
          ["`parent`", "The Router that encloses the current one"],
          ["`root`", "The outermost Router"],
          ['`"app"` (a name)', 'The enclosing Router with `name="app"`'],
          [
            "`nearest-owner`",
            "The first Router, starting from the current one and moving outward, that declares the path you navigate to"
          ]
        ]
      },
      {
        type: "p",
        text: "Every target is looked up from where the hook is called, moving outward through the Routers that enclose it. A Router beside yours, in another branch, is never reached, even by name."
      },
      {
        type: "p",
        text: "Set a default on the hook. A `router` passed to a single call overrides it."
      },
      { type: "code", lang: "ts", code: hookTargetCode, highlight: [2, 3] },
      {
        type: "note",
        kind: "warn",
        text: "A path can type-check even if the target Router does not declare it, and that Router's area then transitions to an empty screen. Development mode reports it."
      },
      { type: "h", text: "Reading the current route" },
      {
        type: "p",
        text: "`useParams` returns the screen's params, path and query merged, typed by `RegisterRoute`."
      },
      { type: "code", lang: "tsx", code: paramsCode },
      {
        type: "p",
        text: "UI outside any `Screen`, like a header beside a `Slot`, reads the nearest Router's current path with `usePathname`."
      },
      { type: "code", lang: "tsx", code: pathnameCode },
      { type: "h", text: "Steps within one screen" },
      {
        type: "p",
        text: "`useStep` changes params without leaving the screen, like a sign-up form going name, email, password. Each step is a history entry, so Back returns to the previous step."
      },
      { type: "code", lang: "tsx", code: stepCode, highlight: [3, 6] },
      {
        type: "table",
        headers: ["Returns", "What it does"],
        rows: [
          ["`pushStep(params)`", "New history entry, same route"],
          ["`replaceStep(params)`", "Replace the current entry"],
          ["`popStep()`", "Back one step"],
          ["`step`", "Current params, for UI outside a `Screen`"]
        ]
      },
      {
        type: "details",
        title: "Edge cases",
        blocks: [
          { type: "h3", text: "Promises and timing" },
          {
            type: "list",
            items: [
              "The promise settles when the navigation task completes, so after `await` the move has finished. Jumping several screens still plays one transition, not one per screen.",
              "A call ignored because the Router is mid-transition resolves at once without navigating. Rapid taps never play the move twice."
            ]
          },
          { type: "h3", text: "skip and until" },
          {
            type: "list",
            items: [
              "`skip` and `until` are mutually exclusive. If you pass both, `until` wins.",
              "`until` reaches the nearest screen matching that declared route.",
              "An unmatched `until` does nothing for `pop` and `replace`, and is a plain push for `push`."
            ]
          },
          { type: "h3", text: "Router targets" },
          {
            type: "list",
            items: [
              "Targets are always resolved from where the hook was called, and only walk the current Router and the Routers around it, never a sibling.",
              'A bare string is read as a keyword first and as a Router name second. If a Router is named after a keyword, use the object forms: `{ router: { name: "parent" } }` picks the Router named `parent`, `{ router: { scope: "parent" } }` the enclosing one.',
              "`nearest-owner` needs a path. A `pop` has none, so it falls back to `current` with a development warning. To pop a different Router, target it by name.",
              "`nearest-owner` matches the actual pathname, so a Router declaring `/files/*splat` handles `/files/a`."
            ]
          },
          { type: "h3", text: "When the route is not there" },
          {
            type: "p",
            text: "`RegisterRoute` is one global registry, so a path can type-check while the target Router does not declare it. The entry then has no `Route` to mount, which is the broken half-transition you see when a nested Router is asked to open a full-screen route."
          },
          {
            type: "list",
            items: [
              "You named a Router that does not declare the path: development error.",
              "You named a Router that does not enclose the call, or `parent` at the outermost Router: development error.",
              "You used `nearest-owner` and no enclosing Router declares the path: development error.",
              "You left the target implicit and the nearest Router does not declare the path: development warning, behavior unchanged.",
              'Pass `strictRoutes` to that `Router` to make the last case an error too, or use `router: "nearest-owner"` to let flemo pick the Router that declares the path.'
            ]
          },
          {
            type: "p",
            text: "All of these are development-only. Production never throws over a navigation: a target that cannot be found does nothing, and a missing route behaves as described above."
          },
          { type: "h3", text: "Params and steps" },
          {
            type: "list",
            items: [
              "Params come from the navigation that mounted the screen. Params the path does not use travel in the query string.",
              "A `useStep` push updates `useParams` in place without stacking a new screen.",
              '`useStep<"/route">()` reuses a registered route\'s params. Outside a `Screen`, pass the param type directly, like `useStep<{ menu: boolean }>()`.',
              "Called outside a `Screen`, there is no route. The step keeps the current pathname, appends its params as a query, and reports them through `step` after mount. Inside a `Screen`, `step` stays `null`, so read `useParams` instead.",
              "A step lets browser Back close a sheet or a menu instead of leaving the page.",
              "`usePathname` reports the navigation's destination, so during a pop it already returns the path being returned to."
            ]
          },
          { type: "code", lang: "tsx", code: chromeStepCode }
        ]
      }
    ]
  },
  ko: {
    slug: "navigation",
    title: "Navigation",
    summary:
      "`useNavigate`로 화면을 push, replace, pop하고, `useParams`, `usePathname`, `useStep`으로 지금 위치를 읽거나 한 화면 안에서 단계를 옮겨요.",
    blocks: [
      {
        type: "demo",
        demo: "cupertino",
        caption:
          "상세 화면으로 push한 뒤, Back 버튼을 누르거나 왼쪽 가장자리에서 드래그해서 돌아와 보세요."
      },
      { type: "h", text: "useNavigate" },
      {
        type: "code",
        lang: "ts",
        code: navigateCode([
          "한 화면 뒤로",
          "두 화면 뒤로, 화면 전환은 한 번만",
          "일치하는 가장 가까운 화면까지 뒤로"
        ])
      },
      {
        type: "p",
        text: "세 메서드 모두 promise를 반환해서 `await`로 이동이 끝나기를 기다릴 수 있어요."
      },
      {
        type: "code",
        lang: "ts",
        code: awaitCode("여기서는 post 화면이 이미 맨 위에 있어요.")
      },
      {
        type: "table",
        headers: ["옵션", "하는 일"],
        rows: [
          [
            "`transitionName`",
            "기본 화면 전환 대신 쓸 전환을 지정해요 (`pop`에서는 뒤로 가는 애니메이션)"
          ],
          ["`skip` / `until`", "맨 위보다 아래에 있는 화면까지 전환 한 번으로 이동해요"],
          ["`router`", "다른 Router에서 이동을 실행해요"]
        ]
      },
      {
        type: "note",
        kind: "tip",
        text: "화면 전환 중에 들어온 호출은 대기열에 쌓이지 않고 무시돼요. 그래서 버튼을 여러 번 눌러도 처음 누른 것만 반영돼요."
      },
      { type: "h", text: "여러 화면 건너뛰기" },
      {
        type: "p",
        text: "`skip`에는 건너뛸 화면 수를, `until`에는 라우트 패턴을 넘겨요. 어느 쪽이든 화면 전환은 한 번만 일어나고, 중간에 있는 화면은 보이지 않아요."
      },
      {
        type: "table",
        headers: ["메서드", "찾은 화면에서 하는 일", "`skip` 기본값"],
        rows: [
          ["`pop`", "그 화면으로 돌아가요", "`1`"],
          ["`replace`", "그 화면과 그 위의 화면을 모두 교체해요", "`0`"],
          ["`push`", "그 화면은 남기고 위에 새 화면을 쌓아요", "`0`"]
        ]
      },
      { type: "h", text: "이동할 Router 고르기" },
      {
        type: "p",
        text: "`useNavigate`는 컴포넌트를 감싸는 가장 가까운 Router를 움직여요. 중첩 Router 안에서 앱 전체를 덮는 화면을 열려면 `router`를 넘기세요. 그러면 그 Router의 히스토리와 화면 전환, 스와이프 제스처로 이동해요."
      },
      {
        type: "code",
        lang: "tsx",
        code: routerTargetCode([
          '중첩된 "region" Router 안에서 호출해요.',
          "region의 Slot 안에서만 바뀌어요.",
          "app Router에서 전체 화면으로 열어요."
        ]),
        highlight: [8]
      },
      {
        type: "table",
        headers: ["`router`", "고르는 Router"],
        rows: [
          ["생략 / `current`", "호출한 곳을 감싸는 가장 가까운 Router (기본값)"],
          ["`parent`", "현재 Router를 감싸는 한 단계 바깥 Router"],
          ["`root`", "가장 바깥에 있는 Router"],
          ['`"app"` (이름)', '호출한 곳을 감싸는 Router 중 `name="app"`인 Router'],
          ["`nearest-owner`", "현재 Router부터 바깥으로 올라가면서, 이동할 경로를 선언한 첫 Router"]
        ]
      },
      {
        type: "p",
        text: "어떤 대상이든 훅을 호출한 위치에서 시작해 바깥쪽 Router로 올라가며 찾아요. 다른 가지에 나란히 있는 Router는 이름을 지정해도 찾지 못해요."
      },
      {
        type: "p",
        text: "훅에 기본 대상을 정해 둘 수 있고, 호출할 때 넘긴 `router`가 그보다 우선해요."
      },
      { type: "code", lang: "ts", code: hookTargetCode, highlight: [2, 3] },
      {
        type: "note",
        kind: "warn",
        text: "대상 Router가 선언하지 않은 경로도 타입 검사는 통과할 수 있어요. 그러면 그 Router의 영역이 빈 화면으로 전환되는데, 개발 환경에서는 이 경우를 알려 줘요."
      },
      { type: "h", text: "현재 라우트 읽기" },
      {
        type: "p",
        text: "`useParams`는 경로 파라미터와 쿼리를 합친 화면 파라미터를 반환하고, 타입은 `RegisterRoute`를 따라요."
      },
      { type: "code", lang: "tsx", code: paramsCode },
      {
        type: "p",
        text: "`Slot` 옆에 둔 헤더처럼 어떤 `Screen`에도 속하지 않은 UI에서는 `usePathname`으로 가장 가까운 Router의 현재 경로를 읽어요."
      },
      { type: "code", lang: "tsx", code: pathnameCode },
      { type: "h", text: "한 화면 안의 단계" },
      {
        type: "p",
        text: "`useStep`은 화면을 그대로 두고 파라미터만 바꿔요. 이름, 이메일, 비밀번호를 차례로 입력하는 가입 폼이 좋은 예예요. 단계마다 히스토리 항목이 생겨서 뒤로 가기를 누르면 이전 단계로 돌아가요."
      },
      { type: "code", lang: "tsx", code: stepCode, highlight: [3, 6] },
      {
        type: "table",
        headers: ["반환값", "하는 일"],
        rows: [
          ["`pushStep(params)`", "같은 라우트에 히스토리 항목을 새로 추가해요"],
          ["`replaceStep(params)`", "현재 히스토리 항목을 교체해요"],
          ["`popStep()`", "한 단계 뒤로 가요"],
          ["`step`", "현재 파라미터예요. `Screen` 바깥 UI에서 읽어요"]
        ]
      },
      {
        type: "details",
        title: "예외 상황",
        blocks: [
          { type: "h3", text: "Promise와 타이밍" },
          {
            type: "list",
            items: [
              "promise는 이동 작업이 끝나야 resolve돼요. 그래서 `await` 다음 줄에서는 이동이 이미 끝나 있어요. 여러 화면을 한 번에 건너뛰어도 화면 전환은 화면마다가 아니라 한 번만 재생돼요.",
              "Router가 전환 중이라 무시된 호출은 이동하지 않고 바로 resolve돼요. 빠르게 연타해도 같은 이동이 반복 재생되지 않아요."
            ]
          },
          { type: "h3", text: "skip과 until" },
          {
            type: "list",
            items: [
              "`skip`과 `until`은 둘 중 하나만 써요. 둘 다 넘기면 `until`이 적용돼요.",
              "`until`은 선언된 그 라우트와 일치하는 화면 중 맨 위에서 가장 가까운 화면을 찾아요.",
              "일치하는 화면이 없으면 `pop`과 `replace`는 아무것도 하지 않고, `push`는 일반 push처럼 동작해요."
            ]
          },
          { type: "h3", text: "Router 대상" },
          {
            type: "list",
            items: [
              "대상은 항상 훅을 호출한 위치를 기준으로 찾아요. 현재 Router와 그 바깥 Router만 거슬러 올라가고, 옆 가지의 Router는 찾지 않아요.",
              '문자열은 먼저 키워드로 해석하고, 키워드가 아니면 Router 이름으로 해석해요. Router 이름이 키워드와 같다면 객체 형태로 구분하세요. `{ router: { name: "parent" } }`는 이름이 `parent`인 Router를, `{ router: { scope: "parent" } }`는 한 단계 바깥 Router를 골라요.',
              "`nearest-owner`는 경로가 있어야 동작해요. `pop`에는 경로가 없어서 개발 환경 경고와 함께 `current`로 처리되니, 다른 Router에서 pop하려면 이름으로 지정하세요.",
              "`nearest-owner`는 패턴 문자열이 아니라 실제 pathname으로 비교해요. 그래서 `/files/*splat`을 선언한 Router가 `/files/a`로 가는 이동을 처리해요."
            ]
          },
          { type: "h3", text: "라우트가 없을 때" },
          {
            type: "p",
            text: "`RegisterRoute`는 앱 전체가 함께 쓰는 레지스트리 하나라서, 대상 Router가 선언하지 않은 경로도 타입 검사를 통과해요. 그러면 새 히스토리 항목에 마운트할 `Route`가 없어서 화면 전환이 반쯤 깨진 채로 보여요. 중첩 Router에서 전체 화면용 라우트를 열려고 할 때 자주 생기는 문제예요."
          },
          {
            type: "list",
            items: [
              "그 경로를 선언하지 않은 Router를 이름으로 지정하면 개발 환경에서 에러가 나요.",
              "호출한 곳을 감싸지 않는 Router를 지정하거나, 가장 바깥 Router에서 `parent`를 지정하면 개발 환경에서 에러가 나요.",
              "`nearest-owner`를 썼는데 감싸는 Router 중 어디에도 그 경로가 없으면 개발 환경에서 에러가 나요.",
              "대상을 지정하지 않았는데 가장 가까운 Router에 그 경로가 없으면 개발 환경에서 경고만 하고, 동작은 바꾸지 않아요.",
              '마지막 경우도 에러로 받으려면 그 `Router`에 `strictRoutes`를 넘기세요. 또는 `router: "nearest-owner"`를 쓰면 그 경로를 선언한 Router를 flemo가 찾아서 이동해요.'
            ]
          },
          {
            type: "p",
            text: "이 에러와 경고는 모두 개발 환경에서만 나와요. 프로덕션에서는 이동 때문에 예외가 발생하지 않아요. 대상을 찾지 못하면 아무것도 하지 않고, 라우트가 없을 때는 위에서 설명한 대로 동작해요."
          },
          { type: "h3", text: "파라미터와 단계" },
          {
            type: "list",
            items: [
              "파라미터는 그 화면을 마운트한 이동에서 받은 값이에요. 경로 패턴에 쓰이지 않은 파라미터는 쿼리 문자열로 전달돼요.",
              "`useStep`으로 push하면 새 화면을 쌓지 않고 현재 화면의 `useParams` 값만 바뀌어요.",
              '`useStep<"/route">()`는 등록한 라우트의 파라미터 타입을 그대로 써요. `Screen` 바깥에서는 `useStep<{ menu: boolean }>()`처럼 파라미터 타입을 직접 넘기세요.',
              "`Screen` 바깥에서 호출하면 기준이 되는 라우트가 없어요. 이때는 현재 pathname을 그대로 두고 파라미터를 쿼리로 붙이며, 마운트된 뒤 `step`으로 값을 알려 줘요. `Screen` 안에서는 `step`이 항상 `null`이니 `useParams`로 읽으세요.",
              "시트나 메뉴를 단계로 열면 브라우저 뒤로 가기가 페이지를 떠나지 않고 시트나 메뉴를 닫아요.",
              "`usePathname`은 이동의 목적지 경로를 반환해요. 그래서 pop하는 중에는 이미 돌아갈 화면의 경로를 반환해요."
            ]
          },
          { type: "code", lang: "tsx", code: chromeStepCode }
        ]
      }
    ]
  }
};

export default page;
