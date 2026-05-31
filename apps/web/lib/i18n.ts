import type { I18nConfig } from "fumadocs-core/i18n";

export const i18n: I18nConfig = {
  defaultLanguage: "en",
  languages: ["en", "ko"],
  hideLocale: "default-locale"
};

export const fumadocsTranslations: Record<string, Record<string, string>> = {
  ko: {
    search: "검색",
    searchNoResult: "결과 없음",
    toc: "이 페이지에서",
    tocNoHeadings: "헤딩이 없어요",
    lastUpdate: "최근 수정",
    chooseLanguage: "언어 선택",
    nextPage: "다음 페이지",
    previousPage: "이전 페이지",
    chooseTheme: "테마",
    editOnGithub: "GitHub에서 수정"
  }
};

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
    hero: {
      title: "A React router for native-like screen transitions",
      ctaPrimary: "Get started",
      ctaSecondary: "Playground"
    },
    features: [
      {
        icon: "phone",
        label: "Mobile-first",
        body: "Designed from the ground up for mobile screen transitions"
      },
      {
        icon: "swipe",
        label: "Gestures",
        body: "Swipe gestures for natural navigation"
      },
      {
        icon: "code",
        label: "TypeScript",
        body: "Type-safe routes for a confident development experience"
      },
      {
        icon: "layers",
        label: "Built-in transitions",
        body: "Cupertino, Material, and more — bundled out of the box"
      },
      {
        icon: "sparkle",
        label: "Decorators",
        body: "Decorators like Overlay enhance your transitions"
      },
      {
        icon: "palette",
        label: "Custom transitions",
        body: "Build and apply your own transitions"
      }
    ],
    resources: {
      kicker: "Resources",
      cards: [
        {
          label: "Docs",
          body: "Quick start, API reference, and migration guide",
          cta: "Read the docs",
          target: "docs" as const
        },
        {
          label: "GitHub",
          body: "Source, issues, discussions, and pull requests",
          cta: "View on GitHub",
          target: "github" as const
        }
      ]
    },
    footer: {
      built: "MIT · © kimjh96"
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
      tabBar: { library: "Library", search: "Search" },
      segment: { albums: "Albums", songs: "Songs", artists: "Artists" },
      library: { title: "Library" },
      search: {
        placeholder: "Artists, songs, albums",
        topPicks: "Top Picks",
        artists: "Artists",
        albums: "Albums",
        noMatches: "No matches"
      },
      album: { fallbackTitle: "Album", notFound: "Album not found", play: "Play" },
      nowPlaying: {
        title: "Now Playing",
        upNext: "Up Next",
        lyrics: "Lyrics",
        lyricsUnavailable: "Lyrics unavailable in the demo.",
        lyricsHint:
          "Tap the chip above to swap the sheet contents in place via `replaceStep` — no close / reopen."
      },
      player: {
        previous: "Previous",
        play: "Play",
        pause: "Pause",
        next: "Next",
        close: "Close",
        more: "More",
        back: "Back"
      },
      intro: {
        description:
          "A miniature music app powered by flemo's Router. Swap the screen transition, pin the shared bar — every choice reflects instantly in the phone preview, and the code that authored it sits right beside."
      },
      devPanel: {
        transition: {
          title: "Compose transitions per navigation",
          description:
            "By default each push uses the transition that fits its affordance — cupertino for browse-deeper hops, material for the player. Pick a chip below to force every push to one transition for comparison; tap it again to drop back to the per-context defaults.",
          noOverride: "No override — each push site picks its own transition inline.",
          overridePrefix: "Override active — ",
          summaries: {
            cupertino: "iOS-style horizontal push. Ships with @flemo/core.",
            material: "Material-style vertical rise. Ships with @flemo/core.",
            none: "Instant swap, no animation. Useful for tab-like routing.",
            blur: "Author-defined with createTransition — lives in this playground, not the core.",
            zoom: "Cross-zoom dive — the new screen scales up into focus while the old one pushes forward and fades.",
            "card-stack":
              "iOS-style card present — the new screen rises while the current one scales back and dims behind it.",
            reveal:
              "Iris reveal — the new screen opens through a circular clip-path that grows to just cover the viewport, while the backdrop recedes.",
            spring:
              "Springy pop — the new screen scales up with an overshooting ease, settling with a bounce.",
            ripple:
              "A drop in water: the screen reveals through a circle expanding from the center, and concentric rings radiate from that same point on the backdrop — reveal and ripples share one origin.",
            dive: "Diving forward through depth: the screen rushes in from a point at the center while the backdrop scales out into a closing dark tunnel — both read as the same plunge into depth."
          }
        },
        sharedBars: {
          title: "Pin bars across screens",
          description:
            "A shared bar stays mounted across pushes so it never re-animates. The nav bar (mini-player + tabs) spans Library, Search and Album; the app bar is shared only on Library. Toggle each and watch the bars appear or vanish in the preview; the Live inspector below shows which screens registered which bar.",
          navName: "Shared navigation bar",
          navOn: "Navigation bar · visible",
          navOff: "Navigation bar · hidden",
          appName: "Shared app bar",
          appOn: "App bar · visible",
          appOff: "App bar · hidden"
        },
        navigation: {
          title: "Reach past the top in one transition",
          description:
            "pop / replace / push all take a distance — { skip } screens or { until } a route. The screens skipped over are removed without ever painting, so you never see them flash. Seed a stack, then reach back several screens at once and watch the depth jump with no flicker.",
          stackDepth: "Stack depth",
          seed: "Seed deep stack",
          reachBack: "Reach back",
          seedFirst: "(seed first)"
        },
        performance: {
          title: "Stress-test arrival screens",
          description:
            "Push a synthetic heavy screen into the preview to feel how flemo holds the transition under load. cpuMs busy-waits in render; nodes inflates the tree."
        },
        inspector: {
          title: "What flemo is doing, right now",
          description:
            "A read-only window into flemo's stores — the history stack, the navigation status as it moves through its state machine, and which mounted screens registered which shared bars. Navigate the preview and watch it update live.",
          status: "Status",
          historyStack: "History stack (top first)",
          sharedBars: "Shared bars by screen",
          emptyStack: "Empty stack.",
          noScreen: "No screen mounted yet."
        },
        group: {
          builtIn: "Built-in",
          custom: "Custom",
          customDecorator: "Custom + decorator",
          captionBuiltIn: "Force one preset for every push.",
          captionCustom: "Defined in this playground, not in @flemo/core.",
          captionCustomDecorator: "A custom transition paired with a custom createDecorator layer."
        }
      }
    }
  },
  ko: {
    nav: {
      docs: "문서",
      github: "GitHub"
    },
    hero: {
      title: "네이티브 같은 화면 전환을 위한 React 라우터",
      ctaPrimary: "시작하기",
      ctaSecondary: "플레이그라운드"
    },
    features: [
      {
        icon: "phone",
        label: "모바일 퍼스트",
        body: "모바일 화면 전환을 위해 처음부터 설계한 라우터"
      },
      {
        icon: "swipe",
        label: "제스처 지원",
        body: "스와이프 제스처로 자연스러운 내비게이션"
      },
      {
        icon: "code",
        label: "TypeScript 지원",
        body: "타입 안전한 라우트로 자신 있게 개발하는 경험"
      },
      {
        icon: "layers",
        label: "Built-in 트랜지션",
        body: "Cupertino, Material 등 다양한 내장 트랜지션"
      },
      {
        icon: "sparkle",
        label: "데코레이터",
        body: "Overlay 등 트랜지션 효과를 향상시키는 데코레이터"
      },
      {
        icon: "palette",
        label: "커스텀 트랜지션",
        body: "필요한 트랜지션을 직접 제작하고 적용"
      }
    ],
    resources: {
      kicker: "리소스",
      cards: [
        {
          label: "문서",
          body: "시작하기, API 레퍼런스, 마이그레이션 가이드까지",
          cta: "문서 보기",
          target: "docs" as const
        },
        {
          label: "GitHub",
          body: "소스, 이슈, 디스커션, PR",
          cta: "GitHub에서 보기",
          target: "github" as const
        }
      ]
    },
    footer: {
      built: "MIT · © kimjh96"
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
      tabBar: { library: "보관함", search: "검색" },
      segment: { albums: "앨범", songs: "노래", artists: "아티스트" },
      library: { title: "보관함" },
      search: {
        placeholder: "아티스트, 노래, 앨범",
        topPicks: "추천",
        artists: "아티스트",
        albums: "앨범",
        noMatches: "검색 결과 없어요"
      },
      album: { fallbackTitle: "앨범", notFound: "앨범을 찾을 수 없어요", play: "재생" },
      nowPlaying: {
        title: "재생 중",
        upNext: "다음 트랙",
        lyrics: "가사",
        lyricsUnavailable: "데모에서는 가사를 제공하지 않아요.",
        lyricsHint:
          "위 칩을 누르면 `replaceStep`으로 시트 내용을 그 자리에서 교체해요 — 닫고 다시 열지 않아요."
      },
      player: {
        previous: "이전",
        play: "재생",
        pause: "일시정지",
        next: "다음",
        close: "닫기",
        more: "더보기",
        back: "뒤로"
      },
      intro: {
        description:
          "flemo의 Router로 만든 미니 뮤직 앱이에요. 화면 전환을 바꾸고 공유 바를 고정해 보세요 — 모든 선택이 오른쪽 폰 미리보기에 즉시 반영되고, 그걸 만든 코드가 바로 옆에 함께 보여요."
      },
      devPanel: {
        transition: {
          title: "내비게이션마다 전환 구성",
          description:
            "기본적으로 각 push는 상황에 맞는 전환을 써요 — 깊이 탐색은 cupertino, 플레이어는 material. 아래 칩을 눌러 모든 push를 한 전환으로 강제해 비교하고, 다시 누르면 상황별 기본값으로 돌아가요.",
          noOverride: "오버라이드 없음 — 각 push가 자체 전환을 선택해요.",
          overridePrefix: "오버라이드 적용 중 — ",
          summaries: {
            cupertino: "iOS 스타일 가로 push. @flemo/core에 기본 포함돼요.",
            material: "Material 스타일 세로 상승. @flemo/core에 기본 포함돼요.",
            none: "애니메이션 없이 즉시 교체. 탭처럼 동작하는 라우팅에 유용해요.",
            blur: "createTransition으로 직접 정의 — 코어가 아니라 이 playground에 있어요.",
            zoom: "크로스 줌 다이브 — 새 화면이 확대되며 또렷해지고, 이전 화면은 앞으로 밀려나며 사라져요.",
            "card-stack":
              "iOS 스타일 카드 표시 — 새 화면이 떠오르고, 현재 화면은 뒤로 축소되며 그 뒤에서 어두워져요.",
            reveal:
              "아이리스 reveal — 새 화면이 원형 clip-path를 통해 열리며 뷰포트를 막 덮을 만큼 커지고, 배경은 뒤로 물러나요.",
            spring:
              "스프링 팝 — 새 화면이 살짝 튀어 오르는 이징으로 확대되며 통통 튀듯 자리를 잡아요.",
            ripple:
              "물에 떨어진 물방울 — 화면이 가운데에서 퍼지는 원을 통해 드러나고, 같은 지점에서 동심원이 배경으로 퍼져 나가요. reveal과 물결이 하나의 원점을 공유해요.",
            dive: "깊이 속으로 다이빙 — 화면이 가운데 한 점에서 솟구쳐 들어오고, 배경은 닫히는 어두운 터널처럼 확장돼요. 둘 다 같은 깊이로의 돌입처럼 읽혀요."
          }
        },
        sharedBars: {
          title: "여러 화면에 바 고정",
          description:
            "공유 바는 push 사이에도 마운트된 채 유지돼 다시 애니메이션되지 않아요. 내비게이션 바(미니플레이어+탭)는 보관함·검색·앨범에 걸쳐 있고, 앱 바는 보관함에만 공유돼요. 각각 토글해 미리보기에서 바가 나타나거나 사라지는 걸 확인하고, 어떤 화면이 어떤 바를 등록했는지는 아래 Live inspector에서 보세요.",
          navName: "공유 내비게이션 바",
          navOn: "내비게이션 바 · 표시",
          navOff: "내비게이션 바 · 숨김",
          appName: "공유 앱 바",
          appOn: "앱 바 · 표시",
          appOff: "앱 바 · 숨김"
        },
        navigation: {
          title: "한 번의 전환으로 여러 화면 건너뛰기",
          description:
            "pop / replace / push 는 모두 이동 거리를 받아요 — { skip } 으로 건너뛸 화면 수를, { until } 로 멈출 라우트를 지정해요. 건너뛴 화면은 한 프레임도 그려지지 않고 제거돼요. 스택을 쌓은 뒤 여러 화면을 한 번에 거슬러 올라가며, 깊이가 깜빡임 없이 줄어드는 걸 확인해 보세요.",
          stackDepth: "스택 깊이",
          seed: "깊은 스택 쌓기",
          reachBack: "거슬러 올라가기",
          seedFirst: "(먼저 쌓기)"
        },
        performance: {
          title: "도착 화면 스트레스 테스트",
          description:
            "인위적으로 무겁게 만든 화면을 미리보기에 push해, 부하 속에서 flemo가 전환을 어떻게 버티는지 확인해 보세요. cpuMs는 렌더링 중 CPU를 바쁘게 점유하고, nodes는 트리 크기를 부풀려요."
        },
        inspector: {
          title: "지금 flemo가 하는 일",
          description:
            "flemo 스토어를 읽기 전용으로 들여다봐요 — history 스택, 상태 머신을 따라 움직이는 내비게이션 상태, 그리고 어떤 마운트된 화면이 어떤 공유 바를 등록했는지. 미리보기를 조작하며 실시간으로 갱신되는 걸 보세요.",
          status: "상태",
          historyStack: "History 스택 (맨 위부터)",
          sharedBars: "화면별 공유 바",
          emptyStack: "빈 스택.",
          noScreen: "아직 마운트된 화면이 없어요."
        },
        group: {
          builtIn: "내장",
          custom: "커스텀",
          customDecorator: "커스텀 + 데코레이터",
          captionBuiltIn: "모든 push를 한 프리셋으로 강제.",
          captionCustom: "@flemo/core가 아니라 이 playground에서 정의했어요.",
          captionCustomDecorator: "커스텀 전환 + 커스텀 createDecorator 레이어 조합."
        }
      }
    }
  }
} as const;

export type Lang = keyof typeof dict;

export function getDict(lang: string): (typeof dict)[Lang] {
  return (dict as Record<string, (typeof dict)[Lang]>)[lang] ?? dict.en;
}
