import type { Metadata } from "next";

import ShellApp from "@/app/[lang]/_components/ShellApp";
import { getDict } from "@/lib/i18n";

export async function generateMetadata({
  params
}: PageProps<"/[lang]/playground/[n]">): Promise<Metadata> {
  const { lang } = await params;
  const t = getDict(lang);

  return {
    title: t.app.nav.playground,
    description: t.app.playground.subtitle
  };
}

export default async function PlaygroundStagePage({
  params,
  searchParams
}: PageProps<"/[lang]/playground/[n]">) {
  const { lang, n } = await params;
  // Forward the query into initPath so the server seeds any deep-linked step
  // (e.g. ?code=x opens the source panel) and matches the client.
  const search = new URLSearchParams(
    Object.entries(await searchParams).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  ).toString();

  return <ShellApp lang={lang} initPath={`/playground/${n}${search ? `?${search}` : ""}`} />;
}
