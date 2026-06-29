import type { Metadata } from "next";

import ShellApp from "@/app/[lang]/_components/ShellApp";
import { getDict } from "@/lib/i18n";

import { getDocPageDescription } from "./_docs/_data/docPages";

export async function generateMetadata({ params }: PageProps<"/[lang]/docs">): Promise<Metadata> {
  const { lang } = await params;

  return {
    title: getDict(lang).app.nav.docs,
    description: getDocPageDescription(lang, "introduction")
  };
}

export default async function DocsPage({ params }: PageProps<"/[lang]/docs">) {
  const { lang } = await params;

  return <ShellApp lang={lang} initPath="/docs" />;
}
