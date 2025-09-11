export interface GitBlameLine {
  line: number;
  hash: string;
  author: string;
  authorEmail: string;
  authorTime: string;
  authorTimeZone: string;
  committer: string;
  committerEmail: string;
  committerTime: string;
  committerTimeZone: string;
  summary: string;
  previousHash: string;
  previousFilename: string;
  filename: string;
  content: string;
}

export interface GitBlameParams {
  filePath: string;
  lineFrom?: number;
  lineTo?: number;
}

export interface GitCommitDetail {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  authorTime: string;
  authorTimeZone: string;
  committer: string;
  committerEmail: string;
  committerTime: string;
  committerTimeZone: string;
  summary: string;
  message: string;
  parentHashes: string[];
  treeHash: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  diff?: string;
  changedFiles?: GitChangedFile[];
}

export interface GitCommitDetailParams {
  commitHash: string;
  includeDiff?: boolean;
  // Optional: any path inside the target repository (e.g., blamed file)
  filePath?: string;
  // If true, also include per-file unified diffs in changedFiles[].patch
  includeFileDiffs?: boolean;
}

export interface GitChangedFile {
  // Single-letter git status: A, M, D, R, C, T, U, etc.
  status: string;
  // New/current path in the commit
  path: string;
  // Old path when renamed or copied
  oldPath?: string;
  // Insertions/deletions for this path (may be undefined for binary changes)
  insertions?: number;
  deletions?: number;
  // Optional per-file unified diff (when includeFileDiffs is true)
  patch?: string;
}