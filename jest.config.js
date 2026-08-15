const path = require("path");
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

// The main checkout must not collect tests out of nested worktrees, but a run
// started INSIDE a worktree has ".worktrees" in its own absolute path — so the
// blanket ignore would skip every test it was asked to run. Only apply it when
// we are not already inside one.
const insideWorktree = __dirname
  .split(path.sep)
  .includes(".worktrees");

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/.claude/",
    ...(insideWorktree ? [] : ["/.worktrees/"]),
  ],
  modulePathIgnorePatterns: ["<rootDir>/.claude/"],
};

module.exports = createJestConfig(config);
