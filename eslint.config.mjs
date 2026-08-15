import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktrees hold full copies of the repo at other commits. Without these,
    // lint reports stale code from other branches as errors in this one, and
    // the run takes minutes instead of seconds.
    ".worktrees/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
