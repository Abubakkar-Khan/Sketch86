import { isRegister, MNEMONICS, registerSize, SEGMENT_REGISTERS } from "../isa";
import type {
  AstDataDefinition,
  AstNode,
  DataValue,
  Diagnostic,
  ExpressionTerm,
  Operand,
  ParseResult,
  RegisterName,
  Token
} from "../types";
import { makeDiagnostic, makeLocation, parseNumber, parseStringLiteral, splitTopLevel } from "../utils";

const PREFIXES = new Set(["REP", "REPE", "REPZ", "REPNE", "REPNZ", "LOCK"]);
const DATA_TYPES = new Set(["DB", "DW"]);

function compactLine(tokens: Token[]): string {
  let output = "";
  const noSpaceBefore = new Set([",", ":", "]", ")", "+", "-"]);
  const noSpaceAfter = new Set(["[", "(", "+", "-"]);
  for (const token of tokens.filter((t) => t.kind !== "comment")) {
    const value = token.value;
    if (!output || noSpaceBefore.has(value) || output.endsWith(" ") || noSpaceAfter.has(output.at(-1) ?? "")) {
      output += value;
    } else {
      output += ` ${value}`;
    }
  }
  return output.trim();
}

function stripOuter(text: string, open: string, close: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(open) || !trimmed.endsWith(close)) return null;
  return trimmed.slice(1, -1).trim();
}

function parseDataAtom(text: string): DataValue {
  const trimmed = text.trim();
  if (trimmed === "?") return { kind: "uninitialized", raw: "?" };
  const string = parseStringLiteral(trimmed);
  if (string) return { kind: "string", value: string.value, raw: trimmed };
  const dupMatch = trimmed.match(/^(.+?)\s+DUP\s*\((.*)\)$/i);
  if (dupMatch) {
    const count = parseNumber(dupMatch[1].trim()) ?? 0;
    return { kind: "dup", count, values: splitTopLevel(dupMatch[2]).map(parseDataAtom) };
  }
  return { kind: "number", value: parseNumber(trimmed) ?? 0, raw: trimmed };
}

function parseDataValues(text: string): DataValue[] {
  return splitTopLevel(text).map(parseDataAtom);
}

function parseExpressionTerms(text: string): ExpressionTerm[] {
  const terms: ExpressionTerm[] = [];
  const normalized = text.replace(/-/g, "+-");
  for (const raw of normalized.split("+")) {
    const part = raw.trim();
    if (!part) continue;
    const sign: 1 | -1 = part.startsWith("-") ? -1 : 1;
    const body = part.replace(/^-/, "").trim();
    const num = parseNumber(body);
    if (num !== null) {
      terms.push({ kind: "number", value: body, sign, numericValue: Math.abs(num) });
    } else if (isRegister(body.toUpperCase())) {
      terms.push({ kind: "register", value: body.toUpperCase(), sign });
    } else {
      terms.push({ kind: "identifier", value: body, sign });
    }
  }
  return terms;
}

function parseMemoryOperand(raw: string, explicitSize: 8 | 16 | undefined, diagnostics: Diagnostic[], line: number): Operand | null {
  let text = raw.trim();
  let symbol: string | undefined;
  let inner = stripOuter(text, "[", "]");

  const symbolIndexed = text.match(/^([A-Za-z_@$][\w@$]*)\s*\[(.*)\]$/);
  if (!inner && symbolIndexed) {
    symbol = symbolIndexed[1];
    inner = symbolIndexed[2].trim();
  }
  if (!inner) return null;

  const terms = parseExpressionTerms(inner);
  const registers = terms.filter((term) => term.kind === "register").map((term) => term.value.toUpperCase());
  const invalidRegisters = registers.filter((reg) => !["BX", "BP", "SI", "DI"].includes(reg));
  if (invalidRegisters.length) {
    diagnostics.push(makeDiagnostic(`Invalid addressing mode "${raw}". 8086 memory addressing cannot use ${invalidRegisters.join(", ")} as memory base/index registers.`, line, 1, "INVALID_ADDRESS_REGISTER"));
  }

  const hasBX = registers.includes("BX");
  const hasBP = registers.includes("BP");
  const hasSI = registers.includes("SI");
  const hasDI = registers.includes("DI");
  if ((hasBX && hasBP) || (hasSI && hasDI)) {
    diagnostics.push(makeDiagnostic(`Invalid addressing mode "${raw}". Valid 8086 pairs are BX+SI, BX+DI, BP+SI, or BP+DI.`, line, 1, "INVALID_ADDRESS_PAIR"));
  }

  const displacement = terms
    .filter((term) => term.kind === "number")
    .reduce((sum, term) => sum + term.sign * (term.numericValue ?? 0), 0);

  return {
    type: "memory",
    text,
    size: explicitSize,
    symbol,
    base: hasBX ? "BX" : hasBP ? "BP" : undefined,
    index: hasSI ? "SI" : hasDI ? "DI" : undefined,
    displacement,
    terms
  };
}

export function parseOperand(raw: string, diagnostics: Diagnostic[], line: number): Operand {
  let text = raw.trim();
  let explicitSize: 8 | 16 | undefined;

  const sizeMatch = text.match(/^(BYTE|WORD)\s+PTR\s+(.+)$/i);
  if (sizeMatch) {
    explicitSize = sizeMatch[1].toUpperCase() === "BYTE" ? 8 : 16;
    text = sizeMatch[2].trim();
  }

  const offsetMatch = text.match(/^OFFSET\s+([A-Za-z_@$][\w@$]*)$/i);
  if (offsetMatch) return { type: "symbol", name: offsetMatch[1], offsetOnly: true, text: raw.trim() };

  const register = text.toUpperCase();
  const size = registerSize(register);
  if (size && isRegister(register)) return { type: "register", name: register as RegisterName, size, text: raw.trim() };

  const memory = parseMemoryOperand(text, explicitSize, diagnostics, line);
  if (memory) return memory;

  const string = parseStringLiteral(text);
  if (string) return { type: "string", value: string.value, quote: string.quote, text: raw.trim() };

  const number = parseNumber(text);
  if (number !== null) return { type: "immediate", value: number, raw: text, size: explicitSize, text: raw.trim() };

  return { type: "symbol", name: text, text: raw.trim() };
}

function parseInstruction(text: string, lineNumber: number, diagnostics: Diagnostic[], locationColumn = 1): AstNode {
  const parts = text.trim().split(/\s+/);
  let prefix: "REP" | "REPE" | "REPZ" | "REPNE" | "REPNZ" | "LOCK" | undefined;
  let mnemonic = parts[0]?.toUpperCase() ?? "";
  let operandText = text.slice(parts[0]?.length ?? 0).trim();

  if (PREFIXES.has(mnemonic)) {
    prefix = mnemonic as typeof prefix;
    mnemonic = parts[1]?.toUpperCase() ?? "";
    operandText = text.slice(parts[0].length + (parts[1]?.length ?? 0) + 1).trim();
  }

  if (!MNEMONICS.has(mnemonic)) {
    diagnostics.push(makeDiagnostic(`Unknown instruction "${mnemonic}".`, lineNumber, locationColumn, "UNKNOWN_INSTRUCTION"));
  }

  const operands = operandText ? splitTopLevel(operandText).map((operand) => parseOperand(operand, diagnostics, lineNumber)) : [];
  return {
    type: "instruction",
    mnemonic,
    prefix,
    operands,
    text,
    lineNumber,
    location: makeLocation(lineNumber, locationColumn)
  };
}

function parseLine(tokens: Token[], diagnostics: Diagnostic[]): AstNode[] {
  const first = tokens.find((token) => token.kind !== "comment");
  if (!first) return [];
  const lineNumber = first.location.line;
  let text = compactLine(tokens);
  if (!text) return [];

  const nodes: AstNode[] = [];
  const labelMatch = text.match(/^([A-Za-z_@$][\w@$]*):\s*(.*)$/);
  if (labelMatch) {
    nodes.push({ type: "label", name: labelMatch[1], text: `${labelMatch[1]}:`, lineNumber, location: first.location });
    text = labelMatch[2].trim();
    if (!text) return nodes;
  }

  const procMatch = text.match(/^([A-Za-z_@$][\w@$]*)\s+PROC$/i);
  if (procMatch) {
    nodes.push({ type: "label", name: procMatch[1], text, lineNumber, location: first.location });
    nodes.push({ type: "directive", name: "PROC", args: [procMatch[1]], text, lineNumber, location: first.location });
    return nodes;
  }

  const segmentMatch = text.match(/^([A-Za-z_@$][\w@$]*)\s+(SEGMENT|ENDS|ENDP)$/i);
  if (segmentMatch) {
    nodes.push({ type: "directive", name: segmentMatch[2].toUpperCase(), args: [segmentMatch[1]], text, lineNumber, location: first.location });
    return nodes;
  }

  const equMatch = text.match(/^([A-Za-z_@$][\w@$]*)\s+EQU\s+(.+)$/i);
  if (equMatch) {
    nodes.push({ type: "equ", name: equMatch[1], expression: equMatch[2].trim(), text, lineNumber, location: first.location });
    return nodes;
  }

  const dataMatch = text.match(/^([A-Za-z_@$][\w@$]*)\s+(DB|DW)\s+(.+)$/i);
  if (dataMatch) {
    nodes.push({
      type: "data",
      name: dataMatch[1],
      dataType: dataMatch[2].toUpperCase() as AstDataDefinition["dataType"],
      values: parseDataValues(dataMatch[3]),
      text,
      lineNumber,
      location: first.location
    });
    return nodes;
  }

  const firstWord = text.split(/\s+/)[0]?.toUpperCase();
  if (firstWord?.startsWith(".") || ["ORG", "END", "ASSUME", ".MODEL", ".STACK", ".DATA", ".CODE"].includes(firstWord)) {
    nodes.push({
      type: "directive",
      name: firstWord,
      args: text.slice(firstWord.length).trim() ? splitTopLevel(text.slice(firstWord.length).trim(), " ") : [],
      text,
      lineNumber,
      location: first.location
    });
    return nodes;
  }

  if (DATA_TYPES.has(firstWord)) {
    diagnostics.push(makeDiagnostic(`Data declaration is missing a variable name before ${firstWord}.`, lineNumber, first.location.column, "DATA_MISSING_NAME"));
    return nodes;
  }

  nodes.push(parseInstruction(text, lineNumber, diagnostics, first.location.column));
  return nodes;
}

export function parse(tokens: Token[]): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const nodes: AstNode[] = [];
  let current: Token[] = [];

  for (const token of tokens) {
    if (token.kind === "newline" || token.kind === "eof") {
      nodes.push(...parseLine(current, diagnostics));
      current = [];
    } else {
      current.push(token);
    }
  }

  return {
    nodes,
    diagnostics,
    source: tokens.map((token) => token.value).join("")
  };
}

export function validateSegmentRegister(name: string): name is "CS" | "DS" | "ES" | "SS" {
  return (SEGMENT_REGISTERS as readonly string[]).includes(name.toUpperCase());
}
