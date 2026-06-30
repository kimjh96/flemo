// A small, dependency-free tokenizer for the docs code samples. It covers the
// subset that appears here (TSX + shell), enough for readable highlighting
// without pulling in a full grammar. Colors map to shiflo tokens, so the
// palette stays on-brand and introduces no new hex.
export type CodeTokenType = "comment" | "string" | "keyword" | "tag" | "number" | "plain";

export interface CodeToken {
  type: CodeTokenType;
  value: string;
}

const KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "import",
  "from",
  "export",
  "type",
  "interface",
  "new",
  "await",
  "async",
  "if",
  "else",
  "for",
  "while",
  "default",
  "extends",
  "as",
  "true",
  "false",
  "null",
  "undefined",
  "void"
]);

// Order matters: comments and strings first so their contents are not retokenized.
const TSX_PATTERN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(<\/?[A-Za-z][\w.]*|\/>)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;

function tokenizeTsx(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TSX_PATTERN.lastIndex = 0;

  while ((match = TSX_PATTERN.exec(code)) !== null) {
    if (match.index > last) {
      tokens.push({ type: "plain", value: code.slice(last, match.index) });
    }
    if (match[1]) tokens.push({ type: "comment", value: match[1] });
    else if (match[2]) tokens.push({ type: "string", value: match[2] });
    else if (match[3]) tokens.push({ type: "tag", value: match[3] });
    else if (match[4]) tokens.push({ type: "number", value: match[4] });
    else if (match[5]) {
      tokens.push({ type: KEYWORDS.has(match[5]) ? "keyword" : "plain", value: match[5] });
    }
    last = match.index + match[0].length;
  }

  if (last < code.length) tokens.push({ type: "plain", value: code.slice(last) });
  return tokens;
}

// Shell: the command word leads, comments start with #, the rest is plain.
function tokenizeBash(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  code.split(/(\n)/).forEach((line) => {
    if (line === "\n" || line === "") {
      if (line) tokens.push({ type: "plain", value: line });
      return;
    }
    if (line.trimStart().startsWith("#")) {
      tokens.push({ type: "comment", value: line });
      return;
    }
    const lead = line.match(/^(\s*)(\S+)(.*)$/);
    if (!lead) {
      tokens.push({ type: "plain", value: line });
      return;
    }
    const [, space, command, rest] = lead;
    if (space) tokens.push({ type: "plain", value: space });
    tokens.push({ type: "keyword", value: command! });
    if (rest) tokens.push({ type: "plain", value: rest });
  });
  return tokens;
}

export function tokenizeCode(code: string, lang: string): CodeToken[] {
  return lang === "bash" ? tokenizeBash(code) : tokenizeTsx(code);
}

export const TOKEN_COLOR: Record<CodeTokenType, string> = {
  comment: "var(--color-text-disabled)",
  string: "var(--color-success)",
  keyword: "var(--color-primary)",
  tag: "var(--color-accent)",
  number: "var(--color-primary-hover)",
  plain: "var(--color-text-primary)"
};
