import type { Metadata } from "next";

import ShellApp from "@/app/[lang]/_components/ShellApp";

export const metadata: Metadata = {
  title: "Composition benchmark | flemo",
  description:
    "Visually verify nested routing, shared header Parts, Morph ownership, and swipe composition."
};

export default async function CompositionPlaygroundPage({
  params
}: PageProps<"/[lang]/playground/composition">) {
  const { lang } = await params;

  return <ShellApp lang={lang} initPath="/playground/composition" />;
}
