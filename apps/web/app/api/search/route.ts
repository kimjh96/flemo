import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

// Orama doesn't ship a Korean tokenizer, and its English tokenizer applies Porter-style
// normalization that drops non-Latin tokens. Use a simple whitespace + punctuation splitter that
// keeps every Unicode word as-is, so Korean text is searchable.
const splitTokenizer = {
  language: "english",
  normalizationCache: new Map<string, string>(),
  tokenize: (raw: string): string[] =>
    raw
      .toLowerCase()
      .split(/[\s,.;:!?()[\]{}'"`~@#$%^&*+=<>/\\|·—–-]+/u)
      .filter((token) => token.length > 0)
};

export const { GET } = createFromSource(source, {
  localeMap: {
    en: { tokenizer: splitTokenizer },
    ko: { tokenizer: splitTokenizer }
  }
});
