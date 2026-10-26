import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allTeachCards, examTechnique, teachCard } from ".";

// Topic ids live in the reference-data migration; every one needs Teach Me notes.
const sql = readFileSync(
  path.resolve(import.meta.dirname, "../../supabase/migrations/20261026000100_reference_data.sql"),
  "utf8",
);
const topicBlock = sql.slice(sql.indexOf("insert into public.topics"), sql.indexOf("insert into public.past_papers"));
const topicIds = [...topicBlock.matchAll(/\('((?:econ|bus|soc)-[a-z-]+)', '(econ|business|sociology)'/g)].map((m) => m[1]);

describe("teach content", () => {
  it("finds the seeded topics", () => {
    expect(topicIds).toHaveLength(33);
  });

  it.each(topicIds)("has a card for %s", (id) => {
    const card = teachCard(id);
    expect(card, id).toBeDefined();
    expect(card!.summary.length).toBeGreaterThanOrEqual(5);
    expect(card!.definitions.length).toBeGreaterThanOrEqual(3);
    expect(card!.essays.length).toBeGreaterThanOrEqual(1);
    expect(card!.practice.length).toBeGreaterThanOrEqual(3);
  });

  it("has no cards for topics that aren't seeded", () => {
    const extra = allTeachCards().map((c) => c.topicId).filter((id) => !topicIds.includes(id));
    expect(extra).toEqual([]);
  });

  it("gives every Economics topic a diagram checklist where diagrams are examined", () => {
    const withoutDiagrams = allTeachCards()
      .filter((c) => c.topicId.startsWith("econ-") && !c.diagrams?.length)
      .map((c) => c.topicId);
    // These are examined mostly through written analysis rather than diagrams.
    expect(withoutDiagrams.sort()).toEqual(["econ-behavioural", "econ-gov-failure", "econ-public-goods-info"]);
  });

  it("has exam technique for each subject", () => {
    for (const s of ["econ", "business", "sociology"]) expect(examTechnique(s)).toBeDefined();
  });
});
