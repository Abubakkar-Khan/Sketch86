import type { PropsWithChildren } from "react";
import { RoughBorder } from "./RoughBorder";

type RoughPanelProps = PropsWithChildren<{
  className?: string;
  redrawKey?: string | number;
}>;

export function RoughPanel({ children, className = "", redrawKey }: RoughPanelProps) {
  return (
    <section className={`panel roughShape ${className}`}>
      <RoughBorder strokeWidth={2.4} roughness={1.9} inset={4} redrawKey={redrawKey} />
      {children}
    </section>
  );
}
