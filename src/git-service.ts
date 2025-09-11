import { simpleGit, SimpleGit } from 'simple-git';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { GitBlameParams, GitBlameLine } from './types.js';
import { BlameParser } from './blame-parser.js';

export class GitService {
  private parser: BlameParser;

  constructor() {
    this.parser = new BlameParser();
  }

  async getBlameInfo(params: GitBlameParams): Promise<{
    filePath: string;
    totalLines: number;
    requestedLines: number;
    lineRange: { from: number; to: number };
    blame: GitBlameLine[];
  }> {
    const { filePath, lineFrom, lineTo } = params;

    // Validate file path
    if (!filePath) {
      throw new Error('File path is required');
    }

    // Resolve absolute path
    const absolutePath = resolve(filePath);
    
    // Check if file exists
    if (!existsSync(absolutePath)) {
      throw new Error(`File does not exist: ${absolutePath}`);
    }

    // Use a git instance scoped to the target file's directory. This avoids
    // relying on the process CWD which may not be the repo root (especially
    // when launched by external tools on Windows).
    const baseDir = dirname(absolutePath);
    const git = simpleGit({ baseDir });

    // Check if we're in a git repository (from the file's directory)
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error('Not in a git repository');
    }

    // Get git blame information
    // Convert path separators for Git compatibility on Windows
    const gitPath = absolutePath.replace(/\\/g, '/');
    const blameResult = await git.raw([
      'blame',
      '--porcelain',
      '--line-porcelain',
      gitPath
    ]);

    const blameLines = this.parser.parseBlameOutput(blameResult);
    
    // Filter lines if lineFrom and lineTo are specified
    let filteredLines = blameLines;
    if (lineFrom !== undefined || lineTo !== undefined) {
      const startLine = lineFrom || 1;
      const endLine = lineTo || blameLines.length;
      
      filteredLines = blameLines.filter(line => 
        line.line >= startLine && line.line <= endLine
      );
    }

    return {
      filePath: absolutePath,
      totalLines: blameLines.length,
      requestedLines: filteredLines.length,
      lineRange: {
        from: lineFrom || 1,
        to: lineTo || blameLines.length
      },
      blame: filteredLines
    };
  }
}
