import type { ShowcaseAppId, ShowcaseLanguageCode } from "@/lib/i18n";

export interface ShowcaseAppConfig {
  id: ShowcaseAppId;
  logo: string;
  screenshots: string[];
  languages: ShowcaseLanguageCode[];
  appStoreUrl?: string;
  playStoreUrl?: string;
}

export const showcaseApps: ShowcaseAppConfig[] = [
  {
    id: "shiflo",
    logo: "/shiflo/logo.png",
    screenshots: [
      "/shiflo/screenshot-1.png",
      "/shiflo/screenshot-2.png",
      "/shiflo/screenshot-3.png",
      "/shiflo/screenshot-4.png",
      "/shiflo/screenshot-5.png"
    ],
    languages: ["ko"],
    appStoreUrl: "https://apps.apple.com/kr/app/%EC%8B%9C%ED%94%8C%EB%A1%9C/id6757798018",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.shiflo&hl=ko"
  }
];
