import * as assert from "assert";
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { extractFilesInDirectory, extractTargetFiles, findPromptFiles, timestampAsString } from "../util";

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
    test("extractTargetFiles should return file paths from request references", async function () {
      const req = {
        prompt: "hoge",
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
      const stream = { markdown: sinon.stub(), progress: sinon.stub() } as unknown as vscode.ChatResponseStream;

      const result = await extractTargetFiles(req, stream);
      assert.deepStrictEqual(result, ["/path/to/file2", "/path/to/file1"]);
    });

    test("extractTargetFiles should handle empty references", async function () {
      const req = {
        prompt: "hoge",
        references: [],
      } as unknown as vscode.ChatRequest;
      const stream = { markdown: sinon.stub(), progress: sinon.stub() } as unknown as vscode.ChatResponseStream;

      const result = await extractTargetFiles(req, stream);
      assert.deepStrictEqual(result, []);
    });

    test("extractTargetFiles should ignore non-file references", async function () {
      const req = {
        prompt: "hoge",
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
      const stream = { markdown: sinon.stub(), progress: sinon.stub() } as unknown as vscode.ChatResponseStream;

      const result = await extractTargetFiles(req, stream);
      assert.deepStrictEqual(result, ["/path/to/file1"]);
    });
  });

  suite("timestampAsString Test Suite", function () {
    const tests = [
      { date: new Date("2024-01-02T03:04:05"), expected: "20240102-030405" },
      { date: new Date("2024-01-02T23:04:05"), expected: "20240102-230405" }, // 24時間表記になることを確認
    ];

    tests.forEach(({ date, expected }) => {
      test(`timestampAsString should return ${expected} from ${date}`, function () {
        const result = timestampAsString(date);
        assert.strictEqual(result, expected);
      });
    });
  });

  suite("extractFilesInDirectory Test Suite", function () {
    let mockShowOpenDialog: sinon.SinonStub;
    let mockFindFiles: sinon.SinonStub;
    let mockMarkdown: sinon.SinonStub;

    setup(function () {
      mockShowOpenDialog = sinon.stub(vscode.window, "showOpenDialog");
      mockFindFiles = sinon.stub(vscode.workspace, "findFiles");
      mockMarkdown = sinon.stub();
    });

    teardown(function () {
      mockShowOpenDialog.restore();
      mockFindFiles.restore();
    });

    test("ディレクトリ選択がキャンセルされた場合、空の配列を返すべき", async function () {
      mockShowOpenDialog.resolves(undefined);
      const stream = { markdown: mockMarkdown } as unknown as vscode.ChatResponseStream;

      const result = await extractFilesInDirectory("**/*.md", stream);
      assert.deepStrictEqual(result, []);
      sinon.assert.notCalled(mockMarkdown);
    });

    test("ディレクトリが選択されたが、フィルタパターンに一致するファイルがない場合、空の配列を返すべき", async function () {
      mockShowOpenDialog.resolves([vscode.Uri.file("/path/to/directory")]);
      mockFindFiles.resolves([]);
      const stream = { markdown: mockMarkdown } as unknown as vscode.ChatResponseStream;

      const result = await extractFilesInDirectory("**/*.md", stream);
      assert.deepStrictEqual(result, []);
      sinon.assert.calledOnce(mockMarkdown);
      sinon.assert.calledWith(mockMarkdown, sinon.match.string);
    });

    test("ディレクトリが選択され、フィルタパターンに一致するファイルがある場合、ファイルパスを返すべき", async function () {
      mockShowOpenDialog.resolves([vscode.Uri.file("/path/to/directory")]);
      mockFindFiles.resolves([
        vscode.Uri.file("/path/to/directory/file1.md"),
        vscode.Uri.file("/path/to/directory/file2.md"),
      ]);
      const stream = { markdown: mockMarkdown } as unknown as vscode.ChatResponseStream;

      const result = await extractFilesInDirectory("**/*.md", stream);
      assert.deepStrictEqual(result, ["/path/to/directory/file1.md", "/path/to/directory/file2.md"]);
      sinon.assert.calledThrice(mockMarkdown);
      sinon.assert.calledWith(mockMarkdown, sinon.match.string);
    });
  });
});
