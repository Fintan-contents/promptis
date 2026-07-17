import * as assert from "assert";
import path from "path";
import * as vscode from "vscode";
import {
  extractDiffRange,
  formatDiffForReview,
  getDiffFiles,
  hasReviewableHunks,
  parseUnifiedDiff,
  type GitRepository,
} from "../gitDiff";

suite("GitDiff Test Suite", function () {
  suite("extractDiffRange Test Suite", function () {
    test("should return default range when #range is not specified", function () {
      const result = extractDiffRange("review this diff", "origin/main...HEAD");
      assert.strictEqual(result, "origin/main...HEAD");
    });

    test("should extract unquoted #range value", function () {
      const result = extractDiffRange("review #range:HEAD~3..HEAD", "origin/main...HEAD");
      assert.strictEqual(result, "HEAD~3..HEAD");
    });

    test("should extract quoted #range value", function () {
      const result = extractDiffRange('review #range:"origin/develop...HEAD"', "origin/main...HEAD");
      assert.strictEqual(result, "origin/develop...HEAD");
    });
  });

  suite("parseUnifiedDiff Test Suite", function () {
    const repoRootPath = "/workspace/project";

    test("should parse modified and added files from unified diff", function () {
      const diffOutput = [
        "diff --git a/src/app.ts b/src/app.ts",
        "index 1111111..2222222 100644",
        "--- a/src/app.ts",
        "+++ b/src/app.ts",
        "@@ -1,2 +1,2 @@",
        "-const oldValue = 1;",
        "+const newValue = 1;",
        "diff --git a/src/new.ts b/src/new.ts",
        "new file mode 100644",
        "index 0000000..3333333",
        "--- /dev/null",
        "+++ b/src/new.ts",
        "@@ -0,0 +1 @@",
        "+export const created = true;",
        "",
      ].join("\n");

      const result = parseUnifiedDiff(diffOutput, repoRootPath);

      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(
        result.map((file) => ({ relativePath: file.relativePath, changeType: file.changeType })),
        [
          { relativePath: "src/app.ts", changeType: "modified" },
          { relativePath: "src/new.ts", changeType: "added" },
        ],
      );
      assert.strictEqual(result[0].filePath, path.join(repoRootPath, "src/app.ts"));
    });

    test("should parse deleted and renamed files", function () {
      const diffOutput = [
        "diff --git a/src/removed.ts b/src/removed.ts",
        "deleted file mode 100644",
        "index 1111111..0000000",
        "--- a/src/removed.ts",
        "+++ /dev/null",
        "@@ -1 +0,0 @@",
        "-export const removed = true;",
        "diff --git a/src/old.ts b/src/new-name.ts",
        "similarity index 88%",
        "rename from src/old.ts",
        "rename to src/new-name.ts",
        "--- a/src/old.ts",
        "+++ b/src/new-name.ts",
        "@@ -1 +1 @@",
        "-export const name = 'old';",
        "+export const name = 'new';",
        "",
      ].join("\n");

      const result = parseUnifiedDiff(diffOutput, repoRootPath);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].relativePath, "src/removed.ts");
      assert.strictEqual(result[0].changeType, "deleted");
      assert.strictEqual(result[1].relativePath, "src/new-name.ts");
      assert.strictEqual(result[1].changeType, "renamed");
      assert.strictEqual(result[1].oldPath, "src/old.ts");
    });

    test("should return empty array for empty diff", function () {
      const result = parseUnifiedDiff("", repoRootPath);
      assert.deepStrictEqual(result, []);
    });
  });

  suite("getDiffFiles Test Suite", function () {
    test("should call VS Code Git repository diffWith by raw range", async function () {
      const diffOutput = [
        "diff --git a/src/app.ts b/src/app.ts",
        "index 1111111..2222222 100644",
        "--- a/src/app.ts",
        "+++ b/src/app.ts",
        "@@ -1 +1 @@",
        "-old",
        "+new",
        "",
      ].join("\n");
      const repo = {
        rootUri: vscode.Uri.file("/workspace/project"),
        diffWith: async (range: string) => {
          assert.strictEqual(range, "origin/main...HEAD");
          return diffOutput;
        },
      } as GitRepository;

      const result = await getDiffFiles(repo, "origin/main...HEAD");

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].relativePath, "src/app.ts");
    });
  });

  suite("formatDiffForReview Test Suite", function () {
    test("should format diff with range, file, change type, and unified diff", function () {
      const diffFile = parseUnifiedDiff(
        [
          "diff --git a/src/app.ts b/src/app.ts",
          "index 1111111..2222222 100644",
          "--- a/src/app.ts",
          "+++ b/src/app.ts",
          "@@ -1 +1 @@",
          "-old",
          "+new",
          "",
        ].join("\n"),
        "/workspace/project",
      )[0];

      const result = formatDiffForReview(diffFile, "origin/main...HEAD");

      assert.match(result, /Diff range: origin\/main\.\.\.HEAD/);
      assert.match(result, /File: src\/app\.ts/);
      assert.match(result, /Change type: modified/);
      assert.match(result, /```diff/);
      assert.strictEqual(hasReviewableHunks(diffFile), true);
    });
  });
});
