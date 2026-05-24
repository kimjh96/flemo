export type TokenType =
  | "comment"
  | "string"
  | "number"
  | "function"
  | "key"
  | "punctuation"
  | "text";

export interface Token {
  type: TokenType;
  value: string;
}
