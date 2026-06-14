import { DIRECTIVES, isMnemonic, isRegister, KEYWORDS } from "../isa";
import type { LexResult, Token, TokenKind } from "../types";
import { makeLocation, normalizeSource } from "../utils";

function classifyWord(word: string): TokenKind {
  const upper = word.toUpperCase();
  if (isRegister(upper)) return "register";
  if (isMnemonic(upper)) return "mnemonic";
  if (DIRECTIVES.has(upper) || DIRECTIVES.has(`.${upper}`)) return "directive";
  if (KEYWORDS.has(upper)) return "keyword";
  return "identifier";
}

export function lex(source: string): LexResult {
  const normalized = normalizeSource(source);
  const tokens: Token[] = [];
  const diagnostics: LexResult["diagnostics"] = [];
  let offset = 0;

  const lines = normalized.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    let column = 1;
    let i = 0;
    const push = (kind: TokenKind, value: string, startColumn: number, startOffset: number) => {
      tokens.push({ kind, value, location: makeLocation(lineIndex + 1, startColumn, startOffset) });
    };

    while (i < line.length) {
      const char = line[i];
      const startColumn = column;
      const startOffset = offset + i;

      if (/\s/.test(char)) {
        i += 1;
        column += 1;
        continue;
      }

      if (char === ";") {
        push("comment", line.slice(i), startColumn, startOffset);
        column += line.length - i;
        i = line.length;
        continue;
      }

      if (char === "," || char === ":" || char === "[" || char === "]" || char === "(" || char === ")") {
        const kindByChar: Record<string, TokenKind> = {
          ",": "comma",
          ":": "colon",
          "[": "bracketOpen",
          "]": "bracketClose",
          "(": "parenOpen",
          ")": "parenClose"
        };
        push(kindByChar[char], char, startColumn, startOffset);
        i += 1;
        column += 1;
        continue;
      }

      if (char === "+" || char === "-") {
        push("operator", char, startColumn, startOffset);
        i += 1;
        column += 1;
        continue;
      }

      if (char === "?") {
        push("question", char, startColumn, startOffset);
        i += 1;
        column += 1;
        continue;
      }

      if (char === "'" || char === "\"") {
        const quote = char;
        let end = i + 1;
        while (end < line.length && line[end] !== quote) end += 1;
        if (end >= line.length) {
          diagnostics.push({
            severity: "error",
            message: `Unterminated string literal.`,
            location: makeLocation(lineIndex + 1, startColumn, startOffset),
            code: "LEX_UNTERMINATED_STRING"
          });
          push("string", line.slice(i), startColumn, startOffset);
          i = line.length;
          column = line.length + 1;
        } else {
          const value = line.slice(i, end + 1);
          push("string", value, startColumn, startOffset);
          column += value.length;
          i = end + 1;
        }
        continue;
      }

      const numberMatch = line.slice(i).match(/^(?:0x[0-9a-f]+|[0-9][0-9a-f]*h|[01]+b|[0-7]+[oq]|\d+)/i);
      if (numberMatch) {
        push("number", numberMatch[0], startColumn, startOffset);
        i += numberMatch[0].length;
        column += numberMatch[0].length;
        continue;
      }

      const wordMatch = line.slice(i).match(/^\.?[A-Za-z_@$][\w@$]*/);
      if (wordMatch) {
        const value = wordMatch[0];
        push(classifyWord(value), value, startColumn, startOffset);
        i += value.length;
        column += value.length;
        continue;
      }

      diagnostics.push({
        severity: "error",
        message: `Unexpected character "${char}".`,
        location: makeLocation(lineIndex + 1, startColumn, startOffset),
        code: "LEX_UNEXPECTED_CHARACTER"
      });
      i += 1;
      column += 1;
    }

    tokens.push({ kind: "newline", value: "\n", location: makeLocation(lineIndex + 1, line.length + 1, offset + line.length) });
    offset += line.length + 1;
  }

  tokens.push({ kind: "eof", value: "", location: makeLocation(lines.length, lines[lines.length - 1]?.length ?? 1, offset) });
  return { tokens, diagnostics, source: normalized };
}
