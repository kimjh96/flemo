# 핸드오프: flemo CSS 전환 마이그레이션 + 패키지 분리

> 이 문서는 다음 에이전트가 컨텍스트 없이 이어서 작업할 수 있도록 작성됨. 결정 사항, 동기, 현재 상태, 단계별 plan을 모두 담는다. 추측 금지 — 적힌 대로만 진행할 것.

## 왜 이 작업을 하는가 (Motivation)

현재 flemo는 화면 전환을 [Motion](https://motion.dev)의 `useAnimate` + `animate()`로 구현한다 (`packages/flemo/src/screen/ScreenMotion.tsx`의 status `useEffect`). Motion은 메인 스레드 rAF 루프(`frame.update`)에서 transform/opacity를 매 프레임 직접 inline style에 쓴다.

**문제**: 진입 화면이 마운트 직후 무거운 React 작업(예: TanStack Query suspend, 큰 컴포넌트 트리 hydration)을 하면 같은 메인 스레드의 rAF 큐에서 React 렌더와 Motion의 frame.update가 경합해 첫 200–400 ms 프레임이 떨어진다. 사용자는 실제로 본인 앱(`~/PersonalWebProject/shiflo-web`)에서 이 증상을 보고했고, 같은 시나리오를 [stackflow](https://github.com/daangn/stackflow)에서는 못 봤다고 명시.

**Stackflow가 안 떨어지는 이유**: stackflow는 CSS transition 기반이다. 화면 마운트 → 한 프레임 idle 클래스 → 다음 rAF에서 active 클래스 토글. 트랜지션은 컴포지터에서 완전히 GPU로 돌아 메인 스레드와 분리된다. flemo도 같은 모델로 가면 동일하게 부드러워진다는 가설.

**플레이그라운드의 layoutId는 어떻게**: layoutId/FLIP은 Motion에서 가장 강력하지만, 그건 모든 사용자가 쓰는 것이 아니라 옵트인이다. CSS 전환은 코어에 두고, layoutId/FLIP은 별도 패키지 `@flemo/layout`으로 분리해 Motion 의존을 그 패키지에만 둔다. 코어 번들은 줄고, layoutId 안 쓰는 앱은 Motion을 끌어들이지 않는다.

이 두 가지(perf + 번들 축소)가 같이 풀린다.

## 합의된 큰 방향 (사용자가 명시적으로 동의함)

|                        | 동의 항목                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 전환 구현              | Motion의 `animate()` 폐기 → CSS className 토글 + 2-rAF gap (stackflow 모델)                                                                                                                               |
| 트랜지션 정의 형식     | TS 객체(`createTransition`)는 유지하되 `value`/`options`가 CSS keyframes/timing 으로 컴파일됨                                                                                                             |
| 스타일 주입            | 런타임 `<style>` 태그를 `useInsertionEffect`로 head에 삽입 (옵션 b — 사용자 선택)                                                                                                                         |
| layoutId 분리 패키지명 | `@flemo/layout` (`@flemo/flip` 안 함 — 사용자 선택)                                                                                                                                                       |
| 패키지 분리 단계       | Phase 1: 코어 안에서 CSS 전환 마이그레이션 끝낸 뒤 / Phase 2: `@flemo/core` + `@flemo/react` + `@flemo/layout` 으로 분리 / Phase 3 (먼 미래): Motion 의존을 `@flemo/layout`에서도 걷어내고 자체 FLIP 구현 |
| 첫 릴리스에서 layoutId | 일단 `@flemo/layout`에 Motion 의존 그대로 두고 옵트인. Motion 자체 대체는 Phase 3.                                                                                                                        |

## 현재 상태 (직전 커밋 기준)

`main`의 최근 두 커밋:

- `58c930b feat: isolate shared app/navigation bars from screen transitions`
  - `ScreenMotion`이 `sharedAppBar`/`sharedNavigationBar`를 `position: fixed`로 motion.div 바깥에 렌더.
  - 다음/이전 화면이 같은 bar를 안 가질 때만 `frame.postRender`로 매 프레임 `getComputedStyle(scope).transform`/`opacity`를 bar inline style에 동기화 → bar가 이전/다음 화면과 함께 움직임. 같은 bar 공유면 가만히 있음.
  - `screen/store.ts`에 `sharedBars: Record<id, { appBar, navigationBar }>` registry + `registerSharedBars`/`unregisterSharedBars`.
- `3a727cb fix: serialize push/replace/pop/popStep onto a single navigation queue`
  - `push`/`replace`/`pop`/`pushStep`/`replaceStep`/`popStep` 전부 `TaskManager.addTask({ control: { manual: true } })`로 큐 직렬화.
  - 각 task body가 `setStatus`/`setTransitionTaskId(id)`를 호출, 활성 화면의 `ScreenMotion` status effect가 animate 종료 후 `useNavigationStore.getState().transitionTaskId`로 `resolveTask`를 부르면 task의 완료 콜백(`popHistory` 등)이 실행됨.
  - `selfPopGuard.ts` — flemo가 직접 호출한 `history.back()`이 만들어내는 `popstate`를 `HistoryListener`가 재처리하지 않도록 마킹/소비.
  - 테스트: `packages/flemo/src/navigate/__tests__/selfPopGuard.test.ts`, `packages/flemo/src/screen/__tests__/store.test.ts`.

CI gate (`pnpm turbo run typecheck lint test build`)는 두 커밋 모두 7/7 통과.

작업 트리에는 `apps/web/.source/*`, `tsconfig.tsbuildinfo`, `next-env.d.ts`만 남아있음 — fumadocs-mdx + Next.js 빌드 산출물이라 커밋 대상 아님.

## 이미 결정된 구체 사항

### CSS 전환 컴파일 모델

기존 `createTransition({ name, initial, idle, enter, enterBack, exit, exitBack, options })`의 시그니처는 **유지**한다. 사용자 코드(트랜지션 정의)를 깨지 않는다.

내부적으로는 각 variant value를 CSS keyframes로 변환:

```css
@keyframes flemo-cupertino-enter {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
.flemo-screen[data-status="PUSHING"][data-active="true"][data-transition="cupertino"] {
  animation: flemo-cupertino-enter 0.7s cubic-bezier(0.32, 0.72, 0, 1) both;
}
```

`useInsertionEffect`에서 transitionMap을 순회해 위 형태로 만들어 `document.head`에 `<style data-flemo>` 한 장으로 주입. HMR/transition 추가 시 idempotent하게 다시 만들어 덮어쓴다.

화면의 motion.div(이름은 `<div data-screen>`으로 충분, motion 의존 제거)는 `data-status`/`data-active`/`data-transition`만 토글하면 CSS animation이 알아서 동작. `useAnimate`/`scope`/`animate()` 삭제.

**2-rAF 이유**: 마운트 직후 첫 commit에서 `data-status="IDLE"`로 두고, 다음 rAF에서 `requestAnimationFrame(() => requestAnimationFrame(() => setStatus("PUSHING")))`처럼 두 프레임 대기 후 active 클래스 적용. 한 프레임만 기다리면 브라우저가 `from` 상태를 그리지 못해 트랜지션이 안 보이는 케이스가 있다(stackflow 코드에 같은 패턴).

### task 완료 신호

현재는 `await animate(...)` 후 `resolveTask(transitionTaskId)`. CSS 마이그레이션 후엔 `animationend` 이벤트로 대체:

```ts
useEffect(() => {
  const el = scopeRef.current;
  if (!el) return;
  const onEnd = (e: AnimationEvent) => {
    if (e.target !== el) return;
    if (!isActive) return;
    const id = useNavigationStore.getState().transitionTaskId;
    if (id) TaskManager.resolveTask(id);
  };
  el.addEventListener("animationend", onEnd);
  return () => el.removeEventListener("animationend", onEnd);
}, [scopeRef, isActive]);
```

주의: 트랜지션이 transform + opacity 등 여러 속성을 동시에 애니메이션하면 `animationend`가 여러 번 발생할 수 있다. 가장 긴 한 개만 신호로 쓰거나 `Promise.all([... animationend per property])` 묶음으로 처리. 그 결정은 마이그레이션 시작할 때 한 줄로 정해두고 시작.

### 스와이프-백 (드래그)는 별도 처리

cupertino/material/layout 전환의 `onSwipeStart`/`onSwipe`/`onSwipeEnd`는 현재 Motion의 `useDragControls` + `animate()`로 명령형 제어. CSS는 명령형이 안 되므로 **드래그 단계만 inline `transform`을 직접 쓰고, 드래그 종료 시 CSS transition(짧은 duration)으로 마무리**하는 하이브리드가 가장 단순. 이 부분은 `@flemo/core` 안에 남기되 `requestAnimationFrame` + 직접 `el.style.transform = ...` 로 구현. Motion 의존 제거.

### Screen freeze는 그대로

`ScreenFreeze`의 `display: none` 정책은 사용자가 명시적으로 못 박은 요구사항(스택 깊이 성능). CSS 마이그레이션과 무관하게 유지.

### 패키지 경계

| 패키지              | 책임                                                                                                                                                    | 의존                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `@flemo/core`       | TaskManager, history store, navigate store, navigate API (`useNavigate`/`useStep`), transition 정의 타입 + 기본 프리셋, HistoryListener, selfPopGuard   | zustand, path-to-regexp         |
| `@flemo/react`      | `Router`, `Route`, `Screen`, `LayoutScreen`, `ScreenMotion` (CSS 전환), `ScreenFreeze`, `ScreenDecorator`, useScreen, ParamsProvider, shared bar 시스템 | `@flemo/core`, react, react-dom |
| `@flemo/layout`     | layoutId/공유 element/FLIP을 쓰고 싶을 때 옵트인. 현재 시점에서는 Motion v12 래퍼 — `<LayoutScreen>`을 이쪽으로 이관하고 motion을 peerDep로.            | `@flemo/react`, motion          |
| `flemo` (기존 이름) | `@flemo/react`를 그대로 re-export하는 메타 패키지. 기존 사용자 무중단.                                                                                  | `@flemo/react`                  |

`flemo`를 그대로 두는 이유: shiflo-web이 `file:../flemo/packages/flemo`로 박혀있고 실배포 npm 패키지명도 `flemo`. 깨면 안 됨.

## 작업 순서

**Phase 1 — CSS 전환 마이그레이션 (현재 패키지 안에서)**

1. `packages/flemo/src/transition/` 안에 keyframes 컴파일러 추가. `createTransition`의 variant value/options을 받아 `{ keyframes: string, duration: number, easing: string }` 산출. cupertino/material/layout/none/fade\* 프리셋의 출력이 기존 Motion animate와 동일한 시각 결과인지 단위 테스트로 stamp.
2. 런타임 스타일 인젝터 추가 (`src/screen/transitionStyles.ts`). `useInsertionEffect`로 transitionMap 변경 시 head에 `<style data-flemo>` 갱신.
3. `ScreenMotion`에서 `useAnimate`/`useDragControls`/`animate(...)` 호출 모두 제거. `<div data-screen data-status data-active data-transition>`로 단순화. status useEffect는 2-rAF setStatus 트리거만 담당. 트랜지션 종료 신호는 `animationend` 리스너로 `resolveTask`.
4. 드래그(swipe-to-back): `onSwipeStart`/`onSwipe`/`onSwipeEnd` 콜백 시그니처는 그대로 두되, `animate`로 받던 도구를 `(el, properties, options) => void` 형태의 명령형 transform 헬퍼로 교체. 시작 시 `el.style.transition = "none"`, 종료 시 짧은 cubic-bezier transition으로 settle.
5. shared bar는 이미 `frame.postRender`로 polling 동기화함. Motion 의존 끊으려면 `requestAnimationFrame` 루프로 교체 (똑같이 매 프레임 `getComputedStyle(scope).transform` → bar inline). `scope`도 더이상 Motion ref가 아니라 일반 `useRef<HTMLDivElement>` 면 충분.
6. ScreenDecorator의 motion 의존 제거. decorator도 같은 CSS animation 모델로.
7. `packages/flemo/package.json`에서 `motion`을 peerDep에서 제거 가능한지 확인. layoutId 쓰는 LayoutScreen이 아직 여기 있으면 Phase 1 종료 시점엔 못 뺀다 — Phase 2에서 layoutId를 분리한 뒤 제거.
8. 회귀 검증: 플레이그라운드의 `/playground`에서 cupertino/material/layout/fade 모든 트랜지션 push/pop, swipe-back, sharedBar 라이드, ScreenFreeze 동작이 그대로인지 시각 + getAnimations로 확인. 무거운 화면 (예: TanStack Query suspend) 진입 시 프레임 떨어짐이 사라지는지 사용자 본인 앱(`shiflo-web`)에서도 확인.
9. 단일 changeset (`.changeset/css-transitions.md`, `"flemo": minor`)으로 배포.

**Phase 2 — 패키지 분리**

10. `packages/flemo` → `packages/flemo-react`로 디렉토리 이동. package.json `name: "@flemo/react"`. 기존 `packages/flemo`는 얇은 meta로 남겨 `@flemo/react`를 re-export.
11. 진짜 framework-agnostic 한 것들(core, history store/types, navigate store/types, TaskManager, transition 타입 + 프리셋, selfPopGuard)을 `packages/flemo-core`로 분리. `name: "@flemo/core"`. React import 0개여야 함.
12. `@flemo/react`가 `@flemo/core`를 deps로. 기존 path alias(`@core`, `@history`, ...)는 `@flemo/react` 내부에선 그대로 두되, `@flemo/core` import는 패키지 경로로.
13. LayoutScreen + ScreenDecorator의 layoutId/motion 관련 코드만 `packages/flemo-layout`로 이동. `name: "@flemo/layout"`. motion을 peerDep로. `LayoutScreen`을 여기서 export.
14. `@flemo/react`의 `LayoutScreen` re-export는 일단 deprecated alias로 남기고 다음 메이저에서 제거. 또는 깔끔히 제거하고 changeset에 major bump로 명시 (사용자 결정 필요 — 디폴트는 deprecated alias).
15. turbo `pipeline` 업데이트, `pnpm-workspace.yaml`에 새 패키지 등록, 각 패키지 `tsconfig`/`vite.config`/`eslint` 셋업.
16. `apps/web` 의 import 경로 정리. 플레이그라운드는 `@flemo/react` + 옵션으로 `@flemo/layout`만 쓰면 됨.
17. Changeset 3장 (각 패키지 minor 또는 0.1.0 첫 배포).

**Phase 3 (먼 미래, 별도 세션)**

18. `@flemo/layout`의 Motion 의존을 자체 FLIP 구현으로 교체. First/Last 측정 → Invert transform → Play CSS transition. 사용자도 "FLIP을 직접 구현하는 방향에 동의"했음.

## 시작 전 체크리스트 (다음 에이전트)

- [ ] 현재 `main` HEAD가 `58c930b`인지 확인 (`git log -1 --oneline`).
- [ ] `pnpm install && pnpm turbo run typecheck lint test build`가 7/7 통과하는지 확인.
- [ ] `apps/web/app/playground/_components/PlaygroundDemo/PlaygroundDemo.tsx`에서 등록된 모든 트랜지션(`cupertino`/`material`/`layout`/`fade`/`fadeLeft`/`fadeRight`)을 mental note. 마이그레이션 후 회귀 회귀 검증 시 사용.
- [ ] 사용자가 `display: none` 정책을 절대 못 바꾸게 한다는 점 (이번 세션 5회 이상 강조됨). ScreenFreeze 건드릴 일 있으면 무조건 사전 확인.
- [ ] `transpilePackages: ["motion"]`을 `apps/web/next.config.ts`에 넣는 건 우회책이지 fix가 아니다 (이번 세션에서 시도→되돌림). 같은 함정에 빠지지 말 것.

## 알려진 함정

- `<motion.div ref={scope} drag={swipeDirection}>` 의 `drag` prop은 mount 시 element를 `position: absolute`처럼 layout flow에서 떼낼 수 있다. CSS 마이그레이션 후엔 `drag` prop 자체가 사라지므로 무관하지만, Phase 1 작업 도중 임시로 motion.div를 유지하면 이 차이 때문에 layout이 미세하게 어긋날 수 있다.
- Motion v12.38은 Next.js 16 Turbopack production build에서 `layoutId` projection이 안 도는 알려진 회귀가 있다. `transpilePackages: ["motion"]`로 우회 가능하지만 위에 적은 대로 우회책이지 정답 아님. CSS 전환으로 가면 이 회귀 자체가 무관해진다.
- `TaskManager`의 `pendingTaskQueue`는 한 task가 `MANUAL_PENDING`에 머무는 동안 그 뒤 task들이 직렬화된다. `setTransitionTaskId(id)`를 task body 안에서 부르지 않으면 `ScreenMotion`의 `resolveTask`가 매칭 못해서 `MANUAL_PENDING`에서 못 빠져나오고 그 뒤 모든 navigation이 멈춘다. push/replace에서 빠뜨리지 말 것 (이번 세션에서 한 번 빠져서 사용자 분노 1회).
- shared bar의 frame.postRender 동기화는 motion 패키지의 `frame`/`cancelFrame`을 쓴다. Motion 의존 끊을 때 같이 `requestAnimationFrame` 루프로 교체.

## 참고 자료

- 사용자가 lovable에 배포해 둔 "잘 되던 시절" 데모: <https://flemo-new-live-demo.lovable.app/product> — flemo 1.3.5 또는 1.3.2 기반. layoutId 모핑이 자연스럽게 동작하는 reference visual.
- stackflow 레퍼런스: <https://github.com/daangn/stackflow>
- 사용자의 실제 앱: `~/PersonalWebProject/shiflo-web` — `file:../flemo/packages/flemo`로 로컬 링크. 작업 중 안전망으로 사용자 본인 앱에서 회귀 확인 가능.
