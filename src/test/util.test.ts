import * as assert from "assert";
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { extractTargetFiles, findPromptFiles } from "../util";

suite("Util Test Suite", function () {
  let mockShowErrorMessage: sinon.SinonStub;

  setup(function () {
    mockShowErrorMessage = sinon.stub(vscode.window, "showErrorMessage");
  });

  teardown(function () {
    mockShowErrorMessage.restore();
  });

  suite("findPromptFiles Test Suite", function () {
    test("findPromptFiles should return .md files that do not match ignore patterns", function () {
      const directoryPath = path.normalize(path.join(__dirname, "..", "..", "src", "test", "__tests__", "utiltestdir"));
      const ignorePatterns = ["**/ignored_dir/**.md", "**/*.test.md"];

      const result = findPromptFiles(directoryPath, ignorePatterns);
      assert.deepStrictEqual(
        new Set(result),
        new Set(["file1.md", "file2.md", "dir/file3.md"].map((file) => path.join(directoryPath, file))),
      );
    });

    test("findPromptFiles should handle directory read error", function () {
      const directoryPath = "/not_exist";

      const result = findPromptFiles(directoryPath, []);
      assert.deepStrictEqual(result, []);
      sinon.assert.calledOnceWithMatch(mockShowErrorMessage, /Failed to read directory:/);
    });
  });

  suite("extractTargetFiles Test Suite", function () {
    test("extractTargetFiles should return file paths from request references", function () {
      const req = {
        references: [
          {
            id: "vscode.file",
            value: vscode.Uri.file("/path/to/file1"),
          },
          {
            id: "vscode.file",
            value: vscode.Uri.file("/path/to/file2"),
          },
        ],
      } as unknown as vscode.ChatRequest;

      const result = extractTargetFiles(req);
      assert.deepStrictEqual(result, ["/path/to/file2", "/path/to/file1"]);
    });

    test("extractTargetFiles should handle empty references", function () {
      const req = {
        references: [],
      } as unknown as vscode.ChatRequest;

      const result = extractTargetFiles(req);
      assert.deepStrictEqual(result, []);
    });

    test("extractTargetFiles should ignore non-file references", function () {
      const req = {
        references: [
          {
            id: "vscode.file",
            value: vscode.Uri.file("/path/to/file1"),
          },
          {
            id: "vscode.other",
            value: vscode.Uri.file("/path/to/file2"),
          },
        ],
      } as unknown as vscode.ChatRequest;

      const result = extractTargetFiles(req);
      assert.deepStrictEqual(result, ["/path/to/file1"]);
    });
  });
});
