import type { CSSProperties } from "react";

import PlaygroundDemo from "./_components/PlaygroundDemo";

export const dynamic = "force-static";

export const metadata = {
  title: "flemo · playground",
  robots: { index: false, follow: false }
};

const lightTheme: CSSProperties = {
  background: "#ffffff",
  color: "#191f28",
  colorScheme: "light",
  ["--color-bg" as string]: "#ffffff",
  ["--color-surface" as string]: "#ffffff",
  ["--color-layer" as string]: "#f7f8fa",
  ["--color-ink" as string]: "#191f28",
  ["--color-ink-soft" as string]: "#4e5968",
  ["--color-ink-mute" as string]: "#8b95a1",
  ["--color-line" as string]: "#e5e8eb",
  ["--color-brand" as string]: "#0066cc",
  ["--color-brand-hover" as string]: "#1f78db"
};

export default function PlaygroundPage() {
  return (
    <div className="min-h-[100dvh]" style={lightTheme}>
      <PlaygroundDemo />
    </div>
  );
}
