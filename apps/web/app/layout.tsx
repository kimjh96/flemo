import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { ThemeProvider } from "next-themes";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { InitialThemeProvider, normalizeTheme, THEME_COOKIE } from "@/components/ThemeToggle";
import { i18n } from "@/lib/i18n";

import "./global.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://flemo.dev"),
  title: {
    default: "flemo · Screens that move like apps",
    template: "%s · flemo"
  },
  description:
    "A React router with native screen transitions: push, pop, swipe back and shared elements, compiled to CSS and driven by the finger.",
  openGraph: {
    type: "website",
    siteName: "flemo",
    url: "https://flemo.dev"
  },
  twitter: { card: "summary_large_image" }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#09090a" }
  ]
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const initialTheme = normalizeTheme((await cookies()).get(THEME_COOKIE)?.value);
  // proxy.ts resolves the locale from the URL prefix for every request, including
  // the ones that land on the root error and not-found pages.
  const lang = (await headers()).get("x-locale") ?? i18n.defaultLanguage;

  return (
    <html
      lang={lang}
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-bg text-fg">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <InitialThemeProvider value={initialTheme}>{children}</InitialThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
