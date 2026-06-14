import { motion } from "framer-motion";
import type { CPUStateSnapshot, FlagChange, FlagName } from "../../engine";
import { RoughBorder } from "../rough/RoughBorder";
import { RoughPanel } from "../rough/RoughPanel";

const FLAGS: FlagName[] = ["CF", "PF", "AF", "ZF", "SF", "TF", "IF", "DF", "OF"];
const LABELS: Record<FlagName, string> = {
  CF: "carry / borrow",
  PF: "even parity",
  AF: "half carry",
  ZF: "zero result",
  SF: "sign bit",
  TF: "trap mode",
  IF: "interrupts",
  DF: "direction",
  OF: "overflow"
};

export function FlagsPanel({ snapshot, changes }: { snapshot: CPUStateSnapshot; changes: FlagChange[] }) {
  const changed = new Set(changes.map((change) => change.name));
  return (
    <RoughPanel className="flagsPanel">
      <div className="panelHeader">
        <h2>Flags</h2>
        <span>8086 status bits</span>
      </div>
      <div className="flagGrid">
        {FLAGS.map((flag) => (
          <motion.div
            key={flag}
            className={`flagCard roughShape ${snapshot.flags[flag] ? "on" : ""}`}
            animate={changed.has(flag) ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={{ duration: 0.22 }}
          >
            <RoughBorder strokeWidth={1.4} roughness={1.45} inset={2} />
            <strong>{flag}={snapshot.flags[flag] ? "1" : "0"}</strong>
            <span>{LABELS[flag]}</span>
          </motion.div>
        ))}
      </div>
    </RoughPanel>
  );
}
