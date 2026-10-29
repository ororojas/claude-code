import { palette } from "@/lib/subjects";
import type { Rag } from "@/lib/types";

export function Card({ children, className = "", flush = false }: { children: React.ReactNode; className?: string; flush?: boolean }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${flush ? "" : "p-4 md:p-5"} ${className}`}>{children}</section>;
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{children}</h2>
      {aside}
    </div>
  );
}

export function ProgressBar({ value, max, className = "bg-slate-900", label }: { value: number; max: number; className?: string; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SubjectTag({ subjectId, children }: { subjectId: string | null; children: React.ReactNode }) {
  const p = palette(subjectId);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${p.border} ${p.soft} ${p.text}`}>
      <span className={`size-1.5 rounded-full ${p.dot}`} aria-hidden />
      {children}
    </span>
  );
}

const RAG_STYLE: Record<Rag, string> = {
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-green-100 text-green-800",
};

export function RagBadge({ status }: { status: Rag }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${RAG_STYLE[status]}`}>{status}</span>;
}

/** Red/amber/green split as one stacked bar. */
export function RagBar({ red, amber, green }: { red: number; amber: number; green: number }) {
  const total = red + amber + green || 1;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${green} green, ${amber} amber, ${red} red`}>
      <div className="bg-green-500" style={{ width: `${(green / total) * 100}%` }} />
      <div className="bg-amber-400" style={{ width: `${(amber / total) * 100}%` }} />
      <div className="bg-red-400" style={{ width: `${(red / total) * 100}%` }} />
    </div>
  );
}

export function GradeBadge({ grade, target }: { grade: string; target?: string }) {
  const order = ["A*", "A", "B", "C", "D", "E", "U"];
  const ok = target ? order.indexOf(grade) <= order.indexOf(target) : true;
  return (
    <span className={`inline-flex min-w-8 justify-center rounded-md px-1.5 py-0.5 text-sm font-bold ${ok ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
      {grade}
    </span>
  );
}

export function Stat({ label, value, sub, children }: { label: string; value: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-slate-500">{sub}</div> : null}
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">{children}</p>;
}

export const KIND_LABEL: Record<string, string> = {
  content: "Content",
  timed_paper: "Timed paper",
  marking: "Marking",
  mop_up: "Mop-up",
  recall: "Recall",
  exam: "Mock",
};
