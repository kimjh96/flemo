import type { MorphTransitionOptions } from "@flemo/react";

import type { DocBlock, LocalizedDocPage } from "../docTypes";

// THE MORPH OPTION TABLE, KEYED BY THE API ITSELF.
//
// `Record<keyof MorphTransitionOptions, string>` is the whole point: rename or
// drop an option in core and this file stops compiling, instead of the table
// quietly describing something that no longer exists. It already did once:
// `scale` and `anchor` outlived the API they documented, and `crossFade`'s
// default was a number the runtime had moved on from.
//
// The prose stays hand-written per locale; only the KEYS are held to the type.
type MorphOptionCopy = Record<keyof MorphTransitionOptions, string>;

const morphOptionRows = (copy: MorphOptionCopy): string[][] =>
  (Object.keys(copy) as (keyof MorphTransitionOptions)[]).map((option) => [
    `\`${option}\``,
    copy[option]
  ]);

const galleryCode = `import { Morph, Screen, useNavigate } from "@flemo/react";

import { photos } from "./photos";

export function Gallery() {
  const navigate = useNavigate();

  return (
    <Screen>
      <ul>
        {photos.map((photo) => (
          <li key={photo.id}>
            <Morph
              layoutId={\`photo-\${photo.id}\`}
              onClick={() => navigate.push("/photos/:id", { id: photo.id })}
            >
              <img src={photo.thumb} alt="" />
            </Morph>
          </li>
        ))}
      </ul>
    </Screen>
  );
}`;

const photoCode = `import { Morph, Screen, useParams } from "@flemo/react";

import { photoById } from "./photos";

export function Photo() {
  const { id } = useParams<"/photos/:id">();

  return (
    <Screen>
      <Morph layoutId={\`photo-\${id}\`} className="hero">
        <img src={photoById(id).full} alt="" />
      </Morph>
    </Screen>
  );
}`;

const cardCode = `import { Morph } from "@flemo/react";

export function AlbumCard({ id, title }: { id: string; title: string }) {
  return (
    <Morph layoutId={\`album-\${id}\`} className="card">
      <img src={\`/covers/\${id}.jpg\`} alt="" />
      <span style={{ display: "block", height: 24 }}>
        <Morph
          as="span"
          name="text"
          layoutId={\`album-title-\${id}\`}
          style={{ display: "block", fontSize: 16, lineHeight: "24px" }}
        >
          {title}
        </Morph>
      </span>
    </Morph>
  );
}`;

const customCode = (
  comment: string
) => `import { Route, Router, createMorphTransition } from "@flemo/react";

import { Gallery } from "./Gallery";
import { Photo } from "./Photo";

const EASE = [0.4, 0, 0.2, 1] as const;

const quick = createMorphTransition({
  name: "quick",
  initial: {},
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  enter: { value: { opacity: 1 }, options: { duration: 0.3, ease: EASE } },
  exit: { value: { opacity: 0 }, options: { ease: EASE } },
  options: { crossFade: 0.3 }
});

export function App() {
  return (
    <Router morphTransitions={[quick]}>
      <Route path="/" element={<Gallery />} />
      <Route path="/photos/:id" element={<Photo />} />
    </Router>
  );
}

// ${comment}
// <Morph layoutId={\`photo-\${id}\`} name="quick">...</Morph>`;

const enBlocks: DocBlock[] = [
  {
    type: "demo",
    demo: "morph",
    caption:
      "Tap a thumbnail and it grows into the large image on the detail screen. Go back and it returns to where it was."
  },
  { type: "h", text: "Pair two elements" },
  {
    type: "p",
    text: "Wrap the element on both screens in `Morph` with the same `layoutId`. That is all the pairing needs. The element on the new screen starts where its partner was and ends exactly on its own layout box."
  },
  { type: "code", lang: "tsx", title: "Gallery.tsx", code: galleryCode, highlight: [13, 14] },
  { type: "code", lang: "tsx", title: "Photo.tsx", code: photoCode, highlight: [10] },
  { type: "h", text: "What happens during the transition" },
  {
    type: "list",
    items: [
      "The element on the new screen moves from the box of the element on the old screen, measured the moment navigation starts.",
      "The element on the old screen switches to its `exit` style on the first frame. A copy of what it showed, the ghost, fades out on top of the new element.",
      "The box itself animates, so the content is laid out at every size along the way, and it ends pixel-exact on its real layout box.",
      "Because the content is laid out rather than scaled, let it fill the Morph's box (for example `width: 100%; height: 100%`). A child with a fixed size keeps that size while the box grows or shrinks around it.",
      "Swipe-back moves the morph with the finger. You do not write anything for it."
    ]
  },
  {
    type: "note",
    kind: "warn",
    text: "Both elements must be mounted when navigation starts, because a morph pairs elements, not routes. While the transition runs the element is moved out of your tree, so do not measure or change it from outside until it ends."
  },
  {
    type: "details",
    title: "Transition rules in detail",
    blocks: [
      {
        type: "list",
        items: [
          "Keep your screen transition. While the transition runs, the moving element is drawn in a layer above both screens, so a fade, a slide or an instant switch cannot clip, cover or drag it.",
          "The starting box is measured where you last saw it. The two elements never cross-fade: the old one is held at its `exit` end style, and the ghost is a copy of what was on screen (`crossFade`).",
          "The element returns to your tree exactly as it was. `border-radius` is interpolated between the values you set on each of the two elements.",
          "On a pop, the element that moves is the one on the screen you return to. That is the inactive side, because `active` follows the stack, not the direction of navigation.",
          "Give both elements the same children. Anything the element on the new screen does not contain cannot be carried across.",
          "The element leaves its screen when the transition starts and returns when it ends, so a scroll container, an opaque new screen or a sliding transition cannot get in the way.",
          "While the transition runs, the element is drawn above shared bars, tab bars and decorator dims. Its layer sits above every screen container, nothing inside a screen can be drawn above it, and there is currently no way to prevent this.",
          "A morph belongs to the Router of its enclosing `Screen` and pairs only during that Router's transitions. Inside a nested Router it moves within that Router's box. See [Putting it together](putting-it-together).",
          "A `<Part>` inside a growing Morph is laid out once at its normal width, the width it has outside a transition. As the Morph grows, the Part is clipped instead of re-wrapping.",
          "`as` renders another tag (default `div`). Props stay typed as a div's. Do not render a structural tag such as `li` or `td` with it; put the Morph inside the `li` or `td` instead.",
          "A `name` with nothing registered under it animates nothing and warns once in development."
        ]
      }
    ]
  },
  { type: "h", text: "Nested morphs and shared text" },
  {
    type: "p",
    text: 'A nested morph moves with its container: the card moves and its artwork stays in place on it. Text that appears on both screens should be its own nested `name="text"` Morph, which lays the text out again at each size between the two, without a ghost.'
  },
  {
    type: "code",
    lang: "tsx",
    title: "AlbumCard.tsx",
    code: cardCode,
    highlight: [7, 8, 9, 10, 11, 12]
  },
  {
    type: "note",
    kind: "warn",
    text: "Give a text Morph its own box (`display: block` or `inline-block`) with `fontSize` and `lineHeight` on it. An inline one can appear at its destination before it moves."
  },
  {
    type: "details",
    title: "Why repeated text needs its own Morph",
    blocks: [
      {
        type: "list",
        items: [
          "If a card and its artwork moved on their own curves, the card would come apart mid-transition and the artwork would drift out of its box. The eye follows the container as one unit.",
          "The `text` preset uses no ghost: a heading and the label it came from are the same words at two sizes.",
          "Every morph interpolates font size, so the text is laid out again at each size rather than scaled as a bitmap.",
          "Ordinary text inside a container Morph is drawn twice: the ghost fades the old screen's letters over the new screen's letters, and the text visibly doubles or blurs.",
          "A nested Morph grows with its container's timing. Its own `duration` is not used.",
          "A non-replaced inline box can receive a computed translate without its line box moving, so the words show at the destination first. A block or inline-block box fixes that, and a wrapper with a fixed height keeps the surrounding layout from collapsing while the text is moving.",
          "A Morph stands for one element shared by both screens. Copy that differs between the screens (an eyebrow, a summary, controls) belongs in a `Part` beside it, which changes on each screen.",
          "Do not wrap the text Morph in that fading `Part`. Fading its parent would fade the letters that must stay visible."
        ]
      }
    ]
  },
  { type: "h", text: "Presets" },
  {
    type: "table",
    headers: ["Name", "Use it for", "Settings"],
    rows: [
      [
        "`shared` (default)",
        "Any element. A ghost fades out over the opaque new element",
        "`crossFade: 0.55`, `radius: true`, no duration"
      ],
      [
        "`text`",
        "Repeated text inside a container Morph",
        "`crossFade: 0`, `radius: false`, no duration"
      ],
      [
        "`zoom`",
        "A card opening into a full view. The screen it sits on zooms with it",
        '`shared` plus `carry: "screen"`'
      ]
    ]
  },
  {
    type: "note",
    kind: "warn",
    text: 'Use `zoom` (or any `carry: "screen"`) with a screen transition that does not move the screen, such as `none` or an opacity-only one. Its zoom replaces that screen\'s transform, so a slide would disappear. Development warns.'
  },
  {
    type: "details",
    title: "Timing, and an element that fills the screen",
    blocks: [
      {
        type: "list",
        items: [
          "Duration: the morph's own `enter` duration if set, else the running screen transition's duration, else 0.4s when the screen transition is `none`.",
          "Easing: the morph's own, except while the screen itself moves. Then it uses the screen's easing, because the destination moves with that screen.",
          "The presets set no duration on purpose, so a morph ends with its screen under any transition. They do set a curve, `[0.4, 0, 0.2, 1]`, because borrowing a fade's front-loaded curve would make the element jump across and then sit still.",
          "A morph with no duration of its own ends on the same frame as its screen."
        ]
      },
      {
        type: "p",
        text: 'A container that grows to fill the viewport is the same feature with a bigger box. What happens behind it is up to the screen transition. Let the previous screen follow the element out (for example `exit: { scale: 1.08, filter: "blur(10px)" }` in a `createTransition`) and leave the new screen transparent so the previous one shows through.'
      }
    ]
  },
  { type: "h", text: "Write a morph transition" },
  {
    type: "p",
    text: "`createMorphTransition` has the same shape as `createTransition`. Register it with `Router morphTransitions` and select it with `<Morph name>`. flemo measures the movement on every transition. You set the timing, the fade and the options."
  },
  {
    type: "code",
    lang: "tsx",
    title: "App.tsx",
    code: customCode("Select it by name on both screens"),
    highlight: [12, 13, 19, 27]
  },
  {
    type: "table",
    headers: ["Variant", "Meaning"],
    rows: [
      ["`initial`", "Extra starting style for the new element, applied over the old element's box"],
      ["`idle`", "Style at rest, and the old element's style before it switches to `exit`"],
      [
        "`enter`",
        "The new element, which moves. Its duration sets how long the movement takes. Leave it out to end with the screen"
      ],
      ["`exit`", "Style the old element switches to on the first frame. End it hidden"]
    ]
  },
  {
    type: "table",
    headers: ["Option", "What it does"],
    rows: morphOptionRows({
      crossFade:
        "Share of the transition (0-1, default 0.55) the ghost takes to fade out. `0` makes no copy and shows the new element's content from the first frame",
      radius:
        "Interpolates `border-radius` between the values set on the two elements (default `true`)",
      carry:
        "`\"screen\"` (default off) zooms the screen on which the element is small by exactly the element's zoom, replacing that screen's transform"
    })
  },
  {
    type: "note",
    kind: "warn",
    text: "End `exit` at `opacity: 0`. A visible end style keeps the old element drawn, covered on push and revealed on pop, and it flickers after a pop ends. Development warns."
  },
  {
    type: "details",
    title: "Pop direction, raw factory and option edge cases",
    blocks: [
      {
        type: "table",
        headers: ["Status", "Screen", "Morph variant"],
        rows: [
          ["PUSHING / REPLACING, active", "the new screen", "`enter`, moves"],
          [
            "PUSHING / REPLACING, inactive",
            "the previous screen, going behind or leaving",
            "`exit`, switches at once"
          ],
          ["POPPING, active", "the closing screen, still on top", "`exit`, switches at once"],
          ["POPPING, inactive", "the screen behind, returning", "`enter`, moves"],
          ["COMPLETED", "transition ended", "`idle`"]
        ]
      },
      {
        type: "p",
        text: 'Reading `active` as "the side that moves" pairs morphs backwards on every pop. The moving side always starts at `initial`, and the side being left always starts at rest.'
      },
      {
        type: "p",
        text: "`createRawMorphTransition` takes `initial`, `idle`, `pushOnEnter`, `pushOnExit`, `replaceOnEnter`, `replaceOnExit`, `popOnEnter`, `popOnExit` and `options`. `popOnEnter` fills POPPING-false, the returning element that moves. `popOnExit` fills POPPING-true. Rest variants stay `idle`, because a pair exists only while a transition runs."
      },
      {
        type: "list",
        items: [
          "`initial: { opacity: 0 }` makes the new element start as a cross-fade. Nothing is scaled, so `radius` needs no correction.",
          "`crossFade`: the new element stays opaque under the ghost. Fading both would let the background show through by a(1 - a), a brightness dip of up to 25% halfway through, which is why the presets' `initial` is `{}`.",
          "`crossFade`: paired descendants are already hidden in the ghost, so it only holds content with no counterpart. With `0`, that content looks clipped instead of fading out.",
          "`radius` is animated with the content, never with the geometry, so the geometry keyframes stay on the compositor.",
          '`carry: "screen"` zooms the screen on which the element is small: the previous screen on a push, the screen you return to on a pop. Every other card moves as if the view zoomed in on the tapped one.'
        ]
      }
    ]
  }
];

const koBlocks: DocBlock[] = [
  {
    type: "demo",
    demo: "morph",
    caption: "썸네일을 누르면 상세 화면의 큰 이미지로 커져요. 뒤로 가면 원래 자리로 돌아와요."
  },
  { type: "h", text: "두 요소 짝짓기" },
  {
    type: "p",
    text: "두 화면의 요소를 같은 `layoutId`의 `Morph`로 감싸면 끝이에요. 새 화면의 요소는 이전 화면의 요소가 있던 자리에서 시작해서, 자기 레이아웃 위치에 정확히 맞춰 끝나요."
  },
  { type: "code", lang: "tsx", title: "Gallery.tsx", code: galleryCode, highlight: [13, 14] },
  { type: "code", lang: "tsx", title: "Photo.tsx", code: photoCode, highlight: [10] },
  { type: "h", text: "전환 중에 일어나는 일" },
  {
    type: "list",
    items: [
      "새 화면의 요소는 이동이 시작되는 순간 측정한 이전 요소의 위치와 크기에서 출발해요.",
      "이전 화면의 요소는 첫 프레임에 바로 `exit` 스타일로 바뀌어요. 대신 그 요소의 모습을 복사한 ghost가 새 요소 위에서 서서히 사라져요.",
      "박스 크기 자체가 애니메이션되기 때문에 내용은 크기마다 다시 레이아웃되고, 마지막에는 실제 레이아웃 박스에 픽셀 단위로 정확히 맞춰져요.",
      "내용을 확대·축소하지 않고 다시 레이아웃하기 때문에, 안쪽 요소는 Morph 박스를 꽉 채우게 하세요(예: `width: 100%; height: 100%`). 크기가 고정된 자식은 박스가 커지거나 줄어드는 동안에도 그 크기 그대로예요.",
      "뒤로 가기 스와이프를 하면 Morph도 손가락을 따라 움직여요. 따로 작성할 코드는 없어요."
    ]
  },
  {
    type: "note",
    kind: "warn",
    text: "Morph는 라우트가 아니라 요소끼리 짝짓기 때문에, 이동을 시작할 때 두 요소가 모두 마운트돼 있어야 해요. 전환 중에는 요소가 원래 트리 밖으로 옮겨지니, 전환이 끝날 때까지 바깥에서 크기를 재거나 수정하지 마세요."
  },
  {
    type: "details",
    title: "전환 동작 자세히",
    blocks: [
      {
        type: "list",
        items: [
          "화면 전환은 쓰던 그대로 두세요. 전환 중에는 움직이는 요소가 두 화면보다 위에 있는 레이어에 그려져서, 페이드나 슬라이드, 즉시 전환 어느 것도 요소를 자르거나 가리거나 끌고 가지 못해요.",
          "시작 위치는 사용자가 마지막으로 본 자리에서 측정해요. 두 요소를 서로 크로스페이드하지는 않아요. 이전 요소는 `exit` 스타일에 고정되고, ghost는 화면에 보이던 모습을 복사한 거예요(`crossFade`).",
          "전환이 끝나면 요소는 원래 모습 그대로 트리에 돌아와요. `border-radius`는 두 요소에 각각 지정한 값 사이로 보간돼요.",
          "pop할 때 움직이는 요소는 돌아가는 화면, 즉 뒤에 있던 화면의 요소예요. `active`는 이동 방향이 아니라 스택 위치를 따르기 때문에 이쪽이 비활성(inactive) 쪽이에요.",
          "두 요소에 같은 자식을 넣으세요. 새 화면의 요소에 없는 내용은 옮겨 갈 수 없어요.",
          "요소는 전환이 시작될 때 화면에서 빠져나왔다가 끝나면 돌아와요. 그래서 스크롤 컨테이너나 불투명한 새 화면, 슬라이드 전환이 이동을 방해하지 않아요.",
          "전환 중인 요소는 공유 바, 탭 바, 데코레이터의 dim보다 위에 그려져요. 이 레이어는 모든 화면 컨테이너보다 위에 있어서 화면 안의 어떤 요소도 그보다 위에 올 수 없고, 지금은 이걸 막을 방법이 없어요.",
          "Morph는 자신을 감싼 `Screen`의 Router에 속하고, 그 Router의 화면 전환 안에서만 짝을 찾아요. 중첩 Router 안에서는 그 Router 영역 안에서만 움직여요. [Putting it together](putting-it-together)를 참고하세요.",
          "커지는 Morph 안에 있는 `<Part>`는 전환 중이 아닐 때의 너비로 한 번만 레이아웃돼요. Morph가 커지는 동안 줄바꿈이 다시 일어나지 않고 잘려서 보여요.",
          "`as`로 다른 태그를 렌더링할 수 있어요(기본값 `div`). prop 타입은 div 기준 그대로예요. `li`, `td` 같은 구조용 태그를 `as`로 지정하지 말고, Morph를 그 태그 안에 넣으세요.",
          "등록되지 않은 `name`을 쓰면 아무 애니메이션도 일어나지 않고, 개발 모드에서 한 번 경고가 떠요."
        ]
      }
    ]
  },
  { type: "h", text: "Morph 중첩과 텍스트 짝짓기" },
  {
    type: "p",
    text: '중첩된 Morph는 바깥 컨테이너와 함께 움직여요. 카드가 이동하는 동안 안의 이미지는 카드 위 제자리에 그대로 있어요. 두 화면에 모두 나오는 텍스트는 `name="text"`인 Morph로 한 번 더 감싸세요. ghost 없이 두 크기 사이에서 글자가 크기마다 다시 레이아웃돼요.'
  },
  {
    type: "code",
    lang: "tsx",
    title: "AlbumCard.tsx",
    code: cardCode,
    highlight: [7, 8, 9, 10, 11, 12]
  },
  {
    type: "note",
    kind: "warn",
    text: "텍스트 Morph에는 자체 박스(`display: block` 또는 `inline-block`)를 주고, `fontSize`와 `lineHeight`도 그 요소에 직접 지정하세요. 인라인 요소로 두면 글자가 움직이기 전에 도착 위치에 먼저 보일 수 있어요."
  },
  {
    type: "details",
    title: "반복되는 텍스트에 Morph가 따로 필요한 이유",
    blocks: [
      {
        type: "list",
        items: [
          "카드와 이미지가 각자 다른 곡선으로 움직이면 전환 도중 카드가 벌어지고 이미지가 박스 밖으로 밀려나요. 사용자의 눈은 컨테이너를 하나의 덩어리로 따라가요.",
          "`text` 프리셋은 ghost를 쓰지 않아요. 제목과 그 제목이 나온 라벨은 크기만 다른 같은 글자이기 때문이에요.",
          "모든 Morph는 글자 크기를 보간해요. 비트맵을 확대하는 게 아니라 크기마다 글자를 실제로 다시 레이아웃해요.",
          "컨테이너 Morph 안의 일반 텍스트는 두 번 그려져요. ghost가 이전 화면의 글자를 새 화면의 글자 위에서 페이드하기 때문에 글자가 겹치거나 번져 보여요.",
          "중첩된 Morph는 컨테이너의 타이밍에 맞춰 커지고, 자기에게 지정한 `duration`은 쓰지 않아요.",
          "대체 요소가 아닌 인라인 박스는 translate 값이 계산돼도 줄 박스가 움직이지 않을 수 있어서, 글자가 도착 위치에 먼저 보여요. block이나 inline-block 박스로 바꾸면 해결되고, 높이를 고정한 래퍼로 감싸면 텍스트가 움직이는 동안 주변 레이아웃이 무너지지 않아요.",
          "Morph 하나는 두 화면이 공유하는 요소 하나를 뜻해요. 화면마다 다른 문구(eyebrow, 요약, 버튼 등)는 그 옆에 `Part`로 두면 화면마다 바뀌어요.",
          "텍스트 Morph를 그 페이드되는 `Part`로 감싸지는 마세요. 부모가 페이드되면 계속 보여야 할 글자까지 함께 흐려져요."
        ]
      }
    ]
  },
  { type: "h", text: "프리셋" },
  {
    type: "table",
    headers: ["이름", "용도", "설정"],
    rows: [
      [
        "`shared` (기본값)",
        "모든 요소. 불투명한 새 요소 위에서 ghost가 서서히 사라져요",
        "`crossFade: 0.55`, `radius: true`, duration 없음"
      ],
      [
        "`text`",
        "컨테이너 Morph 안에서 반복되는 텍스트",
        "`crossFade: 0`, `radius: false`, duration 없음"
      ],
      [
        "`zoom`",
        "카드가 전체 화면으로 열릴 때. 카드가 있는 화면도 함께 확대돼요",
        '`shared`에 `carry: "screen"`을 더한 것'
      ]
    ]
  },
  {
    type: "note",
    kind: "warn",
    text: '`zoom`(또는 `carry: "screen"`을 쓴 Morph)은 `none`이나 opacity만 바꾸는 전환처럼 화면이 움직이지 않는 화면 전환과 함께 쓰세요. 확대 효과가 그 화면의 transform을 대신해서 슬라이드가 사라지고, 개발 모드에서 경고가 떠요.'
  },
  {
    type: "details",
    title: "타이밍, 화면을 가득 채우는 요소",
    blocks: [
      {
        type: "list",
        items: [
          "길이: Morph의 `enter`에 지정한 duration을 먼저 써요. 없으면 진행 중인 화면 전환의 길이를 쓰고, 화면 전환이 `none`이면 0.4초를 써요.",
          "easing: 기본은 Morph 자신의 easing이에요. 다만 화면 자체가 움직이는 동안에는 도착 위치도 그 화면과 함께 움직이니 화면의 easing을 따라요.",
          "프리셋에는 일부러 duration이 없어서 어떤 화면 전환을 쓰든 Morph가 화면과 함께 끝나요. 반면 곡선 `[0.4, 0, 0.2, 1]`은 직접 지정해요. 앞부분에 변화가 몰린 페이드 곡선을 그대로 쓰면 요소가 순식간에 건너간 뒤 멈춰 있는 것처럼 보이기 때문이에요.",
          "자기 duration이 없는 Morph는 화면 전환과 같은 프레임에 함께 끝나요."
        ]
      },
      {
        type: "p",
        text: '화면 전체를 채우도록 커지는 컨테이너도 박스만 클 뿐 같은 기능이에요. 그 뒤에서 일어나는 일은 화면 전환이 맡아요. 이전 화면이 요소를 따라 밀려나도록 하고(예: `createTransition`의 `exit: { scale: 1.08, filter: "blur(10px)" }`), 새 화면은 투명하게 두어 이전 화면이 비쳐 보이게 하세요.'
      }
    ]
  },
  { type: "h", text: "Morph 트랜지션 직접 만들기" },
  {
    type: "p",
    text: "`createMorphTransition`은 `createTransition`과 같은 형태예요. `Router morphTransitions`에 등록하고 `<Morph name>`으로 골라요. 이동 거리는 전환할 때마다 flemo가 측정하니, 직접 정하는 건 타이밍, 페이드, 옵션뿐이에요."
  },
  {
    type: "code",
    lang: "tsx",
    title: "App.tsx",
    code: customCode("양쪽 화면에서 같은 이름으로 골라요"),
    highlight: [12, 13, 19, 27]
  },
  {
    type: "table",
    headers: ["variant", "의미"],
    rows: [
      ["`initial`", "새 요소의 시작 스타일. 이전 요소의 박스 위에 추가로 적용돼요"],
      ["`idle`", "평소 스타일. 이전 요소가 `exit`로 바뀌기 전의 스타일이기도 해요"],
      [
        "`enter`",
        "움직이는 새 요소의 스타일. 여기 지정한 duration이 이동 시간이 되고, 비워 두면 화면과 함께 끝나요"
      ],
      ["`exit`", "이전 요소가 첫 프레임에 바로 바뀌는 스타일. 보이지 않는 상태로 끝내세요"]
    ]
  },
  {
    type: "table",
    headers: ["옵션", "역할"],
    rows: morphOptionRows({
      crossFade:
        "전환 시간 중 ghost가 사라지는 데 쓰는 비율(0-1, 기본값 0.55). `0`이면 복사본을 만들지 않고 첫 프레임부터 새 요소의 내용을 보여 줘요",
      radius: "두 요소에 각각 지정한 값 사이로 `border-radius`를 보간해요(기본값 `true`)",
      carry:
        '`"screen"`이면(기본값 꺼짐) 요소가 작게 보이는 쪽 화면을 요소가 확대되는 비율만큼 함께 확대해요. 그 화면의 transform은 이 확대로 대체돼요'
    })
  },
  {
    type: "note",
    kind: "warn",
    text: "`exit`는 `opacity: 0`으로 끝내세요. 끝 스타일이 보이는 상태면 이전 요소가 계속 그려져서 push에서는 가려지고 pop에서는 드러나고, pop이 끝난 뒤에 깜빡여요. 개발 모드에서 경고가 떠요."
  },
  {
    type: "details",
    title: "pop 방향, raw 팩토리, 옵션 세부 동작",
    blocks: [
      {
        type: "table",
        headers: ["status", "화면", "Morph variant"],
        rows: [
          ["PUSHING / REPLACING, active", "새 화면", "`enter`, 움직여요"],
          [
            "PUSHING / REPLACING, inactive",
            "뒤로 가려지거나 사라지는 이전 화면",
            "`exit`, 바로 바뀌어요"
          ],
          ["POPPING, active", "닫히는 화면, 아직 맨 위에 있어요", "`exit`, 바로 바뀌어요"],
          ["POPPING, inactive", "뒤에 있다가 다시 보이는 화면", "`enter`, 움직여요"],
          ["COMPLETED", "전환이 끝난 상태", "`idle`"]
        ]
      },
      {
        type: "p",
        text: '`active`를 "움직이는 쪽"으로 이해하면 pop할 때마다 Morph가 반대로 짝지어져요. 움직이는 쪽은 항상 `initial`에서 시작하고, 남겨지는 쪽은 항상 평소 스타일에서 시작해요.'
      },
      {
        type: "p",
        text: "`createRawMorphTransition`은 `initial`, `idle`, `pushOnEnter`, `pushOnExit`, `replaceOnEnter`, `replaceOnExit`, `popOnEnter`, `popOnExit`, `options`를 받아요. `popOnEnter`는 POPPING-false, 즉 돌아오면서 움직이는 요소에 쓰이고, `popOnExit`는 POPPING-true에 쓰여요. 짝은 전환 중에만 존재하기 때문에 정지 상태의 variant는 `idle` 그대로예요."
      },
      {
        type: "list",
        items: [
          "`initial: { opacity: 0 }`을 주면 새 요소가 크로스페이드로 시작해요. 크기를 조절하는 게 없으니 `radius` 보정도 필요 없어요.",
          "`crossFade`: 새 요소는 ghost 아래에서 계속 불투명하게 유지돼요. 둘 다 페이드하면 배경이 a(1 - a)만큼 비쳐서 전환 중간에 밝기가 최대 25%까지 떨어져요. 그래서 프리셋의 `initial`이 `{}`예요.",
          "`crossFade`: 짝이 있는 자식 요소는 ghost에서 이미 숨겨지기 때문에, ghost에 남는 건 짝이 없는 내용뿐이에요. `0`이면 그 내용이 서서히 사라지지 않고 잘린 것처럼 보여요.",
          "`radius`는 위치·크기 애니메이션이 아니라 내용 애니메이션 쪽에서 처리돼서, 위치·크기 키프레임은 컴포지터에서 그대로 돌아요.",
          '`carry: "screen"`은 요소가 작게 보이는 쪽 화면을 함께 확대해요. push에서는 이전 화면, pop에서는 돌아가는 화면이에요. 그러면 나머지 카드들이 누른 카드 쪽으로 화면이 확대되는 것처럼 움직여요.'
        ]
      }
    ]
  }
];

const page: LocalizedDocPage = {
  en: {
    slug: "morph",
    title: "Morph",
    summary:
      "`<Morph>` pairs two elements that share a `layoutId`, so one element moves from the old screen to the new one while your screen transition runs unchanged.",
    blocks: enBlocks
  },
  ko: {
    slug: "morph",
    title: "Morph",
    summary:
      "`<Morph>`는 같은 `layoutId`를 가진 두 요소를 짝지어요. 화면 전환은 그대로 두고, 요소 하나가 이전 화면의 자리에서 새 화면의 자리로 이어지듯 움직여요.",
    blocks: koBlocks
  }
};

export default page;
