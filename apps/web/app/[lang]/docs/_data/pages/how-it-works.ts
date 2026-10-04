import type { DocBlock, LocalizedDocPage } from "../docTypes";

// The whole library for someone who has never used it. Every
// claim here is a plain restatement of a page further on; link there for the
// details instead of adding them here.
const enBlocks: DocBlock[] = [
  {
    type: "p",
    text: "flemo moves screens the way a phone app does. Here is what happens under the hood, from the stack of screens to the swipe that takes you back."
  },
  { type: "h", text: "Screens are a stack of cards" },
  {
    type: "p",
    text: "Think of every screen in your app as a card. The `Router` keeps the cards in a pile. **push** puts a new card on top of the pile, and **pop** takes the top card off, so the one underneath shows again."
  },
  {
    type: "diagram",
    diagram: "stack",
    caption:
      "push lays a new screen on top. pop lifts the top one off and the screen below comes back."
  },
  {
    type: "p",
    text: "The pile is also your browser history, so the Back button pops too. See [Router and Route](router)."
  },
  { type: "h", text: "The movement is written down first" },
  {
    type: "p",
    text: "A transition is a short recipe: where each screen starts and where it ends. When the `Router` starts, flemo turns every recipe into CSS keyframes, once."
  },
  {
    type: "diagram",
    diagram: "compile",
    caption:
      "Your transition becomes CSS once. After that the browser plays it by itself on every push and pop."
  },
  {
    type: "p",
    text: "Because the browser plays the CSS, no JavaScript has to run on every frame while screens move. That keeps the motion smooth even when the page is busy. See [Transitions](transitions)."
  },
  { type: "h", text: "One push, step by step" },
  {
    type: "p",
    text: "Here is what happens when you push a screen with the `cupertino` transition."
  },
  {
    type: "diagram",
    diagram: "push",
    caption:
      "1: the list is showing. 2: flemo renders the new screen first and waits for it to be drawn. 3: both screens move together. 4: the new screen is on top."
  },
  {
    type: "list",
    ordered: true,
    items: [
      "The list is on screen.",
      "flemo renders the new screen and waits until it has been drawn once, so you never see an empty screen slide in.",
      "Both screens start at the same moment. The new one slides in from the right. The list moves back a little and gets darker, which is a [decorator](decorator).",
      "The new screen is on top of the stack. The list stays underneath, ready for when you go back."
    ]
  },
  {
    type: "p",
    text: "A pop plays the same steps backwards."
  },
  { type: "h", text: "Your finger drives the swipe" },
  {
    type: "p",
    text: "When you start swiping from the left edge, flemo prepares the pop but does not play it. Instead, the distance your finger has moved decides how far along the pop is. Move your finger back and the screens move back with it."
  },
  {
    type: "diagram",
    diagram: "swipe",
    caption:
      "The swipe sets how far along the pop is. Let go far enough and it finishes going back. Let go early and it slides back."
  },
  {
    type: "p",
    text: "When you let go, flemo looks at how far you swiped and how fast you were moving. If either is enough, the pop finishes. If not, the screens slide back to where they were. Either way the rest of the movement uses the transition's own easing."
  },
  { type: "h", text: "The same thing on two screens" },
  {
    type: "p",
    text: "Sometimes the same thing appears on both screens, like a photo in a list that becomes the big photo on the next screen. Wrap it in `Morph` on both screens with the same `layoutId`."
  },
  {
    type: "diagram",
    diagram: "morph",
    caption:
      "flemo measures the photo on both screens, then moves it from the small box to the big one."
  },
  {
    type: "p",
    text: "flemo measures where the photo is on the old screen and where it will be on the new one. The photo on the new screen starts in the old spot and moves to its own place, so it looks like one photo that grew. See [Morph](morph)."
  },
  { type: "h", text: "What stays still and what changes" },
  {
    type: "p",
    text: "Not everything has to move. Anything outside a `Slot` stays still while only the inside moves, which is how a header or a sidebar stays put. And when two screens share a header, `Part` changes only the piece that is different, such as the title."
  },
  {
    type: "diagram",
    diagram: "slot",
    caption:
      "Left: the header outside the Slot stays still while the screens inside move. Right: the header stays and only its title changes."
  },
  {
    type: "p",
    text: "See [Slot](slot) and [Part](part). To draw a menu above that header, use [Layer](layer)."
  },
  { type: "h", text: "Stacks inside stacks" },
  {
    type: "p",
    text: "A screen can hold another `Router`. That inner Router has its own pile of cards and moves only inside its box, which is how a tab or a panel gets its own back button."
  },
  {
    type: "diagram",
    diagram: "nested",
    caption:
      "The panel has its own Router. Moving inside the panel changes only the panel, not the whole app."
  },
  {
    type: "p",
    text: "[Putting it together](composition) builds an app with all of these, one step at a time."
  }
];

const koBlocks: DocBlock[] = [
  {
    type: "p",
    text: "flemo는 휴대폰 앱처럼 화면을 움직여요. 화면 스택부터 뒤로 가는 스와이프까지, 그 안에서 어떤 일이 일어나는지 알아봐요."
  },
  { type: "h", text: "화면은 카드 더미예요" },
  {
    type: "p",
    text: "앱의 화면 하나하나를 카드라고 생각해 보세요. `Router`는 이 카드들을 한 더미로 쌓아 둬요. **push**는 새 카드를 맨 위에 올리고, **pop**은 맨 위 카드를 치워서 아래 카드가 다시 보이게 해요."
  },
  {
    type: "diagram",
    diagram: "stack",
    caption: "push는 새 화면을 맨 위에 올려요. pop은 맨 위 화면을 치우고, 아래 화면이 다시 보여요."
  },
  {
    type: "p",
    text: "이 카드 더미는 브라우저 히스토리이기도 해서, 브라우저의 뒤로 가기 버튼도 pop이 돼요. 자세한 내용은 [Router and Route](router)를 보세요."
  },
  { type: "h", text: "움직임은 미리 적어 둬요" },
  {
    type: "p",
    text: "트랜지션은 짧은 레시피예요. 각 화면이 어디서 시작해서 어디서 끝나는지를 적어 둔 거예요. `Router`가 시작될 때 flemo는 모든 레시피를 CSS 키프레임으로 한 번 바꿔 둬요."
  },
  {
    type: "diagram",
    diagram: "compile",
    caption:
      "직접 정한 트랜지션은 한 번만 CSS로 바뀌어요. 그다음부터는 push, pop할 때마다 브라우저가 알아서 재생해요."
  },
  {
    type: "p",
    text: "브라우저가 CSS를 재생하기 때문에, 화면이 움직이는 동안 프레임마다 JavaScript를 실행할 필요가 없어요. 그래서 페이지가 바쁠 때도 움직임이 부드러워요. 자세한 내용은 [Transitions](transitions)를 보세요."
  },
  { type: "h", text: "push 한 번을 단계별로" },
  {
    type: "p",
    text: "`cupertino` 트랜지션으로 화면을 push하면 이런 일이 일어나요."
  },
  {
    type: "diagram",
    diagram: "push",
    caption:
      "1: 목록이 보여요. 2: flemo가 새 화면을 먼저 렌더링하고, 화면에 그려질 때까지 기다려요. 3: 두 화면이 함께 움직여요. 4: 새 화면이 맨 위에 와요."
  },
  {
    type: "list",
    ordered: true,
    items: [
      "목록 화면이 보이고 있어요.",
      "flemo가 새 화면을 렌더링하고, 한 번 그려질 때까지 기다려요. 그래서 빈 화면이 밀려 들어오는 일이 없어요.",
      "두 화면이 같은 순간에 움직이기 시작해요. 새 화면은 오른쪽에서 밀려 들어오고, 목록은 조금 뒤로 물러나면서 어두워져요. 이렇게 어둡게 하는 것이 [데코레이터](decorator)예요.",
      "새 화면이 스택 맨 위에 와요. 목록은 아래에 그대로 남아서, 뒤로 가면 다시 보여요."
    ]
  },
  {
    type: "p",
    text: "pop은 같은 단계를 거꾸로 밟아요."
  },
  { type: "h", text: "스와이프는 손가락이 움직여요" },
  {
    type: "p",
    text: "왼쪽 가장자리에서 스와이프를 시작하면, flemo는 pop을 준비만 하고 재생하지는 않아요. 대신 손가락이 움직인 거리만큼 pop이 진행돼요. 손가락을 되돌리면 화면도 같이 되돌아와요."
  },
  {
    type: "diagram",
    diagram: "swipe",
    caption:
      "스와이프한 거리만큼 pop이 진행돼요. 충분히 밀고 놓으면 끝까지 뒤로 가고, 일찍 놓으면 제자리로 돌아와요."
  },
  {
    type: "p",
    text: "손을 떼면 flemo는 얼마나 멀리 밀었는지, 얼마나 빠르게 움직이고 있었는지를 봐요. 둘 중 하나라도 충분하면 뒤로 가기가 끝까지 진행되고, 아니면 화면이 원래 자리로 돌아가요. 어느 쪽이든 남은 움직임은 트랜지션에 정해 둔 easing을 따라요."
  },
  { type: "h", text: "두 화면에 있는 같은 것" },
  {
    type: "p",
    text: "목록의 작은 사진이 다음 화면에서 큰 사진이 되는 것처럼, 같은 것이 두 화면에 모두 나올 때가 있어요. 두 화면에서 같은 `layoutId`로 `Morph`를 감싸 주세요."
  },
  {
    type: "diagram",
    diagram: "morph",
    caption: "flemo는 두 화면에서 사진의 위치를 잰 다음, 작은 상자에서 큰 상자로 옮겨요."
  },
  {
    type: "p",
    text: "flemo는 이전 화면에서 사진이 어디 있는지, 새 화면에서는 어디에 놓일지를 재요. 새 화면의 사진은 이전 자리에서 시작해서 자기 자리로 움직이기 때문에, 사진 한 장이 커지는 것처럼 보여요. 자세한 내용은 [Morph](morph)를 보세요."
  },
  { type: "h", text: "그대로 있는 것과 바뀌는 것" },
  {
    type: "p",
    text: "모든 것이 움직일 필요는 없어요. `Slot` 바깥에 있는 것은 그대로 있고 안쪽만 움직여서, 헤더나 사이드바를 고정해 둘 수 있어요. 두 화면이 헤더를 함께 쓸 때는 `Part`로 제목처럼 다른 부분만 바꿀 수 있어요."
  },
  {
    type: "diagram",
    diagram: "slot",
    caption:
      "왼쪽: Slot 바깥의 헤더는 그대로 있고, 안쪽 화면만 움직여요. 오른쪽: 헤더는 그대로 두고 제목만 바뀌어요."
  },
  {
    type: "p",
    text: "자세한 내용은 [Slot](slot)과 [Part](part)를 보세요. 헤더 위에 메뉴를 띄우려면 [Layer](layer)를 쓰세요."
  },
  { type: "h", text: "스택 안의 스택" },
  {
    type: "p",
    text: "화면 안에 `Router`를 하나 더 둘 수 있어요. 안쪽 Router는 자기만의 카드 더미를 갖고 자기 영역 안에서만 움직여서, 탭이나 패널마다 따로 뒤로 갈 수 있어요."
  },
  {
    type: "diagram",
    diagram: "nested",
    caption:
      "패널에는 자기만의 Router가 있어요. 패널 안에서 이동하면 앱 전체가 아니라 패널만 바뀌어요."
  },
  {
    type: "p",
    text: "[Putting it together](composition)에서 이 모든 것을 한 단계씩 써서 앱을 만들어 봐요."
  }
];

const page: LocalizedDocPage = {
  en: {
    slug: "how-it-works",
    title: "How it works",
    summary:
      "How flemo moves screens: a stack of cards, a movement written down once, a swipe your finger drives, and the pieces that stay still.",
    blocks: enBlocks
  },
  ko: {
    slug: "how-it-works",
    title: "How it works",
    summary:
      "flemo가 화면을 움직이는 방식이에요. 카드 더미, 한 번 적어 두는 움직임, 손가락이 움직이는 스와이프, 그리고 그대로 있는 부분까지 차례로 봐요.",
    blocks: koBlocks
  }
};

export default page;
