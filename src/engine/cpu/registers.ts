import { BYTE_TO_WORD_REGISTER } from "../isa";
import type { RegisterName, Registers, Segments } from "../types";

export function freshRegisters(): Registers {
  return {
    AX: 0,
    BX: 0,
    CX: 0,
    DX: 0,
    SI: 0,
    DI: 0,
    BP: 0,
    SP: 0xfffe,
    CS: 0,
    DS: 0,
    ES: 0,
    SS: 0,
    IP: 0x0100
  };
}

export function getRegister(registers: Registers, name: RegisterName): number {
  if (name in BYTE_TO_WORD_REGISTER) {
    const { parent, shift } = BYTE_TO_WORD_REGISTER[name];
    return (registers[parent] >> shift) & 0xff;
  }
  return registers[name as keyof Registers] & 0xffff;
}

export function setRegister(registers: Registers, name: RegisterName, value: number): void {
  if (name in BYTE_TO_WORD_REGISTER) {
    const { parent, shift } = BYTE_TO_WORD_REGISTER[name];
    const mask = shift === 0 ? 0xff00 : 0x00ff;
    registers[parent] = (registers[parent] & mask) | ((value & 0xff) << shift);
    return;
  }
  registers[name as keyof Registers] = value & 0xffff;
}

export function segmentsFromRegisters(registers: Registers): Segments {
  return {
    CS: registers.CS,
    DS: registers.DS,
    ES: registers.ES,
    SS: registers.SS
  };
}
