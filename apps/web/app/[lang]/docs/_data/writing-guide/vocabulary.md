# Docs vocabulary

Use established terms and code names consistently. Replace engine metaphors with descriptions of what readers see.

## Keep as written

Keep these code names and established English terms: `Router`, `Route`, `Slot`, `Screen`, `Part`, `Morph`, `Layer`, decorator; transition preset names (`cupertino`, `material`, `layout`, `none`); variant keys (`initial`, `idle`, `enter`, `exit`, `enterBack`, `exitBack`, `dismiss`); push, pop, replace, prop, hook, layout, easing, `duration`, and `delay`.

In Korean prose, keep `Router`, `Screen`, push, pop, prop, variant, and easing in English. Write common loanwords in Hangul: 스와이프, 제스처, 레이아웃, 렌더링, 마운트, 데코레이터, 프리셋, 애니메이션.

## Replace internal metaphors

Describe visible behavior using the following replacements.

| Do not write | English | Korean |
| --- | --- | --- |
| flight, fly | the transition, while the transition runs, moves | 화면 전환, 전환 중, 움직여요 |
| clock | timing (duration, delay, easing) | 타이밍 |
| pose | style, the variant's values | 스타일, variant 값 |
| rider | describe the behaviour: follows the swipe | 스와이프를 따라가요 |
| chrome | header, tab bar, fixed UI | 헤더, 탭 바, 고정 UI |
| arriving / departing screen | the new screen / the previous screen | 새 화면 / 이전 화면 |
| arriving / departing element (Morph) | the element on the new screen / on the old screen | 새 화면의 요소 / 이전 화면의 요소 |
| lands, landing, settled | ends, when the transition ends | 끝나요, 전환이 끝나면 |
| goes behind, underneath | the previous screen, behind | 이전 화면, 뒤에 있는 화면 |
| dismissing screen | the closing screen | 닫히는 화면 |
| owner, owns the navigation | the Router that handles it | 이동을 처리하는 Router |
| paints, paints in | renders, draws above | 그려요, 위에 그려요 |
| hands over | changes on each screen | 화면마다 바뀌어요 |
| names a decorator | sets, specifies | 지정해요 |
| participant | element that moves | 움직이는 요소 |
| primitive | component | 컴포넌트 |
| commit / cancel (swipe) | the swipe goes back / is cancelled | 뒤로 가기가 확정돼요 / 취소돼요 |
| threshold | the distance needed to go back | 뒤로 가기 기준 거리 |
| cut | disappears at once | 바로 사라져요 |
| spatial phase | the same point along its path | 같은 위치 |
| glass | the screen, what the user sees | 화면에 보이는 것 |
