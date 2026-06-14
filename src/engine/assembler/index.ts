import { lex } from "../lexer";
import { PARTIAL_SUPPORTED, UNSUPPORTED } from "../isa";
import { parse } from "../parser";
import type {
  AssembleOptions,
  AssembleResult,
  AstDataDefinition,
  AstNode,
  DataValue,
  Diagnostic,
  ExecutableProgram,
  Instruction,
  Operand,
  SymbolTable
} from "../types";
import { makeDiagnostic, parseNumber } from "../utils";

const DEFAULT_ORIGIN = 0x0100;
const DEFAULT_DATA_START = 0x0200;
const MEMORY_SIZE = 1024 * 1024;

function flattenData(values: DataValue[], size: 8 | 16): number[] {
  const out: number[] = [];
  for (const value of values) {
    if (value.kind === "number") out.push(value.value);
    if (value.kind === "uninitialized") out.push(0);
    if (value.kind === "string") {
      for (const char of value.value) out.push(char.charCodeAt(0));
    }
    if (value.kind === "dup") {
      const nested = flattenData(value.values, size);
      for (let i = 0; i < value.count; i += 1) out.push(...nested);
    }
  }
  return out;
}

function writeData(memory: Uint8Array, address: number, values: number[], size: 8 | 16): number {
  let cursor = address;
  for (const value of values) {
    memory[cursor] = value & 0xff;
    if (size === 16) {
      memory[cursor + 1] = (value >> 8) & 0xff;
      cursor += 2;
    } else {
      cursor += 1;
    }
  }
  return cursor;
}

function evalAssemblerExpression(expression: string, symbols: SymbolTable): number | undefined {
  const normalized = expression.trim();
  const number = parseNumber(normalized);
  if (number !== null) return number & 0xffff;
  const symbol = symbols[normalized.toUpperCase()];
  if (symbol?.value !== undefined) return symbol.value;
  if (symbol) return symbol.address;
  return undefined;
}

function validateOperandSymbols(operand: Operand, symbols: SymbolTable, instruction: Instruction, diagnostics: Diagnostic[]) {
  if (operand.type === "symbol") {
    if (!symbols[operand.name.toUpperCase()]) {
      diagnostics.push(makeDiagnostic(`Unknown symbol "${operand.name}".`, instruction.lineNumber, 1, "UNKNOWN_SYMBOL"));
    }
  }
  if (operand.type === "memory") {
    if (operand.symbol && !symbols[operand.symbol.toUpperCase()]) {
      diagnostics.push(makeDiagnostic(`Unknown symbol "${operand.symbol}".`, instruction.lineNumber, 1, "UNKNOWN_SYMBOL"));
    }
    for (const term of operand.terms) {
      if (term.kind === "identifier" && !symbols[term.value.toUpperCase()]) {
        diagnostics.push(makeDiagnostic(`Unknown symbol "${term.value}".`, instruction.lineNumber, 1, "UNKNOWN_SYMBOL"));
      }
    }
  }
}

function inferImmediateSize(value: number): 8 | 16 {
  return value >= -128 && value <= 0xff ? 8 : 16;
}

function operandDeclaredSize(operand: Operand, symbols: SymbolTable): 8 | 16 | undefined {
  if (operand.type === "register") return operand.size;
  if (operand.type === "memory") {
    if (operand.size) return operand.size;
    if (operand.symbol) return symbols[operand.symbol.toUpperCase()]?.size;
  }
  if (operand.type === "symbol") return symbols[operand.name.toUpperCase()]?.size;
  if (operand.type === "immediate") return operand.size ?? inferImmediateSize(operand.value);
  return undefined;
}

function validateSizes(instruction: Instruction, symbols: SymbolTable, diagnostics: Diagnostic[]) {
  const [left, right] = instruction.operands;
  if (!left || !right) return;
  const mnemonic = instruction.mnemonic.toUpperCase();
  if (!["MOV", "XCHG", "ADD", "ADC", "SUB", "SBB", "CMP", "AND", "OR", "XOR", "TEST"].includes(mnemonic)) return;
  const leftSize = operandDeclaredSize(left, symbols);
  const rightSize = operandDeclaredSize(right, symbols);
  if (!leftSize || !rightSize) return;
  if (right.type === "immediate" && right.value <= (leftSize === 8 ? 0xff : 0xffff)) return;
  if (leftSize !== rightSize) {
    diagnostics.push(makeDiagnostic(`Operand size mismatch. Cannot use ${rightSize}-bit ${right.text} with ${leftSize}-bit ${left.text}.`, instruction.lineNumber, 1, "OPERAND_SIZE_MISMATCH"));
  }
}

export function assemble(source: string, options: AssembleOptions = {}): AssembleResult {
  const lexResult = lex(source);
  const ast = parse(lexResult.tokens);
  const diagnostics: Diagnostic[] = [...lexResult.diagnostics, ...ast.diagnostics];
  const symbols: SymbolTable = {};
  const memoryImage = new Uint8Array(MEMORY_SIZE);
  const instructions: Instruction[] = [];
  let origin = options.origin ?? DEFAULT_ORIGIN;
  let dataCursor = options.dataStart ?? DEFAULT_DATA_START;
  let section: "code" | "data" = "code";
  let codeAddress = origin;

  symbols["@DATA"] = {
    name: "@data",
    kind: "equ",
    address: 0,
    value: 0,
    lineNumber: 1
  };

  for (const node of ast.nodes) {
    if (node.type === "directive") {
      const name = node.name.toUpperCase();
      if (name === "ORG") {
        const value = parseNumber(node.args.join(" "));
        if (value === null) diagnostics.push(makeDiagnostic(`ORG expects a numeric address.`, node.lineNumber, 1, "INVALID_ORG"));
        else {
          origin = value & 0xffff;
          codeAddress = origin;
        }
      }
      if (name === ".DATA" || name === "SEGMENT") section = "data";
      if (name === ".CODE" || name === "ENDS") section = "code";
      continue;
    }

    if (node.type === "equ") {
      const value = evalAssemblerExpression(node.expression, symbols);
      if (value === undefined) diagnostics.push(makeDiagnostic(`Could not resolve EQU expression "${node.expression}".`, node.lineNumber, 1, "INVALID_EQU"));
      symbols[node.name.toUpperCase()] = { name: node.name, kind: "equ", address: value ?? 0, value: value ?? 0, lineNumber: node.lineNumber };
      continue;
    }

    if (node.type === "label") {
      symbols[node.name.toUpperCase()] = {
        name: node.name,
        kind: section === "code" ? "label" : "data",
        address: section === "code" ? codeAddress : dataCursor,
        lineNumber: node.lineNumber
      };
      continue;
    }

    if (node.type === "data") {
      const size: 8 | 16 = node.dataType === "DB" ? 8 : 16;
      const values = flattenData(node.values, size);
      const start = dataCursor;
      dataCursor = writeData(memoryImage, dataCursor, values, size);
      symbols[node.name.toUpperCase()] = {
        name: node.name,
        kind: "data",
        address: start,
        size,
        byteLength: dataCursor - start,
        lineNumber: node.lineNumber
      };
      continue;
    }

    if (node.type === "instruction") {
      const inst: Instruction = { ...node, address: codeAddress };
      instructions.push(inst);
      codeAddress = (codeAddress + 1) & 0xffff;
    }
  }

  const addressToIndex = new Map<number, number>();
  instructions.forEach((instruction, index) => addressToIndex.set(instruction.address, index));

  for (const instruction of instructions) {
    if (UNSUPPORTED.has(instruction.mnemonic)) {
      diagnostics.push(makeDiagnostic(`${instruction.mnemonic} is not supported yet in this browser simulator.`, instruction.lineNumber, 1, "UNSUPPORTED_INSTRUCTION"));
    }
    if (PARTIAL_SUPPORTED.has(instruction.mnemonic)) {
      diagnostics.push({
        severity: "warning",
        message: `${instruction.mnemonic} has limited educational behavior in Sketch86.`,
        location: { line: instruction.lineNumber, column: 1, offset: 0 },
        code: "PARTIAL_INSTRUCTION"
      });
    }
    instruction.operands.forEach((operand) => validateOperandSymbols(operand, symbols, instruction, diagnostics));
    validateSizes(instruction, symbols, diagnostics);
  }

  const program: ExecutableProgram = {
    source,
    instructions,
    symbols,
    memoryImage,
    origin,
    entryAddress: symbols.MAIN?.address ?? origin,
    dataStart: options.dataStart ?? DEFAULT_DATA_START,
    addressToIndex,
    diagnostics
  };

  return { program: diagnostics.some((d) => d.severity === "error") ? undefined : program, ast, lex: lexResult, diagnostics };
}

export { getSupportMatrix } from "../isa";
