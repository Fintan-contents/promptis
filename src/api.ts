import axios from "axios";
import { env } from "process";
import * as vscode from "vscode";
import { Config } from "./config";
import { Configuration, PostUsageRequest, UsageApi } from "./openapi";

const basePath = "https://m23mzhxw9a.execute-api.ap-northeast-1.amazonaws.com/prod";

const axiosInstance = axios.create(getAxiosConfig(basePath));
const config = new Configuration({});
const api = new UsageApi(config, "", axiosInstance);

function getAxiosConfig(basePath: string): axios.AxiosRequestConfig {
  // APIサーバはHTTPSで提供されるため、HTTPSプロキシを優先する
  const proxy =
    vscode.workspace.getConfiguration("https").get<string>("proxy") ||
    env.https_proxy ||
    env.HTTPS_PROXY ||
    vscode.workspace.getConfiguration("http").get<string>("proxy") ||
    env.http_proxy ||
    env.HTTP_PROXY;

  if (!proxy) {
    return {
      baseURL: basePath,
    };
  }

  const url = new URL(proxy);
  console.log("Proxy detected: ", url);
  return {
    baseURL: basePath,
    proxy: {
      host: url.hostname,
      port: parseInt(url.port, 10),
      protocol: url.protocol.replace(":", ""),
    },
  };
}

/**
 * テレメトリーが有効かどうかを確認する関数
 * @returns {boolean} テレメトリーが有効な場合はtrue、無効な場合はfalse
 */
export function isTelemetryEnabled() {
  const config = vscode.workspace.getConfiguration("telemetry");
  const telemetryLevel = config.get<string>("telemetryLevel", "off");

  // 使用状況の送信が許可されるのは、telemetryLevelが"all"の場合のみ
  // ref: https://code.visualstudio.com/api/extension-guides/telemetry#custom-telemetry-setting
  if (telemetryLevel !== "all") {
    console.log("Telemetry level is not 'all': ", telemetryLevel);
    return false;
  }
  // Promptis の設定を確認
  if (!Config.getTelemetryEnabled()) {
    console.log("Promptis telemetry is disabled");
    return false;
  }

  return true;
}

/**
 * 使用状況をポストする非同期関数
 * @param {string} command 実行されたコマンド
 * @returns {Promise<void>} 非同期処理の完了を示すPromise
 */
export async function postUsage(command: string) {
  // ユーザによってテレメトリーが無効化している場合は何もしない
  if (!isTelemetryEnabled()) {
    return;
  }

  const request: PostUsageRequest = {
    apiKind: "command",
    command: command,
    language: vscode.env.language,
    vscodeVersion: vscode.version,
    os: process.platform,
    extensionId: vscode.extensions.getExtension("tis.promptis")?.id || "",
    extensionVersion: vscode.extensions.getExtension("tis.promptis")?.packageJSON.version || "",
    // MachineIdの生成: https://github.com/microsoft/vscode/blob/a016ec9b66ffdd3ff0f831768b8e75be008a54e4/src/vs/base/node/id.ts#L81
    machineId: vscode.env.machineId,
  };

  try {
    console.log(JSON.stringify(request));
    const response = await api.postUsage({ postUsageRequest: request });
  } catch (error) {
    console.error("Error posting usage", error);
  }
}
