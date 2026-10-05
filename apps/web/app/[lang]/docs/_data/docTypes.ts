// The docs content model. Pages are typed data, not MDX: the site renders them,
// and agentDocs.ts renders the same data into llms.txt and llms-full.txt.
//
// INLINE MARKUP inside any `text`, list item or table cell:
//   `code`            inline code
//   **strong**        emphasis, sparingly
//   [label](slug)     a link to another docs page by slug, e.g. [Part](part)
//   [label](https://…) an external link
//   [label](slug#heading text) is NOT supported; link to the page.

// Live demos a page can embed. Each one is a real nested flemo Router running
// in a small device frame (see docs/_components/DocDemo).
export const DEMO_IDS = [
  // list -> detail on the cupertino preset; drag from the left edge to go back
  "cupertino",
  // the same app on the material preset; drag down to dismiss
  "material",
  // the same app on the layout (fade) preset
  "layout",
  // a shared thumbnail moving into the detail hero with <Morph layoutId>
  "morph",
  // a shared top bar whose title changes per screen as a <Part>
  "part",
  // the inbox from the Composition page: a shared header with Parts, a nested
  // memory Router, a card Morph and a Layer, all in one app
  "composition"
] as const;

export type DemoId = (typeof DEMO_IDS)[number];

// Drawn explanations on the How it works page (see docs/_components/DocDiagram).
export const DIAGRAM_IDS = [
  // screens as a stack of cards: push lays one on top, pop lifts it off
  "stack",
  // a transition written once as CSS keyframes, then played by the browser
  "compile",
  // one push in four moments
  "push",
  // a swipe back: the finger sets how far along the pop is
  "swipe",
  // a Morph measured on both screens and moved between them
  "morph",
  // a Slot keeping the header still, and a Part changing only the title
  "slot",
  // a Router inside a screen of another Router
  "nested"
] as const;

export type DiagramId = (typeof DIAGRAM_IDS)[number];

export type CalloutKind = "note" | "tip" | "warn";

export type DocBlock =
  | { type: "p"; text: string }
  // A section heading (h2). Appears in the page's table of contents.
  | { type: "h"; text: string }
  // A sub-heading (h3). Not in the table of contents.
  | { type: "h3"; text: string }
  | {
      type: "code";
      lang: "tsx" | "ts" | "bash";
      code: string;
      // Shown in the code header instead of the language, e.g. "App.tsx".
      title?: string;
      // 1-based lines to emphasise.
      highlight?: number[];
    }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "note"; text: string; kind?: CalloutKind; title?: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "demo"; demo: DemoId; caption: string }
  | { type: "diagram"; diagram: DiagramId; caption: string }
  // Deep material folded away by default: exact rules, edge cases, the why.
  // Readers who need it open it; llms-full.txt always includes it.
  | { type: "details"; title: string; blocks: DocBlock[] };

export interface DocPage {
  slug: string;
  title: string;
  // One sentence. The page lead, the meta description and the llms.txt
  // summary. Under ~30 words.
  summary: string;
  blocks: DocBlock[];
}

export interface LocalizedDocPage {
  en: DocPage;
  ko: DocPage;
}

export interface DocSection {
  title: string;
  pages: DocPage[];
}
