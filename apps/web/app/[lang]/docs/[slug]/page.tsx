import type { Metadata } from "next";

import ShellApp from "@/app/[lang]/_components/ShellApp";

import { getDocPage, getDocPageDescription } from "../_data/docPages";

export async function generateMetadata({
  params
}: PageProps<"/[lang]/docs/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const page = getDocPage(lang, slug);

  return {
    title: page?.title ?? "Docs",
    description: getDocPageDescription(lang, slug)
  };
}

export default async function DocsSlugPage({ params }: PageProps<"/[lang]/docs/[slug]">) {
  const { lang, slug } = await params;

  return <ShellApp lang={lang} initPath={`/docs/${slug}`} />;
}
