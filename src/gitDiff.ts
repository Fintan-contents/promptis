import path from "path";
import * as vscode from "vscode";

export const DEFAULT_GIT_DIFF_RANGE = "origin/main...HEAD";

export type GitDiffChangeType = "added" | "modified" | "deleted" | "renamed";

export interface GitDiffFile {
  filePath: string;
  relativePath: string;
  diff: string;
  changeType: GitDiffChangeType;
  oldPath?: string;
}

export interface GitRepository {
  rootUri: vscode.Uri;
  diffWith(ref: string, path?: string): Promise<string>;
}

interface GitApi {
  repositories: GitRepository[];
  getRepository(uri: vscode.Uri): GitRepository | null;
}

interface GitExtension {
  getAPI(version: number): GitApi;
}

export function extractDiffRange(prompt: string, defaultRange: string = DEFAULT_GIT_DIFF_RANGE): string {
  const match = prompt.match(/#range:(?:"([^"]+)"|(\S+))/);
  const range = match?.[1] ?? match?.[2];

  if (!range || range.trim().length === 0) {
    return defaultRange;
  }

  return range.trim();
}

export async function getGitRepository(): Promise<GitRepository | undefined> {
  const extension = vscode.extensions.getExtension<GitExtension>("vscode.git");
  if (!extension) {
    return undefined;
  }

  const gitExtension = extension.isActive ? extension.exports : await extension.activate();
  const api = gitExtension.getAPI(1);

  const workspaceFolderUri = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (workspaceFolderUri) {
    const workspaceRepository = api.getRepository(workspaceFolderUri);
    if (workspaceRepository) {
      return workspaceRepository;
    }
  }

  return api.repositories[0];
}

export async function getDiffFiles(repo: GitRepository, range: string): Promise<GitDiffFile[]> {
  const diffOutput = await repo.diffWith(range);
  return parseUnifiedDiff(diffOutput, repo.rootUri.fsPath);
}

export function parseUnifiedDiff(diffOutput: string, repoRootPath: string): GitDiffFile[] {
  if (diffOutput.trim().length === 0) {
    return [];
  }

  return diffOutput
    .split(/^diff --git /m)
    .slice(1)
    .map((chunk) => parseFileDiff(`diff --git ${chunk}`, repoRootPath))
    .filter((result): result is GitDiffFile => result !== undefined);
}

export function hasReviewableHunks(diffFile: GitDiffFile): boolean {
  return diffFile.diff.split(/\r?\n/).some((line) => line.startsWith("@@ "));
}

export function formatDiffForReview(diffFile: GitDiffFile, range: string): string {
  const lines = [
    "Review only the new side of this Git unified diff.",
    "Focus on added or modified lines. Use deleted and context lines only to understand the change.",
    `Diff range: ${range}`,
    `File: ${diffFile.relativePath}`,
    `Change type: ${diffFile.changeType}`,
  ];

  if (diffFile.oldPath) {
    lines.push(`Old file: ${diffFile.oldPath}`);
  }

  lines.push("", "```diff", diffFile.diff.trimEnd(), "```");
  return lines.join("\n");
}

function parseFileDiff(fileDiff: string, repoRootPath: string): GitDiffFile | undefined {
  const lines = fileDiff.split(/\r?\n/);
  const headerPaths = parseHeaderPaths(lines[0]);
  const oldMarkerPath = parseMarkerPath(lines.find((line) => line.startsWith("--- ")));
  const newMarkerPath = parseMarkerPath(lines.find((line) => line.startsWith("+++ ")));
  const renameFrom = parseRenamePath(lines.find((line) => line.startsWith("rename from ")), "rename from ");
  const renameTo = parseRenamePath(lines.find((line) => line.startsWith("rename to ")), "rename to ");

  const oldPath = oldMarkerPath ?? renameFrom ?? headerPaths?.oldPath;
  const newPath = newMarkerPath ?? renameTo ?? headerPaths?.newPath;
  const relativePath = newPath ?? oldPath;

  if (!relativePath) {
    return undefined;
  }

  const changeType = detectChangeType(fileDiff, oldPath, newPath, renameFrom, renameTo);
  const oldFilePath = oldPath && oldPath !== relativePath ? oldPath : undefined;

  return {
    filePath: path.join(repoRootPath, relativePath),
    relativePath,
    diff: fileDiff,
    changeType,
    oldPath: oldFilePath,
  };
}

function parseHeaderPaths(header: string): { oldPath: string; newPath: string } | undefined {
  const match = header.match(/^diff --git a\/(.+) b\/(.+)$/);
  if (!match) {
    return undefined;
  }

  return {
    oldPath: match[1],
    newPath: match[2],
  };
}

function parseMarkerPath(line: string | undefined): string | undefined {
  if (!line) {
    return undefined;
  }

  const markerPath = line.slice(4).trim();
  if (markerPath === "/dev/null") {
    return undefined;
  }

  return removeDiffPrefix(markerPath);
}

function parseRenamePath(line: string | undefined, prefix: string): string | undefined {
  if (!line) {
    return undefined;
  }

  return line.slice(prefix.length).trim();
}

function removeDiffPrefix(diffPath: string): string {
  if (diffPath.startsWith("a/") || diffPath.startsWith("b/")) {
    return diffPath.slice(2);
  }

  return diffPath;
}

function detectChangeType(
  fileDiff: string,
  oldPath: string | undefined,
  newPath: string | undefined,
  renameFrom: string | undefined,
  renameTo: string | undefined,
): GitDiffChangeType {
  if (fileDiff.includes("\nnew file mode ")) {
    return "added";
  }

  if (fileDiff.includes("\ndeleted file mode ")) {
    return "deleted";
  }

  if (renameFrom || renameTo || (oldPath && newPath && oldPath !== newPath)) {
    return "renamed";
  }

  return "modified";
}
