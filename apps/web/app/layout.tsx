import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import "./global.css";

export const metadata = {
  metadataBase: new URL("https://flemo.dev"),
  title: {
    default: "flemo · Native-like screen transitions for React",
    template: "%s · flemo"
  },
  description:
    "flemo brings native-app-like screen transitions to the web. Push, pop, and shared layouts that just work in React.",
  icons: {
    icon: [
      // default — used by browsers that don't honor prefers-color-scheme on favicons
      { url: "/logo.png", type: "image/png" },
      // overrides when supported (Safari / Firefox)
      { url: "/logo-dark.png", type: "image/png", media: "(prefers-color-scheme: dark)" }
    ],
    apple: [{ url: "/logo.png", type: "image/png" }]
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-fd-background text-fd-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
