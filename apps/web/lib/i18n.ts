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
        kicker: "Screen motion for React",
        title: "Make every screen feel connected.",
        subtitle:
          "Open a card, follow it into the next screen, then swipe back. Build that entire flow with one React router.",
        ctaDemo: "Try the live demo",
        ctaPrimary: "Get started",
        heroNote: "A real app running @flemo/react, right here in your browser.",
        demoLabel: "The experience",
        demoLive: "Live demo",
        demoHint: "Tap a poster. On touch screens, drag from the left edge to go back.",
        featuresKicker: "One connected system",
        featuresTitle: "Motion that follows the screen.",
        featuresIntro:
          "Navigation, gestures, and shared elements move together. Each part has a clear job.",
        features: [
          {
            title: "A card becomes a screen",
            body: "Keep the same artwork in view as a card opens into its detail page."
          },
          {
            title: "Back follows your finger",
            body: "Scrub the screen back, cancel the gesture, or finish it naturally."
          },
          {
            title: "The app stays coherent",
            body: "Keep shared bars in place while the screen content and its details change."
          }
        ],
        buildKicker: "Start building",
        buildTitle: "Start with two screens.",
        buildBody:
          "Declare the screens and their paths. Add navigation as your app grows; flemo carries the transition.",
        buildCta: "Read the quick start",
        exploreKicker: "Go deeper",
        exploreTitle: "See the pieces work together.",
        exploreBody:
          "Explore a composed app with shared chrome, nested navigation, Morph, Part, and Layer.",
        exploreCta: "Open the composition demo",
        showcaseKicker: "In production",
        showcaseTitle: "Built with flemo.",
        showcaseBody: "See how a real app uses flemo for its screen navigation.",
        showcaseCta: "View the showcase",
        footerPlayground: "Explore every transition"
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
      title: "Feel the difference",
      subtitle:
        "Open a concert, return, then switch the transition. The same app reveals how each motion feels.",
      bench: {
        label: "Transition style",
        note: "The screens and artwork stay the same. Only the motion changes."
      },
      app: {
        title: "Tonight",
        subtitle: "Live near you",
        tabTonight: "Tonight",
        tabPosters: "Posters",
        postersNote: "Everything on sale",
        tabTickets: "Tickets",
        ticketsNote: "Held for you",
        held: "Held",
        order: "Order",
        past: "Past",
        used: "Used",
        detail: "Event",
        back: "Back",
        body: "A short set of new material, played once and not recorded. Standing room only, and the room is small enough that the back row is six metres from the stage.",
        doors: "Doors",
        venue: "Venue",
        age: "Age",
        ageValue: "18+",
        getTickets: "Get tickets"
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
      submit: {
        title: "Shipping with flemo?",
        body: "Tell us about your app and it can sit right here.",
        cta: "Add your app"
      },
      apps: {
        shiflo: {
          name: "shiflo",
          tagline: "Work and schedule, in one place",
          description: "A scheduling app that brings shift work and personal plans together.",
          flemoUsage:
            "flemo runs the screen stack inside shiflo's WebView, including push, pop, and swipe-back transitions on iOS and Android."
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
        kicker: "React를 위한 화면 전환",
        title: "화면이 바뀌어도 흐름은 이어지게.",
        subtitle:
          "카드를 열면 상세 화면으로 이어지고, 밀어서 돌아가면 움직임이 손가락을 따라옵니다. 이 흐름을 하나의 React 라우터로 만드세요.",
        ctaDemo: "직접 체험하기",
        ctaPrimary: "시작하기",
        heroNote: "브라우저 안에서 실제 @flemo/react로 실행 중인 앱입니다.",
        demoLabel: "직접 체험",
        demoLive: "실행 중",
        demoHint: "포스터를 눌러보세요. 터치 화면에서는 왼쪽 가장자리부터 밀어 돌아갈 수 있습니다.",
        featuresKicker: "하나로 이어지는 움직임",
        featuresTitle: "화면과 동작이 함께 움직입니다.",
        featuresIntro: "이동, 제스처, 공유 요소를 따로 맞출 필요 없이 한 흐름으로 구성합니다.",
        features: [
          {
            title: "카드가 화면으로 이어져요",
            body: "카드를 열어도 같은 이미지가 상세 화면까지 자연스럽게 이어집니다."
          },
          {
            title: "뒤로 가기가 손끝을 따라와요",
            body: "천천히 밀고, 취소하거나, 끝까지 넘기는 동작을 직접 제어할 수 있습니다."
          },
          {
            title: "앱의 구조가 유지돼요",
            body: "공유 바는 제자리에 두고 화면 내용과 세부 요소만 바꿀 수 있습니다."
          }
        ],
        buildKicker: "만들기 시작하기",
        buildTitle: "화면 두 개부터 시작하세요.",
        buildBody: "화면과 경로를 선언하고 이동을 더하세요. 화면 사이의 전환은 flemo가 맡습니다.",
        buildCta: "빠르게 시작하기",
        exploreKicker: "더 깊이 보기",
        exploreTitle: "여러 기능을 한 장면에서.",
        exploreBody: "공유 헤더, 중첩 이동, Morph, Part, Layer가 함께 동작하는 앱을 살펴보세요.",
        exploreCta: "조합 데모 열기",
        showcaseKicker: "실제 서비스",
        showcaseTitle: "flemo로 만든 앱.",
        showcaseBody: "실제 앱에서 flemo가 화면 이동을 어떻게 맡는지 확인해 보세요.",
        showcaseCta: "사례 보기",
        footerPlayground: "모든 전환 살펴보기"
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
      title: "움직임을 직접 느껴보세요",
      subtitle:
        "공연을 열고 돌아온 뒤 전환 방식을 바꿔보세요. 같은 화면이 어떻게 달라지는지 바로 보입니다.",
      bench: {
        label: "화면 전환 방식",
        note: "화면과 이미지는 그대로 두고 움직임만 바꿉니다."
      },
      app: {
        title: "투나잇",
        subtitle: "가까운 곳의 공연",
        tabTonight: "투나잇",
        tabPosters: "포스터",
        postersNote: "판매 중인 공연 전부",
        tabTickets: "내 티켓",
        ticketsNote: "예매해 둔 공연",
        held: "예매됨",
        order: "예매번호",
        past: "지난 공연",
        used: "관람 완료",
        detail: "공연",
        back: "뒤로",
        body: "녹음하지 않고 한 번만 연주하는 짧은 신곡 무대예요. 전석 스탠딩이고, 맨 뒷줄이 무대에서 6미터인 작은 공간입니다.",
        doors: "입장",
        venue: "장소",
        age: "관람등급",
        ageValue: "18세 이상",
        getTickets: "예매하기"
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
      submit: {
        title: "flemo로 만들고 계신가요?",
        body: "앱을 알려 주시면 이 자리에 함께 소개할게요.",
        cta: "앱 등록하기"
      },
      apps: {
        shiflo: {
          name: "시플로",
          tagline: "근무와 일정을 한 번에",
          description: "교대 근무와 개인 일정을 한곳에서 관리하는 앱이에요.",
          flemoUsage:
            "시플로의 WebView 안에서 flemo가 화면 스택을 맡아요. iOS와 Android에서 push, pop, 스와이프 뒤로 가기를 같은 코드로 구현합니다."
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
