import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

// supabase/setup.sql is the one-paste version of the migrations for the
// Supabase SQL editor. It must stay identical to them.
it("setup.sql matches the migrations", () => {
  const dir = path.resolve(import.meta.dirname, "../../supabase");
  const read = (f: string) => readFileSync(path.join(dir, f), "utf8");
  const setup = read("setup.sql");
  const body = setup.slice(setup.indexOf("-- A-level revision tracker"));
  expect(body).toBe(`${read("migrations/20261026000000_schema.sql")}\n${read("migrations/20261026000100_reference_data.sql")}`);
});
