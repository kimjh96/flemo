import { getDocPageDescription, getDocSections, type DocBlock, type DocPage } from "./docPages";

const ORIGIN = "https://flemo.dev";

const textResponseHeaders = {
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "Content-Type": "text/plain; charset=utf-8"
} as const;

const escapeTableCell = (value: string): string =>
  value.replaceAll("|", "\\|").replaceAll("\n", "<br>");

const pageUrl = (lang: string, slug: string): string => `${ORIGIN}/${lang}/docs/${slug}`;

// Inline links in the content name a docs slug, e.g. [Part](part); in plain
// text they become absolute URLs in the same locale.
const absolutize = (lang: string, text: string): string =>
  text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, target: string) =>
    /^https?:\/\//.test(target) ? whole : `[${label}](${pageUrl(lang, target)})`
  );

const renderBlock = (lang: string, block: DocBlock): string => {
  switch (block.type) {
    case "p":
      return absolutize(lang, block.text);
    case "h":
      return `#### ${absolutize(lang, block.text)}`;
    case "h3":
      return `##### ${absolutize(lang, block.text)}`;
    case "code":
      return `\`\`\`${block.lang}${block.title ? ` title="${block.title}"` : ""}\n${block.code}\n\`\`\``;
    case "list":
      return block.items
        .map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${absolutize(lang, item)}`)
        .join("\n");
    case "note":
      return [block.title ? `**${block.title}**` : null, ...block.text.split("\n")]
        .filter((line): line is string => line !== null)
        .map((line) => `> ${absolutize(lang, line)}`)
        .join("\n");
    case "table": {
      const header = `| ${block.headers.map(escapeTableCell).join(" | ")} |`;
      const divider = `| ${block.headers.map(() => "---").join(" | ")} |`;
      const rows = block.rows.map(
        (row) => `| ${row.map((cell) => escapeTableCell(absolutize(lang, cell))).join(" | ")} |`
      );
      return [header, divider, ...rows].join("\n");
    }
    case "demo":
      return `_Live demo (${block.demo}): ${absolutize(lang, block.caption)}_`;
    case "diagram":
      return `_Diagram (${block.diagram}): ${absolutize(lang, block.caption)}_`;
    case "details":
      return [
        `**${block.title}**`,
        "",
        ...block.blocks.flatMap((inner) => [renderBlock(lang, inner), ""])
      ]
        .join("\n")
        .trim();
  }
};

/** One page as Markdown: what "Copy page" puts on the clipboard. */
export function renderPageMarkdown(lang: string, page: DocPage): string {
  return [
    `# ${page.title}`,
    "",
    absolutize(lang, page.summary),
    "",
    ...page.blocks.flatMap((block) => [renderBlock(lang, block), ""]),
    `Source: ${pageUrl(lang, page.slug)}`
  ].join("\n");
}

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
    "Install `@flemo/react`. Start by deciding which Router handles each navigation and which Slot marks the region that moves. A Part with no `onSwipe*` hook follows its declared pop styles during a swipe automatically; adding a hook replaces that default behavior.",
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
      absolutize(lang, page.summary),
      "",
      ...page.blocks.flatMap((block) => [renderBlock(lang, block), ""])
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
