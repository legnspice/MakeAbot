import fs from "fs";
import path from "path";

/**
 * Guards the one rule that keeps soft-deleted content out of feeds and profiles:
 * every exported read in these modules filters on deleted_at.
 *
 * This is a source-level test on purpose. Calling each function and inspecting
 * generated SQL would need a live database or an elaborate mock, and would still
 * say nothing about a read added tomorrow. Deriving the list from the module's
 * own exports means the next read function is covered the moment it is written.
 */
const REPOS = [
  "messages.repo.ts",
  "offers.repo.ts",
  "requests.repo.ts",
  "relationships.repo.ts",
];

/** Reads are what must filter; writes carry their own scoping. */
const READ_PREFIXES = ["find", "get", "has", "relationship"];

function bodiesOf(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /^export async function (\w+)/gm;
  const marks: { name: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    marks.push({ name: m[1], start: m.index });
  }
  marks.forEach((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].start : src.length;
    out.set(mark.name, src.slice(mark.start, end));
  });
  return out;
}

describe("soft-delete read coverage", () => {
  for (const file of REPOS) {
    const src = fs.readFileSync(
      path.join(process.cwd(), "lib", "repo", file),
      "utf8",
    );
    const bodies = bodiesOf(src);
    const reads = [...bodies.keys()].filter((name) =>
      READ_PREFIXES.some((p) => name.toLowerCase().startsWith(p)),
    );

    it(`${file} exposes at least one read function`, () => {
      expect(reads.length).toBeGreaterThan(0);
    });

    for (const name of reads) {
      it(`${file}: ${name} filters soft-deleted rows`, () => {
        expect(bodies.get(name)).toContain("notDeleted(");
      });
    }
  }
});
