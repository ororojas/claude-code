import type { SubjectId } from "./types";

interface Palette {
  dot: string;
  text: string;
  soft: string;
  border: string;
  bar: string;
}

// Full class names so Tailwind can see them at build time.
const PALETTES: Record<SubjectId, Palette> = {
  econ: { dot: "bg-sky-500", text: "text-sky-700", soft: "bg-sky-50", border: "border-sky-200", bar: "bg-sky-500" },
  business: { dot: "bg-violet-500", text: "text-violet-700", soft: "bg-violet-50", border: "border-violet-200", bar: "bg-violet-500" },
  sociology: { dot: "bg-fuchsia-500", text: "text-fuchsia-700", soft: "bg-fuchsia-50", border: "border-fuchsia-200", bar: "bg-fuchsia-500" },
};

const NEUTRAL: Palette = { dot: "bg-slate-400", text: "text-slate-600", soft: "bg-slate-50", border: "border-slate-200", bar: "bg-slate-400" };

export function palette(subjectId: string | null | undefined): Palette {
  return (subjectId && PALETTES[subjectId as SubjectId]) || NEUTRAL;
}

export const FILTER_LABEL: Record<SubjectId, string> = {
  econ: "AQA Econ",
  business: "Edexcel Business",
  sociology: "AQA Sociology",
};

export function isSubjectId(value: unknown): value is SubjectId {
  return value === "econ" || value === "business" || value === "sociology";
}
