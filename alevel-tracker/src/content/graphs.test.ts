import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DRAWINGS } from "@/components/graphs";
import { teachCard } from ".";
import { GRAPHS } from "./graphs";

describe("graphs", () => {
  it("has a drawing for every graph and a graph for every drawing", () => {
    expect(Object.keys(DRAWINGS).sort()).toEqual(GRAPHS.map((g) => g.id).sort());
  });

  it("uses unique ids", () => {
    expect(new Set(GRAPHS.map((g) => g.id)).size).toBe(GRAPHS.length);
  });

  it.each(GRAPHS.map((g) => [g.id, g] as const))("%s belongs to a real topic in its subject", (_, g) => {
    expect(teachCard(g.topicId), g.topicId).toBeDefined();
    expect(g.topicId.startsWith(g.subject === "econ" ? "econ-" : "bus-")).toBe(true);
    expect(g.steps.length).toBeGreaterThanOrEqual(3);
  });

  it.each(GRAPHS.map((g) => g.id))("%s draws without broken numbers", (id) => {
    const svg = renderToStaticMarkup(createElement(DRAWINGS[id]));
    expect(svg).toContain("<svg");
    expect(svg).not.toMatch(/NaN|Infinity|undefined/);
  });
});
