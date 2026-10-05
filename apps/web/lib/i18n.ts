// The app's locale config. The default language is served without a URL prefix;
// every other language keeps its `/lang` prefix (see proxy.ts). Consumed by the
// proxy, the locale-aware history driver, and the shell.
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

export const GITHUB_URL = "https://github.com/kimjh96/flemo";
export const NPM_URL = "https://www.npmjs.com/package/@flemo/react";

export const dict = {
  en: {
    app: {
      nav: {
        home: "Home",
        docs: "Docs",
        playground: "Playground",
        showcase: "Showcase",
        github: "GitHub",
        menu: "Menu",
        close: "Close menu",
        search: "Search docs"
      },
      home: {
        eyebrow: "React screen router",
        title: "Screens that move like apps.",
        subtitle:
          "Push, pop, swipe back and shared elements, from one router. Every transition compiles to CSS, and swipe back moves it with your finger.",
        ctaPrimary: "Get started",
        ctaSecondary: "Open playground",
        demoHint: "Tap a show. Swipe from the left edge to go back.",
        demoLabel: "Transition",
        quickstart: {
          eyebrow: "Quick start",
          title: "A native stack in one file.",
          body: "Declare routes, wrap each one in a Screen, and push. The transition you choose handles the rest.",
          points: [
            {
              title: "Router holds the stack",
              body: "History, the registered transitions and the swipe gesture all live in one Router. Nest another Router for a tab or a pane."
            },
            {
              title: "Screen is what moves",
              body: "Each route renders a Screen: the surface that slides, fades, or follows your finger."
            },
            {
              title: "Pick a transition",
              body: "Push with any registered transition. cupertino, material and layout are built in."
            }
          ]
        },
        primitives: {
          eyebrow: "Building blocks",
          title: "Every piece of a native transition.",
          body: "Screens, the headers and tab bars around them, and the elements that move between them. Every demo below is live.",
          transitions: {
            title: "Transitions",
            body: "Use a preset or write your own from variant styles. One definition covers push, pop and swipe back."
          },
          gesture: {
            title: "Swipe back",
            body: "The screen follows your finger. When you let go, the transition finishes on the same easing it uses for a tap.",
            hint: "Open a place, then drag from the edge."
          },
          morph: {
            title: "Morph",
            body: "Give two elements the same layoutId, and the element on the new screen animates from where the old one was."
          },
          part: {
            title: "Part",
            body: "A shared header stays in place while its title and buttons change on each screen."
          },
          nested: {
            title: "Nested routers",
            body: "A tab, a sheet or a pane can own its own stack, with or without the URL."
          },
          layer: {
            title: "Layer",
            body: "Menus and sheets render above every screen and shared header, and animate with the screen transition."
          },
          typed: {
            title: "Typed routes",
            body: "Register your paths once, and TypeScript checks every push and its params."
          }
        },
        engine: {
          eyebrow: "Under the hood",
          title: "Built to be measured.",
          body: "flemo is tuned against screen recordings on real devices, not against a timeline in DevTools.",
          items: [
            {
              stat: "CSS",
              title: "Compiled to CSS",
              body: "Transitions compile to keyframes once, so the browser runs the animation instead of a per-frame script."
            },
            {
              stat: "Synced",
              title: "Shared timing",
              body: "Parts, the dim and Morphs use the screen transition's duration by default, so nothing falls out of step."
            },
            {
              stat: "1:1",
              title: "Follows your finger",
              body: "While you swipe, the screen stays exactly under your finger. When you let go, it finishes from that spot with the same animation a tap plays, so nothing jumps."
            },
            {
              stat: "rec",
              title: "Transition recorder",
              body: "@flemo/devtools records every transition and flags problems while you develop. None of it ships to production."
            }
          ]
        },
        showcase: {
          eyebrow: "In production",
          title: "shiflo runs on flemo.",
          body: "A React Native shift calendar whose whole UI is a web app in a WebView. Every push, pop and swipe back is flemo.",
          cta: "See the showcase"
        },
        cta: {
          title: "Start with one Router.",
          body: "Install the package, read the ten-minute guide, and push your first screen.",
          primary: "Read the docs",
          secondary: "Star on GitHub"
        }
      },
      footer: {
        tagline: "Screens that move like apps.",
        product: "Product",
        resources: "Resources",
        license: "MIT License",
        llms: "llms.txt",
        npm: "npm",
        agentSkill: "Agent skill"
      },
      mini: {
        title: "Places",
        subtitle: "Saved for later",
        back: "Back",
        detailBody:
          "A short walk from the station, best in the hour before sunset when the light comes in low across the water.",
        save: "Save",
        places: {
          kyoto: "Kyoto",
          lisbon: "Lisbon",
          oaxaca: "Oaxaca",
          reykjavik: "Reykjavík"
        },
        countries: {
          kyoto: "Japan",
          lisbon: "Portugal",
          oaxaca: "Mexico",
          reykjavik: "Iceland"
        },
        trip: {
          featured: "This week",
          saved: "Saved",
          filter: "Filter",
          more: "More",
          filters: "Filters",
          filterOptions: ["Coast", "Old town", "Mountains", "Food"],
          menuTitle: "Saved places",
          menuItems: ["Share list", "Sort by distance", "Clear visited"],
          close: "Close"
        }
      },
      readout: {
        idle: "Idle",
        push: "Push",
        pop: "Pop",
        swipe: "Swipe",
        duration: "Duration",
        curve: "Curve"
      }
    },
    docs: {
      title: "Documentation",
      onThisPage: "On this page",
      previous: "Previous",
      next: "Next",
      details: "Details",
      minRead: "min read",
      menu: "Menu",
      search: {
        placeholder: "Search the docs",
        empty: "No results",
        hint: "Navigate",
        open: "Open"
      },
      copyPage: "Copy page",
      copied: "Copied",
      editOnGithub: "Edit on GitHub",
      demo: {
        replay: "Replay",
        tryIt: "Try it"
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
      eyebrow: "Playground",
      title: "Press it yourself",
      subtitle:
        "A small ticket app running the real library. Open an act from the list or the poster grid, go back, and switch the transition used for the push.",
      presets: "Presets",
      authored: "Authored on this page",
      code: "How it is written",
      cases: {
        cupertino: "The iOS push. Drag from the left edge to go back.",
        material: "Rises from below. Drag down to dismiss.",
        layout: "A plain cross-fade.",
        none: "No screen motion. Only the shared artwork moves between screens.",
        reveal: "A clip-path wipe, on a property no preset animates.",
        drift: "Depth, with a decorator that uses the screen transition's timing.",
        sheet: "A modal sheet that opens and closes with different timing.",
        tether: "A custom swipe: opacity finishes early while the screen keeps moving.",
        zoom: "The container transform. The card expands into the page."
      },
      bench: {
        label: "Transition for the push",
        note: "Same screens, same shared artwork. Only the transition changes."
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
      eyebrow: "Showcase",
      title: "Built with flemo",
      subtitle: "Apps shipping flemo in production.",
      flemoUsageLabel: "How it uses flemo",
      languagesLabel: "Languages",
      languageNames: { ko: "Korean" },
      web: "Web",
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
          description:
            "A scheduling app for shift workers: a month grid, a week timeline, work-pattern templates, home-screen widgets and a full dark theme.",
          flemoUsage:
            "shiflo is a React Native app whose entire UI is a web app inside a WebView. flemo drives all of its navigation, so one web codebase moves like a native app on both iOS and Android."
        }
      }
    }
  },
  ko: {
    app: {
      nav: {
        home: "홈",
        docs: "문서",
        playground: "플레이그라운드",
        showcase: "쇼케이스",
        github: "GitHub",
        menu: "메뉴",
        close: "메뉴 닫기",
        search: "문서 검색"
      },
      home: {
        eyebrow: "React screen router",
        title: "웹에서도, 앱처럼 넘어가는 화면.",
        subtitle:
          "push와 pop, 스와이프 뒤로 가기, 공유 요소 전환까지 라우터 하나로 처리해요. 모든 화면 전환은 CSS로 컴파일되고, 스와이프하면 손가락을 따라 움직여요.",
        ctaPrimary: "시작하기",
        ctaSecondary: "플레이그라운드",
        demoHint: "공연을 눌러 보세요. 왼쪽 가장자리에서 스와이프하면 뒤로 가요.",
        demoLabel: "Transition",
        quickstart: {
          eyebrow: "Quick start",
          title: "파일 하나로 만드는 네이티브 스택.",
          body: "경로를 선언하고 각 경로를 Screen으로 감싼 뒤 push하면 돼요. 나머지는 지정한 트랜지션이 처리해요.",
          points: [
            {
              title: "Router가 스택을 관리해요",
              body: "히스토리, 등록한 트랜지션, 스와이프 제스처를 모두 Router 하나가 관리해요. 탭이나 패널에는 Router를 하나 더 중첩하면 돼요."
            },
            {
              title: "Screen이 움직여요",
              body: "각 경로는 Screen을 렌더링해요. 슬라이드하거나 페이드되거나 손가락을 따라 움직이는 게 바로 이 Screen이에요."
            },
            {
              title: "트랜지션을 골라요",
              body: "등록한 트랜지션 이름으로 push해요. cupertino, material, layout은 기본으로 들어 있어요."
            }
          ]
        },
        primitives: {
          eyebrow: "Building blocks",
          title: "네이티브 화면 전환에 필요한 모든 것.",
          body: "화면과 그 위의 헤더, 탭 바, 화면 사이를 오가는 요소까지 갖췄어요. 아래 데모는 모두 실제로 동작해요.",
          transitions: {
            title: "Transitions",
            body: "프리셋을 그대로 쓰거나 variant 값으로 직접 만들 수 있어요. 정의 하나로 push, pop, 스와이프 뒤로 가기를 모두 처리해요."
          },
          gesture: {
            title: "Swipe back",
            body: "화면이 손가락을 따라 움직여요. 손을 떼면 탭했을 때와 같은 easing으로 화면 전환이 끝나요.",
            hint: "장소를 열고 가장자리에서 스와이프해 보세요."
          },
          morph: {
            title: "Morph",
            body: "두 요소에 같은 layoutId를 주면, 새 화면의 요소가 이전 화면의 요소가 있던 자리에서 이어서 움직여요."
          },
          part: {
            title: "Part",
            body: "공유 헤더는 제자리에 있고, 제목과 버튼만 화면마다 바뀌어요."
          },
          nested: {
            title: "Nested routers",
            body: "탭, 시트, 패널마다 별도의 스택을 둘 수 있고, URL과 연결할지도 고를 수 있어요."
          },
          layer: {
            title: "Layer",
            body: "메뉴와 시트를 모든 화면과 공유 헤더 위에 그리고, 화면 전환과 함께 애니메이션해요."
          },
          typed: {
            title: "Typed routes",
            body: "경로를 한 번 등록하면 TypeScript가 모든 push와 params를 검사해요."
          }
        },
        engine: {
          eyebrow: "Under the hood",
          title: "측정하면서 다듬었어요.",
          body: "flemo는 DevTools 타임라인이 아니라 실제 기기에서 녹화한 화면을 기준으로 다듬어요.",
          items: [
            {
              stat: "CSS",
              title: "Compiled to CSS",
              body: "전환은 처음 한 번만 키프레임으로 컴파일돼요. 화면 전환 중에는 프레임마다 스크립트를 돌리지 않고 브라우저가 애니메이션을 처리해요."
            },
            {
              stat: "Synced",
              title: "Shared timing",
              body: "Part, 딤, Morph는 기본으로 화면 전환의 duration을 그대로 써서 타이밍이 어긋나지 않아요."
            },
            {
              stat: "1:1",
              title: "Follows your finger",
              body: "스와이프하는 동안 화면은 손가락 아래에 정확히 붙어 있어요. 손을 떼면 그 자리에서 버튼으로 뒤로 갈 때와 같은 애니메이션으로 이어서 끝나서, 툭 튀는 순간이 없어요."
            },
            {
              stat: "rec",
              title: "Transition recorder",
              body: "@flemo/devtools가 개발 중에 모든 화면 전환을 기록하고 문제를 표시해 줘요. 프로덕션 번들에는 포함되지 않아요."
            }
          ]
        },
        showcase: {
          eyebrow: "In production",
          title: "시플로는 flemo로 움직여요.",
          body: "UI 전체를 WebView 안의 웹 앱으로 만든 React Native 근무 달력 앱이에요. push, pop, 스와이프 뒤로 가기를 모두 flemo로 처리해요.",
          cta: "쇼케이스 보기"
        },
        cta: {
          title: "Router 하나로 시작하세요.",
          body: "패키지를 설치하고 10분짜리 가이드를 읽은 뒤, 첫 화면을 push해 보세요.",
          primary: "문서 읽기",
          secondary: "GitHub에서 보기"
        }
      },
      footer: {
        tagline: "웹에서도, 앱처럼 넘어가는 화면.",
        product: "Product",
        resources: "Resources",
        license: "MIT 라이선스",
        llms: "llms.txt",
        npm: "npm",
        agentSkill: "에이전트 스킬"
      },
      mini: {
        title: "장소",
        subtitle: "나중에 갈 곳",
        back: "뒤로",
        detailBody:
          "역에서 조금만 걸으면 돼요. 해 지기 한 시간 전, 물 위로 빛이 낮게 들어올 때가 가장 좋아요.",
        save: "저장",
        places: {
          kyoto: "교토",
          lisbon: "리스본",
          oaxaca: "오악사카",
          reykjavik: "레이캬비크"
        },
        countries: {
          kyoto: "일본",
          lisbon: "포르투갈",
          oaxaca: "멕시코",
          reykjavik: "아이슬란드"
        },
        trip: {
          featured: "이번 주 추천",
          saved: "저장함",
          filter: "필터",
          more: "더 보기",
          filters: "필터",
          filterOptions: ["바다", "구시가지", "산", "음식"],
          menuTitle: "저장한 장소",
          menuItems: ["목록 공유", "거리순 정렬", "다녀온 곳 지우기"],
          close: "닫기"
        }
      },
      readout: {
        idle: "Idle",
        push: "Push",
        pop: "Pop",
        swipe: "Swipe",
        duration: "Duration",
        curve: "Curve"
      }
    },
    docs: {
      title: "Documentation",
      onThisPage: "On this page",
      previous: "Previous",
      next: "Next",
      details: "Details",
      minRead: "min read",
      menu: "메뉴",
      search: {
        placeholder: "문서 검색",
        empty: "결과가 없어요",
        hint: "이동",
        open: "열기"
      },
      copyPage: "페이지 복사",
      copied: "복사됨",
      editOnGithub: "GitHub에서 수정",
      demo: {
        replay: "다시 보기",
        tryIt: "직접 해 보기"
      }
    },
    notFound: {
      title: "찾는 페이지가 없어요",
      body: "주소가 바뀌었거나 없는 페이지예요.",
      cta: "홈으로 돌아가기"
    },
    error: {
      title: "문제가 발생했어요",
      body: "페이지를 렌더링하다가 예상하지 못한 오류가 발생했어요.",
      cta: "다시 시도",
      home: "홈으로 돌아가기"
    },
    playground: {
      eyebrow: "Playground",
      title: "직접 눌러보세요",
      subtitle:
        "실제 라이브러리로 동작하는 작은 티켓 앱이에요. 목록이나 포스터 그리드에서 공연을 열었다가 돌아오면서, push에 쓰는 트랜지션을 바꿔 보세요.",
      presets: "Presets",
      authored: "Authored on this page",
      code: "How it is written",
      cases: {
        cupertino: "iOS 기본 push예요. 왼쪽 가장자리에서 스와이프하면 뒤로 가요.",
        material: "아래에서 올라와요. 아래로 스와이프하면 닫혀요.",
        layout: "단순한 크로스페이드예요.",
        none: "화면은 그대로 두고 공유 이미지만 새 화면으로 이동해요.",
        reveal: "프리셋이 쓰지 않는 clip-path로 화면을 드러내요.",
        drift: "깊이감을 주는 전환이에요. 데코레이터도 화면 전환과 같은 타이밍으로 움직여요.",
        sheet: "열 때와 닫을 때 타이밍이 다른 모달 시트예요.",
        tether: "직접 만든 스와이프예요. 투명도는 먼저 끝나고 화면은 계속 움직여요.",
        zoom: "컨테이너 변환이에요. 카드가 그대로 펼쳐져 페이지가 돼요."
      },
      bench: {
        label: "push에 쓰는 트랜지션",
        note: "화면과 공유 이미지는 그대로 두고 트랜지션만 바꿔요."
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
        body: "녹음하지 않고 한 번만 연주하는 짧은 신곡 무대예요. 전석 스탠딩이고, 맨 뒷줄도 무대에서 6미터밖에 안 되는 작은 공연장이에요.",
        doors: "입장",
        venue: "장소",
        age: "관람등급",
        ageValue: "18세 이상",
        getTickets: "예매하기"
      }
    },
    showcase: {
      eyebrow: "Showcase",
      title: "flemo로 만든 앱",
      subtitle: "flemo로 만들어 실제로 서비스하고 있는 앱들이에요.",
      flemoUsageLabel: "How it uses flemo",
      languagesLabel: "Languages",
      languageNames: { ko: "Korean" },
      web: "Web",
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
          description:
            "교대 근무자를 위한 일정 앱이에요. 월 달력, 주 타임라인, 근무 패턴 템플릿, 홈 화면 위젯, 다크 테마까지 갖췄어요.",
          flemoUsage:
            "시플로는 UI 전체가 WebView 안의 웹 앱인 React Native 앱이에요. 화면 이동은 전부 flemo가 맡아서, 웹 코드베이스 하나로 iOS와 Android에서 네이티브 앱처럼 움직여요."
        }
      }
    }
  }
} as const;

export type Lang = keyof typeof dict;

export type Dict = (typeof dict)[Lang];

export type ShowcaseAppId = keyof typeof dict.en.showcase.apps;

export type ShowcaseLanguageCode = keyof typeof dict.en.showcase.languageNames;

export function getDict(lang: string): Dict {
  return (dict as Record<string, Dict>)[lang] ?? dict.en;
}
