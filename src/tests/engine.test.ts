import { describe, expect, it } from "vitest";
import { assemble, createCPU, lex, parse } from "../engine";
import { Memory8086 } from "../engine/memory";
import { examples } from "../examples";

function runSource(source: string, max = 500) {
  const result = assemble(source);
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(result.program).toBeTruthy();
  const cpu = createCPU(result.program!);
  cpu.run(max);
  return cpu.state();
}

describe("lexer", () => {
  it("recognizes comments, strings, numbers, registers, and brackets", () => {
    const result = lex("MOV AX, [BX+SI+4] ; comment\nmsg DB 'Hello$', 0FFh");
    expect(result.diagnostics).toEqual([]);
    expect(result.tokens.map((token) => token.kind)).toContain("comment");
    expect(result.tokens.map((token) => token.kind)).toContain("string");
    expect(result.tokens.some((token) => token.value.toUpperCase() === "AX")).toBe(true);
    expect(result.tokens.some((token) => token.value === "[")).toBe(true);
  });
});

describe("parser", () => {
  it("parses memory operands into structured form", () => {
    const ast = parse(lex("MOV AX, [BX+SI+4]").tokens);
    const instruction = ast.nodes.find((node) => node.type === "instruction");
    expect(instruction?.type).toBe("instruction");
    if (instruction?.type === "instruction") {
      expect(instruction.operands[1]).toMatchObject({ type: "memory", base: "BX", index: "SI", displacement: 4 });
    }
  });

  it("rejects invalid 8086 addressing modes", () => {
    const ast = parse(lex("MOV AX, [AX]\nMOV AX, [BX+BP]\nMOV AX, [SI+DI]").tokens);
    expect(ast.diagnostics.map((d) => d.code)).toContain("INVALID_ADDRESS_REGISTER");
    expect(ast.diagnostics.map((d) => d.code)).toContain("INVALID_ADDRESS_PAIR");
  });
});

describe("assembler", () => {
  it("resolves ORG, labels, DB, DW, DUP, and EQU", () => {
    const result = assemble(`ORG 120h
COUNT EQU 3
.data
buffer DB 3 DUP(0)
value DW 1234h
.code
start:
MOV AX, value
HLT`);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(result.program?.origin).toBe(0x120);
    expect(result.program?.symbols.START.address).toBe(0x120);
    expect(result.program?.symbols.BUFFER.byteLength).toBe(3);
    expect(result.program?.symbols.VALUE.size).toBe(16);
  });

  it("reports unknown labels and operand size mismatch", () => {
    const result = assemble(`MOV AX, missing_label
MOV AL, BX
MOV WORD PTR [1000h], AL`);
    expect(result.diagnostics.some((d) => d.code === "UNKNOWN_SYMBOL")).toBe(true);
    expect(result.diagnostics.some((d) => d.code === "OPERAND_SIZE_MISMATCH")).toBe(true);
  });
});

describe("cpu", () => {
  it("maps AH and AL correctly into AX", () => {
    const state = runSource(`ORG 100h
MOV AX, 1234h
MOV AL, 56h
MOV AH, 78h
HLT`);
    expect(state.registers.AX).toBe(0x7856);
  });

  it("sets ZF after subtraction to zero", () => {
    const state = runSource(`MOV AX, 1
SUB AX, 1
HLT`);
    expect(state.registers.AX).toBe(0);
    expect(state.flags.ZF).toBe(true);
  });

  it("uses 1 MB segmented memory and little-endian words", () => {
    const memory = new Memory8086();
    memory.writeWord(0x1000, 0x0010, 0x1234);
    expect(memory.readByte(0x1000, 0x0010)).toBe(0x34);
    expect(memory.readByte(0x1000, 0x0011)).toBe(0x12);
    expect(memory.physical(0x1000, 0x0010)).toBe(0x10010);
  });

  it("pushes, pops, calls, and returns with SS:SP", () => {
    const state = runSource(`MOV AX, 2
CALL more
HLT
more:
PUSH AX
POP BX
RET`);
    expect(state.registers.BX).toBe(2);
    expect(state.registers.SP).toBe(0xfffe);
  });

  it("prints INT 21h strings and characters", () => {
    const state = runSource(`.data
msg db 'Hi$', 0
.code
LEA DX, msg
MOV AH, 09h
INT 21h
MOV DL, '!'
MOV AH, 02h
INT 21h
MOV AH, 4Ch
INT 21h`);
    expect(state.output.join("")).toBe("Hi!");
    expect(state.halted).toBe(true);
  });

  it("feeds terminal input into INT 21h AH=01h", () => {
    const result = assemble(`MOV AH, 01h
INT 21h
MOV AH, 4Ch
INT 21h`);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const cpu = createCPU(result.program!);
    cpu.provideInput("Z");
    cpu.run();
    const state = cpu.state();
    expect(state.registers.AX & 0xff).toBe("Z".charCodeAt(0));
    expect(state.output.join("")).toBe("Z");
  });

  it("pauses at INT 21h AH=01h when no terminal input is queued", () => {
    const result = assemble(`MOV AH, 01h
INT 21h
HLT`);
    const cpu = createCPU(result.program!);
    cpu.run();
    expect(cpu.state().waitingForInput).toBe(true);
    expect(cpu.state().halted).toBe(false);
    cpu.provideInput("A");
    cpu.step();
    expect(cpu.state().output.join("")).toBe("A");
  });
});

describe("example regression suite", () => {
  it("runs all bundled examples without engine errors", () => {
    for (const example of examples) {
      const result = assemble(example.source);
      expect(result.diagnostics.filter((d) => d.severity === "error"), example.title).toEqual([]);
      const cpu = createCPU(result.program!);
      cpu.run(1000);
      expect(cpu.state().errors, example.title).toEqual([]);
    }
  });

  it("prints the COAL array sum result", () => {
    const example = examples.find((item) => item.id === "array-sum")!;
    const state = runSource(example.source, 1000);
    expect(state.output.join("")).toBe("The sum of the array [5, 10, 15, 20, 25] is: 75");
  });
});
