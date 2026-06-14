import { flagsToWord, freshFlags, updateArithmeticFlags, wordToFlags } from "../flags";
import { registerSize } from "../isa";
import { Memory8086 } from "../memory";
import type {
  CPUStateSnapshot,
  ExecutionState,
  ExecutableProgram,
  FlagChange,
  Instruction,
  MemoryChange,
  Operand,
  RegisterChange,
  RegisterName,
  RunResult,
  RuntimeError,
  StackChange,
  TraceEntry
} from "../types";
import { hex, maskForSize, signed16, signed8, signBit } from "../utils";
import { freshRegisters, getRegister, segmentsFromRegisters, setRegister } from "./registers";

type ResolvedAddress = {
  segment: number;
  offset: number;
  size: 8 | 16;
};

class InputRequiredError extends Error {}

export class CPU8086 {
  readonly program: ExecutableProgram;
  readonly memory: Memory8086;
  registers = freshRegisters();
  flags = freshFlags();
  halted = false;
  waitingForInput = false;
  output: string[] = [];
  trace: TraceEntry[] = [];
  errors: RuntimeError[] = [];
  inputBuffer: string[] = [];
  private memoryChanges: MemoryChange[] = [];
  private stackChanges: StackChange[] = [];

  constructor(program: ExecutableProgram) {
    this.program = program;
    this.memory = new Memory8086(program.memoryImage);
    this.registers.IP = program.entryAddress;
    this.registers.CS = 0;
    this.registers.DS = 0;
    this.registers.ES = 0;
    this.registers.SS = 0;
  }

  provideInput(text: string): void {
    this.inputBuffer.push(...text.split(""));
    if (this.inputBuffer.length > 0) this.waitingForInput = false;
  }

  state(): ExecutionState {
    return {
      registers: { ...this.registers },
      flags: { ...this.flags },
      memory: this.memory.bytes,
      segments: segmentsFromRegisters(this.registers),
      ip: this.registers.IP,
      halted: this.halted,
      waitingForInput: this.waitingForInput,
      currentInstruction: this.currentInstruction(),
      trace: [...this.trace],
      output: [...this.output],
      errors: [...this.errors]
    };
  }

  currentInstruction(): Instruction | null {
    const index = this.program.addressToIndex.get(this.registers.IP & 0xffff);
    return index === undefined ? null : this.program.instructions[index] ?? null;
  }

  step(): TraceEntry {
    const instruction = this.currentInstruction();
    const before = this.snapshot();
    this.memoryChanges = [];
    this.stackChanges = [];

    if (!instruction) {
      this.halted = true;
      const entry = this.makeTrace(before, before, {
        lineNumber: 0,
        address: this.registers.IP,
        instructionText: "END",
        explanation: "IP reached an address with no instruction. Execution stopped."
      });
      this.trace.push(entry);
      return entry;
    }

    try {
      this.registers.IP = (instruction.address + 1) & 0xffff;
      const explanation = this.execute(instruction);
      const after = this.snapshot();
      const entry = this.makeTrace(before, after, {
        lineNumber: instruction.lineNumber,
        address: instruction.address,
        instructionText: instruction.text,
        explanation
      });
      this.trace.push(entry);
      return entry;
    } catch (error) {
      if (error instanceof InputRequiredError) {
        this.registers.IP = instruction.address;
        this.halted = false;
        const after = this.snapshot();
        const entry = this.makeTrace(before, after, {
          lineNumber: instruction.lineNumber,
          address: instruction.address,
          instructionText: instruction.text,
          explanation: error.message
        });
        this.trace.push(entry);
        return entry;
      }
      this.halted = true;
      const message = error instanceof Error ? error.message : String(error);
      this.errors.push({ message, lineNumber: instruction.lineNumber, address: instruction.address });
      const after = this.snapshot();
      const entry = this.makeTrace(before, after, {
        lineNumber: instruction.lineNumber,
        address: instruction.address,
        instructionText: instruction.text,
        explanation: message
      });
      this.trace.push(entry);
      return entry;
    }
  }

  run(maxInstructions = 10000): RunResult {
    const start = this.trace.length;
    let steps = 0;
    while (!this.halted && !this.waitingForInput && steps < maxInstructions) {
      this.step();
      steps += 1;
    }
    if (!this.halted && steps >= maxInstructions) {
      this.halted = true;
      this.errors.push({ message: `Execution stopped after ${maxInstructions} instructions to protect the browser from an infinite loop.` });
    }
    return { halted: this.halted, steps, trace: this.trace.slice(start), errors: [...this.errors] };
  }

  private execute(instruction: Instruction): string {
    const mnemonic = instruction.mnemonic.toUpperCase();
    const op = instruction.operands;

    if (instruction.prefix && ["MOVSB", "MOVSW", "CMPSB", "CMPSW", "SCASB", "SCASW", "LODSB", "LODSW", "STOSB", "STOSW"].includes(mnemonic)) {
      return this.executeRepeatedString(instruction);
    }

    switch (mnemonic) {
      case "MOV":
        return this.mov(op[0], op[1]);
      case "XCHG":
        return this.xchg(op[0], op[1]);
      case "LEA":
        return this.lea(op[0], op[1]);
      case "LDS":
      case "LES":
        throw new Error(`${mnemonic} has pointer-loading semantics and is not fully supported yet.`);
      case "XLAT":
        return this.xlat();
      case "PUSH":
        return this.push(this.read(op[0], 16), "push");
      case "POP":
        this.write(op[0], this.pop("pop"), 16);
        return `POP copied the word at SS:SP into ${op[0].text}.`;
      case "PUSHF":
        return this.push(flagsToWord(this.flags), "push");
      case "POPF":
        this.flags = wordToFlags(this.pop("pop"));
        return "POPF restored FLAGS from the stack.";
      case "LAHF":
        setRegister(this.registers, "AH", flagsToWord(this.flags) & 0xff);
        return "LAHF copied low FLAGS into AH.";
      case "SAHF":
        this.flags = { ...this.flags, ...wordToFlags(getRegister(this.registers, "AH")) };
        return "SAHF copied AH into the low FLAGS bits.";
      case "ADD":
      case "ADC":
        return this.binaryArithmetic(op[0], op[1], mnemonic);
      case "SUB":
      case "SBB":
      case "CMP":
        return this.binaryArithmetic(op[0], op[1], mnemonic);
      case "INC":
      case "DEC":
      case "NEG":
        return this.unaryArithmetic(op[0], mnemonic);
      case "MUL":
      case "IMUL":
        return this.multiply(op[0], mnemonic === "IMUL");
      case "DIV":
      case "IDIV":
        return this.divide(op[0], mnemonic === "IDIV");
      case "CBW":
        setRegister(this.registers, "AX", signed8(getRegister(this.registers, "AL")) & 0xffff);
        return "CBW sign-extended AL into AX.";
      case "CWD":
        setRegister(this.registers, "DX", getRegister(this.registers, "AX") & 0x8000 ? 0xffff : 0);
        return "CWD sign-extended AX into DX:AX.";
      case "AAA":
      case "AAD":
      case "AAM":
      case "AAS":
      case "DAA":
      case "DAS":
        throw new Error(`${mnemonic} is a BCD adjustment instruction and is marked partial; it is not implemented yet.`);
      case "AND":
      case "OR":
      case "XOR":
      case "TEST":
        return this.logic(op[0], op[1], mnemonic);
      case "NOT":
        return this.not(op[0]);
      case "SHL":
      case "SAL":
      case "SHR":
      case "SAR":
      case "ROL":
      case "ROR":
      case "RCL":
      case "RCR":
        return this.shiftRotate(op[0], op[1], mnemonic);
      case "JMP":
        return this.jump(op[0], true, "JMP always jumps.");
      case "CALL": {
        const target = this.resolveTarget(op[0]);
        this.push(this.registers.IP, "call");
        this.registers.IP = target;
        return `CALL saved the return address and jumped to ${op[0].text}.`;
      }
      case "RET":
        this.registers.IP = this.pop("ret");
        return "RET returned to the saved address.";
      case "RETF":
      case "IRET":
      case "INTO":
        throw new Error(`${mnemonic} is not implemented in this browser learning engine yet.`);
      case "LOOP":
      case "LOOPE":
      case "LOOPZ":
      case "LOOPNE":
      case "LOOPNZ":
        return this.loop(op[0], mnemonic);
      case "JCXZ":
        return this.jump(op[0], getRegister(this.registers, "CX") === 0, "JCXZ jumps when CX is zero.");
      case "INT":
        return this.interrupt(this.read(op[0], 8));
      case "MOVSB":
      case "MOVSW":
      case "CMPSB":
      case "CMPSW":
      case "SCASB":
      case "SCASW":
      case "LODSB":
      case "LODSW":
      case "STOSB":
      case "STOSW":
        return this.executeStringOnce(mnemonic);
      case "CLC":
        this.flags.CF = false;
        return "CLC cleared the carry flag.";
      case "STC":
        this.flags.CF = true;
        return "STC set the carry flag.";
      case "CMC":
        this.flags.CF = !this.flags.CF;
        return "CMC toggled the carry flag.";
      case "CLD":
        this.flags.DF = false;
        return "CLD cleared the direction flag.";
      case "STD":
        this.flags.DF = true;
        return "STD set the direction flag.";
      case "CLI":
        this.flags.IF = false;
        return "CLI cleared the interrupt-enable flag.";
      case "STI":
        this.flags.IF = true;
        return "STI set the interrupt-enable flag.";
      case "NOP":
        return "NOP did nothing for one instruction.";
      case "HLT":
        this.halted = true;
        return "HLT stopped the CPU.";
      case "WAIT":
      case "ESC":
      case "LOCK":
      case "IN":
      case "OUT":
        throw new Error(`${mnemonic} is not supported yet in this browser simulator.`);
      default:
        if (this.isConditionalJump(mnemonic)) return this.conditionalJump(op[0], mnemonic);
        throw new Error(`Unknown instruction "${mnemonic}".`);
    }
  }

  private mov(dest: Operand, src: Operand): string {
    const size = this.inferSize(dest, src);
    const value = this.read(src, size);
    this.write(dest, value, size);
    return `MOV copies ${src.text} into ${dest.text}.`;
  }

  private xchg(a: Operand, b: Operand): string {
    const size = this.inferSize(a, b);
    const av = this.read(a, size);
    const bv = this.read(b, size);
    this.write(a, bv, size);
    this.write(b, av, size);
    return `XCHG swapped ${a.text} and ${b.text}.`;
  }

  private lea(dest: Operand, src: Operand): string {
    if (src.type !== "memory" && src.type !== "symbol") throw new Error("LEA requires a memory or symbol operand.");
    this.write(dest, this.effectiveOffset(src), 16);
    return `LEA loaded the offset of ${src.text} into ${dest.text}.`;
  }

  private xlat(): string {
    const offset = (getRegister(this.registers, "BX") + getRegister(this.registers, "AL")) & 0xffff;
    setRegister(this.registers, "AL", this.memory.readByte(this.registers.DS, offset));
    return "XLAT loaded AL from DS:[BX+AL].";
  }

  private binaryArithmetic(dest: Operand, src: Operand, op: string): string {
    const size = this.inferSize(dest, src);
    const left = this.read(dest, size);
    const carry = op === "ADC" || op === "SBB" ? (this.flags.CF ? 1 : 0) : 0;
    const right = this.read(src, size) + carry;
    const result = op === "ADD" || op === "ADC" ? left + right : left - right;
    updateArithmeticFlags(this.flags, result, size, op === "ADD" || op === "ADC" ? "add" : "sub", left, right);
    if (op !== "CMP") this.write(dest, result, size);
    return op === "CMP"
      ? `CMP subtracts ${src.text} from ${dest.text} without storing the result.`
      : `${op} updates ${dest.text} and refreshes arithmetic flags.`;
  }

  private unaryArithmetic(dest: Operand, op: string): string {
    const size = this.inferSize(dest);
    const value = this.read(dest, size);
    const result = op === "INC" ? value + 1 : op === "DEC" ? value - 1 : -value;
    updateArithmeticFlags(this.flags, result, size, op === "INC" ? "add" : "sub", op === "NEG" ? 0 : value, op === "NEG" ? value : 1);
    if (op === "NEG") this.flags.CF = value !== 0;
    this.write(dest, result, size);
    return `${op} updates ${dest.text}.`;
  }

  private multiply(src: Operand, signed: boolean): string {
    const size = this.inferSize(src);
    const value = this.read(src, size);
    if (size === 8) {
      const left = getRegister(this.registers, "AL");
      const result = (signed ? signed8(left) * signed8(value) : left * value) & 0xffff;
      setRegister(this.registers, "AX", result);
      this.flags.CF = this.flags.OF = (result & 0xff00) !== 0;
      return `${signed ? "IMUL" : "MUL"} stored the byte result in AX.`;
    }
    const left = getRegister(this.registers, "AX");
    const result = signed ? signed16(left) * signed16(value) : left * value;
    setRegister(this.registers, "AX", result & 0xffff);
    setRegister(this.registers, "DX", (result >>> 16) & 0xffff);
    this.flags.CF = this.flags.OF = result > 0xffff || result < 0;
    return `${signed ? "IMUL" : "MUL"} stored the word result in DX:AX.`;
  }

  private divide(src: Operand, signed: boolean): string {
    const size = this.inferSize(src);
    const divisor = this.read(src, size);
    if (divisor === 0) throw new Error("DIV tried to divide by zero.");
    if (size === 8) {
      const dividend = getRegister(this.registers, "AX");
      const quotient = signed ? Math.trunc(signed16(dividend) / signed8(divisor)) : Math.floor(dividend / divisor);
      const remainder = signed ? signed16(dividend) % signed8(divisor) : dividend % divisor;
      if (quotient < -128 || quotient > 0xff) throw new Error("DIV overflow: quotient does not fit in AL.");
      setRegister(this.registers, "AL", quotient);
      setRegister(this.registers, "AH", remainder);
      return `${signed ? "IDIV" : "DIV"} divided AX by ${src.text}; quotient went to AL and remainder to AH.`;
    }
    const dividend = (getRegister(this.registers, "DX") << 16) | getRegister(this.registers, "AX");
    const quotient = signed ? Math.trunc(dividend / signed16(divisor)) : Math.floor(dividend / divisor);
    const remainder = signed ? dividend % signed16(divisor) : dividend % divisor;
    if (quotient < -32768 || quotient > 0xffff) throw new Error("DIV overflow: quotient does not fit in AX.");
    setRegister(this.registers, "AX", quotient);
    setRegister(this.registers, "DX", remainder);
    return `${signed ? "IDIV" : "DIV"} divided DX:AX by ${src.text}; quotient went to AX and remainder to DX.`;
  }

  private logic(dest: Operand, src: Operand, op: string): string {
    const size = this.inferSize(dest, src);
    const left = this.read(dest, size);
    const right = this.read(src, size);
    const result = op === "AND" || op === "TEST" ? left & right : op === "OR" ? left | right : left ^ right;
    updateArithmeticFlags(this.flags, result, size, "logic");
    if (op !== "TEST") this.write(dest, result, size);
    return `${op} updates logical flags${op === "TEST" ? " without storing the result" : ""}.`;
  }

  private not(dest: Operand): string {
    const size = this.inferSize(dest);
    this.write(dest, ~this.read(dest, size) & maskForSize(size), size);
    return `NOT flipped every bit in ${dest.text}.`;
  }

  private shiftRotate(dest: Operand, countOperand: Operand | undefined, op: string): string {
    const size = this.inferSize(dest);
    const count = countOperand ? (countOperand.type === "register" && countOperand.name === "CL" ? getRegister(this.registers, "CL") : this.read(countOperand, 8)) : 1;
    const mask = maskForSize(size);
    let value = this.read(dest, size);
    for (let i = 0; i < count; i += 1) {
      if (op === "SHL" || op === "SAL") {
        this.flags.CF = (value & signBit(size)) !== 0;
        value = (value << 1) & mask;
      } else if (op === "SHR") {
        this.flags.CF = (value & 1) !== 0;
        value >>>= 1;
      } else if (op === "SAR") {
        this.flags.CF = (value & 1) !== 0;
        value = (value >> 1) | (value & signBit(size));
      } else if (op === "ROL") {
        const top = (value & signBit(size)) ? 1 : 0;
        value = ((value << 1) & mask) | top;
        this.flags.CF = top === 1;
      } else if (op === "ROR") {
        const low = value & 1;
        value = (value >>> 1) | (low ? signBit(size) : 0);
        this.flags.CF = low === 1;
      } else if (op === "RCL" || op === "RCR") {
        const carry = this.flags.CF ? 1 : 0;
        if (op === "RCL") {
          const top = (value & signBit(size)) ? 1 : 0;
          value = ((value << 1) & mask) | carry;
          this.flags.CF = top === 1;
        } else {
          const low = value & 1;
          value = (value >>> 1) | (carry ? signBit(size) : 0);
          this.flags.CF = low === 1;
        }
      }
    }
    updateArithmeticFlags(this.flags, value, size, "logic");
    this.write(dest, value, size);
    return `${op} shifted/rotated ${dest.text} by ${count}.`;
  }

  private loop(targetOperand: Operand, mnemonic: string): string {
    const cx = (getRegister(this.registers, "CX") - 1) & 0xffff;
    setRegister(this.registers, "CX", cx);
    const shouldJump =
      mnemonic === "LOOP" ||
      ((mnemonic === "LOOPE" || mnemonic === "LOOPZ") && this.flags.ZF) ||
      ((mnemonic === "LOOPNE" || mnemonic === "LOOPNZ") && !this.flags.ZF);
    if (cx !== 0 && shouldJump) {
      this.registers.IP = this.resolveTarget(targetOperand);
      return `${mnemonic} decremented CX to ${hex(cx)} and jumped.`;
    }
    return `${mnemonic} decremented CX to ${hex(cx)} and continued.`;
  }

  private conditionalJump(target: Operand, mnemonic: string): string {
    const taken = this.evaluateCondition(mnemonic);
    return this.jump(target, taken, taken ? `${mnemonic} condition is true.` : `${mnemonic} condition is false.`);
  }

  private jump(target: Operand, taken: boolean, explanation: string): string {
    if (taken) this.registers.IP = this.resolveTarget(target);
    return `${explanation} Jump ${taken ? "taken" : "skipped"}.`;
  }

  private interrupt(number: number): string {
    if (number === 0x20) {
      this.halted = true;
      return "INT 20h terminated the program.";
    }
    if (number !== 0x21) throw new Error(`INT ${hex(number, 2)}h is not supported yet in this simulator.`);
    const ah = getRegister(this.registers, "AH");
    if (ah === 0x01) {
      const char = this.inputBuffer.shift();
      if (char === undefined) {
        this.waitingForInput = true;
        throw new InputRequiredError("INT 21h AH=01h is waiting for terminal input. Type characters in stdin, send them, then continue.");
      }
      setRegister(this.registers, "AL", char.charCodeAt(0));
      this.output.push(char);
      return "INT 21h AH=01h read one simulated keyboard character into AL.";
    }
    if (ah === 0x02) {
      this.output.push(String.fromCharCode(getRegister(this.registers, "DL") & 0xff));
      return "INT 21h AH=02h printed the character in DL.";
    }
    if (ah === 0x09) {
      let offset = getRegister(this.registers, "DX");
      let text = "";
      let scanned = 0;
      while (scanned < 0x10000) {
        const byte = this.memory.readByte(this.registers.DS, offset);
        if (byte === 0x24) break;
        text += String.fromCharCode(byte);
        offset = (offset + 1) & 0xffff;
        scanned += 1;
      }
      if (scanned >= 0x10000) throw new Error("INT 21h AH=09h could not find a $ terminator before the segment wrapped.");
      this.output.push(text);
      return "INT 21h AH=09h printed the $-terminated string at DS:DX.";
    }
    if (ah === 0x4c) {
      this.halted = true;
      return "INT 21h AH=4Ch terminated the program.";
    }
    throw new Error(`INT 21h AH=${hex(ah, 2)}h is not supported yet in this simulator.`);
  }

  private executeRepeatedString(instruction: Instruction): string {
    let count = getRegister(this.registers, "CX");
    let iterations = 0;
    while (count > 0) {
      this.executeStringOnce(instruction.mnemonic);
      iterations += 1;
      count = (count - 1) & 0xffff;
      setRegister(this.registers, "CX", count);
      if ((instruction.prefix === "REPE" || instruction.prefix === "REPZ") && !this.flags.ZF) break;
      if ((instruction.prefix === "REPNE" || instruction.prefix === "REPNZ") && this.flags.ZF) break;
    }
    return `${instruction.prefix} ${instruction.mnemonic} repeated ${iterations} time(s).`;
  }

  private executeStringOnce(mnemonic: string): string {
    const size: 8 | 16 = mnemonic.endsWith("W") ? 16 : 8;
    const step = this.flags.DF ? -(size / 8) : size / 8;
    const si = getRegister(this.registers, "SI");
    const di = getRegister(this.registers, "DI");
    if (mnemonic.startsWith("MOVS")) {
      const value = size === 8 ? this.memory.readByte(this.registers.DS, si) : this.memory.readWord(this.registers.DS, si);
      this.writeAddress(this.registers.ES, di, value, size);
      setRegister(this.registers, "SI", si + step);
      setRegister(this.registers, "DI", di + step);
    } else if (mnemonic.startsWith("LODS")) {
      const value = size === 8 ? this.memory.readByte(this.registers.DS, si) : this.memory.readWord(this.registers.DS, si);
      setRegister(this.registers, size === 8 ? "AL" : "AX", value);
      setRegister(this.registers, "SI", si + step);
    } else if (mnemonic.startsWith("STOS")) {
      this.writeAddress(this.registers.ES, di, getRegister(this.registers, size === 8 ? "AL" : "AX"), size);
      setRegister(this.registers, "DI", di + step);
    } else if (mnemonic.startsWith("CMPS")) {
      const left = size === 8 ? this.memory.readByte(this.registers.DS, si) : this.memory.readWord(this.registers.DS, si);
      const right = size === 8 ? this.memory.readByte(this.registers.ES, di) : this.memory.readWord(this.registers.ES, di);
      updateArithmeticFlags(this.flags, left - right, size, "sub", left, right);
      setRegister(this.registers, "SI", si + step);
      setRegister(this.registers, "DI", di + step);
    } else if (mnemonic.startsWith("SCAS")) {
      const left = getRegister(this.registers, size === 8 ? "AL" : "AX");
      const right = size === 8 ? this.memory.readByte(this.registers.ES, di) : this.memory.readWord(this.registers.ES, di);
      updateArithmeticFlags(this.flags, left - right, size, "sub", left, right);
      setRegister(this.registers, "DI", di + step);
    }
    return `${mnemonic} executed once.`;
  }

  private read(operand: Operand | undefined, expectedSize?: 8 | 16): number {
    if (!operand) throw new Error("Missing operand.");
    if (operand.type === "register") return getRegister(this.registers, operand.name);
    if (operand.type === "immediate") return operand.value;
    if (operand.type === "string") return operand.value.charCodeAt(0) ?? 0;
    if (operand.type === "symbol") {
      const symbol = this.program.symbols[operand.name.toUpperCase()];
      if (!symbol) throw new Error(`Unknown symbol "${operand.name}".`);
      if (operand.offsetOnly || symbol.kind === "label" || symbol.kind === "procedure" || symbol.kind === "equ") return symbol.value ?? symbol.address;
      const size = expectedSize ?? symbol.size ?? 16;
      return size === 8 ? this.memory.readByte(this.registers.DS, symbol.address) : this.memory.readWord(this.registers.DS, symbol.address);
    }
    const address = this.resolveAddress(operand, expectedSize);
    return address.size === 8 ? this.memory.readByte(address.segment, address.offset) : this.memory.readWord(address.segment, address.offset);
  }

  private write(operand: Operand | undefined, value: number, size?: 8 | 16): void {
    if (!operand) throw new Error("Missing operand.");
    if (operand.type === "register") {
      setRegister(this.registers, operand.name, value);
      return;
    }
    if (operand.type === "symbol") {
      const symbol = this.program.symbols[operand.name.toUpperCase()];
      if (!symbol || symbol.kind !== "data") throw new Error(`Cannot write to symbol "${operand.name}".`);
      this.writeAddress(this.registers.DS, symbol.address, value, size ?? symbol.size ?? 16);
      return;
    }
    if (operand.type === "memory") {
      const address = this.resolveAddress(operand, size);
      this.writeAddress(address.segment, address.offset, value, address.size);
      return;
    }
    throw new Error(`Cannot write to ${operand.text}.`);
  }

  private writeAddress(segment: number, offset: number, value: number, size: 8 | 16): void {
    if (size === 8) this.memoryChanges.push(this.memory.writeByte(segment, offset, value));
    else this.memoryChanges.push(...this.memory.writeWord(segment, offset, value));
  }

  private push(value: number, kind: StackChange["kind"]): string {
    const spBefore = this.registers.SP;
    this.registers.SP = (this.registers.SP - 2) & 0xffff;
    this.writeAddress(this.registers.SS, this.registers.SP, value, 16);
    this.stackChanges.push({ kind, value: value & 0xffff, spBefore, spAfter: this.registers.SP });
    return `${kind.toUpperCase()} stored ${hex(value)} at SS:SP.`;
  }

  private pop(kind: StackChange["kind"]): number {
    const spBefore = this.registers.SP;
    const value = this.memory.readWord(this.registers.SS, this.registers.SP);
    this.registers.SP = (this.registers.SP + 2) & 0xffff;
    this.stackChanges.push({ kind, value, spBefore, spAfter: this.registers.SP });
    return value;
  }

  private inferSize(a?: Operand, b?: Operand): 8 | 16 {
    const sizeA = this.operandSize(a);
    const sizeB = this.operandSize(b);
    return sizeA ?? sizeB ?? 16;
  }

  private operandSize(operand?: Operand): 8 | 16 | undefined {
    if (!operand) return undefined;
    if (operand.type === "register") return operand.size;
    if (operand.type === "memory") {
      if (operand.size) return operand.size;
      if (operand.symbol) return this.program.symbols[operand.symbol.toUpperCase()]?.size;
    }
    if (operand.type === "symbol") return this.program.symbols[operand.name.toUpperCase()]?.size;
    if (operand.type === "immediate") return operand.size;
    return undefined;
  }

  private resolveAddress(operand: Operand, expectedSize?: 8 | 16): ResolvedAddress {
    if (operand.type !== "memory") throw new Error(`${operand.text} is not a memory operand.`);
    let offset = operand.displacement;
    let segment = operand.segment ? this.registers[operand.segment] : operand.base === "BP" ? this.registers.SS : this.registers.DS;
    if (operand.symbol) {
      const symbol = this.program.symbols[operand.symbol.toUpperCase()];
      if (!symbol) throw new Error(`Unknown symbol "${operand.symbol}".`);
      offset += symbol.address;
      if (!operand.size && symbol.size) expectedSize = symbol.size;
    }
    for (const term of operand.terms) {
      const sign = term.sign;
      if (term.kind === "register") offset += sign * getRegister(this.registers, term.value as RegisterName);
      if (term.kind === "identifier") {
        const symbol = this.program.symbols[term.value.toUpperCase()];
        if (!symbol) throw new Error(`Unknown symbol "${term.value}".`);
        offset += sign * (symbol.value ?? symbol.address);
      }
    }
    return { segment, offset: offset & 0xffff, size: operand.size ?? expectedSize ?? 16 };
  }

  private effectiveOffset(operand: Operand): number {
    if (operand.type === "symbol") {
      const symbol = this.program.symbols[operand.name.toUpperCase()];
      if (!symbol) throw new Error(`Unknown symbol "${operand.name}".`);
      return symbol.address;
    }
    return this.resolveAddress(operand, 16).offset;
  }

  private resolveTarget(operand: Operand): number {
    if (operand.type === "symbol") {
      const symbol = this.program.symbols[operand.name.toUpperCase()];
      if (!symbol) throw new Error(`Unknown label "${operand.name}".`);
      return symbol.address & 0xffff;
    }
    return this.read(operand, 16) & 0xffff;
  }

  private evaluateCondition(mnemonic: string): boolean {
    switch (mnemonic) {
      case "JA":
      case "JNBE":
        return !this.flags.CF && !this.flags.ZF;
      case "JAE":
      case "JNB":
      case "JNC":
        return !this.flags.CF;
      case "JB":
      case "JNAE":
      case "JC":
        return this.flags.CF;
      case "JBE":
      case "JNA":
        return this.flags.CF || this.flags.ZF;
      case "JE":
      case "JZ":
        return this.flags.ZF;
      case "JNE":
      case "JNZ":
        return !this.flags.ZF;
      case "JG":
      case "JNLE":
        return !this.flags.ZF && this.flags.SF === this.flags.OF;
      case "JGE":
      case "JNL":
        return this.flags.SF === this.flags.OF;
      case "JL":
      case "JNGE":
        return this.flags.SF !== this.flags.OF;
      case "JLE":
      case "JNG":
        return this.flags.ZF || this.flags.SF !== this.flags.OF;
      case "JO":
        return this.flags.OF;
      case "JNO":
        return !this.flags.OF;
      case "JS":
        return this.flags.SF;
      case "JNS":
        return !this.flags.SF;
      case "JP":
      case "JPE":
        return this.flags.PF;
      case "JNP":
      case "JPO":
        return !this.flags.PF;
      default:
        return false;
    }
  }

  private isConditionalJump(mnemonic: string): boolean {
    return ["JA", "JNBE", "JAE", "JNB", "JB", "JNAE", "JBE", "JNA", "JC", "JNC", "JE", "JZ", "JNE", "JNZ", "JG", "JNLE", "JGE", "JNL", "JL", "JNGE", "JLE", "JNG", "JO", "JNO", "JS", "JNS", "JP", "JPE", "JNP", "JPO"].includes(mnemonic);
  }

  private snapshot(): CPUStateSnapshot {
    return {
      registers: { ...this.registers },
      flags: { ...this.flags },
      segments: segmentsFromRegisters(this.registers),
      halted: this.halted,
      output: [...this.output]
    };
  }

  private makeTrace(before: CPUStateSnapshot, after: CPUStateSnapshot, meta: Pick<TraceEntry, "lineNumber" | "address" | "instructionText" | "explanation">): TraceEntry {
    const registers: RegisterChange[] = [];
    for (const key of Object.keys(after.registers) as Array<keyof typeof after.registers>) {
      if (before.registers[key] !== after.registers[key]) registers.push({ name: key, before: before.registers[key], after: after.registers[key] });
    }
    const flags: FlagChange[] = [];
    for (const key of Object.keys(after.flags) as Array<keyof typeof after.flags>) {
      if (before.flags[key] !== after.flags[key]) flags.push({ name: key, before: before.flags[key], after: after.flags[key] });
    }
    return {
      ...meta,
      before,
      after,
      changes: {
        registers,
        flags,
        memory: [...this.memoryChanges],
        stack: [...this.stackChanges]
      }
    };
  }
}

export function createCPU(program: ExecutableProgram): CPU8086 {
  return new CPU8086(program);
}
