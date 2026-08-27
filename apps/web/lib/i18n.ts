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
      title: "Press it yourself",
      subtitle:
        "A small ticket app running the real library. One shared element, one tab bar, and whichever transition you pick carrying the push. Nothing in the app is told which one it is.",
      bench: {
        label: "screen transition",
        note: "Tap a row to open it, then come back. The artwork is the same square on both sides, so it grows into place. The tab bar holds still between the two tabs and rides away on the push, because the detail declares none."
      },
      app: {
        title: "Tonight",
        subtitle: "Live near you",
        tabTonight: "Tonight",
        tabTickets: "Tickets",
        ticketsNote: "Held for you",
        held: "Held",
        detail: "Event",
        back: "Back",
        body: "Doors an hour before. The artwork above is the same element that was in the list a moment ago — flemo measured where it sat when you tapped, and moved it here."
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
      title: "직접 눌러보세요",
      subtitle:
        "실제 라이브러리로 도는 작은 티켓 앱이에요. 공유 요소 하나, 탭바 하나, 그리고 고른 전환이 push를 나릅니다. 앱 안의 어떤 화면도 지금 무엇이 도는지 모릅니다.",
      bench: {
        label: "화면 전환",
        note: "줄을 눌러 열고 다시 돌아와 보세요. 이미지는 양쪽 다 같은 정사각형이라 그대로 자라납니다. 탭바는 두 탭 사이에선 가만히 있다가, 상세로 밀 때는 함께 빠집니다 — 상세가 바를 선언하지 않기 때문입니다."
      },
      app: {
        title: "투나잇",
        subtitle: "가까운 곳의 공연",
        tabTonight: "투나잇",
        tabTickets: "내 티켓",
        ticketsNote: "예매해 둔 공연",
        held: "예매됨",
        detail: "공연",
        back: "뒤로",
        body: "공연 한 시간 전 입장이에요. 위 이미지는 조금 전 목록에 있던 바로 그 요소입니다. 누른 순간 어디에 있었는지 flemo가 재서 여기로 옮겨온 거예요."
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
