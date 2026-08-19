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

/**
 * Reads are what must filter; writes carry their own scoping.
 *
 * This list is how the gate below decides what counts as a "read" at all: a
 * function whose name does not start with one of these prefixes is invisible
 * to this file's coverage checks, not merely exempt from them — it is never
 * inspected, so it can omit `notDeleted(...)` with nobody noticing. New read
 * functions added to these four repo files MUST be named with one of these
 * prefixes (or this list extended to cover the new name) or they will not be
 * checked here at all.
 */
const READ_PREFIXES = ["find", "get", "has", "relationship"];

/**
 * Prefixes that read naturally as "this returns rows" but are NOT in
 * READ_PREFIXES above. A function named with one of these would silently
 * skip every check in this file. See the guard test below.
 */
const READ_LIKE_PREFIXES_NOT_COVERED = [
  "list",
  "resolve",
  "fetch",
  "select",
  "query",
  "load",
  "read",
];

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

    it(`${file} has no exported function named with a read-like prefix that READ_PREFIXES would miss`, () => {
      const blindSpots = [...bodies.keys()].filter((name) =>
        READ_LIKE_PREFIXES_NOT_COVERED.some((p) =>
          name.toLowerCase().startsWith(p),
        ),
      );

      if (blindSpots.length > 0) {
        throw new Error(
          `${file} exports ${blindSpots.join(", ")}, whose name starts with a ` +
            `read-like prefix not in READ_PREFIXES (${READ_PREFIXES.join(", ")}). ` +
            `The soft-delete coverage check above never inspects these functions. ` +
            `Either rename them to start with one of READ_PREFIXES, or add their ` +
            `prefix to READ_PREFIXES so this gate actually checks them.`,
        );
      }
      expect(blindSpots).toEqual([]);
    });
  }
});
