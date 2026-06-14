import type { PropsWithChildren } from "react";
import { RoughBorder } from "./RoughBorder";

type RoughPanelProps = PropsWithChildren<{
  className?: string;
}>;

export function RoughPanel({ children, className = "" }: RoughPanelProps) {
  return (
    <section className={`panel roughShape ${className}`}>
      <RoughBorder strokeWidth={2.4} roughness={1.9} inset={4} />
      {children}
    </section>
  );
}
