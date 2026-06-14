import { motion } from "framer-motion";
import type { ExecutionState, StackChange } from "../../engine";
import { RoughBorder } from "../rough/RoughBorder";
import { RoughPanel } from "../rough/RoughPanel";

export function StackPanel({ state, changes }: { state: ExecutionState; changes: StackChange[] }) {
  const sp = state.registers.SP;
  const rows = Array.from({ length: 8 }, (_, index) => {
    const offset = (sp + index * 2) & 0xffff;
    const lo = state.memory[offset] ?? 0;
    const hi = state.memory[(offset + 1) & 0xffff] ?? 0;
    return { offset, value: lo | (hi << 8) };
  });
  return (
    <RoughPanel className="stackPanel">
      <div className="panelHeader">
        <h2>Stack</h2>
        <span>SS:SP {hex(sp)}</span>
      </div>
      <div className="stackList">
        {rows.map((row, index) => (
          <motion.div key={row.offset} className="stackItem roughShape" animate={changes.length && index === 0 ? { y: [-8, 0] } : {}}>
            <RoughBorder strokeWidth={1.3} roughness={1.45} inset={2} />
            <span>{index === 0 ? "TOP" : hex(row.offset)}</span>
            <strong>{hex(row.value)}</strong>
          </motion.div>
        ))}
      </div>
    </RoughPanel>
  );
}

function hex(value: number) {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}
