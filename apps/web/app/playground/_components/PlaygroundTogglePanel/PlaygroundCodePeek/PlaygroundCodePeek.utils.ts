import type { Token, TokenType } from "./PlaygroundCodePeek.types";

export const tokenColor: Record<TokenType, string> = {
  comment: "var(--syntax-comment)",
  string: "var(--syntax-string)",
  number: "var(--syntax-number)",
  function: "var(--syntax-function)",
  key: "var(--syntax-key)",
  punctuation: "var(--syntax-punctuation)",
  text: "inherit"
};

const punctuationChars = new Set(["{", "}", "(", ")", "[", "]", ",", ";", ":"]);

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);

    const commentMatch = /^\/\/[^\n]*/.exec(rest);
    if (commentMatch) {
      tokens.push({ type: "comment", value: commentMatch[0] });
      i += commentMatch[0].length;
      continue;
    }

    const stringMatch = /^"[^"\\]*(?:\\.[^"\\]*)*"/.exec(rest);
    if (stringMatch) {
      tokens.push({ type: "string", value: stringMatch[0] });
      i += stringMatch[0].length;
      continue;
    }

    const numberMatch = /^\d+(?:\.\d+)?/.exec(rest);
    if (numberMatch) {
      tokens.push({ type: "number", value: numberMatch[0] });
      i += numberMatch[0].length;
      continue;
    }

    const identMatch = /^[A-Za-z_$][\w$]*/.exec(rest);
    if (identMatch) {
      const ident = identMatch[0];
      const after = rest.slice(ident.length);
      if (/^\s*\(/.test(after)) {
        tokens.push({ type: "function", value: ident });
      } else if (/^\s*:/.test(after)) {
        tokens.push({ type: "key", value: ident });
      } else {
        tokens.push({ type: "text", value: ident });
      }
      i += ident.length;
      continue;
    }

    const char = code[i]!;
    if (punctuationChars.has(char)) {
      tokens.push({ type: "punctuation", value: char });
    } else {
      tokens.push({ type: "text", value: char });
    }
    i += 1;
  }
  return tokens;
}
