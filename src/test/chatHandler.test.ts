import * as assert from "assert";
import path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";
import * as chatHandlerModule from "../chatHandler";

/**
 * Chatリクエストを作成する関数。
 *
 * @returns {object} context, stream, tokenを含むオブジェクト。
 * @returns {vscode.ChatContext} context - チャットのコンテキスト。
 * @returns {vscode.ChatResponseStream} stream - チャットのレスポンスストリーム。
 * @returns {vscode.CancellationToken} token - キャンセルトークン。
 */
function createPartOfChatRequest() {
  const context = {} as vscode.ChatContext;
  const stream = { markdown: sinon.stub(), progress: sinon.stub() } as unknown as vscode.ChatResponseStream;
  const token = {} as vscode.CancellationToken;
  return { context, stream, token };
}

suite("chatHandler Test Suite", function () {
  vscode.window.showInformationMessage("Start all tests.");

  let mockGetConfiguration: sinon.SinonStub;
  let mockActiveTextEditor: sinon.SinonStub;

  const mockGetConfigurationReturns = {
    get: sinon.stub().callsFake((section: string) => {
      switch (section) {
        case "prompt.excludeFilePatterns":
          return ["hoge", "fuga"];
        case "chat.outputPath":
          // チャット内容のバックアップ出力先
          return path.normalize(`${__dirname}/../../out/`);
        default:
          // プロンプト格納ディレクトリ
          return path.normalize(`${__dirname}/../../src/test/__tests__/`);
      }
    }),
    has: sinon.stub().returns(true),
    inspect: sinon.stub().returns(undefined),
    update: sinon.stub().returns(Promise.resolve()),
  };

  setup(function () {
    // VSCodeの設定を返却するメソッドをスタブ化
    mockGetConfiguration = sinon.stub(vscode.workspace, "getConfiguration").returns(mockGetConfigurationReturns);

    // VSCodeのテキストエディタも、テストコードから状態を定義するのが面倒なのでスタブ化
    mockActiveTextEditor = sinon.stub(vscode.window, "activeTextEditor").value({
      // エディタ上で選択がなされていない状態とする
      selection: { isEmpty: false },
      // エディタで開いているファイルとテキストの内容
      document: {
        uri: { fsPath: "filePath" },
        getText: sinon.stub().returns("selected content"),
      },
    });
  });

  teardown(function () {
    mockGetConfiguration.restore();
    mockActiveTextEditor.restore();
  });

  suite("chatHandler Tests", function () {
    test("chatHandler should handle chat request", async function () {
      const request: vscode.ChatRequest = {
        command: "codereviewCodeStandards",
        prompt: "hoge",
        references: [],
        toolReferences: [],
        toolInvocationToken: {} as never,
        model: {
          sendRequest: sinon.stub().resolves({ text: [""] }),
        } as unknown as vscode.LanguageModelChat,
      };
      const { context, stream, token } = createPartOfChatRequest();

      const result = await chatHandlerModule.chatHandler(request, context, stream, token);
      assert.strictEqual(result, undefined);
    });

    test("chatHandler should return error if no command is specified", async function () {
      const request: vscode.ChatRequest = {
        command: "", // コマンドを指定しない
        prompt: "hoge",
        references: [],
        toolReferences: [],
        toolInvocationToken: {} as never,
        model: {
          sendRequest: sinon.stub().resolves({ text: [""] }),
        } as unknown as vscode.LanguageModelChat,
      };
      const { context, stream, token } = createPartOfChatRequest();

      const result = await chatHandlerModule.chatHandler(request, context, stream, token);
      assert.deepStrictEqual(result, { errorDetails: { message: "No command specified" } });
    });

    test("chatHandler should return error if no prompt path is found for command", async function () {
      const request: vscode.ChatRequest = {
        command: "unknownCommand", // 未定義コマンド
        prompt: "hoge",
        references: [],
        toolReferences: [],
        toolInvocationToken: {} as never,
        model: {
          sendRequest: sinon.stub().resolves({ text: [""] }),
        } as unknown as vscode.LanguageModelChat,
      };
      const { context, stream, token } = createPartOfChatRequest();

      const result = await chatHandlerModule.chatHandler(request, context, stream, token);
      assert.deepStrictEqual(result, { errorDetails: { message: "No prompt path found for command: unknownCommand" } });
    });

    test("chatHandler should return error if no prompt files are found", async function () {
      const request: vscode.ChatRequest = {
        command: "codereviewCodeStandards",
        prompt: "hoge",
        references: [],
        toolReferences: [],
        toolInvocationToken: {} as never,
        model: {
          sendRequest: sinon.stub().resolves({ text: [""] }),
        } as unknown as vscode.LanguageModelChat,
      };
      const { context, stream, token } = createPartOfChatRequest();

      // プロンプト格納ディレクトリを返却するスタブを、空のディレクトリを指定するように上書き
      const emptyPromptDir = path.normalize(`${__dirname}/../../src/test/__tests__/emptydir`);
      const backupMock = mockGetConfiguration;
      mockGetConfiguration.restore();
      try {
        mockGetConfiguration = sinon.stub(vscode.workspace, "getConfiguration").returns({
          ...mockGetConfigurationReturns,
          // プロンプト格納ディレクトリを返却するスタブを上書きし、空のディレクトリを指定する
          get: sinon.stub().callsFake((section: string) => emptyPromptDir),
        });

        const result = await chatHandlerModule.chatHandler(request, context, stream, token);
        assert.deepStrictEqual(result, { errorDetails: { message: `No prompt files found in ${emptyPromptDir}` } });
      } finally {
        mockGetConfiguration = backupMock;
      }
    });

    test("chatHandler should process source files if target files are specified", async function () {
      const request: vscode.ChatRequest = {
        command: "codereviewCodeStandards",
        prompt: "hoge",
        // プロンプトで #file 指定をされているケースを作成
        references: [{ id: "vscode.file", range: [12, 25], value: { $mid: 1, path: __filename, scheme: "file" } }],
        toolReferences: [],
        toolInvocationToken: {} as never,
        model: {
          sendRequest: sinon.stub().resolves({ text: [""] }),
        } as unknown as vscode.LanguageModelChat,
      };
      const { context, stream, token } = createPartOfChatRequest();

      const result = await chatHandlerModule.chatHandler(request, context, stream, token);
      assert.strictEqual(result, undefined);
    });
  });
});

suite("processSelectedContent Test Suite", function () {
  test("processSelectedContent should return error if no active editor", async function () {
    let mockActiveTextEditor = sinon.stub(vscode.window, "activeTextEditor").value(undefined);

    const promptFiles = ["prompt1", "prompt2"];
    const model = {
      sendRequest: sinon.stub().resolves({ text: ["response"] }),
    } as unknown as vscode.LanguageModelChat;
    const { token, stream } = createPartOfChatRequest();

    const result = await chatHandlerModule.processSelectedContent(promptFiles, model, token, stream);
    assert.deepStrictEqual(result, { errorDetails: { message: "No active editor" } });

    mockActiveTextEditor.restore();
  });

  test("processSelectedContent should return error if no selection found", async function () {
    const mockActiveTextEditor = sinon.stub(vscode.window, "activeTextEditor").value({
      selection: { isEmpty: true },
      document: {
        uri: { fsPath: "filePath" },
        getText: sinon.stub().returns(""),
      },
    });

    const promptFiles = ["prompt1", "prompt2"];
    const model = {
      sendRequest: sinon.stub().resolves({ text: ["response"] }),
    } as unknown as vscode.LanguageModelChat;
    const { token, stream } = createPartOfChatRequest();

    const result = await chatHandlerModule.processSelectedContent(promptFiles, model, token, stream);
    assert.deepStrictEqual(result, { errorDetails: { message: "No selection found" } });

    mockActiveTextEditor.restore();
  });

  test("processSelectedContent should return error if no content found", async function () {
    const mockActiveTextEditor = sinon.stub(vscode.window, "activeTextEditor").value({
      selection: { isEmpty: false },
      document: {
        uri: { fsPath: "filePath" },
        getText: sinon.stub().returns(""),
      },
    });

    const promptFiles = ["prompt1", "prompt2"];
    const model = {
      sendRequest: sinon.stub().resolves({ text: ["response"] }),
    } as unknown as vscode.LanguageModelChat;
    const { token, stream } = createPartOfChatRequest();

    const result = await chatHandlerModule.processSelectedContent(promptFiles, model, token, stream);
    assert.deepStrictEqual(result, { errorDetails: { message: "No content found" } });

    mockActiveTextEditor.restore();
  });

  test("processSelectedContent should process selected content", async function () {
    const mockActiveTextEditor = sinon.stub(vscode.window, "activeTextEditor").value({
      selection: { isEmpty: false },
      document: {
        uri: { fsPath: "filePath" },
        getText: sinon.stub().returns("selected content"),
      },
    });

    const promptFiles = [path.normalize(`${__dirname}/../../prompts/codestandards/01_readability.md`)];
    const model = {
      sendRequest: sinon.stub().resolves({ text: ["response"] }),
    } as unknown as vscode.LanguageModelChat;
    const { token, stream } = createPartOfChatRequest();

    await chatHandlerModule.processSelectedContent(promptFiles, model, token, stream);
  });
});

suite("processContent Test Suite", function () {
  test("processContent should handle blocked request error", async function () {
    const content = "test content";
    const contentFilePath = "test/path";
    const promptFiles = [path.normalize(`${__dirname}/../../prompts/codestandards/01_readability.md`)];
    const model = {
      sendRequest: sinon.stub().rejects(vscode.LanguageModelError.Blocked("Blocked")),
    } as unknown as vscode.LanguageModelChat;
    const { token, stream } = createPartOfChatRequest();

    await chatHandlerModule.processContent(content, contentFilePath, promptFiles, model, token, stream);

    sinon.assert.calledWithMatch(stream.markdown as sinon.SinonSpy, /Blocked/);
  });

  test("processContent should handle no permissions error", async function () {
    const content = "test content";
    const contentFilePath = "test/path";
    const promptFiles = [path.normalize(`${__dirname}/../../prompts/codestandards/01_readability.md`)];
    const model = {
      sendRequest: sinon.stub().rejects(vscode.LanguageModelError.NoPermissions("No permissions")),
    } as unknown as vscode.LanguageModelChat;
    const { token, stream } = createPartOfChatRequest();

    await chatHandlerModule.processContent(content, contentFilePath, promptFiles, model, token, stream);

    sinon.assert.calledWithMatch(stream.markdown as sinon.SinonSpy, /No permissions/);
  });

  test("processContent should handle not found error", async function () {
    const content = "test content";
    const contentFilePath = "test/path";
    const promptFiles = [path.normalize(`${__dirname}/../../prompts/codestandards/01_readability.md`)];
    const model = {
      sendRequest: sinon.stub().rejects(vscode.LanguageModelError.NotFound("Not found")),
    } as unknown as vscode.LanguageModelChat;
    const { token, stream } = createPartOfChatRequest();

    await chatHandlerModule.processContent(content, contentFilePath, promptFiles, model, token, stream);

    sinon.assert.calledWithMatch(stream.markdown as sinon.SinonSpy, /Not found/);
  });

  test("processContent should handle generic error", async function () {
    const content = "test content";
    const contentFilePath = "test/path";
    const promptFiles = [path.normalize(`${__dirname}/../../prompts/codestandards/01_readability.md`)];
    const model = {
      sendRequest: sinon.stub().rejects(new Error("Generic error")),
    } as unknown as vscode.LanguageModelChat;
    const { token, stream } = createPartOfChatRequest();

    await chatHandlerModule.processContent(content, contentFilePath, promptFiles, model, token, stream);

    sinon.assert.calledWithMatch(stream.markdown as sinon.SinonSpy, /Generic error/);
  });

  test("processContent should process content and write to stream", async function () {
    const content = "test content";
    const contentFilePath = "test/path";
    const promptFiles = [path.normalize(`${__dirname}/../../prompts/codestandards/01_readability.md`)];
    const model = {
      sendRequest: sinon.stub().resolves({ text: ["response"] }),
    } as unknown as vscode.LanguageModelChat;
    const { token, stream } = createPartOfChatRequest();

    await chatHandlerModule.processContent(content, contentFilePath, promptFiles, model, token, stream);

    sinon.assert.calledWithMatch(stream.markdown as sinon.SinonSpy, "response");
  });
});
