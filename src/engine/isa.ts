import type { FlagName, RegisterName, SupportMatrixEntry } from "./types";

export const REGISTER_NAMES = [
  "AX",
  "BX",
  "CX",
  "DX",
  "AH",
  "AL",
  "BH",
  "BL",
  "CH",
  "CL",
  "DH",
  "DL",
  "SI",
  "DI",
  "BP",
  "SP",
  "CS",
  "DS",
  "ES",
  "SS",
  "IP"
] as const satisfies readonly RegisterName[];

export const WORD_REGISTERS = ["AX", "BX", "CX", "DX", "SI", "DI", "BP", "SP", "CS", "DS", "ES", "SS", "IP"] as const;
export const BYTE_REGISTERS = ["AH", "AL", "BH", "BL", "CH", "CL", "DH", "DL"] as const;
export const SEGMENT_REGISTERS = ["CS", "DS", "ES", "SS"] as const;
export const FLAGS: FlagName[] = ["CF", "PF", "AF", "ZF", "SF", "TF", "IF", "DF", "OF"];

export const BYTE_TO_WORD_REGISTER: Record<string, { parent: "AX" | "BX" | "CX" | "DX"; shift: 0 | 8 }> = {
  AL: { parent: "AX", shift: 0 },
  AH: { parent: "AX", shift: 8 },
  BL: { parent: "BX", shift: 0 },
  BH: { parent: "BX", shift: 8 },
  CL: { parent: "CX", shift: 0 },
  CH: { parent: "CX", shift: 8 },
  DL: { parent: "DX", shift: 0 },
  DH: { parent: "DX", shift: 8 }
};

export const FULLY_SUPPORTED = new Set([
  "MOV",
  "XCHG",
  "LEA",
  "PUSH",
  "POP",
  "PUSHF",
  "POPF",
  "LAHF",
  "SAHF",
  "ADD",
  "ADC",
  "SUB",
  "SBB",
  "INC",
  "DEC",
  "NEG",
  "CMP",
  "MUL",
  "IMUL",
  "DIV",
  "IDIV",
  "CBW",
  "CWD",
  "AND",
  "OR",
  "XOR",
  "NOT",
  "TEST",
  "SHL",
  "SAL",
  "SHR",
  "SAR",
  "ROL",
  "ROR",
  "RCL",
  "RCR",
  "JMP",
  "CALL",
  "RET",
  "LOOP",
  "LOOPE",
  "LOOPZ",
  "LOOPNE",
  "LOOPNZ",
  "JCXZ",
  "JA",
  "JNBE",
  "JAE",
  "JNB",
  "JB",
  "JNAE",
  "JBE",
  "JNA",
  "JC",
  "JNC",
  "JE",
  "JZ",
  "JNE",
  "JNZ",
  "JG",
  "JNLE",
  "JGE",
  "JNL",
  "JL",
  "JNGE",
  "JLE",
  "JNG",
  "JO",
  "JNO",
  "JS",
  "JNS",
  "JP",
  "JPE",
  "JNP",
  "JPO",
  "MOVSB",
  "MOVSW",
  "CMPSB",
  "CMPSW",
  "SCASB",
  "SCASW",
  "LODSB",
  "LODSW",
  "STOSB",
  "STOSW",
  "CLC",
  "STC",
  "CMC",
  "CLD",
  "STD",
  "CLI",
  "STI",
  "NOP",
  "HLT"
]);

export const COMPATIBILITY_SUPPORTED = new Set(["PUSHA", "POPA"]);

export const PARTIAL_SUPPORTED = new Set([
  "LDS",
  "LES",
  "XLAT",
  "INT",
  "INTO",
  "IRET",
  "RETF",
  "REP",
  "REPE",
  "REPZ",
  "REPNE",
  "REPNZ",
  "AAA",
  "AAD",
  "AAM",
  "AAS",
  "DAA",
  "DAS"
]);

export const UNSUPPORTED = new Set(["IN", "OUT", "WAIT", "ESC", "LOCK", "PUSHAD", "POPAD", "ENTER", "LEAVE"]);

export const MNEMONICS = new Set([...FULLY_SUPPORTED, ...COMPATIBILITY_SUPPORTED, ...PARTIAL_SUPPORTED, ...UNSUPPORTED]);

export const DIRECTIVES = new Set([
  "ORG",
  "DB",
  "DW",
  "DUP",
  "EQU",
  "END",
  ".MODEL",
  ".STACK",
  ".DATA",
  ".CODE",
  "PROC",
  "ENDP",
  "SEGMENT",
  "ENDS",
  "ASSUME",
  "OFFSET"
]);

export const KEYWORDS = new Set(["BYTE", "WORD", "PTR", "SHORT", "NEAR", "FAR"]);

export function isRegister(value: string): value is RegisterName {
  return (REGISTER_NAMES as readonly string[]).includes(value.toUpperCase());
}

export function registerSize(value: string): 8 | 16 | null {
  const upper = value.toUpperCase();
  if ((BYTE_REGISTERS as readonly string[]).includes(upper)) return 8;
  if ((WORD_REGISTERS as readonly string[]).includes(upper)) return 16;
  return null;
}

export function isMnemonic(value: string): boolean {
  return MNEMONICS.has(value.toUpperCase());
}

export function getSupportMatrix(): SupportMatrixEntry[] {
  const instructionRows = [
    ...[...FULLY_SUPPORTED].sort().map((feature) => ({
      category: "Instruction",
      feature,
      status: "supported" as const,
      notes: "Implemented in the educational CPU engine."
    })),
    ...[...COMPATIBILITY_SUPPORTED].sort().map((feature) => ({
      category: "Instruction",
      feature,
      status: "supported" as const,
      notes: "80186+ instruction; supported for classroom/emulator compatibility, not base 8086."
    })),
    ...[...PARTIAL_SUPPORTED].sort().map((feature) => ({
      category: "Instruction",
      feature,
      status: "partial" as const,
      notes: "Supported with educational or limited simulator behavior."
    })),
    ...[...UNSUPPORTED].sort().map((feature) => ({
      category: "Instruction",
      feature,
      status: "unsupported" as const,
      notes: "Browser simulator reports a clear unsupported diagnostic."
    }))
  ];

  return [
    ...instructionRows,
    { category: "Directive", feature: "ORG", status: "supported", notes: "Sets the internal code origin." },
    { category: "Directive", feature: "DB / DW / DUP", status: "supported", notes: "Allocates byte/word data in little-endian memory." },
    { category: "Directive", feature: "EQU / OFFSET", status: "supported", notes: "Resolves constants and data offsets." },
    { category: "Directive", feature: ".MODEL / .STACK / ASSUME", status: "partial", notes: "Accepted for MASM-like classroom syntax; model metadata is not fully enforced." },
    { category: "Addressing", feature: "[BX+SI+disp]", status: "supported", notes: "Valid 8086 memory forms are validated." },
    { category: "Addressing", feature: "[AX] / [SP] / [BX+BP]", status: "unsupported", notes: "Rejected with line-based addressing diagnostics." },
    { category: "Interrupt", feature: "INT 21h AH=01h/02h/09h/4Ch", status: "supported", notes: "Learning-friendly DOS services." },
    { category: "Interrupt", feature: "INT 20h", status: "supported", notes: "Terminates the program." },
    { category: "Interrupt", feature: "Other BIOS/DOS interrupts", status: "unsupported", notes: "Reported honestly as unsupported." }
  ];
}
