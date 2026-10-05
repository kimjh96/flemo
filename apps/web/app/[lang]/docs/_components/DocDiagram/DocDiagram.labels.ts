// The words drawn inside the How it works diagrams. The explanation itself
// lives in the page's typed blocks (and so in llms-full.txt); these are only
// the short tags on the pictures.
const labels = {
  en: {
    stack: { stack: "The stack", push: "push", pop: "pop", top: "on top" },
    compile: {
      recipe: "Your transition",
      css: "CSS keyframes",
      browser: "The browser plays it",
      once: "written once",
      every: "every push and pop"
    },
    push: ["Before", "Ready", "Moving", "Done"],
    pushNotes: [
      "the list is on screen",
      "the new screen is drawn first",
      "both move together",
      "the new screen is on top"
    ],
    swipe: {
      finger: "your finger",
      progress: "how far you swiped",
      goBack: "let go far enough: go back",
      stay: "let go early: slide back"
    },
    morph: { from: "here", to: "there", measure: "measured on both screens" },
    slot: {
      stays: "stays still",
      moves: "moves",
      title1: "Inbox",
      title2: "Message",
      part: "only the title changes"
    },
    nested: { outer: "app Router", inner: "panel Router", own: "its own stack" }
  },
  ko: {
    stack: { stack: "스택", push: "push", pop: "pop", top: "맨 위" },
    compile: {
      recipe: "직접 정한 트랜지션",
      css: "CSS 키프레임",
      browser: "브라우저가 재생",
      once: "한 번만 변환",
      every: "push, pop할 때마다"
    },
    push: ["처음", "준비", "이동", "끝"],
    pushNotes: [
      "목록 화면",
      "새 화면을 먼저 그려 둬요",
      "두 화면이 함께 움직여요",
      "새 화면이 맨 위에"
    ],
    swipe: {
      finger: "손가락",
      progress: "스와이프한 거리",
      goBack: "충분히 밀고 놓으면 뒤로 가기",
      stay: "일찍 놓으면 제자리로"
    },
    morph: { from: "여기서", to: "저기로", measure: "두 화면에서 위치를 재요" },
    slot: {
      stays: "그대로",
      moves: "움직여요",
      title1: "Inbox",
      title2: "Message",
      part: "제목만 바뀌어요"
    },
    nested: { outer: "앱 Router", inner: "패널 Router", own: "자체 스택" }
  }
};

export type DiagramLabels = (typeof labels)["en"];

export const diagramLabels = (lang: string): DiagramLabels =>
  lang === "ko" ? labels.ko : labels.en;
