export type Severity = "error" | "warning" | "info";

export type SourceLocation = {
  line: number;
  column: number;
  offset: number;
};

export type Diagnostic = {
  severity: Severity;
  message: string;
  location: SourceLocation;
  code?: string;
};

export type TokenKind =
  | "identifier"
  | "register"
  | "mnemonic"
  | "directive"
  | "number"
  | "string"
  | "comma"
  | "colon"
  | "bracketOpen"
  | "bracketClose"
  | "parenOpen"
  | "parenClose"
  | "operator"
  | "question"
  | "comment"
  | "newline"
  | "keyword"
  | "eof";

export type Token = {
  kind: TokenKind;
  value: string;
  location: SourceLocation;
};

export type LexResult = {
  tokens: Token[];
  diagnostics: Diagnostic[];
  source: string;
};

export type RegisterName =
  | "AX"
  | "BX"
  | "CX"
  | "DX"
  | "AH"
  | "AL"
  | "BH"
  | "BL"
  | "CH"
  | "CL"
  | "DH"
  | "DL"
  | "SI"
  | "DI"
  | "BP"
  | "SP"
  | "CS"
  | "DS"
  | "ES"
  | "SS"
  | "IP";

export type FlagName = "CF" | "PF" | "AF" | "ZF" | "SF" | "TF" | "IF" | "DF" | "OF";

export type Registers = Record<Exclude<RegisterName, "AH" | "AL" | "BH" | "BL" | "CH" | "CL" | "DH" | "DL">, number>;

export type Flags = Record<FlagName, boolean>;

export type Segments = {
  CS: number;
  DS: number;
  ES: number;
  SS: number;
};

export type NumberLiteral = {
  raw: string;
  value: number;
};

export type ExpressionTerm = {
  kind: "number" | "identifier" | "register";
  value: string;
  sign: 1 | -1;
  numericValue?: number;
};

export type Operand =
  | { type: "register"; name: RegisterName; size: 8 | 16; text: string }
  | { type: "immediate"; value: number; raw: string; size?: 8 | 16; text: string }
  | { type: "string"; value: string; quote: "'" | "\""; text: string }
  | { type: "symbol"; name: string; offsetOnly?: boolean; text: string }
  | {
      type: "memory";
      text: string;
      size?: 8 | 16;
      symbol?: string;
      segment?: "CS" | "DS" | "ES" | "SS";
      base?: "BX" | "BP";
      index?: "SI" | "DI";
      displacement: number;
      terms: ExpressionTerm[];
    };

export type AstInstruction = {
  type: "instruction";
  mnemonic: string;
  operands: Operand[];
  prefix?: "REP" | "REPE" | "REPZ" | "REPNE" | "REPNZ" | "LOCK";
  text: string;
  lineNumber: number;
  location: SourceLocation;
};

export type AstDirective = {
  type: "directive";
  name: string;
  args: string[];
  text: string;
  lineNumber: number;
  location: SourceLocation;
};

export type AstLabel = {
  type: "label";
  name: string;
  text: string;
  lineNumber: number;
  location: SourceLocation;
};

export type AstDataDefinition = {
  type: "data";
  name: string;
  dataType: "DB" | "DW";
  values: DataValue[];
  text: string;
  lineNumber: number;
  location: SourceLocation;
};

export type AstEqu = {
  type: "equ";
  name: string;
  expression: string;
  value?: number;
  text: string;
  lineNumber: number;
  location: SourceLocation;
};

export type AstNode = AstInstruction | AstDirective | AstLabel | AstDataDefinition | AstEqu;

export type AstProgram = {
  nodes: AstNode[];
  diagnostics: Diagnostic[];
  source: string;
};

export type DataValue =
  | { kind: "number"; value: number; raw: string }
  | { kind: "string"; value: string; raw: string }
  | { kind: "dup"; count: number; values: DataValue[] }
  | { kind: "uninitialized"; raw: "?" };

export type SymbolKind = "label" | "data" | "equ" | "procedure" | "segment";

export type SymbolInfo = {
  name: string;
  kind: SymbolKind;
  address: number;
  size?: 8 | 16;
  byteLength?: number;
  value?: number;
  lineNumber: number;
};

export type SymbolTable = Record<string, SymbolInfo>;

export type Instruction = AstInstruction & {
  address: number;
};

export type ExecutableProgram = {
  source: string;
  instructions: Instruction[];
  symbols: SymbolTable;
  memoryImage: Uint8Array;
  origin: number;
  entryAddress: number;
  dataStart: number;
  addressToIndex: Map<number, number>;
  diagnostics: Diagnostic[];
};

export type AssembleOptions = {
  origin?: number;
  dataStart?: number;
};

export type AssembleResult = {
  program?: ExecutableProgram;
  ast?: AstProgram;
  lex?: LexResult;
  diagnostics: Diagnostic[];
};

export type RegisterChange = {
  name: string;
  before: number;
  after: number;
};

export type FlagChange = {
  name: FlagName;
  before: boolean;
  after: boolean;
  reason?: string;
};

export type MemoryChange = {
  address: number;
  before: number;
  after: number;
};

export type StackChange = {
  kind: "push" | "pop" | "call" | "ret";
  value: number;
  spBefore: number;
  spAfter: number;
};

export type CPUStateSnapshot = {
  registers: Registers;
  flags: Flags;
  segments: Segments;
  halted: boolean;
  output: string[];
};

export type TraceEntry = {
  lineNumber: number;
  address: number;
  instructionText: string;
  explanation: string;
  before: CPUStateSnapshot;
  after: CPUStateSnapshot;
  changes: {
    registers: RegisterChange[];
    flags: FlagChange[];
    memory: MemoryChange[];
    stack: StackChange[];
  };
};

export type RuntimeError = {
  message: string;
  lineNumber?: number;
  address?: number;
};

export type ExecutionState = {
  registers: Registers;
  flags: Flags;
  memory: Uint8Array;
  segments: Segments;
  ip: number;
  halted: boolean;
  waitingForInput: boolean;
  currentInstruction: Instruction | null;
  trace: TraceEntry[];
  output: string[];
  errors: RuntimeError[];
};

export type RunResult = {
  halted: boolean;
  steps: number;
  trace: TraceEntry[];
  errors: RuntimeError[];
};

export type SupportStatus = "supported" | "partial" | "unsupported";

export type SupportMatrixEntry = {
  category: string;
  feature: string;
  status: SupportStatus;
  notes: string;
};

export type ParseResult = AstProgram;
