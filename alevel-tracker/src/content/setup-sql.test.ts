import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

// supabase/setup.sql is the one-paste version of the migrations for the
// Supabase SQL editor. It must stay identical to them.
it("setup.sql matches the migrations", () => {
  const dir = path.resolve(import.meta.dirname, "../../supabase");
  const read = (f: string) => readFileSync(path.join(dir, f), "utf8");
  const setup = read("setup.sql");
  const body = setup.slice(setup.indexOf("-- A-level revision tracker"));
  const migrations = readdirSync(path.join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  expect(body).toBe(migrations.map((f) => read(`migrations/${f}`)).join("\n"));
});
