import type { ShowcaseAppId, ShowcaseLanguageCode } from "@/lib/i18n";

export interface ShowcaseAppConfig {
  id: ShowcaseAppId;
  logo: string;
  languages: ShowcaseLanguageCode[];
  appStoreUrl?: string;
  playStoreUrl?: string;
}

export const showcaseApps: ShowcaseAppConfig[] = [
  {
    id: "shiflo",
    logo: "/shiflo/logo.png",
    languages: ["ko"],
    appStoreUrl: "https://apps.apple.com/kr/app/%EC%8B%9C%ED%94%8C%EB%A1%9C/id6757798018",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.shiflo&hl=ko"
  }
];
