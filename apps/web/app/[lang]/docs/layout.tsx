import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";

import { baseOptions } from "@/app/layout.config";
import { source } from "@/lib/source";

export default async function Layout({
  params,
  children
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;
  const { links: _omitLinks, ...rest } = baseOptions(lang);

  return (
    <DocsLayout {...rest} links={[]} tree={source.pageTree[lang] ?? source.pageTree.en}>
      {children}
    </DocsLayout>
  );
}
