import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { notFound } from "next/navigation";

import type { ComponentProps, FC } from "react";

import ExperimentalPill from "@/components/ExperimentalPill";
import { source } from "@/lib/source";

function makeRelativeAnchor(
  pageUrl: string,
  Base: FC<ComponentProps<"a">>
): FC<ComponentProps<"a">> {
  return function RelativeAnchor({ href, ...rest }) {
    if (href && (href.startsWith("./") || href.startsWith("../"))) {
      try {
        const url = new URL(href, `https://_${pageUrl}`);
        const resolved = `${url.pathname}${url.search}${url.hash}`;
        return <Base href={resolved} {...rest} />;
      } catch {
        // fall through
      }
    }
    return <Base href={href} {...rest} />;
  };
}

export default async function Page({ params }: PageProps<"/[lang]/docs/[[...slug]]">) {
  const { lang, slug } = await params;
  const page = source.getPage(slug, lang);
  if (!page) notFound();

  const MDX = page.data.body;
  const isIndex = !slug || slug.length === 0;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      footer={isIndex ? { enabled: false } : undefined}
    >
      <DocsTitle>
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-2">
          {page.data.title}
          {page.data.experimental && <ExperimentalPill />}
        </span>
      </DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            a: makeRelativeAnchor(page.url, defaultMdxComponents.a)
          }}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: PageProps<"/[lang]/docs/[[...slug]]">) {
  const { lang, slug } = await params;
  const page = source.getPage(slug, lang);
  if (!page) return {};
  return {
    title: page.data.title,
    description: page.data.description
  };
}
