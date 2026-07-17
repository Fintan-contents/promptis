import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { Config } from "../config";

suite("Config Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  let mockGetConfiguration: sinon.SinonStub;
  setup(function () {
    // 各テストケースの前に実行されるセットアップ
    mockGetConfiguration = sinon.stub(vscode.workspace, "getConfiguration").returns({
      get: sinon.stub().callsFake((_section: string, defaultValue: unknown) => defaultValue),
      has: sinon.stub().returns(true),
      inspect: sinon.stub().returns(undefined),
      update: sinon.stub().returns(Promise.resolve()),
    });
  });

  teardown(function () {
    // 各テストケースの後に実行されるクリーンアップ
    mockGetConfiguration.restore();
  });

  suite("Config Tests", function () {
    test("should return the code review standard path using Config class", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("codeReview.codeStandardPath").returns("code/review/standard/path");
      const result = Config.getCodeReviewStandardPath();
      assert.strictEqual(result, "code/review/standard/path");
    });

    test("should return the code review functional path using Config class", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("codeReview.functionalPath").returns("code/review/functional/path");
      const result = Config.getCodeReviewFunctionalPath();
      assert.strictEqual(result, "code/review/functional/path");
    });

    test("should return the code review non-functional path using Config class", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("codeReview.nonFunctionalPath").returns("code/review/non-functional/path");
      const result = Config.getCodeReviewNonFunctionalPath();
      assert.strictEqual(result, "code/review/non-functional/path");
    });

    test("should return the Git diff review path using Config class", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("codeReview.diffPath").returns("code/review/diff/path");
      const result = Config.getCodeReviewDiffPath();
      assert.strictEqual(result, "code/review/diff/path");
    });

    test("should use code review standard path if Git diff review path is not configured", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("codeReview.diffPath").returns(undefined);
      getStub.withArgs("codeReview.codeStandardPath").returns("code/review/standard/path");
      const result = Config.getCodeReviewDiffPath();
      assert.strictEqual(result, "code/review/standard/path");
    });

    test("should return the reverse engineering prompt path using Config class", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("reverseEngineering.promptsPath").returns("reverse/engineering/prompts/path");
      const result = Config.getReverseEngineeringPromptPath();
      assert.strictEqual(result, "reverse/engineering/prompts/path");
    });

    test("should return the draw diagrams prompt path using Config class", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("drawDiagrams.promptsPath").returns("draw/diagrams/prompts/path");
      const result = Config.getDrawDiagramsPromptPath();
      assert.strictEqual(result, "draw/diagrams/prompts/path");
    });

    test("should return the prompt exclude file patterns using Config class", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("prompt.excludeFilePatterns").returns(["pattern1", "pattern2"]);
      const result = Config.getPromptExcludeFilePatterns();
      assert.deepStrictEqual(result, ["pattern1", "pattern2"]);
    });

    test("should return an empty array if no prompt exclude file patterns are found using Config class", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("prompt.excludeFilePatterns").returns(undefined);
      const result = Config.getPromptExcludeFilePatterns();
      assert.deepStrictEqual(result, []);
    });

    test("should return the chat output directory path using Config class", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("chat.outputPath").returns("chat/output/dir/path");
      const result = Config.getChatOutputDirPath();
      assert.strictEqual(result, "chat/output/dir/path");
    });

    test("should return true if telemetry is enabled using Config class", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("telemetry.enable").returns(true);
      const result = Config.getTelemetryEnabled();
      assert.strictEqual(result, true);
    });

    test("should return false if telemetry is disabled using Config class", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("telemetry.enable").returns(false);
      const result = Config.getTelemetryEnabled();
      assert.strictEqual(result, false);
    });

    test("デフォルトの出力モードとして'chat-only'を返すべき", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("promptis.output.mode", "chat-only").returns("chat-only");
      const result = Config.getOutputMode();
      assert.strictEqual(result, "chat-only");
    });

    test("設定で'file-only'が指定された場合、'file-only'を返すべき", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("promptis.output.mode", "chat-only").returns("file-only");
      const result = Config.getOutputMode();
      assert.strictEqual(result, "file-only");
    });

    test("設定値が未設定の場合、デフォルトの'chat-only'を返すべき", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("promptis.output.mode", "chat-only").returns("chat-only");
      const result = Config.getOutputMode();
      assert.strictEqual(result, "chat-only");
    });

    test("should return the default Git diff range", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("promptis.git.defaultDiffRange", "origin/main...HEAD").returns("origin/main...HEAD");
      const result = Config.getGitDiffDefaultRange();
      assert.strictEqual(result, "origin/main...HEAD");
    });

    test("should return configured Git diff range", function () {
      const getStub = mockGetConfiguration().get as sinon.SinonStub;
      getStub.withArgs("promptis.git.defaultDiffRange", "origin/main...HEAD").returns("origin/develop...HEAD");
      const result = Config.getGitDiffDefaultRange();
      assert.strictEqual(result, "origin/develop...HEAD");
    });
  });
});
