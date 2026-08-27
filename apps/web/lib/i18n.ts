// The app's locale config. The default language is served without a URL prefix;
// every other language keeps its `/lang` prefix (see proxy.ts). Consumed by the
// locale middleware, the locale-aware history driver, and generateStaticParams.
export interface I18nConfig {
  defaultLanguage: string;
  languages: string[];
}

export const i18n: I18nConfig = {
  defaultLanguage: "en",
  languages: ["en", "ko"]
};

// Display names for the language switcher.
export const localeNames: Record<string, string> = {
  en: "English",
  ko: "한국어"
};

export const dict = {
  en: {
    nav: {
      docs: "Docs",
      github: "GitHub"
    },
    footer: {
      built: "MIT · © kimjh96"
    },
    app: {
      nav: {
        home: "Home",
        showcase: "Showcase",
        playground: "Playground",
        docs: "Docs",
        github: "GitHub"
      },
      home: {
        kicker: "Native-like, on the web",
        title: "A router for native-like screen transitions",
        subtitle:
          "Push, pop, the swipe-back gesture, and shared bars. All the motion of a native app, on the web.",
        ctaPrimary: "Get started",
        demoCaption: "An interactive flemo demo. Tap around."
      },
      wallet: {
        tab: { home: "Home", activity: "Activity" },
        balanceLabel: "Total balance",
        actions: { send: "Send", request: "Request", topup: "Top up" },
        recent: "Recent",
        day: { today: "Today", yesterday: "Yesterday" },
        detail: { status: "Completed", spent: "Paid", received: "Received" },
        sheet: {
          title: "Send money",
          amountLabel: "Amount",
          toLabel: "To",
          toValue: "Jamie Park",
          confirm: "Send"
        }
      }
    },
    notFound: {
      title: "Page not found",
      body: "The page you're looking for doesn't exist or has moved.",
      cta: "Back to home"
    },
    error: {
      title: "Something went wrong",
      body: "An unexpected error occurred while rendering this page.",
      cta: "Try again",
      home: "Back to home"
    },
    playground: {
      layer: {
        title: "Overlays",
        intro:
          "A sheet opened from a screen has to reach the floor and cover the tab bar, and it has to travel with its own screen when that screen moves.",
        open: "Open sheet",
        shut: "Close sheet",
        hosted: "Leaves the screen",
        inline: "Stays in the screen",
        hostedHint:
          "The sheet is hosted outside its screen. Toggle this to write it inline instead — the only difference between the two runs.",
        step: "Next section",
        out: "Open full screen",
        solo: "Without nesting",
        back: "Back",
        close: "Close",
        away: "Full screen",
        sectionA: "Floor seats",
        sectionB: "Balcony",
        soloTitle: "One screen",
        seats: "Seats",
        confirm: "Confirm seats"
      },
      title: "Press it yourself",
      subtitle:
        "A small ticket app, running the real library. Pick a transition and a shared element, then drive it — tap through, swipe back, switch tabs. Nothing in the app is told which transition is running.",
      cases: {
        transitions: "Transitions",
        transitionsBody:
          "Six transitions on the same pair of screens, with the shared element on its own switch. A transition and a shared element are separate systems that compose, so either one can be watched with the other turned off.",
        stack: "A stack",
        stackBody:
          "Buying a ticket, five screens deep, with a different transition on every step. One flight should leave nothing behind for the next one to trip on, and five taps back should unwind five transitions in the order they ran.",
        overlays: "Overlays"
      },
      bench: {
        screen: "screen",
        element: "shared element",
        builtIn: "built in",
        authored: "written here"
      },
      scopes: {
        app: "app",
        tab: "tab",
        flow: "flow"
      },
      transitions: {
        cupertino:
          "Slides in from the right while the screen behind it recedes under a dim. The one with the swipe-back gesture.",
        material: "Rises from below and fades in.",
        layout:
          "One screen fades at a time. Nothing travels, so a shared element is the whole show.",
        none: "An instant cut. Whatever still moves is not the screen transition.",
        fade: "Written here, not shipped. The arrival settles in over a screen that holds perfectly still.",
        sheet:
          "Written here too. The screen behind pulls back and blurs while the poster opens over it."
      },
      morphs: {
        off: "No shared element, so the screen transition is the only thing running.",
        shared: "The card, its poster and the artist's name each cross on their own.",
        zoom: "The list itself zooms into the row you tapped."
      },
      app: {
        home: "Tonight",
        tickets: "Tickets",
        tonight: "Tonight",
        filter: "Filter",
        filterTitle: "Filter",
        filterBody:
          "This panel is a step, not a screen. It belongs to the screen you are on, so back closes it and the stack count under the frame never moves.",
        close: "Close",
        stage: "Stage",
        ticketHeld: "Held",
        ticketsNote:
          "The other tab. It holds no stack of its own, and the tab bar does not care: same shared bar, so it stays exactly where it is while the content behind it changes."
      },
      acts: {
        hintShared:
          "Tap a row. The card, its poster and the artist's name each cross on their own.",
        hintPlain: "Tap a row. No shared element this time, so the screen transition is on its own."
      },
      act: {
        body: "Doors an hour before. The poster and the name above it are the same two elements that were in the list a moment ago — flemo measured where each one sat when you tapped, and moved them here.",
        seatmap: "Choose seats",
        seatmapNote: "Opens over the tab bar, one level up.",
        seatmapBody:
          "This screen was pushed onto the app's own stack rather than this tab's. The tab bar is not hidden for it — it belongs to the level below, and that whole region left with its own transition while this one arrived with its own. The readout under the frame shows it from the other side."
      },
      booking: {
        steps: {
          tonight: "Tonight",
          event: "Event",
          seats: "Seats",
          extras: "Extras",
          review: "Review",
          done: "Done"
        },
        next: {
          event: "See the event",
          seats: "Pick seats",
          extras: "Add extras",
          review: "Review order",
          done: "Confirm"
        },
        body: {
          tonight:
            "The bottom of the stack. Every step above this one arrives with a different transition, so this is where the flow starts and where five taps back should return you.",
          event:
            "Arrived by cupertino, carrying the poster with it. Try the swipe-back gesture from the left edge here.",
          seats:
            "Arrived by sheet: the screen behind pulled back and blurred while this one opened over it.",
          extras:
            "Arrived by material, rising from below. The step before it ran a shared element and this one does not — if a flight left anything behind, this is the step it shows up on.",
          review:
            "Arrived by fade. Nothing travelled, so anything you saw move was the content settling, not the screen.",
          done: "Arrived by layout with the poster zooming into place. End of the flow."
        },
        end: "Now tap back five times and watch them unwind in order."
      }
    },
    showcase: {
      kicker: "Showcase",
      title: "Built with flemo",
      subtitle: "Real apps shipping flemo in production.",
      flemoUsageLabel: "How it uses flemo",
      languagesLabel: "Languages",
      languageNames: { ko: "Korean" },
      appStore: "App Store",
      playStore: "Google Play",
      apps: {
        shiflo: {
          name: "shiflo",
          tagline: "Work and schedule, in one place",
          description:
            "A scheduling app that helps shift workers keep their work rotations and personal plans in one place: a month grid, a week timeline, a list view, work-pattern templates, home-screen widgets, and a full dark theme.",
          flemoUsage:
            "shiflo is a React Native app, but its entire UI is a web app running inside a WebView. flemo drives all of its screen navigation (pushes and pops, the swipe-back gesture, and the transitions between screens), so the web UI inside the native shell moves like a native app on both iOS and Android, from a single web codebase."
        }
      }
    }
  },
  ko: {
    nav: {
      docs: "문서",
      github: "GitHub"
    },
    footer: {
      built: "MIT · © kimjh96"
    },
    app: {
      nav: {
        home: "홈",
        showcase: "쇼케이스",
        playground: "플레이그라운드",
        docs: "문서",
        github: "GitHub"
      },
      home: {
        kicker: "웹에서, 네이티브처럼",
        title: "네이티브 같은 화면 전환을 위한 라우터",
        subtitle:
          "push와 pop, 스와이프 뒤로 가기, 화면 사이를 잇는 공유 바까지. 네이티브 앱 같은 움직임을 웹에서 그대로 만들어요.",
        ctaPrimary: "시작하기",
        demoCaption: "직접 만져보는 flemo 데모. 눌러보세요."
      },
      wallet: {
        tab: { home: "홈", activity: "내역" },
        balanceLabel: "총 잔액",
        actions: { send: "보내기", request: "받기", topup: "충전" },
        recent: "최근 거래",
        day: { today: "오늘", yesterday: "어제" },
        detail: { status: "완료", spent: "결제", received: "받음" },
        sheet: {
          title: "보내기",
          amountLabel: "금액",
          toLabel: "받는 사람",
          toValue: "박지민",
          confirm: "보내기"
        }
      }
    },
    notFound: {
      title: "찾는 페이지가 없어요",
      body: "주소가 바뀌었거나, 존재하지 않는 페이지예요.",
      cta: "홈으로 돌아가기"
    },
    error: {
      title: "문제가 발생했어요",
      body: "페이지를 그리는 중에 예상치 못한 오류가 생겼어요.",
      cta: "다시 시도",
      home: "홈으로 돌아가기"
    },
    playground: {
      layer: {
        title: "오버레이",
        intro:
          "화면에서 연 시트는 바닥까지 닿아 탭바를 덮어야 하고, 그 화면이 움직이면 함께 따라가야 합니다.",
        open: "시트 열기",
        shut: "시트 닫기",
        hosted: "화면 밖으로",
        inline: "화면 안에",
        hostedHint:
          "지금은 시트가 자기 화면 바깥에 놓여 있어요. 이걸 바꾸면 화면 안에 그대로 쓰는 방식이 되고, 두 실행의 차이는 그것 하나뿐입니다.",
        step: "다음 구역",
        out: "전체 화면으로 열기",
        solo: "중첩 없이",
        back: "뒤로",
        close: "닫기",
        away: "전체 화면",
        sectionA: "플로어석",
        sectionB: "발코니석",
        soloTitle: "단일 화면",
        seats: "좌석",
        confirm: "좌석 확정"
      },
      title: "직접 눌러보세요",
      subtitle:
        "실제 라이브러리로 돌아가는 작은 티켓 앱이에요. 전환과 공유 요소를 고르고 직접 만져보세요. 눌러서 들어가고, 스와이프로 돌아 나오고, 탭을 바꿔보세요. 앱 안의 화면들은 지금 어떤 전환이 도는지 모릅니다.",
      cases: {
        transitions: "전환",
        transitionsBody:
          "같은 화면 한 쌍 위에서 전환 여섯 개를, 공유 요소는 따로 켜고 끄면서 봅니다. 전환과 공유 요소는 서로 독립된 시스템이라, 한쪽을 끈 채로 다른 쪽만 볼 수 있어야 해요.",
        stack: "스택",
        stackBody:
          "티켓 한 장을 사는 다섯 화면이고, 단계마다 전환이 다릅니다. 앞선 전환이 다음 전환에 걸릴 무언가를 남기지 않아야 하고, 뒤로 다섯 번이면 다섯 전환이 돌아간 순서대로 풀려야 해요.",
        overlays: "오버레이"
      },
      bench: {
        screen: "화면",
        element: "공유 요소",
        builtIn: "내장",
        authored: "직접 작성"
      },
      scopes: {
        app: "앱",
        tab: "탭",
        flow: "흐름"
      },
      transitions: {
        cupertino:
          "오른쪽에서 밀려 들어오고, 덮이는 화면은 딤 아래로 물러납니다. 스와이프로 뒤로 가는 그 전환이에요.",
        material: "아래에서 올라오면서 나타납니다.",
        layout: "한 번에 한 화면만 페이드해요. 움직이는 게 없으니 공유 요소가 전부입니다.",
        none: "즉시 전환이에요. 그런데도 움직이는 게 있다면 그건 화면 전환이 아닙니다.",
        fade: "직접 작성한 전환이에요. 가만히 있는 화면 위로 도착 화면이 자리를 잡습니다.",
        sheet: "이것도 직접 작성했어요. 포스터가 화면을 덮는 동안 뒤 화면이 물러나며 흐려집니다."
      },
      morphs: {
        off: "공유 요소 없이 화면 전환만 돕니다.",
        shared: "카드와 포스터, 아티스트 이름이 각각 건너갑니다.",
        zoom: "누른 줄을 향해 목록 전체가 확대됩니다."
      },
      app: {
        home: "투나잇",
        tickets: "내 티켓",
        tonight: "투나잇",
        filter: "필터",
        filterTitle: "필터",
        filterBody:
          "이 패널은 화면이 아니라 스텝이에요. 지금 화면에 딸린 상태라 뒤로가기로 그대로 닫히고, 프레임 아래 스택 숫자는 변하지 않습니다.",
        close: "닫기",
        stage: "무대",
        ticketHeld: "예매됨",
        ticketsNote:
          "다른 탭이에요. 여기엔 자체 스택이 없지만 탭바는 상관하지 않습니다. 같은 공유 바라서, 뒤 내용만 바뀌고 탭바는 그 자리에 그대로 있어요."
      },
      acts: {
        hintShared: "줄을 하나 눌러보세요. 카드와 포스터, 아티스트 이름이 각각 건너갑니다.",
        hintPlain: "줄을 하나 눌러보세요. 이번엔 공유 요소 없이 화면 전환만 돕니다."
      },
      act: {
        body: "공연 한 시간 전 입장이에요. 포스터와 그 위의 이름은 조금 전 목록에 있던 바로 그 두 요소입니다. 누른 순간 각각이 어디에 있었는지 flemo가 재서 여기로 옮겨온 거예요.",
        seatmap: "좌석 고르기",
        seatmapNote: "탭바 위로, 한 단계 위에서 열립니다.",
        seatmapBody:
          "이 화면은 이 탭이 아니라 앱 자체의 스택으로 push된 거예요. 탭바를 숨긴 게 아니라, 탭바는 아래 단계에 속해 있고 그 영역 전체가 자기 전환으로 물러난 겁니다. 프레임 아래 readout이 같은 사실을 반대편에서 보여줘요."
      },
      booking: {
        steps: {
          tonight: "투나잇",
          event: "공연",
          seats: "좌석",
          extras: "추가",
          review: "확인",
          done: "완료"
        },
        next: {
          event: "공연 보기",
          seats: "좌석 고르기",
          extras: "추가 선택",
          review: "주문 확인",
          done: "결제하기"
        },
        body: {
          tonight:
            "스택의 바닥이에요. 이 위의 모든 단계는 서로 다른 전환으로 도착합니다. 여기서 흐름이 시작되고, 뒤로 다섯 번이면 여기로 돌아와야 해요.",
          event:
            "cupertino로 도착했고, 포스터를 함께 데려왔어요. 여기서 왼쪽 가장자리 스와이프도 해보세요.",
          seats: "sheet로 도착했어요. 이 화면이 위로 열리는 동안 뒤 화면이 물러나며 흐려졌습니다.",
          extras:
            "아래에서 올라오는 material로 도착했어요. 바로 앞 단계는 공유 요소가 돌았고 이 단계는 아니라서, 앞선 전환이 뭔가를 남겼다면 여기서 드러납니다.",
          review:
            "fade로 도착했어요. 움직인 화면이 없으니, 움직이는 게 보였다면 그건 화면이 아니라 내용이 자리를 잡는 것이었어요.",
          done: "layout으로 도착하면서 포스터가 제자리로 확대됐어요. 흐름의 끝입니다."
        },
        end: "이제 뒤로 다섯 번 눌러서 순서대로 풀리는지 보세요."
      }
    },
    showcase: {
      kicker: "쇼케이스",
      title: "flemo로 만든 앱",
      subtitle: "flemo로 만들어 실제로 서비스하고 있는 앱들이에요.",
      flemoUsageLabel: "flemo를 어떻게 사용하나요",
      languagesLabel: "지원 언어",
      languageNames: { ko: "한국어" },
      appStore: "App Store",
      playStore: "Google Play",
      apps: {
        shiflo: {
          name: "시플로",
          tagline: "근무와 일정을 한 번에",
          description:
            "교대 근무자가 근무 일정과 개인 일정을 한 곳에서 관리하도록 돕는 일정 앱이에요. 월 단위 달력, 주 단위 타임라인, 목록 보기, 근무 패턴 템플릿, 홈 화면 위젯, 그리고 완전한 다크 테마까지.",
          flemoUsage:
            "shiflo는 React Native 앱이지만, UI 전체가 WebView 안에서 도는 웹 앱이에요. 화면 간 이동은 전부 flemo가 담당해요. push와 pop, 스와이프 뒤로 가기, 화면 사이의 전환까지요. 그래서 네이티브 셸 안의 웹 UI가 하나의 웹 코드베이스로 iOS·Android 양쪽에서 네이티브 앱처럼 움직여요."
        }
      }
    }
  }
} as const;

export type Lang = keyof typeof dict;

export type ShowcaseAppId = keyof typeof dict.en.showcase.apps;

export type ShowcaseLanguageCode = keyof typeof dict.en.showcase.languageNames;

export function getDict(lang: string): (typeof dict)[Lang] {
  return (dict as Record<string, (typeof dict)[Lang]>)[lang] ?? dict.en;
}
