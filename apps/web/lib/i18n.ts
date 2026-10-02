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
        showcase: "Examples",
        playground: "Live demo",
        docs: "Docs",
        github: "GitHub"
      },
      home: {
        kicker: "Screen transitions for React",
        title: "Make the web move like an app.",
        subtitle:
          "flemo connects screen changes, swipe back, and moving images in one React flow. Try it before you read a line of code.",
        ctaDemo: "Try the apps",
        ctaPrimary: "Start building",
        labKicker: "Live playground",
        labTitle: "A real app. Go ahead, tap.",
        labBody: "Open a card below. Then try the second app.",
        demoLive: "Running in your browser",
        demoModes: [
          {
            title: "Concert tickets",
            subtitle: "A card becomes a screen",
            steps: ["Open a poster", "Go back or swipe", "Switch the bottom tab"]
          },
          {
            title: "Workspace",
            subtitle: "Several moves, one flow",
            steps: ["Open the purple card", "Open filters", "Open the floating panel"]
          }
        ],
        labFootnote: "Both apps run on @flemo/react. Tap around to explore.",
        featuresKicker: "What you just felt",
        featuresTitle: "The little details make it feel real.",
        features: [
          {
            title: "The picture goes with you.",
            body: "Open a card and its artwork follows into the next screen."
          },
          {
            title: "Back follows your hand.",
            body: "Drag from the edge. The screen moves as far as you do."
          },
          {
            title: "The app stays in place.",
            body: "Switch tabs while the bottom bar stays where it belongs."
          }
        ],
        compareCta: "Compare transition styles",
        buildKicker: "Build it",
        buildTitle: "Two screens are enough to start.",
        buildBody:
          "Install flemo, add your screens, then move between them. The quick start walks you through it.",
        buildCta: "Open the quick start",
        installLabel: "Install",
        showcaseKicker: "Used in a real app",
        showcaseTitle: "Made for more than demos.",
        showcaseBody: "shiflo uses flemo to move between schedules and details on iOS and Android.",
        showcaseCta: "See the app",
        footerPlayground: "Explore all demos"
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
      title: "Same app. Nine ways to move.",
      subtitle:
        "Open a poster, go back, and try another style. The app stays the same; only the movement changes.",
      bench: {
        label: "Choose a movement",
        note: "Open a poster to feel the selected style.",
        more: "See all styles",
        next: "Try the workspace app",
        styles: {
          zoom: "The card grows into a screen",
          cupertino: "The next screen slides in",
          material: "A soft, quick lift",
          layout: "The layout shifts with you",
          none: "Switch instantly",
          reveal: "The new screen is revealed",
          drift: "Move through depth",
          sheet: "Rise from the bottom",
          tether: "Follow the swipe"
        }
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
      kicker: "In the wild",
      title: "A real app, moving every day.",
      subtitle:
        "See how flemo feels beyond the demo. shiflo uses it in an app people use for work and life.",
      flemoUsageLabel: "Where flemo fits",
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
          description: "Plan shifts and personal time in one place.",
          flemoUsage:
            "Cards open into details, screens return with a swipe, and the app keeps its place on iOS and Android."
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
        showcase: "사례",
        playground: "라이브 데모",
        docs: "문서",
        github: "GitHub"
      },
      home: {
        kicker: "React 화면 전환 라이브러리",
        title: "웹도 앱처럼 움직이게.",
        subtitle:
          "flemo는 React 화면 이동과 뒤로 밀기, 카드가 이어지는 움직임을 한곳에서 다룹니다. 먼저 아래 앱을 눌러보세요.",
        ctaDemo: "앱 직접 눌러보기",
        ctaPrimary: "만들기 시작하기",
        labKicker: "실시간 체험",
        labTitle: "진짜 앱을 눌러보세요.",
        labBody: "아래 카드를 열어보세요. 다른 앱도 골라볼 수 있습니다.",
        demoLive: "브라우저에서 실행 중",
        demoModes: [
          {
            title: "공연 예매",
            subtitle: "카드가 화면으로 이어져요",
            steps: ["포스터 열기", "뒤로 가거나 밀기", "하단 탭 바꾸기"]
          },
          {
            title: "작업 공간",
            subtitle: "여러 움직임이 함께해요",
            steps: ["보라색 카드 열기", "필터 열기", "떠 있는 패널 열기"]
          }
        ],
        labFootnote: "두 앱 모두 @flemo/react로 움직입니다.",
        featuresKicker: "방금 느낀 차이",
        featuresTitle: "작은 움직임이 앱의 느낌을 만듭니다.",
        features: [
          {
            title: "사진이 함께 넘어갑니다.",
            body: "카드를 열면 사진이 사라졌다 나타나는 대신 다음 화면까지 이어집니다."
          },
          {
            title: "뒤로 가기가 손을 따라옵니다.",
            body: "화면 가장자리를 밀면 민 만큼 움직이고, 놓으면 돌아가거나 넘어갑니다."
          },
          {
            title: "하단 메뉴는 제자리에 남습니다.",
            body: "탭을 바꿔도 화면의 바탕은 이어지고 내용만 바뀝니다."
          }
        ],
        compareCta: "다른 전환 방식도 비교하기",
        buildKicker: "직접 만들기",
        buildTitle: "화면 두 개부터 시작하면 됩니다.",
        buildBody:
          "flemo를 설치하고 화면을 연결하세요. 시작 문서에서 순서대로 따라 할 수 있습니다.",
        buildCta: "시작 문서 열기",
        installLabel: "설치",
        showcaseKicker: "실제 앱에서도",
        showcaseTitle: "데모에서 끝나지 않습니다.",
        showcaseBody: "시플로는 iOS와 Android에서 일정과 상세 화면을 넘길 때 flemo를 사용합니다.",
        showcaseCta: "앱 사례 보기",
        footerPlayground: "전체 데모 보기"
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
      title: "같은 앱, 아홉 가지 움직임.",
      subtitle:
        "포스터를 열고 돌아온 뒤 다른 방식을 골라보세요. 화면은 그대로이고 움직임만 달라집니다.",
      bench: {
        label: "움직임 고르기",
        note: "포스터를 열면 선택한 움직임을 볼 수 있어요.",
        more: "모든 방식 보기",
        next: "작업 공간 앱도 체험하기",
        styles: {
          zoom: "카드가 화면으로 커져요",
          cupertino: "다음 화면이 옆에서 와요",
          material: "가볍게 떠올라요",
          layout: "화면 구조가 함께 움직여요",
          none: "즉시 바뀌어요",
          reveal: "새 화면이 드러나요",
          drift: "깊이감 있게 이동해요",
          sheet: "아래에서 올라와요",
          tether: "손가락을 따라와요"
        }
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
      kicker: "실제 서비스",
      title: "매일 쓰는 앱에서도 자연스럽게.",
      subtitle:
        "flemo는 데모 안에서만 움직이지 않습니다. 시플로가 일과 일상을 잇는 화면에 사용하고 있어요.",
      flemoUsageLabel: "flemo가 하는 일",
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
          description: "교대 근무와 개인 일정을 한곳에서 계획하는 앱이에요.",
          flemoUsage:
            "카드를 열어 상세 화면으로 이동하고, 화면을 밀어 돌아옵니다. iOS와 Android에서 같은 흐름을 사용합니다."
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
