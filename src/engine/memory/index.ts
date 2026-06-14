export const MEMORY_SIZE = 1024 * 1024;

export class Memory8086 {
  readonly bytes: Uint8Array;

  constructor(initial?: Uint8Array) {
    this.bytes = new Uint8Array(MEMORY_SIZE);
    if (initial) this.bytes.set(initial.slice(0, MEMORY_SIZE));
  }

  physical(segment: number, offset: number): number {
    return (((segment & 0xffff) << 4) + (offset & 0xffff)) & 0xfffff;
  }

  readByte(segment: number, offset: number): number {
    return this.bytes[this.physical(segment, offset)];
  }

  readWord(segment: number, offset: number): number {
    const lo = this.readByte(segment, offset);
    const hi = this.readByte(segment, (offset + 1) & 0xffff);
    return lo | (hi << 8);
  }

  writeByte(segment: number, offset: number, value: number): { address: number; before: number; after: number } {
    const address = this.physical(segment, offset);
    const before = this.bytes[address];
    const after = value & 0xff;
    this.bytes[address] = after;
    return { address, before, after };
  }

  writeWord(segment: number, offset: number, value: number) {
    const lo = this.writeByte(segment, offset, value & 0xff);
    const hi = this.writeByte(segment, (offset + 1) & 0xffff, (value >> 8) & 0xff);
    return [lo, hi];
  }
}
