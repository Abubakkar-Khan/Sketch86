import type { SupportMatrixEntry } from "../../engine";
import { RoughPanel } from "../rough/RoughPanel";

export function SupportMatrix({ entries }: { entries: SupportMatrixEntry[] }) {
  return (
    <RoughPanel className="fullPanel">
      <div className="panelHeader">
        <h2>Support Matrix</h2>
        <span>honest compatibility</span>
      </div>
      <div className="matrixTable">
        <div className="matrixHead">Category</div>
        <div className="matrixHead">Feature</div>
        <div className="matrixHead">Status</div>
        <div className="matrixHead">Notes</div>
        {entries.map((entry) => (
          <div className="matrixRow" key={`${entry.category}-${entry.feature}`}>
            <span>{entry.category}</span>
            <strong>{entry.feature}</strong>
            <b className={`status ${entry.status}`}>{entry.status}</b>
            <span>{entry.notes}</span>
          </div>
        ))}
      </div>
    </RoughPanel>
  );
}
