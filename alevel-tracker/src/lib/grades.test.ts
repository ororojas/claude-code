import { describe, expect, it } from "vitest";
import { boundariesFor, gradeFor, marksForGrade, marksToTarget, meetsTarget, percentOf } from "./grades";
import type { GradeBoundaryRow } from "./types";

const econDefaults: GradeBoundaryRow[] = [
  ["A*", 73.75], ["A", 65], ["B", 55], ["C", 45], ["D", 35], ["E", 25],
].map(([grade, min]) => ({ subject_id: "econ", user_id: null, grade: grade as string, min_percent: min as number, source: null }));

describe("grades", () => {
  const b = boundariesFor(econDefaults, "econ");

  it("matches the AQA June 2024 raw boundaries on an 80-mark paper", () => {
    expect(marksForGrade("A*", b, 80)).toBe(59);
    expect(marksForGrade("A", b, 80)).toBe(52);
    expect(marksForGrade("B", b, 80)).toBe(44);
    expect(marksForGrade("E", b, 80)).toBe(20);
  });

  it("grades exactly on a boundary as the higher grade", () => {
    expect(gradeFor(percentOf(52, 80), b)).toBe("A");
    expect(gradeFor(percentOf(59, 80), b)).toBe("A*");
    expect(gradeFor(percentOf(51, 80), b)).toBe("B");
  });

  it("returns U below E", () => {
    expect(gradeFor(percentOf(19, 80), b)).toBe("U");
  });

  it("works for a 100-mark Business paper", () => {
    const bus: GradeBoundaryRow[] = [
      { subject_id: "business", user_id: null, grade: "A", min_percent: 64.48, source: null },
      { subject_id: "business", user_id: null, grade: "A*", min_percent: 70.75, source: null },
    ];
    const bb = boundariesFor(bus, "business");
    expect(marksForGrade("A", bb, 100)).toBe(65);
    expect(gradeFor(64.5, bb)).toBe("A");
    expect(gradeFor(64.4, bb)).toBe("U"); // no B–E rows in this fixture
    expect(gradeFor(99, bb)).toBe("A*");
    expect(marksForGrade("B", bb, 100)).toBeNull();
  });

  it("prefers the user's own boundaries over defaults", () => {
    const rows = [
      ...econDefaults,
      { subject_id: "econ" as const, user_id: "u1", grade: "A", min_percent: 70, source: "School" },
    ];
    const mine = boundariesFor(rows, "econ");
    expect(mine.A).toBe(70);
    expect(mine.B).toBe(55);
    expect(gradeFor(percentOf(54, 80), mine)).toBe("B");
  });

  it("measures distance to target", () => {
    expect(marksToTarget(48, 80, "A", b)).toBe(4);
    expect(marksToTarget(60, 80, "A", b)).toBe(0);
    expect(meetsTarget("A*", "A")).toBe(true);
    expect(meetsTarget("B", "A")).toBe(false);
    expect(meetsTarget("U", "E")).toBe(false);
  });
});
