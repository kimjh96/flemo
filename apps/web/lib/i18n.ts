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
        body: "스와이프 제스처로 자연스러운 네비게이션"
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
    }
  }
} as const;

export type Lang = keyof typeof dict;

export function getDict(lang: string): (typeof dict)[Lang] {
  return (dict as Record<string, (typeof dict)[Lang]>)[lang] ?? dict.en;
}
