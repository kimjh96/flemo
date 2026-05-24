import type { ReactNode } from "react";

export const dynamic = "force-static";

export const metadata = {
  title: "flemo · playground",
  robots: { index: false, follow: false }
};

export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return children;
}
