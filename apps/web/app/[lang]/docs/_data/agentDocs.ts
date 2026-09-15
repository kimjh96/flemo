import { getDocPageDescription, getDocSections, type DocBlock } from "./docPages";

const ORIGIN = "https://flemo.dev";

const textResponseHeaders = {
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "Content-Type": "text/plain; charset=utf-8"
} as const;

const escapeTableCell = (value: string): string =>
  value.replaceAll("|", "\\|").replaceAll("\n", "<br>");

const renderBlock = (block: DocBlock): string => {
  switch (block.type) {
    case "p":
      return block.text;
    case "h":
      return `#### ${block.text}`;
    case "code":
      return `\`\`\`${block.lang}\n${block.code}\n\`\`\``;
    case "list":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "note":
      return block.text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "table": {
      const header = `| ${block.headers.map(escapeTableCell).join(" | ")} |`;
      const divider = `| ${block.headers.map(() => "---").join(" | ")} |`;
      const rows = block.rows.map((row) => `| ${row.map(escapeTableCell).join(" | ")} |`);
      return [header, divider, ...rows].join("\n");
    }
  }
};

const pageUrl = (lang: string, slug: string): string => `${ORIGIN}/${lang}/docs/${slug}`;

const renderLanguageIndex = (lang: "en" | "ko", label: string): string => {
  const sections = getDocSections(lang).map((section) => {
    const pages = section.pages.map((page) => {
      const description = getDocPageDescription(lang, page.slug);
      return `- [${page.title}](${pageUrl(lang, page.slug)})${description ? `: ${description}` : ""}`;
    });
    return [`### ${section.title}`, ...pages].join("\n");
  });
  return [`## ${label}`, ...sections].join("\n\n");
};

/** A compact discovery map. The page titles and summaries come from the live docs data. */
export function renderLlmsIndex(): string {
  return [
    "# flemo",
    "",
    "> A React screen router and transition system with nested Router ownership, interactive back gestures, Parts, shared bars, Morphs, decorators, and diagnostic tooling.",
    "",
    "Install `@flemo/react`. Start by deciding which Router owns the navigation and which Slot bounds the moving region. A Part with no `onSwipe*` hook follows its declared pop pose during a swipe automatically; hooks replace that default behavior.",
    "",
    "- [Complete machine-readable documentation](https://flemo.dev/llms-full.txt)",
    "- [English documentation](https://flemo.dev/en/docs/introduction)",
    "- [Korean documentation](https://flemo.dev/ko/docs/introduction)",
    "- [Portable Agent Skill](https://github.com/kimjh96/flemo/tree/main/.agents/skills/flemo)",
    "- [npm package](https://www.npmjs.com/package/@flemo/react)",
    "- [Source repository](https://github.com/kimjh96/flemo)",
    "",
    renderLanguageIndex("en", "English documentation"),
    "",
    renderLanguageIndex("ko", "한국어 문서"),
    ""
  ].join("\n");
}

const renderLanguage = (lang: "en" | "ko", label: string): string => {
  const sections = getDocSections(lang).flatMap((section) => [
    `## ${label}: ${section.title}`,
    "",
    ...section.pages.flatMap((page) => [
      `### [${page.title}](${pageUrl(lang, page.slug)})`,
      "",
      ...page.blocks.flatMap((block) => [renderBlock(block), ""])
    ])
  ]);
  return sections.join("\n").trim();
};

/** The full EN and KO documentation corpus, rendered from the same typed data as the site. */
export function renderLlmsFull(): string {
  return [
    "# flemo complete documentation",
    "",
    "> Generated from the same typed EN and KO content rendered by flemo.dev. Prefer the linked pages for humans and this file for retrieval.",
    "",
    renderLanguage("en", "English"),
    "",
    renderLanguage("ko", "한국어"),
    ""
  ].join("\n");
}

export function agentTextResponse(body: string): Response {
  return new Response(body, { headers: textResponseHeaders });
}
