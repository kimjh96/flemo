// A small, dependency-free tokenizer for the code on this site. It covers the
// subset that appears here (TSX, TS and shell), enough for readable highlighting
// without shipping a grammar to the client. Colours come from the syntax tokens
// in global.css, so both themes stay on the palette.
export type CodeTokenType =
  "comment" | "string" | "keyword" | "tag" | "number" | "function" | "punctuation" | "plain";

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
  "void",
  "declare",
  "module"
]);

// Order matters: comments and strings first so their contents are not
// retokenized; an identifier directly followed by `(` is a call.
const TSX_PATTERN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(<\/?[A-Za-z][\w.]*|\/?>)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)|([{}()[\];,.:=?|&])/g;

function tokenizeTsx(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TSX_PATTERN.lastIndex = 0;

  while ((match = TSX_PATTERN.exec(code)) !== null) {
    if (match.index > last) tokens.push({ type: "plain", value: code.slice(last, match.index) });
    if (match[1]) tokens.push({ type: "comment", value: match[1] });
    else if (match[2]) tokens.push({ type: "string", value: match[2] });
    else if (match[3]) tokens.push({ type: "tag", value: match[3] });
    else if (match[4]) tokens.push({ type: "number", value: match[4] });
    else if (match[5]) {
      tokens.push({ type: KEYWORDS.has(match[5]) ? "keyword" : "function", value: match[5] });
    } else if (match[6]) {
      tokens.push({ type: KEYWORDS.has(match[6]) ? "keyword" : "plain", value: match[6] });
    } else if (match[7]) tokens.push({ type: "punctuation", value: match[7] });
    last = match.index + match[0].length;
  }

  if (last < code.length) tokens.push({ type: "plain", value: code.slice(last) });
  return tokens;
}

// Shell: the command word leads, comments start with #, the rest is plain.
function tokenizeBash(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  code.split(/(\n)/).forEach((line) => {
    if (line === "") return;
    if (line === "\n") {
      tokens.push({ type: "plain", value: line });
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
    tokens.push({ type: "function", value: command! });
    if (rest) tokens.push({ type: "plain", value: rest });
  });
  return tokens;
}

export function tokenizeCode(code: string, lang: string): CodeToken[] {
  return lang === "bash" ? tokenizeBash(code) : tokenizeTsx(code);
}

export const TOKEN_COLOR: Record<CodeTokenType, string> = {
  comment: "var(--syntax-comment)",
  string: "var(--syntax-string)",
  keyword: "var(--syntax-keyword)",
  tag: "var(--syntax-tag)",
  number: "var(--syntax-number)",
  function: "var(--syntax-function)",
  punctuation: "var(--syntax-punctuation)",
  plain: "var(--code-fg)"
};

// Split tokens into lines so a renderer can number and highlight them. A token
// that spans a newline (a block comment, a template string) is cut at it.
export function tokensToLines(tokens: CodeToken[]): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  for (const token of tokens) {
    const parts = token.value.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1]!.push({ type: token.type, value: part });
    });
  }
  return lines;
}
