import { useLayoutEffect, useRef } from "react";
import rough from "roughjs";

type RoughBorderProps = {
  className?: string;
  stroke?: string;
  strokeWidth?: number;
  roughness?: number;
  inset?: number;
  redrawKey?: string | number;
};

export function RoughBorder({ className = "", stroke, strokeWidth = 2, roughness = 1.65, inset = 3, redrawKey }: RoughBorderProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const lastSize = useRef({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const draw = () => {
      const width = Math.round(parent.clientWidth);
      const height = Math.round(parent.clientHeight);
      if (width <= 0 || height <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.ceil(width * dpr);
      const nextHeight = Math.ceil(height * dpr);
      if (lastSize.current.width !== nextWidth || lastSize.current.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        lastSize.current = { width: nextWidth, height: nextHeight };
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const themeStroke = stroke ?? (getComputedStyle(parent).getPropertyValue("--ink").trim() || "#23201c");

      rough.canvas(canvas).rectangle(inset, inset, Math.max(0, width - inset * 2), Math.max(0, height - inset * 2), {
        stroke: themeStroke,
        strokeWidth,
        roughness
      });
    };

    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(parent);
    const themeObserver = new MutationObserver(draw);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
    };
  }, [inset, redrawKey, roughness, stroke, strokeWidth]);

  return <canvas aria-hidden="true" className={`roughBorder ${className}`} ref={ref} />;
}
