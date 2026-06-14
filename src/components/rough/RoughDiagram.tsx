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
      ? { panel: "#241f19", ink: "#fff1cf", card: "#30291f", accent: "#7ed7c5", accentSoft: "#1f453f", warm: "#d8aa4b", warn: "#f1b06d", muted: "#cfc0a5" }
      : { panel: "#fff8e8", ink: "#23201c", card: "#fffdfa", accent: "#236f70", accentSoft: "#dceeea", warm: "#f1d58a", warn: "#9d5d33", muted: "#706a5d" };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = colors.panel;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const rc = rough.canvas(canvas);
    const registerHot = Boolean(trace?.changes.registers.length);
    const memoryHot = Boolean(trace?.changes.memory.length || trace?.changes.stack.length);
    const flagHot = Boolean(trace?.changes.flags.length);
    const hot = registerHot || memoryHot || flagHot;

    drawCard(ctx, rc, 24, 26, 142, 58, "Fetch", "IP -> instruction", colors.card, colors);
    drawCard(ctx, rc, 208, 26, 142, 58, "Decode", trace?.instructionText.slice(0, 18) || "waiting", colors.accentSoft, colors);
    drawCard(ctx, rc, 392, 26, 142, 58, "Execute", hot ? "state changed" : "ready", hot ? colors.warm : colors.card, colors);
    drawCard(ctx, rc, 92, 132, 132, 60, "Registers", registerHot ? `${trace?.changes.registers.length} changed` : "watching", registerHot ? colors.accentSoft : colors.card, colors);
    drawCard(ctx, rc, 286, 132, 132, 60, "Flags", flagHot ? "updated" : "stable", flagHot ? colors.warm : colors.card, colors);
    drawCard(ctx, rc, 480, 132, 132, 60, "Memory", memoryHot ? "write/stack" : "idle", memoryHot ? colors.accentSoft : colors.card, colors);

    drawArrow(rc, 170, 55, 204, 55, hot ? colors.warn : colors.accent);
    drawArrow(rc, 354, 55, 388, 55, hot ? colors.warn : colors.accent);
    drawArrow(rc, 460, 88, 176, 128, registerHot ? colors.warn : colors.accent);
    drawArrow(rc, 466, 88, 350, 128, flagHot ? colors.warn : colors.accent);
    drawArrow(rc, 472, 88, 542, 128, memoryHot ? colors.warn : colors.accent);

    ctx.fillStyle = colors.muted;
    ctx.font = "700 13px Comic Sans MS, Comic Neue, Trebuchet MS, sans-serif";
    ctx.fillText("trace", 28, 218);
    ctx.fillStyle = colors.ink;
    ctx.font = "700 13px Comic Sans MS, Comic Neue, Trebuchet MS, sans-serif";
    ctx.fillText(trace?.explanation.slice(0, 70) || "Run or step to animate the 8086 data path.", 74, 218);
  }, [trace, theme]);
  return (
    <div className="sketchViewport">
      <canvas className="roughCanvas" ref={ref} width={680} height={234} aria-hidden="true" />
    </div>
  );
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  rc: ReturnType<typeof rough.canvas>,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  detail: string,
  fill: string,
  colors: { ink: string; muted: string }
) {
  rc.rectangle(x, y, width, height, { stroke: colors.ink, strokeWidth: 1.8, fill, fillStyle: "hachure", roughness: 1.35 });
  ctx.fillStyle = colors.ink;
  ctx.font = "800 15px Comic Sans MS, Comic Neue, Trebuchet MS, sans-serif";
  ctx.fillText(title, x + 14, y + 24);
  ctx.fillStyle = colors.muted;
  ctx.font = "700 12px Comic Sans MS, Comic Neue, Trebuchet MS, sans-serif";
  ctx.fillText(detail, x + 14, y + 43);
}

function drawArrow(rc: ReturnType<typeof rough.canvas>, x1: number, y1: number, x2: number, y2: number, stroke: string) {
  rc.line(x1, y1, x2, y2, { stroke, strokeWidth: 2.3, roughness: 1.7 });
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 8;
  const left = angle + Math.PI * 0.82;
  const right = angle - Math.PI * 0.82;
  rc.line(x2, y2, x2 + Math.cos(left) * size, y2 + Math.sin(left) * size, { stroke, strokeWidth: 2.3, roughness: 1.7 });
  rc.line(x2, y2, x2 + Math.cos(right) * size, y2 + Math.sin(right) * size, { stroke, strokeWidth: 2.3, roughness: 1.7 });
}
