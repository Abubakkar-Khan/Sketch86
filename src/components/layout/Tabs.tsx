import { RoughBorder } from "../rough/RoughBorder";

export type AppTab = "lab" | "examples" | "support";

export function Tabs({ active, onChange }: { active: AppTab; onChange: (tab: AppTab) => void }) {
  const tabs: Array<{ id: AppTab; label: string }> = [
    { id: "lab", label: "Lab" },
    { id: "examples", label: "Examples" },
    { id: "support", label: "Support Matrix" }
  ];
  return (
    <nav className="tabs" aria-label="Sketch86 sections">
      {tabs.map((tab) => (
        <button key={tab.id} className={`roughShape ${active === tab.id ? "active" : ""}`} onClick={() => onChange(tab.id)}>
          <RoughBorder strokeWidth={1.8} roughness={1.8} />
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
