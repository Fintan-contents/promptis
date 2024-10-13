import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { chatHandler } from "../chatHandler";
import { activate, Command, commandMap, deactivate, registerCommands } from "../extension";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  let context: vscode.ExtensionContext;
  let createChatParticipantStub: sinon.SinonStub;
  let registerCommandStub: sinon.SinonStub;

  setup(() => {
    context = {
      subscriptions: [],
      extensionUri: vscode.Uri.file("/path/to/extension"),
    } as unknown as vscode.ExtensionContext;

    createChatParticipantStub = sinon.stub(vscode.chat, "createChatParticipant").returns({
      iconPath: undefined,
    } as unknown as vscode.ChatParticipant);

    registerCommandStub = sinon.stub(vscode.commands, "registerCommand");
  });

  teardown(() => {
    createChatParticipantStub.restore();
    registerCommandStub.restore();
  });

  test("activate should register chat participant and commands", () => {
    activate(context);

    // chatHandlerが登録されることを確認
    sinon.assert.calledOnceWithExactly(createChatParticipantStub, "promptis.promptis", chatHandler);
    // アイコンが想定通り設定されることを確認
    const participant = createChatParticipantStub.returnValues[0];
    assert.strictEqual(participant.iconPath?.fsPath, "/path/to/extension/images/icon.png");

    // commandMapの数だけコマンドが登録されることを確認
    assert.strictEqual(registerCommandStub.callCount, Object.keys(commandMap).length);
    for (const [key, value] of Object.entries(commandMap)) {
      sinon.assert.calledWith(registerCommandStub, value.id);
    }
  });

  test("deactivate should not throw an error", () => {
    assert.doesNotThrow(() => deactivate());
  });

  test("registerCommands should register all commands in commandMap", function () {
    const commandMap = {
      command1: {
        id: "command1",
        execute: (context: vscode.ExtensionContext, ...args: any[]) => {},
      },
      command2: {
        id: "command2",
        execute: (context: vscode.ExtensionContext, ...args: any[]) => {},
      },
    } satisfies { [key: string]: Command };
    registerCommands(context, commandMap);
    assert.strictEqual(registerCommandStub.callCount, Object.keys(commandMap).length);

    for (const [key, value] of Object.entries(commandMap)) {
      sinon.assert.calledWith(registerCommandStub, value.id);
      const call = registerCommandStub.getCall(Object.keys(commandMap).indexOf(key));
      const commandId = call.args[0];
      const commandHandler = call.args[1];

      assert.strictEqual(commandId, value.id);
      assert.strictEqual(typeof commandHandler, "function");

      // コマンドハンドラが正しく動作することを確認するために、
      // executeメソッドをスタブに置き換え、引数が正しく渡されていることを確認
      const executeStub = sinon.stub(value, "execute");
      commandHandler("arg1", "arg2");
      sinon.assert.calledOnceWithExactly(executeStub, context, "arg1", "arg2");
      executeStub.restore();
    }
  });
});
