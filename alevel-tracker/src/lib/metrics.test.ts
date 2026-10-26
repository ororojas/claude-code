import { describe, expect, it } from "vitest";
import { biggestLeak, droppedMarks, subjectMetrics, weakTopicCounts } from "./metrics";
import type { GradeBoundaryRow, PaperAttempt, Topic, TopicProgress } from "./types";

const topics: Topic[] = ["a", "b", "c", "d"].map((id, i) => ({
  id, subject_id: "econ", section: "s", spec_ref: "r", title: id, exam_focus: null, est_hours: 2, sort_order: i,
}));
const progress: TopicProgress[] = [
  { topic_id: "a", status: "green", percent_complete: 100, notes: null, updated_at: "" },
  { topic_id: "b", status: "amber", percent_complete: 50, notes: null, updated_at: "" },
  { topic_id: "c", status: "red", percent_complete: 10, notes: null, updated_at: "" },
];
const bounds: GradeBoundaryRow[] = [
  { subject_id: "econ", user_id: null, grade: "A", min_percent: 65, source: null },
  { subject_id: "econ", user_id: null, grade: "B", min_percent: 55, source: null },
];
const attempt = (over: Partial<PaperAttempt>): PaperAttempt => ({
  id: crypto.randomUUID(), subject_id: "econ", past_paper_id: null, title: "t", sat_on: "2026-11-05",
  marks_scored: 50, max_marks: 80, timed: true, minutes_taken: null, lost_knowledge: 0, lost_timing: 0,
  lost_structure: 0, lost_other: 0, reflection: null, weak_topic_ids: [], created_at: "2026-11-05T19:00:00Z", ...over,
});

describe("subjectMetrics", () => {
  it("counts traffic lights, completion, hours and papers", () => {
    const m = subjectMetrics(
      "econ", topics, progress,
      [{ id: "1", subject_id: "econ", topic_id: null, schedule_item_id: null, studied_on: "2026-10-26", minutes: 90, note: null },
       { id: "2", subject_id: "business", topic_id: null, schedule_item_id: null, studied_on: "2026-10-26", minutes: 60, note: null }],
      [attempt({ sat_on: "2026-10-31", marks_scored: 44 }), attempt({ sat_on: "2026-11-05", marks_scored: 54 })],
      { subject_id: "econ", target_grade: "A", target_hours: 30, target_papers: 4, exam_date: "2026-11-12", exam_session: "AM" },
      bounds,
    );
    expect([m.green, m.amber, m.red]).toEqual([1, 1, 2]); // "d" has no row, so it counts as red
    expect(m.percentComplete).toBe(40); // (100 + 50 + 10 + 0) / 4
    expect(m.minutesLogged).toBe(90);
    expect(m.papersDone).toBe(2);
    expect(m.latest?.grade).toBe("A"); // most recent: 54/80 = 67.5%
    expect(m.average?.grade).toBe("B"); // mean 61.25%
  });
});

describe("dropped marks", () => {
  it("totals categories and the marks nobody explained", () => {
    const d = droppedMarks([
      attempt({ marks_scored: 50, lost_knowledge: 10, lost_timing: 5, lost_structure: 8 }),
      attempt({ marks_scored: 60, lost_structure: 12 }),
    ]);
    expect(d).toEqual({ knowledge: 10, timing: 5, structure: 20, other: 0, unassigned: 7 + 8, total: 50 });
    expect(biggestLeak(d)).toBe("structure");
    expect(biggestLeak(droppedMarks([]))).toBeNull();
  });

  it("counts weak topic tags", () => {
    const c = weakTopicCounts([attempt({ weak_topic_ids: ["a", "b"] }), attempt({ weak_topic_ids: ["a"] })]);
    expect(c.get("a")).toBe(2);
    expect(c.get("b")).toBe(1);
  });
});
