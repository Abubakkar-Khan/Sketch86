import type { SupportMatrixEntry } from "../../engine";
import { RoughBorder } from "../rough/RoughBorder";
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
            <b className={`status roughShape ${entry.status}`}>
              <RoughBorder strokeWidth={1.2} roughness={1.35} inset={1} />
              {entry.status}
            </b>
            <span>{entry.notes}</span>
          </div>
        ))}
      </div>
    </RoughPanel>
  );
}
