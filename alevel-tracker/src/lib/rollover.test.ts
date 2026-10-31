import { describe, expect, it } from "vitest";
import { partId, planRollover, splitBlock } from "./rollover";
import type { ScheduleItem } from "./types";

let seq = 0;
function block(day: string, start: string, end: string, extra: Partial<ScheduleItem> = {}): ScheduleItem {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    day,
    start_time: `${start}:00`,
    end_time: `${end}:00`,
    subject_id: "econ",
    kind: "content",
    title: `Block ${seq}`,
    detail: null,
    topic_ids: [],
    past_paper_id: null,
    completed_at: null,
    moved_from: null,
    ...extra,
  };
}

const exams = { econ: "2026-11-12", business: "2026-11-13", sociology: "2026-11-13" };
// Half-term Monday to Friday look like this in the seeded plan.
function halfTermDay(day: string) {
  return [
    block(day, "09:00", "11:00"),
    block(day, "11:30", "13:30", { subject_id: "sociology" }),
    block(day, "14:30", "16:30", { subject_id: "business" }),
    block(day, "19:30", "20:30", { subject_id: null, kind: "recall" }),
  ];
}

const run = (items: ScheduleItem[], today: string, nowMinutes = 8 * 60) => planRollover({ items, today, nowMinutes, examDates: exams });

describe("planRollover", () => {
  it("leaves everything alone when nothing was missed", () => {
    const items = [block("2026-10-26", "09:00", "11:00", { completed_at: "2026-10-26T11:00:00Z" }), ...halfTermDay("2026-10-27")];
    expect(run(items, "2026-10-27")).toEqual({ rows: [], freed: [], stuck: [] });
  });

  it("moves a missed block into the next free gap and remembers where it came from", () => {
    const missed = block("2026-10-26", "09:00", "11:00", { topic_ids: ["econ-problem"] });
    const { rows, stuck } = run([missed, ...halfTermDay("2026-10-27")], "2026-10-27");
    expect(stuck).toEqual([]);
    expect(rows).toEqual([expect.objectContaining({ id: missed.id, day: "2026-10-27", start_time: "16:30", end_time: "18:30", moved_from: "2026-10-26", topic_ids: ["econ-problem"] })]);
  });

  it("spreads a whole missed day over the following days instead of piling it onto one", () => {
    const missedDay = halfTermDay("2026-10-26");
    const items = [...missedDay, ...halfTermDay("2026-10-27"), ...halfTermDay("2026-10-28"), ...halfTermDay("2026-10-29")];
    const { rows } = run(items, "2026-10-27");
    // Each day already has 7h; the 9h cap leaves room for one 2h block a day.
    expect(rows.map((r) => r.day)).toEqual(["2026-10-27", "2026-10-28", "2026-10-29"]);
  });

  it("never moves exams or blocks without a subject, and leaves ticked blocks alone", () => {
    const exam = block("2026-11-12", "09:00", "11:00", { kind: "exam" });
    const recall = block("2026-10-26", "19:30", "20:30", { subject_id: null, kind: "recall" });
    const ticked = block("2026-10-26", "09:00", "11:00", { completed_at: "2026-10-26T11:00:00Z" });
    expect(run([exam, recall, ticked], "2026-11-13").rows).toEqual([]);
  });

  it("doesn't move today's blocks, and only uses time later today", () => {
    const earlier = block("2026-10-27", "09:00", "11:00");
    const missed = block("2026-10-26", "14:30", "16:30");
    const { rows } = run([earlier, missed], "2026-10-27", 17 * 60 + 10);
    expect(rows).toEqual([expect.objectContaining({ id: missed.id, day: "2026-10-27", start_time: "19:30", end_time: "21:30" })]);
  });

  it("keeps work for a subject before that subject's exam", () => {
    // Econ is on Thursday 12 Nov, so Wednesday 11 Nov is the last chance.
    const missed = block("2026-11-10", "16:30", "18:30");
    const full = (day: string) => [block(day, "16:30", "18:30", { subject_id: "business" }), block(day, "19:30", "21:30", { subject_id: "business" })];
    const { rows, stuck } = run([missed, ...full("2026-11-11"), block("2026-11-12", "09:00", "11:00", { kind: "exam" })], "2026-11-11");
    expect(rows).toEqual([]);
    expect(stuck.map((s) => s.id)).toEqual([missed.id]);
  });

  it("moves a timed paper and its marking together, marking second", () => {
    const paper = block("2026-11-05", "16:30", "18:30", { kind: "timed_paper", past_paper_id: "p1" });
    const marking = block("2026-11-05", "19:30", "21:30", { kind: "marking", past_paper_id: "p1" });
    const { rows } = run([paper, marking], "2026-11-06");
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(paper.id)).toMatchObject({ day: "2026-11-06", start_time: "16:30", end_time: "18:30" });
    expect(byId.get(marking.id)).toMatchObject({ day: "2026-11-06", start_time: "19:30", end_time: "21:30" });
  });

  it("moves an upcoming marking block when its paper now lands after it", () => {
    const paper = block("2026-11-04", "16:30", "18:30", { kind: "timed_paper", past_paper_id: "p1" });
    const marking = block("2026-11-05", "16:30", "17:30", { kind: "marking", past_paper_id: "p1" });
    const { rows } = run([paper, marking], "2026-11-05");
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(paper.id)).toMatchObject({ day: "2026-11-05", start_time: "19:30", end_time: "21:30" });
    expect(byId.get(marking.id)).toMatchObject({ day: "2026-11-06", start_time: "16:30", end_time: "17:30", moved_from: "2026-11-05" });
  });

  it("splits a block by topic when only shorter gaps are left", () => {
    const missed = block("2026-10-26", "09:00", "11:00", { topic_ids: ["a", "b"], title: "Econ: a + b" });
    // One free hour after 20:30 today and one tomorrow (the 9h cap allows it).
    const day = (d: string) => [
      block(d, "09:00", "13:30", { subject_id: "business" }),
      block(d, "14:30", "19:00", { subject_id: "business", kind: "exam" }),
      block(d, "19:30", "20:30", { subject_id: null, kind: "recall" }),
    ];
    const { rows } = run([missed, ...day("2026-10-27"), ...day("2026-10-28")], "2026-10-27");
    expect(rows).toEqual([
      expect.objectContaining({ id: missed.id, day: "2026-10-27", start_time: "20:30", end_time: "21:30", topic_ids: ["a"], title: "Econ: a + b (part 1 of 2)" }),
      expect.objectContaining({ id: partId(missed.id, 1), day: "2026-10-28", start_time: "20:30", end_time: "21:30", topic_ids: ["b"], title: "Econ: a + b (part 2 of 2)" }),
    ]);
  });

  it("takes over a mop-up block for the same subject when there's no free time", () => {
    const missed = block("2026-11-02", "16:30", "18:30");
    const otherMopUp = block("2026-11-03", "16:30", "18:30", { subject_id: "sociology", kind: "mop_up" });
    const mopUp = block("2026-11-03", "19:30", "21:30", { kind: "mop_up" });
    const { rows, freed } = run([missed, otherMopUp, mopUp], "2026-11-03");
    expect(freed).toEqual([mopUp.id]);
    expect(rows).toEqual([expect.objectContaining({ id: missed.id, day: "2026-11-03", start_time: "19:30", end_time: "21:30" })]);
  });

  it("never takes over the evening before the exam", () => {
    const missed = block("2026-11-10", "16:30", "18:30");
    const busy = block("2026-11-11", "16:30", "18:30", { kind: "timed_paper", past_paper_id: "p9" });
    const lastNight = block("2026-11-11", "19:30", "21:00", { kind: "recall" });
    const { rows, freed, stuck } = run([missed, busy, lastNight], "2026-11-11");
    expect([rows, freed]).toEqual([[], []]);
    expect(stuck.map((s) => s.id)).toEqual([missed.id]);
  });

  it("reports what can't fit and changes nothing for it", () => {
    const missed = block("2026-11-11", "16:30", "18:30");
    const { rows, stuck } = run([missed], "2026-11-12");
    expect(rows).toEqual([]);
    expect(stuck).toEqual([missed]);
  });

  it("gives the same answer every time, so overlapping runs agree", () => {
    const items = [...halfTermDay("2026-10-26"), ...halfTermDay("2026-10-27")];
    expect(run(items, "2026-10-27")).toEqual(run(items, "2026-10-27"));
    expect(partId("x", 1)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("splitBlock", () => {
  it("splits by topic, or in half when there's one topic", () => {
    expect(splitBlock(block("2026-10-26", "09:00", "11:00", { topic_ids: ["a", "b", "c"] }))).toEqual([
      { minutes: 60, topic_ids: ["a"] },
      { minutes: 60, topic_ids: ["b", "c"] },
    ]);
    expect(splitBlock(block("2026-10-26", "09:00", "10:30", { topic_ids: ["a"] }))).toEqual([
      { minutes: 45, topic_ids: ["a"] },
      { minutes: 45, topic_ids: ["a"] },
    ]);
  });

  it("won't split timed papers, short blocks or parts", () => {
    expect(splitBlock(block("2026-10-26", "09:00", "11:00", { kind: "timed_paper" }))).toBeNull();
    expect(splitBlock(block("2026-10-26", "09:00", "10:00"))).toBeNull();
    expect(splitBlock(block("2026-10-26", "09:00", "11:00", { title: "Econ (part 1 of 2)" }))).toBeNull();
  });
});
