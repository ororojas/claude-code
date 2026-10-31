import type { ReactNode } from "react";

// A small kit for drawing exam diagrams as SVG. Graphs use data coordinates
// from 0 to 100 on both axes; sx/sy turn them into SVG units. Anything with
// the "lbl" class is something to remember, and practice mode hides it.

export type Pt = [number, number];
export type Fn = (x: number) => number;

const W = 360;
const H = 280;
const OX = 48;
const OY = 236;
const PW = 262;
const PH = 212;

export const sx = (x: number) => OX + (x / 100) * PW;
export const sy = (y: number) => OY - (y / 100) * PH;

export const INK = {
  base: "#1e293b",
  accent: "#0369a1",
  second: "#7c3aed",
  red: "#b91c1c",
  green: "#15803d",
  muted: "#64748b",
} as const;
export type Ink = keyof typeof INK;

const FILL = {
  loss: "#ef4444",
  profit: "#22c55e",
  consumer: "#0ea5e9",
  producer: "#f59e0b",
  tax: "#8b5cf6",
} as const;
export type Tone = keyof typeof FILL;

/** Straight line through two points, as y = f(x). */
export function line(a: Pt, b: Pt): Fn {
  const m = (b[1] - a[1]) / (b[0] - a[0]);
  return (x) => a[1] + m * (x - a[0]);
}

/** Where two curves cross, by bisection between lo and hi. */
export function meet(f: Fn, g: Fn, lo = 0.5, hi = 100): Pt {
  let a = lo;
  let b = hi;
  const d = (x: number) => f(x) - g(x);
  for (let i = 0; i < 60; i++) {
    const mid = (a + b) / 2;
    if (Math.sign(d(mid)) === Math.sign(d(a))) a = mid;
    else b = mid;
  }
  const x = (a + b) / 2;
  return [x, f(x)];
}

function sample(f: Fn, from: number, to: number, steps = 64): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = from + ((to - from) * i) / steps;
    return [x, f(x)] as Pt;
  });
}

const path = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ");

function head(x1: number, y1: number, x2: number, y2: number, size = 7) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (t: number) => `${(x2 - size * Math.cos(a + t)).toFixed(1)},${(y2 - size * Math.sin(a + t)).toFixed(1)}`;
  return `${x2.toFixed(1)},${y2.toFixed(1)} ${p(0.45)} ${p(-0.45)}`;
}

function Svg({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full select-none" fontFamily="inherit">
      <title>{label}</title>
      {children}
    </svg>
  );
}

/** A pair of axes. The axis titles stay visible in practice mode. */
export function Graph({ label, x, y, children }: { label: string; x: string; y: string; children: ReactNode }) {
  return (
    <Svg label={label}>
      <g stroke={INK.base} strokeWidth={1.5} fill={INK.base}>
        <line x1={OX} y1={OY} x2={OX} y2={OY - PH - 6} />
        <polygon points={head(OX, OY, OX, OY - PH - 10)} stroke="none" />
        <line x1={OX} y1={OY} x2={OX + PW + 6} y2={OY} />
        <polygon points={head(OX, OY, OX + PW + 10, OY)} stroke="none" />
      </g>
      <text x={OX + 8} y={16} fontSize={11} fill={INK.muted}>
        {y}
      </text>
      <text x={OX + PW + 8} y={OY + 32} fontSize={11} fill={INK.muted} textAnchor="end">
        {x}
      </text>
      <text x={OX - 8} y={OY + 14} fontSize={11} fill={INK.muted} textAnchor="end">
        0
      </text>
      {children}
    </Svg>
  );
}

/** A diagram that isn't a graph (matrices, trees, networks), in raw SVG units. */
export function Canvas({ label, children }: { label: string; children: ReactNode }) {
  return <Svg label={label}>{children}</Svg>;
}

export function Curve({
  f,
  from = 0,
  to = 100,
  pts,
  label,
  at = "end",
  dx = 4,
  dy = 4,
  ink = "base",
  dashed = false,
  width = 2,
}: {
  f?: Fn;
  from?: number;
  to?: number;
  pts?: Pt[];
  label?: string;
  at?: "end" | "start" | Pt;
  dx?: number;
  dy?: number;
  ink?: Ink;
  dashed?: boolean;
  width?: number;
}) {
  const points = pts ?? sample(f!, from, to);
  const [lx, ly] = at === "end" ? points[points.length - 1] : at === "start" ? points[0] : at;
  return (
    <g>
      <path d={path(points)} fill="none" stroke={INK[ink]} strokeWidth={width} strokeDasharray={dashed ? "6 4" : undefined} strokeLinejoin="round" />
      {label ? (
        <text className="lbl" x={sx(lx) + dx} y={sy(ly) + dy} fontSize={11.5} fontWeight={600} fill={INK[ink]}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** Dashed guides from a point down to the x axis and across to the y axis. */
export function Drop({ at: [x, y], xTick, yTick, toX = true, toY = true }: { at: Pt; xTick?: string; yTick?: string; toX?: boolean; toY?: boolean }) {
  return (
    <g stroke={INK.muted} strokeWidth={1} strokeDasharray="3 3">
      {toX ? <line x1={sx(x)} y1={sy(y)} x2={sx(x)} y2={sy(0)} /> : null}
      {toY ? <line x1={sx(x)} y1={sy(y)} x2={sx(0)} y2={sy(y)} /> : null}
      {xTick ? <Tick x={x} label={xTick} /> : null}
      {yTick ? <Tick y={y} label={yTick} /> : null}
    </g>
  );
}

export function Tick({ x, y, label }: { x?: number; y?: number; label: string }) {
  return x !== undefined ? (
    <text className="lbl" x={sx(x)} y={OY + 15} fontSize={10.5} textAnchor="middle" fill={INK.base} stroke="none">
      {label}
    </text>
  ) : (
    <text className="lbl" x={OX - 5} y={sy(y!) + 4} fontSize={10.5} textAnchor="end" fill={INK.base} stroke="none">
      {label}
    </text>
  );
}

export function Region({ pts, tone, label, at, size = 10 }: { pts: Pt[]; tone: Tone; label?: string; at?: Pt; size?: number }) {
  const cx = at ? at[0] : pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = at ? at[1] : pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return (
    <g>
      <polygon points={pts.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ")} fill={FILL[tone]} fillOpacity={0.28} stroke="none" />
      {label ? <Note at={[cx, cy]} anchor="middle" size={size} ink="base">{label}</Note> : null}
    </g>
  );
}

export function Arrow({ from, to, ink = "accent", both = false, width = 1.6 }: { from: Pt; to: Pt; ink?: Ink; both?: boolean; width?: number }) {
  const [x1, y1, x2, y2] = [sx(from[0]), sy(from[1]), sx(to[0]), sy(to[1])];
  return (
    <g stroke={INK[ink]} fill={INK[ink]} strokeWidth={width}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon points={head(x1, y1, x2, y2)} stroke="none" />
      {both ? <polygon points={head(x2, y2, x1, y1)} stroke="none" /> : null}
    </g>
  );
}

export function Dot({ at, label, dx = 6, dy = -6, ink = "base" }: { at: Pt; label?: string; dx?: number; dy?: number; ink?: Ink }) {
  return (
    <g>
      <circle cx={sx(at[0])} cy={sy(at[1])} r={3.5} fill={INK[ink]} />
      {label ? (
        <text className="lbl" x={sx(at[0]) + dx} y={sy(at[1]) + dy} fontSize={10.5} fontWeight={600} fill={INK[ink]}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** Text placed in data coordinates. Hidden in practice mode unless `keep`. */
export function Note({
  at,
  children,
  anchor = "start",
  ink = "base",
  size = 10.5,
  weight = 500,
  keep = false,
}: {
  at: Pt;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  ink?: Ink;
  size?: number;
  weight?: number;
  keep?: boolean;
}) {
  const lines = String(children).split("\n");
  return (
    <text className={keep ? undefined : "lbl"} x={sx(at[0])} y={sy(at[1])} fontSize={size} fontWeight={weight} textAnchor={anchor} fill={INK[ink]}>
      {lines.map((l, i) => (
        <tspan key={i} x={sx(at[0])} dy={i ? size + 2 : 0}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Pieces for non-graph diagrams, in raw SVG units (360 × 280).
// ---------------------------------------------------------------------------

export function Txt({
  x,
  y,
  children,
  anchor = "middle",
  size = 11,
  weight = 500,
  ink = "base",
  keep = false,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: "start" | "middle" | "end";
  size?: number;
  weight?: number;
  ink?: Ink;
  keep?: boolean;
}) {
  const lines = String(children).split("\n");
  return (
    <text className={keep ? undefined : "lbl"} x={x} y={y} fontSize={size} fontWeight={weight} textAnchor={anchor} fill={INK[ink]}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i ? size + 2 : 0}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

export function Rect({ x, y, w, h, fill = "#f8fafc", stroke = INK.base, dashed = false }: { x: number; y: number; w: number; h: number; fill?: string; stroke?: string; dashed?: boolean }) {
  return <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke={stroke} strokeWidth={1.5} strokeDasharray={dashed ? "5 4" : undefined} />;
}

export function PxArrow({ x1, y1, x2, y2, ink = "base", width = 1.6, both = false }: { x1: number; y1: number; x2: number; y2: number; ink?: Ink; width?: number; both?: boolean }) {
  return (
    <g stroke={INK[ink]} fill={INK[ink]} strokeWidth={width}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polygon points={head(x1, y1, x2, y2)} stroke="none" />
      {both ? <polygon points={head(x2, y2, x1, y1)} stroke="none" /> : null}
    </g>
  );
}

/** Two or three graphs side by side for comparisons, stacked on phones. */
export function Panels({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={`grid grid-cols-1 gap-3 ${cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>{children}</div>;
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return <p className="mb-1 text-center text-xs font-semibold text-slate-600">{children}</p>;
}
