import fs from "fs";
import path from "path";
import * as vscode from "vscode";
import { findPromptFiles } from "./util";

export const PROMPT_DIRECTORY_VARIABLE = "#promptDir";

export type PromptDirectoryDirective =
  | { kind: "none" }
  | { kind: "pick" }
  | { kind: "path"; value: string };

export interface PromptSubdirectoryOption {
  relativePath: string;
  promptCount: number;
}

export type PromptDirectoryScopeResolution =
  | { ok: true; promptDir: string; relativePath?: string }
  | { ok: false; errorMessage: string };

interface PromptSubdirectoryQuickPickItem extends vscode.QuickPickItem {
  relativePath: string;
}

export function parsePromptDirectoryDirective(prompt: string): PromptDirectoryDirective {
  const match = prompt.match(/#promptDir(?=$|\s|:)(?::(?:"([^"]+)"|(\S+)))?/);
  if (!match) {
    return { kind: "none" };
  }

  const value = match[1] ?? match[2];
  if (!value) {
    return { kind: "pick" };
  }

  return { kind: "path", value };
}

export function listPromptSubdirectories(basePromptDir: string, ignorePatterns: string[]): PromptSubdirectoryOption[] {
  const promptFiles = findPromptFiles(basePromptDir, ignorePatterns);
  const promptCountByDirectory = new Map<string, number>();

  for (const promptFile of promptFiles) {
    const relativeDirectory = path.relative(basePromptDir, path.dirname(promptFile));
    if (!relativeDirectory || relativeDirectory === ".") {
      continue;
    }

    const displayPathParts = toDisplayPath(relativeDirectory).split("/");
    for (let index = 1; index <= displayPathParts.length; index++) {
      const displayPath = displayPathParts.slice(0, index).join("/");
      promptCountByDirectory.set(displayPath, (promptCountByDirectory.get(displayPath) ?? 0) + 1);
    }
  }

  return Array.from(promptCountByDirectory.entries())
    .map(([relativePath, promptCount]) => ({ relativePath, promptCount }))
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function resolvePromptDirectoryScope(
  basePromptDir: string,
  prompt: string,
  ignorePatterns: string[],
): Promise<PromptDirectoryScopeResolution> {
  const directive = parsePromptDirectoryDirective(prompt);

  if (directive.kind === "none") {
    return { ok: true, promptDir: basePromptDir };
  }

  if (directive.kind === "path") {
    return resolvePromptSubdirectory(basePromptDir, directive.value);
  }

  const options = listPromptSubdirectories(basePromptDir, ignorePatterns);
  if (options.length === 0) {
    return { ok: false, errorMessage: `No prompt subdirectories found in ${basePromptDir}` };
  }

  const selected = await vscode.window.showQuickPick(
    options.map<PromptSubdirectoryQuickPickItem>((option) => ({
      label: option.relativePath,
      description: `${option.promptCount} prompt file(s)`,
      relativePath: option.relativePath,
    })),
    {
      placeHolder: "Select a prompt subdirectory",
    },
  );

  if (!selected) {
    return { ok: false, errorMessage: "Prompt subdirectory selection was cancelled." };
  }

  return resolvePromptSubdirectory(basePromptDir, selected.relativePath);
}

export function resolvePromptSubdirectory(
  basePromptDir: string,
  promptSubdirectory: string,
): PromptDirectoryScopeResolution {
  if (path.isAbsolute(promptSubdirectory)) {
    return { ok: false, errorMessage: `${PROMPT_DIRECTORY_VARIABLE} must be a relative path: ${promptSubdirectory}` };
  }

  const resolvedPromptDir = path.resolve(basePromptDir, promptSubdirectory);
  if (!isPathInside(basePromptDir, resolvedPromptDir)) {
    return {
      ok: false,
      errorMessage: `${PROMPT_DIRECTORY_VARIABLE} must stay under the configured prompt directory: ${promptSubdirectory}`,
    };
  }

  if (!fs.existsSync(resolvedPromptDir)) {
    return { ok: false, errorMessage: `Prompt subdirectory not found: ${promptSubdirectory}` };
  }

  const stats = fs.statSync(resolvedPromptDir);
  if (!stats.isDirectory()) {
    return { ok: false, errorMessage: `Prompt subdirectory is not a directory: ${promptSubdirectory}` };
  }

  const realBasePromptDir = fs.realpathSync(basePromptDir);
  const realResolvedPromptDir = fs.realpathSync(resolvedPromptDir);
  if (!isPathInside(realBasePromptDir, realResolvedPromptDir)) {
    return {
      ok: false,
      errorMessage: `${PROMPT_DIRECTORY_VARIABLE} must stay under the configured prompt directory: ${promptSubdirectory}`,
    };
  }

  const relativePath = toDisplayPath(path.relative(realBasePromptDir, realResolvedPromptDir));
  return { ok: true, promptDir: resolvedPromptDir, relativePath };
}

function isPathInside(baseDir: string, targetPath: string): boolean {
  const relativePath = path.relative(baseDir, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function toDisplayPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
