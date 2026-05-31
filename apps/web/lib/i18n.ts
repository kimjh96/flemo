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
      devPanel: {
        transition: {
          eyebrow: "Screen transition",
          title: "Compose transitions per navigation",
          description:
            "By default each push uses the transition that fits its affordance — cupertino for browse-deeper hops, material for the player. Pick a chip below to force every push to one transition for comparison; tap it again to drop back to the per-context defaults.",
          noOverride: "No override — each push site picks its own transition inline.",
          overridePrefix: "Override active — "
        },
        sharedBars: {
          title: "Pin bars across screens",
          description:
            "A shared bar stays mounted across pushes so it never re-animates. The nav bar (mini-player + tabs) spans Library, Search and Album; the app bar is shared only on Library. Toggle each, then watch the live presence below.",
          navName: "Shared navigation bar",
          navOn: "Navigation bar · visible",
          navOff: "Navigation bar · hidden",
          appName: "Shared app bar",
          appOn: "App bar · visible",
          appOff: "App bar · hidden",
          mountedNow: "Mounted now",
          noScreen: "No screen mounted yet."
        },
        navigation: {
          eyebrow: "Navigation distance",
          title: "Reach past the top in one transition",
          description:
            "pop / replace / push all take a distance — { skip } screens or { until } a route. The screens skipped over are removed without ever painting, so you never see them flash. Seed a stack, then reach back several screens at once and watch the depth jump with no flicker.",
          stackDepth: "Stack depth",
          seed: "Seed deep stack",
          reachBack: "Reach back",
          seedFirst: "(seed first)"
        },
        performance: {
          eyebrow: "Performance",
          title: "Stress-test arrival screens",
          description:
            "Push a synthetic heavy screen into the preview to feel how flemo holds the transition under load. cpuMs busy-waits in render; nodes inflates the tree."
        },
        inspector: {
          eyebrow: "Live inspector",
          title: "What flemo is doing, right now",
          description:
            "A read-only window into flemo's stores — the history stack, the navigation status as it moves through its state machine, and which mounted screens registered which shared bars. Navigate the preview and watch it update live.",
          status: "Status",
          historyStack: "History stack (top first)",
          sharedBars: "Shared bars by screen",
          emptyStack: "Empty stack."
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
      title: "네이티브 화면 전환을 위한 React 라우터",
      ctaPrimary: "시작하기",
      ctaSecondary: "플레이그라운드"
    },
    features: [
      {
        icon: "phone",
        label: "모바일 퍼스트",
        body: "모바일 화면 전환부터 설계된 라우터"
      },
      {
        icon: "swipe",
        label: "제스처 지원",
        body: "스와이프 제스처로 자연스러운 내비게이션"
      },
      {
        icon: "code",
        label: "TypeScript 지원",
        body: "타입 정의로 안전한 개발 경험"
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
      devPanel: {
        transition: {
          eyebrow: "화면 전환",
          title: "내비게이션마다 전환 구성",
          description:
            "기본적으로 각 push는 상황에 맞는 전환을 써요 — 깊이 탐색은 cupertino, 플레이어는 material. 아래 칩을 눌러 모든 push를 한 전환으로 강제해 비교하고, 다시 누르면 상황별 기본값으로 돌아가요.",
          noOverride: "오버라이드 없음 — 각 push가 자체 전환을 선택해요.",
          overridePrefix: "오버라이드 적용 중 — "
        },
        sharedBars: {
          title: "여러 화면에 바 고정",
          description:
            "공유 바는 push 사이에도 마운트된 채 유지돼 다시 애니메이션되지 않아요. 내비게이션 바(미니플레이어+탭)는 보관함·검색·앨범에 걸쳐 있고, 앱 바는 보관함에만 공유돼요. 각각 토글한 뒤 아래 실시간 presence를 확인하세요.",
          navName: "공유 내비게이션 바",
          navOn: "내비게이션 바 · 표시",
          navOff: "내비게이션 바 · 숨김",
          appName: "공유 앱 바",
          appOn: "앱 바 · 표시",
          appOff: "앱 바 · 숨김",
          mountedNow: "현재 마운트됨",
          noScreen: "아직 마운트된 화면이 없어요."
        },
        navigation: {
          eyebrow: "내비게이션 거리",
          title: "한 번의 전환으로 여러 화면 건너뛰기",
          description:
            "pop / replace / push 는 모두 이동 거리를 받아요 — { skip } 으로 건너뛸 화면 수를, { until } 로 멈출 라우트를 지정해요. 건너뛴 화면은 한 프레임도 그려지지 않고 제거돼요. 스택을 쌓은 뒤 여러 화면을 한 번에 거슬러 올라가며, 깊이가 깜빡임 없이 줄어드는 걸 확인해 보세요.",
          stackDepth: "스택 깊이",
          seed: "깊은 스택 쌓기",
          reachBack: "거슬러 올라가기",
          seedFirst: "(먼저 쌓기)"
        },
        performance: {
          eyebrow: "성능",
          title: "도착 화면 스트레스 테스트",
          description:
            "인위적으로 무겁게 만든 화면을 미리보기에 push해, 부하 속에서 flemo가 전환을 어떻게 버티는지 확인해 보세요. cpuMs는 렌더링 중 CPU를 바쁘게 점유하고, nodes는 트리 크기를 부풀려요."
        },
        inspector: {
          eyebrow: "라이브 인스펙터",
          title: "지금 flemo가 하는 일",
          description:
            "flemo 스토어를 읽기 전용으로 들여다봐요 — history 스택, 상태 머신을 따라 움직이는 내비게이션 상태, 그리고 어떤 마운트된 화면이 어떤 공유 바를 등록했는지. 미리보기를 조작하며 실시간으로 갱신되는 걸 보세요.",
          status: "상태",
          historyStack: "History 스택 (맨 위부터)",
          sharedBars: "화면별 공유 바",
          emptyStack: "빈 스택."
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
