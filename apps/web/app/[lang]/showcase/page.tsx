import type { Metadata } from "next";

import ShellApp from "@/app/[lang]/_components/ShellApp";
import { getDict } from "@/lib/i18n";

export async function generateMetadata({
  params
}: PageProps<"/[lang]/showcase">): Promise<Metadata> {
  const { lang } = await params;
  const t = getDict(lang);

  return {
    title: t.app.nav.showcase,
    description: t.showcase.subtitle
  };
}

export default async function ShowcasePage({ params }: PageProps<"/[lang]/showcase">) {
  const { lang } = await params;

  return <ShellApp lang={lang} initPath="/showcase" />;
}
