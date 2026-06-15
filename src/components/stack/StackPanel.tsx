import { motion } from "framer-motion";
import type { ExecutionState, StackChange } from "../../engine";
import { RoughBorder } from "../rough/RoughBorder";
import { RoughPanel } from "../rough/RoughPanel";

export function StackPanel({ state, changes }: { state: ExecutionState; changes: StackChange[] }) {
  const sp = state.registers.SP;
  const observedStackPointers = state.trace.flatMap((entry) => entry.changes.stack.flatMap((change) => [change.spBefore, change.spAfter]));
  const stackTop = 0xfffe;
  const lowestObservedSp = Math.min(sp, stackTop, ...observedStackPointers);
  const stackWindowStart = lowestObservedSp <= stackTop ? lowestObservedSp : sp;
  const usedWords = Math.max(0, Math.ceil((stackTop - stackWindowStart) / 2) + 1);
  const visibleWords = Math.min(64, Math.max(8, usedWords + 3, changes.length + 8));
  const changedOffsets = new Set(changes.flatMap((change) => [change.spBefore, change.spAfter]));
  const segment = state.segments.SS ?? state.registers.SS;
  const rows = Array.from({ length: visibleWords }, (_, index) => {
    const offset = (stackWindowStart + index * 2) & 0xffff;
    const lo = state.memory[physical(segment, offset)] ?? 0;
    const hi = state.memory[physical(segment, (offset + 1) & 0xffff)] ?? 0;
    return { offset, value: lo | (hi << 8) };
  });
  return (
    <RoughPanel className="stackPanel">
      <div className="panelHeader">
        <h2>Stack</h2>
        <span>SS:SP {hex(sp)} · {visibleWords} rows</span>
      </div>
      <div className="stackList">
        {rows.map((row, index) => (
          <motion.div
            key={row.offset}
            className={`stackItem roughShape ${row.offset === sp ? "top" : ""}`}
            animate={changedOffsets.has(row.offset) ? { y: [-8, 0] } : {}}
          >
            <RoughBorder strokeWidth={1.3} roughness={1.45} inset={2} />
            <span>{row.offset === sp ? "TOP" : hex(row.offset)}</span>
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

function physical(segment: number, offset: number) {
  return (((segment & 0xffff) << 4) + (offset & 0xffff)) & 0xfffff;
}
