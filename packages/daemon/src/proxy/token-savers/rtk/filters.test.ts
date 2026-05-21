import assert from "node:assert/strict";
import test from "node:test";
import { autoDetectFilter } from "./filters.js";

// --- autoDetectFilter detection ---

test("autoDetectFilter detects git diff by diff --git header", () => {
  const input = "diff --git a/foo.ts b/foo.ts\n@@ -1,3 +1,4 @@\n+new line\n context";
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  assert.equal(filter?.filterName, "git-diff");
});

test("autoDetectFilter detects git diff by @@ header", () => {
  const input = "@@ -10,5 +10,6 @@\n context\n+added\n";
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  assert.equal(filter?.filterName, "git-diff");
});

test("autoDetectFilter detects git status by On branch", () => {
  const input = "On branch main\nChanges to be committed:\n  modified: src/foo.ts\n";
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  assert.equal(filter?.filterName, "git-status");
});

test("autoDetectFilter detects git status by nothing to commit", () => {
  const input = "On branch main\nnothing to commit, working tree clean";
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  assert.equal(filter?.filterName, "git-status");
});

test("autoDetectFilter detects git status porcelain format", () => {
  const input = " M src/foo.ts\n?? src/bar.ts\nM  src/baz.ts\n";
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  assert.equal(filter?.filterName, "git-status");
});

test("autoDetectFilter detects grep output", () => {
  const input = [
    "src/foo.ts:10:const value = true",
    "src/foo.ts:20:const other = false",
    "src/bar.ts:5:import { value } from './foo'",
  ].join("\n");
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  assert.equal(filter?.filterName, "grep");
});

test("autoDetectFilter detects find output (path-like lines)", () => {
  const input = [
    "./src/foo.ts",
    "./src/bar.ts",
    "./src/baz/index.ts",
    "./tests/foo.test.ts",
  ].join("\n");
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  assert.equal(filter?.filterName, "find");
});

test("autoDetectFilter detects tree output", () => {
  const input = ".\n├── src\n│   ├── foo.ts\n│   └── bar.ts\n└── tests\n    └── foo.test.ts\n";
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  assert.equal(filter?.filterName, "tree");
});

test("autoDetectFilter detects smart-truncate for long plain text", () => {
  const lines = Array.from({ length: 300 }, (_, i) => `line ${i}: some random content here`);
  const input = lines.join("\n");
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  assert.equal(filter?.filterName, "smart-truncate");
});

test("autoDetectFilter returns null for short plain text", () => {
  const input = "hello world\nthis is a short message";
  const filter = autoDetectFilter(input);
  assert.equal(filter, null);
});

// --- git-diff filter ---

test("git-diff filter compresses diff output", () => {
  const diff = [
    "diff --git a/src/foo.ts b/src/foo.ts",
    "index abc..def 100644",
    "--- a/src/foo.ts",
    "+++ b/src/foo.ts",
    "@@ -1,3 +1,4 @@",
    " context line",
    "+added line",
    "-removed line",
    " another context",
  ].join("\n");

  const filter = autoDetectFilter(diff);
  assert.ok(filter !== null);
  const result = filter!(diff);
  assert.ok(result.includes("src/foo.ts"));
  assert.ok(result.includes("+1 -1"));
});

test("git-diff filter truncates large hunks", () => {
  const lines = ["diff --git a/big.ts b/big.ts", "@@ -1,200 +1,200 @@"];
  for (let i = 0; i < 150; i++) lines.push(`+added line ${i}`);
  const diff = lines.join("\n");

  const filter = autoDetectFilter(diff);
  assert.ok(filter !== null);
  const result = filter!(diff);
  assert.match(result, /lines truncated/);
  assert.match(result, /\[full diff:/);
});

// --- git-status filter ---

test("git-status filter summarizes staged files", () => {
  const input = "On branch main\nChanges to be committed:\n  modified:   src/foo.ts\n  new file:   src/bar.ts\n";
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  const result = filter!(input);
  assert.match(result, /\* main/);
  assert.match(result, /\+ Staged: 2 files/);
});

test("git-status filter shows clean when no changes", () => {
  const input = "On branch main\nnothing to commit, working tree clean";
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  const result = filter!(input);
  assert.match(result, /clean/);
});

test("git-status filter handles porcelain format", () => {
  // isMostlyPorcelain requires at least 3 non-empty lines matching the pattern
  const input = "M  src/staged.ts\nM  src/other.ts\n?? src/untracked.ts\n";
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  const result = filter!(input);
  assert.ok(result.includes("staged.ts") || result.includes("Staged") || result.includes("Modified"));
});

test("git-status filter shows untracked files", () => {
  const input = "On branch main\nUntracked files:\n?? new-file.ts\n";
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  const result = filter!(input);
  assert.match(result, /\? Untracked/);
});

// --- grep filter ---

test("grep filter groups matches by file", () => {
  const input = [
    "src/a.ts:10:foo bar",
    "src/a.ts:20:baz qux",
    "src/b.ts:5:hello",
  ].join("\n");

  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  const result = filter!(input);
  assert.match(result, /3 matches in 2F/);
  assert.match(result, /\[file\] src\/a\.ts/);
  assert.match(result, /\[file\] src\/b\.ts/);
});

test("grep filter truncates per-file results beyond limit", () => {
  const lines = Array.from({ length: 20 }, (_, i) => `src/big.ts:${i + 1}:match ${i}`);
  const input = lines.join("\n");
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  const result = filter!(input);
  assert.match(result, /\+10/);
});

test("grep filter returns input unchanged when no matches found", () => {
  const input = "no matches here\njust plain text\n";
  const filter = autoDetectFilter(input);
  if (filter?.filterName === "grep") {
    const result = filter(input);
    assert.equal(result, input);
  }
});

// --- find filter ---

test("find filter groups files by directory", () => {
  const input = [
    "./src/a.ts",
    "./src/b.ts",
    "./tests/a.test.ts",
  ].join("\n");

  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  const result = filter!(input);
  assert.match(result, /3 files in 2 dirs/);
  assert.match(result, /src\//);
  assert.match(result, /tests\//);
});

test("find filter truncates files beyond per-dir limit", () => {
  const lines = Array.from({ length: 15 }, (_, i) => `./src/file_${i}.ts`);
  const input = lines.join("\n");
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  const result = filter!(input);
  assert.match(result, /\+5/);
});

// --- tree filter ---

test("tree filter trims tree output to max lines", () => {
  const lines = Array.from({ length: 250 }, (_, i) => `├── file_${i}.ts`);
  lines.unshift(".");
  const input = lines.join("\n");
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  const result = filter!(input);
  assert.match(result, /\+\d+ more lines/);
});

test("tree filter removes directory/file summary lines", () => {
  const input = ".\n├── src\n│   └── foo.ts\n\n3 directories, 5 files\n";
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  const result = filter!(input);
  assert.doesNotMatch(result, /3 directories, 5 files/);
});

// --- smart-truncate filter ---

test("smart-truncate keeps head and tail of long content", () => {
  const lines = Array.from({ length: 300 }, (_, i) => `line ${i}`);
  const input = lines.join("\n");
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  const result = filter!(input);
  assert.match(result, /line 0/);
  assert.match(result, /line 299/);
  assert.match(result, /lines truncated/);
});

test("smart-truncate returns unchanged content below threshold", () => {
  const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`);
  const input = lines.join("\n");
  const filter = autoDetectFilter(input);
  // Should return null for short content (< 250 lines)
  assert.equal(filter, null);
});

// --- dedup-log filter ---

test("autoDetectFilter detects dedup-log for repeated lines", () => {
  const lines = ["Error: connection refused", "Error: connection refused", "Error: connection refused", "Retrying...", "Retrying..."];
  const input = lines.join("\n");
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  assert.equal(filter?.filterName, "dedup-log");
});

test("dedup-log filter compresses duplicate lines", () => {
  // autoDetectFilter requires nonEmpty.length >= 5 to detect dedup-log
  const lines = ["same line", "same line", "same line", "different line", "extra line"];
  const input = lines.join("\n");
  const filter = autoDetectFilter(input);
  assert.ok(filter !== null);
  const result = filter!(input);
  assert.match(result, /2 duplicate lines/);
  assert.match(result, /different line/);
});
