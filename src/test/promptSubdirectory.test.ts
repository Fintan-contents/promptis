import * as assert from "assert";
import path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";
import {
  listPromptSubdirectories,
  parsePromptDirectoryDirective,
  resolvePromptDirectoryScope,
  resolvePromptSubdirectory,
} from "../promptSubdirectory";

suite("promptSubdirectory Test Suite", function () {
  const fixtureBaseDir = path.join(__dirname, "..", "..", "src", "test", "__tests__", "promptdirs");

  suite("parsePromptDirectoryDirective Test Suite", function () {
    test("returns none when #promptDir is not included", function () {
      assert.deepStrictEqual(parsePromptDirectoryDirective("review this"), { kind: "none" });
    });

    test("does not match longer variable names", function () {
      assert.deepStrictEqual(parsePromptDirectoryDirective("review #promptDirectory:accessibility"), { kind: "none" });
    });

    test("returns pick when #promptDir has no explicit path", function () {
      assert.deepStrictEqual(parsePromptDirectoryDirective("review #promptDir #file:App.tsx"), { kind: "pick" });
    });

    test("returns path when #promptDir has an explicit path", function () {
      assert.deepStrictEqual(parsePromptDirectoryDirective("review #promptDir:accessibility"), {
        kind: "path",
        value: "accessibility",
      });
    });

    test("returns quoted path when #promptDir has spaces", function () {
      assert.deepStrictEqual(parsePromptDirectoryDirective('review #promptDir:"a path/with spaces"'), {
        kind: "path",
        value: "a path/with spaces",
      });
    });
  });

  suite("listPromptSubdirectories Test Suite", function () {
    test("lists subdirectories that contain prompt files", function () {
      const result = listPromptSubdirectories(fixtureBaseDir, []);

      assert.deepStrictEqual(result, [
        { relativePath: "accessibility", promptCount: 2 },
        { relativePath: "accessibility/nested", promptCount: 1 },
        { relativePath: "api-communication", promptCount: 1 },
      ]);
    });

    test("honors prompt exclude patterns", function () {
      const result = listPromptSubdirectories(fixtureBaseDir, ["**/accessibility/**"]);

      assert.deepStrictEqual(result, [
        { relativePath: "api-communication", promptCount: 1 },
      ]);
    });
  });

  suite("resolvePromptSubdirectory Test Suite", function () {
    test("resolves an existing prompt subdirectory", function () {
      const result = resolvePromptSubdirectory(fixtureBaseDir, "accessibility");

      assert.deepStrictEqual(result, {
        ok: true,
        promptDir: path.resolve(fixtureBaseDir, "accessibility"),
        relativePath: "accessibility",
      });
    });

    test("rejects absolute paths", function () {
      const result = resolvePromptSubdirectory(fixtureBaseDir, "/tmp");

      assert.deepStrictEqual(result, {
        ok: false,
        errorMessage: "#promptDir must be a relative path: /tmp",
      });
    });

    test("rejects path traversal", function () {
      const result = resolvePromptSubdirectory(fixtureBaseDir, "../frontmatter");

      assert.deepStrictEqual(result, {
        ok: false,
        errorMessage: "#promptDir must stay under the configured prompt directory: ../frontmatter",
      });
    });

    test("rejects missing subdirectories", function () {
      const result = resolvePromptSubdirectory(fixtureBaseDir, "missing");

      assert.deepStrictEqual(result, {
        ok: false,
        errorMessage: "Prompt subdirectory not found: missing",
      });
    });

    test("rejects files", function () {
      const result = resolvePromptSubdirectory(fixtureBaseDir, "root.md");

      assert.deepStrictEqual(result, {
        ok: false,
        errorMessage: "Prompt subdirectory is not a directory: root.md",
      });
    });
  });

  suite("resolvePromptDirectoryScope Test Suite", function () {
    let mockShowQuickPick: sinon.SinonStub;

    setup(function () {
      mockShowQuickPick = sinon.stub(vscode.window, "showQuickPick");
    });

    teardown(function () {
      mockShowQuickPick.restore();
    });

    test("uses the base prompt directory when #promptDir is not specified", async function () {
      const result = await resolvePromptDirectoryScope(fixtureBaseDir, "review", []);

      assert.deepStrictEqual(result, { ok: true, promptDir: fixtureBaseDir });
      sinon.assert.notCalled(mockShowQuickPick);
    });

    test("uses the explicit prompt subdirectory when #promptDir:path is specified", async function () {
      const result = await resolvePromptDirectoryScope(fixtureBaseDir, "review #promptDir:api-communication", []);

      assert.deepStrictEqual(result, {
        ok: true,
        promptDir: path.resolve(fixtureBaseDir, "api-communication"),
        relativePath: "api-communication",
      });
      sinon.assert.notCalled(mockShowQuickPick);
    });

    test("uses QuickPick when #promptDir is specified without a path", async function () {
      mockShowQuickPick.resolves({ label: "accessibility", relativePath: "accessibility" });

      const result = await resolvePromptDirectoryScope(fixtureBaseDir, "review #promptDir", []);

      assert.deepStrictEqual(result, {
        ok: true,
        promptDir: path.resolve(fixtureBaseDir, "accessibility"),
        relativePath: "accessibility",
      });
      sinon.assert.calledOnce(mockShowQuickPick);
    });

    test("returns an error when QuickPick is cancelled", async function () {
      mockShowQuickPick.resolves(undefined);

      const result = await resolvePromptDirectoryScope(fixtureBaseDir, "review #promptDir", []);

      assert.deepStrictEqual(result, {
        ok: false,
        errorMessage: "Prompt subdirectory selection was cancelled.",
      });
    });

    test("returns an error when no prompt subdirectories exist", async function () {
      const emptyDir = path.join(fixtureBaseDir, "empty");

      const result = await resolvePromptDirectoryScope(emptyDir, "review #promptDir", []);

      assert.deepStrictEqual(result, {
        ok: false,
        errorMessage: `No prompt subdirectories found in ${emptyDir}`,
      });
      sinon.assert.notCalled(mockShowQuickPick);
    });
  });
});
