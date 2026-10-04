# Docs writing guide

Rules for the typed docs content in `pages/*.ts`, both languages. The engine's
own design documents still use some internal metaphors (clock, rider, pose);
those stay in `docs/architecture/` and never reach a reader of the site. The
word "flight" was retired from the code and the docs alike: it is
"transition" everywhere, including the API (`after: "transition"`,
`attachTransitionRecorder`).

## Who reads this

A React developer who has used a router and maybe Framer Motion, and has never
read flemo's source. Every sentence should make sense to that person without
knowing how the engine works inside.

## Vocabulary

### Keep as written (code names and established English terms)

`Router`, `Route`, `Slot`, `Screen`, `Part`, `Morph`, `Layer`, decorator,
transition preset names (`cupertino`, `material`, `layout`, `none`), variant
keys (`initial`, `idle`, `enter`, `exit`, `enterBack`, `exitBack`, `dismiss`),
push, pop, replace, prop, hook, layout, easing, `duration`, `delay`.

In Korean prose these stay in English: `Router`, `Screen`, push, pop, prop,
variant, easing. Common loanwords are written in Hangul: 스와이프, 제스처,
레이아웃, 렌더링, 마운트, 데코레이터, 프리셋, 애니메이션.

### Replace internal metaphors

| Do not write                         | English                                           | Korean                            |
| ------------------------------------ | ------------------------------------------------- | --------------------------------- |
| flight, fly                          | the transition, while the transition runs, moves  | 화면 전환, 전환 중, 움직여요      |
| clock                                | timing (duration, delay, easing)                  | 타이밍                            |
| pose                                 | style, the variant's values                       | 스타일, variant 값                |
| rider                                | (describe the behaviour) follows the swipe        | 스와이프를 따라가요               |
| chrome                               | header, tab bar, fixed UI                         | 헤더, 탭 바, 고정 UI              |
| arriving / departing screen          | the new screen / the previous screen              | 새 화면 / 이전 화면               |
| arriving / departing element (Morph) | the element on the new screen / on the old screen | 새 화면의 요소 / 이전 화면의 요소 |
| lands, landing, settled              | ends, when the transition ends                    | 끝나요, 전환이 끝나면             |
| goes behind, underneath              | the previous screen, behind                       | 이전 화면, 뒤에 있는 화면         |
| dismissing screen                    | the closing screen                                | 닫히는 화면                       |
| owner, owns the navigation           | the Router that handles it                        | 이동을 처리하는 Router            |
| paints, paints in                    | renders, draws above                              | 그려요, 위에 그려요               |
| hands over                           | changes on each screen                            | 화면마다 바뀌어요                 |
| names a decorator                    | sets, specifies                                   | 지정해요                          |
| participant                          | element that moves                                | 움직이는 요소                     |
| primitive                            | component                                         | 컴포넌트                          |
| commit / cancel (swipe)              | the swipe goes back / is cancelled                | 뒤로 가기가 확정돼요 / 취소돼요   |
| threshold                            | the distance needed to go back                    | 뒤로 가기 기준 거리               |
| cut                                  | disappears at once                                | 바로 사라져요                     |
| spatial phase                        | the same point along its path                     | 같은 위치                         |
| glass                                | the screen, what the user sees                    | 화면에 보이는 것                  |

## Sentences

- Lead with what the reader can do or will see, then how.
- One idea per sentence. Split a sentence that needs a semicolon.
- No slogans or aphorisms in docs ("the finger is the clock"). Marketing copy on
  the home page may be shorter, but it still has to be literal.
- Name the concrete thing: "the header title", not "a piece of chrome".
- Show the result before the rule: a demo or a code sample comes before a table
  of cases.
- Tables are for comparison the reader already has context for. Do not open a
  page or a section with one.

## Korean

- Write the Korean page from the meaning, not by following the English sentence.
  Reorder, split or merge freely.
- 해요체 throughout. Avoid stacking short "~예요." sentences; join related ideas
  with "~하고", "~해서", "~면".
- Use the words a Korean frontend developer says at work: 화면 전환, 뒤로 가기,
  진행도, 고정 헤더, 상태. Avoid literal coinages (비행, 시계, 지명, 착지, 넘겨받다).
- Keep code identifiers in backticks and never translate them.
- 트랜지션 vs 화면 전환: "트랜지션" is the thing you define and register
  (`createTransition`, a preset, a name passed to `transitionName`, Part
  트랜지션, Morph 트랜지션). "화면 전환" is the screens changing on screen
  (전환 중, 화면 전환이 끝나면). Never write "Part 전환" or "전환 이름".
