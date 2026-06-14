import { motion } from "framer-motion";
import type { ExecutableProgram, ExecutionState, MemoryChange } from "../../engine";
import { RoughPanel } from "../rough/RoughPanel";

export function MemoryPanel({ state, program, changes }: { state: ExecutionState; program?: ExecutableProgram; changes: MemoryChange[] }) {
  const changed = new Set(changes.map((change) => change.address));
  const bases = new Set<number>([program?.dataStart ?? 0x200, state.registers.SP & 0xfff0]);
  Object.values(program?.symbols ?? {}).forEach((symbol) => {
    if (symbol.kind === "data") bases.add(symbol.address & 0xfff0);
  });
  return (
    <RoughPanel className="memoryPanel">
      <div className="panelHeader">
        <h2>Memory</h2>
        <span>byte view</span>
      </div>
      <div className="memoryRows">
        {[...bases].sort((a, b) => a - b).slice(0, 8).map((base) => (
          <div className="memoryRow" key={base}>
            <span className="address">{hex(base)}</span>
            <span>
              {Array.from({ length: 16 }, (_, offset) => {
                const address = base + offset;
                return (
                  <motion.b
                    key={address}
                    className={changed.has(address) ? "byte changed" : "byte"}
                    animate={changed.has(address) ? { y: [-4, 0] } : {}}
                  >
                    {hexByte(state.memory[address] ?? 0)}
                  </motion.b>
                );
              })}
            </span>
          </div>
        ))}
      </div>
    </RoughPanel>
  );
}

function hex(value: number) {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function hexByte(value: number) {
  return (value & 0xff).toString(16).toUpperCase().padStart(2, "0");
}
