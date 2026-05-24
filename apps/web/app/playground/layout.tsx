export const dynamic = "force-static";

export const metadata = {
  title: "flemo · playground",
  robots: { index: false, follow: false }
};

export default function PlaygroundLayout({ children }: LayoutProps<"/playground">) {
  return children;
}
