import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { isTelemetryEnabled } from "../api";
import { Config } from "../config";

suite("API Test Suite", () => {
  suite("isTelemetryEnabled", () => {
    let getConfigurationStub: sinon.SinonStub;
    let getTelemetryEnabledStub: sinon.SinonStub;

    setup(() => {
      getConfigurationStub = sinon.stub(vscode.workspace, "getConfiguration");
      getTelemetryEnabledStub = sinon.stub(Config, "getTelemetryEnabled");
    });

    teardown(() => {
      getConfigurationStub.restore();
      getTelemetryEnabledStub.restore();
    });

    test("should return true when telemetry is enabled and Config telemetry is enabled", () => {
      getConfigurationStub.withArgs("telemetry").returns({
        get: sinon.stub().withArgs("telemetryLevel", "off").returns("all"),
      });
      getTelemetryEnabledStub.returns(true);

      const result = isTelemetryEnabled();
      assert.strictEqual(result, true);
    });

    test("should return false when telemetry level is not 'all'", () => {
      getConfigurationStub.withArgs("telemetry").returns({
        get: sinon.stub().withArgs("telemetryLevel", "off").returns("error"),
      });
      getTelemetryEnabledStub.returns(true);

      const result = isTelemetryEnabled();
      assert.strictEqual(result, false);
    });

    test("should return false when Config telemetry is disabled", () => {
      getConfigurationStub.withArgs("telemetry").returns({
        get: sinon.stub().withArgs("telemetryLevel", "off").returns("all"),
      });
      getTelemetryEnabledStub.returns(false);

      const result = isTelemetryEnabled();
      assert.strictEqual(result, false);
    });

    test("should return false when telemetry configuration is not found", () => {
      getConfigurationStub.withArgs("telemetry").returns({
        get: sinon.stub().withArgs("telemetryLevel", "off").returns(undefined),
      });
      getTelemetryEnabledStub.returns(true);

      const result = isTelemetryEnabled();
      assert.strictEqual(result, false);
    });
  });
});
