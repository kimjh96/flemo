import type { Metadata } from "next";

import ShellApp from "@/app/[lang]/_components/ShellApp";
import { getDict } from "@/lib/i18n";

export async function generateMetadata({
  params
}: PageProps<"/[lang]/playground">): Promise<Metadata> {
  const { lang } = await params;
  const t = getDict(lang);

  return {
    title: t.app.nav.playground,
    description:
      "Every flemo transition on one pair of screens, with a shared element on its own switch."
  };
}

export default async function PlaygroundPage({ params }: PageProps<"/[lang]/playground">) {
  const { lang } = await params;

  return <ShellApp lang={lang} initPath="/playground" />;
}
