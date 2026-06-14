import type { Diagnostic, SourceLocation } from "./types";

export function makeLocation(line: number, column = 1, offset = 0): SourceLocation {
  return { line, column, offset };
}

export function makeDiagnostic(message: string, line: number, column = 1, code?: string): Diagnostic {
  return {
    severity: "error",
    message,
    code,
    location: makeLocation(line, column)
  };
}

export function normalizeSource(source: string): string {
  const trimmed = source.replace(/\r/g, "").trim();
  if (trimmed.startsWith("{")) {
    const end = trimmed.lastIndexOf("}");
    if (end > 0) return trimmed.slice(1, end).trim();
  }
  return source.replace(/\r/g, "");
}

export function splitComment(line: string): { code: string; comment?: string } {
  let quote: "'" | "\"" | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if ((char === "'" || char === "\"") && line[i - 1] !== "\\") {
      quote = quote === char ? null : quote ?? char;
    }
    if (char === ";" && !quote) {
      return { code: line.slice(0, i), comment: line.slice(i) };
    }
  }
  return { code: line };
}

export function splitTopLevel(text: string, delimiter = ","): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let bracketDepth = 0;
  let parenDepth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if ((char === "'" || char === "\"") && text[i - 1] !== "\\") {
      quote = quote === char ? null : quote ?? char;
    }
    if (!quote) {
      if (char === "[") bracketDepth += 1;
      if (char === "]") bracketDepth -= 1;
      if (char === "(") parenDepth += 1;
      if (char === ")") parenDepth -= 1;
    }
    if (char === delimiter && !quote && bracketDepth === 0 && parenDepth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export function parseNumber(raw: string): number | null {
  const text = raw.trim();
  if (/^'.'$/s.test(text)) return text.charCodeAt(1);
  if (/^[+-]?\d+$/.test(text)) return Number.parseInt(text, 10);
  if (/^[+-]?[0-9a-f]+h$/i.test(text)) {
    const sign = text.startsWith("-") ? -1 : 1;
    const body = text.replace(/^[+-]/, "").slice(0, -1);
    return sign * Number.parseInt(body, 16);
  }
  if (/^[+-]?[01]+b$/i.test(text)) {
    const sign = text.startsWith("-") ? -1 : 1;
    const body = text.replace(/^[+-]/, "").slice(0, -1);
    return sign * Number.parseInt(body, 2);
  }
  if (/^[+-]?[0-7]+[oq]$/i.test(text)) {
    const sign = text.startsWith("-") ? -1 : 1;
    const body = text.replace(/^[+-]/, "").slice(0, -1);
    return sign * Number.parseInt(body, 8);
  }
  if (/^[+-]?0x[0-9a-f]+$/i.test(text)) return Number.parseInt(text, 16);
  return null;
}

export function parseStringLiteral(raw: string): { value: string; quote: "'" | "\"" } | null {
  const text = raw.trim();
  if (text.length < 2) return null;
  const quote = text[0];
  if ((quote !== "'" && quote !== "\"") || text[text.length - 1] !== quote) return null;
  return { value: text.slice(1, -1), quote };
}

export function hex(value: number, width = 4): string {
  const mask = width <= 2 ? 0xff : 0xffff;
  return (value & mask).toString(16).toUpperCase().padStart(width, "0");
}

export function signed8(value: number): number {
  const v = value & 0xff;
  return v & 0x80 ? v - 0x100 : v;
}

export function signed16(value: number): number {
  const v = value & 0xffff;
  return v & 0x8000 ? v - 0x10000 : v;
}

export function maskForSize(size: 8 | 16): number {
  return size === 8 ? 0xff : 0xffff;
}

export function signBit(size: 8 | 16): number {
  return size === 8 ? 0x80 : 0x8000;
}
