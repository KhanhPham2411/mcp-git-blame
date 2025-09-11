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
