import { describe, expect, it } from "vitest";
import { busyStretches, isBusy, type CalendarEvent } from "./calendar";

const ev = (title: string, starts_at: string, ends_at: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  title,
  starts_at,
  ends_at,
  all_day: false,
  transparent: false,
  ...extra,
});

describe("isBusy", () => {
  it("counts lessons, lessons with teachers, meals and appointments", () => {
    expect(isBusy(ev("Driving test", "2026-11-05T13:15:00Z", "2026-11-05T16:00:00Z"))).toBe(true);
    expect(isBusy(ev("Sociology – Mr T Carding", "2026-11-02T08:30:00Z", "2026-11-02T09:25:00Z"))).toBe(true);
    expect(isBusy(ev("Lunch", "2026-11-01T13:00:00Z", "2026-11-01T14:00:00Z"))).toBe(true);
  });

  it("ignores your own study sessions, short breaks, all-day and free events", () => {
    for (const title of ["Late study session", "Timed past papers", "Revision: weakest topic", "Mop up remaining content", "Sociology: Education 10-marker outline", "Mock Prep Review: Mark first timed paper"]) {
      expect(isBusy(ev(title, "2026-11-02T19:30:00Z", "2026-11-02T21:30:00Z")), title).toBe(false);
    }
    expect(isBusy(ev("Coffee break", "2026-11-01T15:30:00Z", "2026-11-01T15:45:00Z"))).toBe(false);
    expect(isBusy(ev("ECON PAPER 1 MOCK", "2026-11-12T00:00:00Z", "2026-11-13T00:00:00Z", { all_day: true }))).toBe(false);
    expect(isBusy(ev("Week a", "2026-11-09T00:00:00Z", "2026-11-16T00:00:00Z", { transparent: true }))).toBe(false);
  });
});

describe("busyStretches", () => {
  it("converts to UK time, including British Summer Time", () => {
    expect(busyStretches([ev("Football", "2026-10-20T16:00:00Z", "2026-10-20T18:00:00Z")])).toEqual([{ day: "2026-10-20", start: 17 * 60, end: 19 * 60, title: "Football" }]);
    expect(busyStretches([ev("Football", "2026-11-03T16:00:00Z", "2026-11-03T18:00:00Z")])).toEqual([{ day: "2026-11-03", start: 16 * 60, end: 18 * 60, title: "Football" }]);
  });

  it("splits an event that runs past midnight", () => {
    expect(busyStretches([ev("Party", "2026-11-07T22:00:00Z", "2026-11-08T01:00:00Z")])).toEqual([
      { day: "2026-11-07", start: 22 * 60, end: 24 * 60, title: "Party" },
      { day: "2026-11-08", start: 0, end: 60, title: "Party" },
    ]);
  });
});
