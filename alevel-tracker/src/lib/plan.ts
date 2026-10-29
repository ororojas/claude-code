import { addDays } from "./dates";

export interface Phase {
  key: "before" | "half-term" | "mop-up" | "papers" | "mocks" | "after";
  label: string;
  start: string;
  end: string;
  focus: string;
}

// Mirrors the study timetable seeded in plan_template.
export const PHASES: Phase[] = [
  {
    key: "half-term",
    label: "Half-term",
    start: "2026-10-26",
    end: "2026-11-01",
    focus: "100% content, then the first timed paper in each subject at the weekend.",
  },
  {
    key: "mop-up",
    label: "Week 1 · back at school",
    start: "2026-11-02",
    end: "2026-11-04",
    focus: "Mop-up: fix every red topic and drill calculations and essay plans.",
  },
  {
    key: "papers",
    label: "Week 2 · timed papers",
    start: "2026-11-05",
    end: "2026-11-11",
    focus: "A timed past paper every evening (4:30–6:30pm), marked and analysed in the late block (7:30–9:30pm).",
  },
  {
    key: "mocks",
    label: "Mock week",
    start: "2026-11-12",
    end: "2026-11-13",
    focus: "Economics Thursday morning. Business and Sociology Friday.",
  },
];

export const PLAN_START = PHASES[0].start;
export const PLAN_END = PHASES[PHASES.length - 1].end;

export function phaseFor(iso: string): Phase {
  const match = PHASES.find((p) => iso >= p.start && iso <= p.end);
  if (match) return match;
  if (iso < PLAN_START) {
    return { key: "before", label: "Before half-term", start: addDays(PLAN_START, -30), end: addDays(PLAN_START, -1), focus: "Get your notes in order before half-term starts." };
  }
  return { key: "after", label: "Mocks done", start: addDays(PLAN_END, 1), end: addDays(PLAN_END, 60), focus: "Log your real mock results and look at where the marks went." };
}
