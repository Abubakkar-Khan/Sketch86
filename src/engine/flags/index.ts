import type { Flags } from "../types";
import { maskForSize, signBit } from "../utils";

export function freshFlags(): Flags {
  return {
    CF: false,
    PF: false,
    AF: false,
    ZF: false,
    SF: false,
    TF: false,
    IF: false,
    DF: false,
    OF: false
  };
}

export function flagsToWord(flags: Flags): number {
  return (
    (flags.CF ? 1 : 0) |
    (flags.PF ? 0x0004 : 0) |
    (flags.AF ? 0x0010 : 0) |
    (flags.ZF ? 0x0040 : 0) |
    (flags.SF ? 0x0080 : 0) |
    (flags.TF ? 0x0100 : 0) |
    (flags.IF ? 0x0200 : 0) |
    (flags.DF ? 0x0400 : 0) |
    (flags.OF ? 0x0800 : 0)
  );
}

export function wordToFlags(word: number): Flags {
  return {
    CF: (word & 0x0001) !== 0,
    PF: (word & 0x0004) !== 0,
    AF: (word & 0x0010) !== 0,
    ZF: (word & 0x0040) !== 0,
    SF: (word & 0x0080) !== 0,
    TF: (word & 0x0100) !== 0,
    IF: (word & 0x0200) !== 0,
    DF: (word & 0x0400) !== 0,
    OF: (word & 0x0800) !== 0
  };
}

export function updateArithmeticFlags(flags: Flags, result: number, size: 8 | 16, op: "add" | "sub" | "logic", left = 0, right = 0): void {
  const mask = maskForSize(size);
  const sign = signBit(size);
  const value = result & mask;
  flags.ZF = value === 0;
  flags.SF = (value & sign) !== 0;
  flags.PF = parity(value & 0xff);
  flags.AF = ((left ^ right ^ value) & 0x10) !== 0;
  if (op === "add") {
    flags.CF = result > mask;
    flags.OF = (~(left ^ right) & (left ^ value) & sign) !== 0;
  } else if (op === "sub") {
    flags.CF = result < 0;
    flags.OF = ((left ^ right) & (left ^ value) & sign) !== 0;
  } else {
    flags.CF = false;
    flags.OF = false;
  }
}

export function parity(value: number): boolean {
  let count = 0;
  for (let i = 0; i < 8; i += 1) count += (value >> i) & 1;
  return count % 2 === 0;
}
