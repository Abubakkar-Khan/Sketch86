import { useEffect, useRef } from "react";
import rough from "roughjs";
import type { TraceEntry } from "../../engine";

export function RoughDiagram({ trace, theme }: { trace?: TraceEntry; theme: "light" | "dark" }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const colors = theme === "dark"
      ? { panel: "#202421", ink: "#f4ead3", card: "#181b1a", accent: "#82d7cc", accentSoft: "#263d3a", warn: "#f0aa75" }
      : { panel: "#fff8e8", ink: "#23201c", card: "#fffdfa", accent: "#27706c", accentSoft: "#dceeea", warn: "#a85f38" };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = colors.panel;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const rc = rough.canvas(canvas);
    const hot = Boolean(trace?.changes.registers.length || trace?.changes.memory.length || trace?.changes.stack.length);
    rc.rectangle(28, 35, 160, 72, { stroke: colors.ink, strokeWidth: 1.7, fill: colors.card, fillStyle: "hachure", roughness: 1.5 });
    rc.rectangle(372, 35, 150, 72, { stroke: colors.ink, strokeWidth: 1.7, fill: colors.accentSoft, fillStyle: "zigzag", roughness: 1.5 });
    rc.path(`M203 72 C258 ${hot ? 28 : 88}, 314 ${hot ? 28 : 88}, 360 72`, { stroke: hot ? colors.warn : colors.accent, strokeWidth: hot ? 3 : 2, roughness: 1.7 });
    ctx.fillStyle = colors.ink;
    ctx.font = "700 15px Comic Sans MS, Comic Neue, Trebuchet MS, sans-serif";
    ctx.fillText("Instruction", 52, 78);
    ctx.fillText("CPU state", 400, 78);
    if (hot) {
      ctx.fillStyle = colors.warn;
      ctx.font = "700 13px Comic Sans MS, Comic Neue, Trebuchet MS, sans-serif";
      ctx.fillText("state changed", 232, 48);
    }
  }, [trace, theme]);
  return (
    <div className="sketchViewport">
      <canvas className="roughCanvas" ref={ref} width={560} height={144} aria-hidden="true" />
    </div>
  );
}
