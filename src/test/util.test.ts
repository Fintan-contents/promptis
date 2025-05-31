import * as assert from "assert";
import * as path from "path";
import proxyquire from "proxyquire";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { extractFilesInDirectory, findPromptFiles, timestampAsString } from "../util";

/*
 * fs.existsSync のスタブ
 *
 * fs.existsSync は非書き換え可能であり、直接スタブを作成することができないため、
 * proxyquire を利用して fs.existsSync のスタブを作成する。
 */
const fsStub = {
  existsSync: sinon.stub(),
  statSync: sinon.stub(),
};
const { getUserSpecifiedDirectory, extractTargetFiles } = proxyquire("../util", { fs: fsStub });

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
    let mockShowOpenDialog: sinon.SinonStub;
    let mockFindFiles: sinon.SinonStub;

    setup(function () {
      mockShowOpenDialog = sinon.stub(vscode.window, "showOpenDialog");
      mockFindFiles = sinon.stub(vscode.workspace, "findFiles");
      fsStub.existsSync.reset();
    });

    teardown(function () {
      mockShowOpenDialog.restore();
      mockFindFiles.restore();
    });

    test("extractTargetFiles がリクエストの参照からファイルパスを返すべき", async function () {
      const req = {
        prompt: "hoge",
        references: [
          {
            id: "vscode.hoge",
            value: vscode.Uri.file("/path/to/file1"),
          },
          {
            id: "vscode.fuga",
            value: vscode.Uri.file("/path/to/file2"),
          },
          {
            id: "vscode.piyo",
            value: vscode.Uri.file("/path/to/dir"),
          },
        ],
      } as unknown as vscode.ChatRequest;

      fsStub.statSync.withArgs("/path/to/file1").returns({ isDirectory: () => false });
      fsStub.statSync.withArgs("/path/to/file2").returns({ isDirectory: () => false });
      fsStub.statSync.withArgs("/path/to/dir").returns({ isDirectory: () => true });
      mockFindFiles.resolves([vscode.Uri.file("/path/to/dir/file1.md"), vscode.Uri.file("/path/to/dir/file2.md")]);

      const stream = { markdown: sinon.stub(), progress: sinon.stub() } as unknown as vscode.ChatResponseStream;

      const result = await extractTargetFiles(req, stream);
      assert.deepStrictEqual(result, [
        "/path/to/file1",
        "/path/to/file2",
        "/path/to/dir/file1.md",
        "/path/to/dir/file2.md",
      ]);
    });

    test("extractTargetFilesが参照なしのケースを処理できるべき", async function () {
      const req = {
        prompt: "hoge #filter:*.md",
        references: [],
      } as unknown as vscode.ChatRequest;
      const stream = { markdown: sinon.stub(), progress: sinon.stub() } as unknown as vscode.ChatResponseStream;

      const result = await extractTargetFiles(req, stream);
      assert.deepStrictEqual(result, []);
    });

    test("extractTargetFilesがファイル以外のreferenceを無視すべき", async function () {
      const req = {
        prompt: "hoge",
        references: [
          {
            id: "vscode.hoge",
            value: vscode.Uri.file("/path/to/file1"),
          },
          {
            id: "vscode.fuga",
            value: vscode.Uri.file("/path/to/file2"),
          },
          {
            id: "vscode.piyo",
            value: "this is string type",
          },
        ],
      } as unknown as vscode.ChatRequest;

      fsStub.statSync.withArgs("/path/to/file1").returns({ isDirectory: () => false });
      fsStub.statSync.withArgs("/path/to/file2").returns({ isDirectory: () => false });
      const stream = { markdown: sinon.stub(), progress: sinon.stub() } as unknown as vscode.ChatResponseStream;

      const result = await extractTargetFiles(req, stream);
      assert.deepStrictEqual(result, ["/path/to/file1", "/path/to/file2"]);
    });

    test("extractTargetFilesが、プロンプトで#dirを指定されたときは指定ディレクトリ配下のファイルも返却すべき", async function () {
      mockShowOpenDialog.resolves([vscode.Uri.file("/path/to/directory")]);
      mockFindFiles.resolves([
        vscode.Uri.file("/path/to/directory/file1.md"),
        vscode.Uri.file("/path/to/directory/file2.md"),
      ]);

      const req = {
        prompt: "hoge #dir:/path/to/dir",
        references: [],
      } as unknown as vscode.ChatRequest;

      const stream = { markdown: sinon.stub(), progress: sinon.stub() } as unknown as vscode.ChatResponseStream;

      const result = await extractTargetFiles(req, stream);
      assert.deepStrictEqual(result, ["/path/to/directory/file1.md", "/path/to/directory/file2.md"]);
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

    const req = {
      prompt: "hoge",
    } as unknown as vscode.ChatRequest;

    test("ディレクトリ選択がキャンセルされた場合、空の配列を返すべき", async function () {
      mockShowOpenDialog.resolves(undefined);
      const stream = { markdown: mockMarkdown } as unknown as vscode.ChatResponseStream;

      const result = await extractFilesInDirectory(req, "**/*.md", stream);
      assert.deepStrictEqual(result, []);
      sinon.assert.notCalled(mockMarkdown);
    });

    test("ディレクトリが選択されたが、フィルタパターンに一致するファイルがない場合、空の配列を返すべき", async function () {
      mockShowOpenDialog.resolves([vscode.Uri.file("/path/to/directory")]);
      mockFindFiles.resolves([]);
      const stream = { markdown: mockMarkdown } as unknown as vscode.ChatResponseStream;

      const result = await extractFilesInDirectory(req, "**/*.md", stream);
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

      const result = await extractFilesInDirectory(req, "**/*.md", stream);
      assert.deepStrictEqual(result, ["/path/to/directory/file1.md", "/path/to/directory/file2.md"]);
      sinon.assert.calledThrice(mockMarkdown);
      sinon.assert.calledWith(mockMarkdown, sinon.match.string);
    });
  });

  suite("getUserSpecifiedDirectory テスト", () => {
    let mockWorkspaceFolders: sinon.SinonStub;
    setup(() => {
      fsStub.existsSync.reset();
      mockWorkspaceFolders = sinon.stub(vscode.workspace, "workspaceFolders");
    });

    teardown(() => {
      mockWorkspaceFolders.restore();
    });

    test("指定された絶対パスが存在する場合、ディレクトリパスを返すこと", () => {
      const req = { prompt: "#dir:/absolute/path/to/dir" } as vscode.ChatRequest;
      const dirPath = "/absolute/path/to/dir";
      fsStub.existsSync.withArgs(dirPath).returns(true);

      const result = getUserSpecifiedDirectory(req) as vscode.Uri;
      assert.strictEqual(result.path, dirPath);
    });

    test("指定された相対パスが存在する場合、ディレクトリパスを返すこと", () => {
      const req = { prompt: "#dir:relative/path/to/dir" } as vscode.ChatRequest;

      const workspaceRoot = "/workspace/root";
      mockWorkspaceFolders.value([{ uri: vscode.Uri.file(workspaceRoot) }]);

      const dirPath = path.join(workspaceRoot, "relative/path/to/dir");
      fsStub.existsSync.withArgs(dirPath).returns(true);

      const result = getUserSpecifiedDirectory(req) as vscode.Uri;
      assert.strictEqual(result.path, dirPath);
    });

    test("指定されたパスがダブルクォートで括られていても、ディレクトリとして扱えること", () => {
      const req = { prompt: '#dir:"relative/ path / to / dir"' } as vscode.ChatRequest;

      const workspaceRoot = "/workspace/root";
      mockWorkspaceFolders.value([{ uri: vscode.Uri.file(workspaceRoot) }]);

      const dirPath = path.join(workspaceRoot, "relative/ path / to / dir");
      fsStub.existsSync.withArgs(dirPath).returns(true);

      const result = getUserSpecifiedDirectory(req) as vscode.Uri;
      assert.strictEqual(result.path, dirPath);
    });

    test("指定されたディレクトリが存在しない場合、undefinedを返すこと", () => {
      const req = { prompt: "#dir:/non/existent/dir" } as vscode.ChatRequest;
      fsStub.existsSync.withArgs("/non/existent/dir").returns(false);

      const result = getUserSpecifiedDirectory(req);
      assert.strictEqual(result, undefined);
    });

    test("ワークスペースが開かれていない場合、undefinedを返すこと", () => {
      const req = { prompt: "#dir:relative/path/to/dir" } as vscode.ChatRequest;
      mockWorkspaceFolders.value(undefined);

      const result = getUserSpecifiedDirectory(req);
      assert.strictEqual(result, undefined);
    });

    test("プロンプトにディレクトリが指定されていない場合、undefinedを返すこと", () => {
      const req = { prompt: "no directory specified" } as vscode.ChatRequest;

      const result = getUserSpecifiedDirectory(req);
      assert.strictEqual(result, undefined);
    });
  });
});
