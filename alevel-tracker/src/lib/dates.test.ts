import { describe, expect, it } from "vitest";
import { addDays, daysBetween, durationMinutes, formatDay, londonMinutes, todayISO, weekStart } from "./dates";
import { phaseFor } from "./plan";

describe("dates", () => {
  it("uses London time for today", () => {
    // 23:30 UTC on 1 July is already 2 July in BST.
    expect(todayISO(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    // After the clocks go back (25 Oct 2026), London matches UTC.
    expect(todayISO(new Date("2026-10-26T23:30:00Z"))).toBe("2026-10-26");
    expect(londonMinutes(new Date("2026-07-01T15:30:00Z"))).toBe(16 * 60 + 30);
  });

  it("does date arithmetic without timezone drift", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(daysBetween("2026-10-26", "2026-11-12")).toBe(17);
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
    expect(formatDay("2026-11-12")).toBe("Thu 12 Nov");
    expect(durationMinutes("16:30:00", "18:30:00")).toBe(120);
  });

  it("maps days to the study phases", () => {
    expect(phaseFor("2026-10-26").key).toBe("half-term");
    expect(phaseFor("2026-11-01").key).toBe("half-term");
    expect(phaseFor("2026-11-03").key).toBe("mop-up");
    expect(phaseFor("2026-11-11").key).toBe("papers");
    expect(phaseFor("2026-11-13").key).toBe("mocks");
    expect(phaseFor("2026-10-20").key).toBe("before");
    expect(phaseFor("2026-11-20").key).toBe("after");
  });
});
