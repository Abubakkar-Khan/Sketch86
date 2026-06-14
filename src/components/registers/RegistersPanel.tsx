import { motion } from "framer-motion";
import type { CPUStateSnapshot, RegisterChange, Registers } from "../../engine";
import { RoughPanel } from "../rough/RoughPanel";

const REGISTER_ORDER: Array<keyof Registers> = ["AX", "BX", "CX", "DX", "SI", "DI", "BP", "SP", "CS", "DS", "ES", "SS", "IP"];

type RegistersPanelProps = {
  snapshot: CPUStateSnapshot;
  changes: RegisterChange[];
};

export function RegistersPanel({ snapshot, changes }: RegistersPanelProps) {
  const changed = new Set(changes.map((change) => change.name));
  return (
    <RoughPanel className="registersPanel">
      <div className="panelHeader">
        <h2>CPU Registers</h2>
        <span>16-bit state</span>
      </div>
      <div className="registerGrid">
        {REGISTER_ORDER.map((name) => (
          <motion.div
            key={name}
            className={`registerCard ${changed.has(name) ? "changed" : ""}`}
            animate={changed.has(name) ? { scale: [1, 1.05, 1], y: [0, -3, 0] } : { scale: 1, y: 0 }}
            transition={{ duration: 0.28 }}
          >
            <span>{name}</span>
            <strong>{hex(snapshot.registers[name])}</strong>
            {["AX", "BX", "CX", "DX"].includes(name) && <small>{byteLine(name, snapshot.registers[name])}</small>}
          </motion.div>
        ))}
      </div>
    </RoughPanel>
  );
}

function hex(value: number) {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function byteLine(name: string, value: number) {
  const high = (value >> 8) & 0xff;
  const low = value & 0xff;
  return `${name[0]}H ${high.toString(16).toUpperCase().padStart(2, "0")} / ${name[0]}L ${low.toString(16).toUpperCase().padStart(2, "0")}`;
}
