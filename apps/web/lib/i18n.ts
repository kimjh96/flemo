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
      kicker: "Playground",
      title: "Every transition, on glass",
      subtitle:
        "The built-in presets, two more written the way a consumer writes them, and a shared element you can switch on over any of them. Nothing in the fixtures is told which transition is running.",
      footer:
        "Judge on a production build, with devtools closed. Arm ?flemo:morph=on to record every flight decision on globalThis.flemoMorphTrace.",
      bench: {
        title: "Every transition, one pair of screens",
        question:
          "The four built-in presets and two written the way a consumer writes them, with the shared element on its own switch. A morph and a screen transition are separate systems that compose, so either one can be looked at with the other turned off.",
        builtIn: "built-in",
        authored: "authored here",
        element: "shared element",
        screenLabel: "screen",
        elementLabel: "element",
        caption: "Tap a card, then swipe or tap back."
      },
      chain: {
        title: "Five transitions, one stack",
        question:
          "Whether a flight leaves anything behind for the next transition to trip on, and whether five pops unwind five different transitions in the right order.",
        caption: "Walk it down, then pop it back. It runs nested inside a screen.",
        root: "root"
      },
      transitions: {
        cupertino: "Slides in from the right, over a screen that recedes under a dim.",
        material: "Rises from below and fades in.",
        layout: "One screen fades at a time. Nothing moves, so a shared element is the whole show.",
        none: "An instant cut, so whatever still moves is not the screen transition.",
        fade: "The arrival fades in over a screen that holds perfectly still.",
        sheet: "The screen behind scales up and blurs while the element opens over it."
      },
      morphs: {
        off: "No shared element, so the screen transition is the only thing running.",
        shared: "The card, its artwork and its title each cross on their own.",
        zoom: "Container transform: the grid itself zooms into the tapped card."
      },
      gallery: {
        title: "Gallery",
        hintShared: "Tap a card. The card, its artwork and its title each cross on their own.",
        hintPlain:
          "Tap a card. No shared element this time, so the screen transition is on its own."
      },
      piece: {
        body: "The card you tapped, its artwork and its title are the same three elements as the ones on the list. flemo measured where each was the instant the navigation started and moved them here, above both screens."
      },
      chainSteps: {
        start: "the bottom of the stack",
        a: "cupertino, straight from the presets",
        b: "a zoom morph: the card opens into the screen and the grid zooms with it",
        c: "material, rising from below",
        d: "fade, written here rather than shipped",
        e: "layout plus a shared morph, so the element arrives in place"
      },
      chainScreen: {
        step: "step",
        next: "Screen",
        rootTitle: "Start screen",
        end: "End of the chain. Pop back out and every transition runs in reverse, in order.",
        bottom: "the bottom of the stack"
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
      kicker: "플레이그라운드",
      title: "모든 전환을 화면에서",
      subtitle:
        "내장 프리셋과, 소비자가 쓰는 방식 그대로 작성한 전환 두 개, 그리고 그 위에 켜고 끌 수 있는 공유 요소입니다. 픽스처의 화면들은 지금 어떤 전환이 도는지 모릅니다.",
      footer:
        "프로덕션 빌드에서, 개발자 도구를 닫고 판정하세요. ?flemo:morph=on 을 붙이면 모든 비행 결정이 globalThis.flemoMorphTrace 에 남습니다.",
      bench: {
        title: "전환 전부, 같은 화면 한 쌍",
        question:
          "내장 프리셋 네 개와 소비자가 쓰는 방식으로 작성한 두 개, 그리고 따로 켜고 끄는 공유 요소입니다. 모프와 화면 전환은 서로 독립된 시스템이라, 한쪽을 끈 채로 다른 쪽만 볼 수 있어야 합니다.",
        builtIn: "내장",
        authored: "직접 작성",
        element: "공유 요소",
        screenLabel: "화면",
        elementLabel: "요소",
        caption: "카드를 누른 뒤 스와이프하거나 뒤로 눌러보세요."
      },
      chain: {
        title: "전환 다섯 개, 한 스택",
        question:
          "비행이 다음 전환이 걸려 넘어질 무언가를 남기는지, 그리고 다섯 번의 pop이 서로 다른 다섯 전환을 순서대로 풀어내는지 봅니다.",
        caption: "끝까지 내려갔다가 되돌아 나와보세요. 중첩된 화면 안에서 돕니다.",
        root: "루트"
      },
      transitions: {
        cupertino: "오른쪽에서 밀려 들어오고, 덮이는 화면은 딤 아래로 물러납니다.",
        material: "아래에서 올라오면서 나타납니다.",
        layout: "한 번에 한 화면만 페이드합니다. 움직이는 게 없으니 공유 요소가 전부입니다.",
        none: "즉시 전환이라, 그래도 움직이는 게 있다면 그건 화면 전환이 아닙니다.",
        fade: "도착 화면이 가만히 있는 화면 위로 나타납니다.",
        sheet: "요소가 화면을 덮는 동안 뒤 화면이 커지면서 흐려집니다."
      },
      morphs: {
        off: "공유 요소 없이 화면 전환만 돕니다.",
        shared: "카드와 그 안의 이미지, 제목이 각각 건너갑니다.",
        zoom: "컨테이너 트랜스폼입니다. 누른 카드를 향해 그리드 전체가 확대됩니다."
      },
      gallery: {
        title: "갤러리",
        hintShared: "카드를 눌러보세요. 카드와 이미지, 제목이 각각 건너갑니다.",
        hintPlain: "카드를 눌러보세요. 이번엔 공유 요소 없이 화면 전환만 돕니다."
      },
      piece: {
        body: "지금 누른 카드와 그 이미지, 제목은 목록에 있던 바로 그 세 요소입니다. flemo가 내비게이션이 시작된 순간 각각의 위치를 재서, 두 화면 위로 옮겨온 것입니다."
      },
      chainSteps: {
        start: "스택의 바닥",
        a: "프리셋 그대로의 cupertino",
        b: "zoom 모프입니다. 카드가 화면으로 열리면서 그리드도 같이 확대됩니다",
        c: "아래에서 올라오는 material",
        d: "flemo가 아니라 여기서 직접 작성한 fade",
        e: "layout에 shared 모프를 얹어, 요소가 제자리로 도착합니다"
      },
      chainScreen: {
        step: "단계",
        next: "화면",
        rootTitle: "시작 화면",
        end: "체인의 끝입니다. 되돌아 나오면 모든 전환이 순서대로 역재생됩니다.",
        bottom: "스택의 바닥"
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
