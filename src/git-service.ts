import { simpleGit, SimpleGit } from 'simple-git';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { GitBlameParams, GitBlameLine, GitCommitDetailParams, GitCommitDetail, GitChangedFile } from './types.js';
import { BlameParser } from './blame-parser.js';
import { Logger } from './logger.js';

export class GitService {
  private parser: BlameParser;
  private logger: Logger;

  constructor() {
    this.parser = new BlameParser();
    this.logger = Logger.getInstance();
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

  async getCommitDetail(params: GitCommitDetailParams): Promise<GitCommitDetail> {
    const startTime = Date.now();
    const { commitHash, includeDiff = false, includeFileDiffs, filePath } = params;

    this.logger.info('Starting getCommitDetail', {
      commitHash,
      includeDiff,
      filePath,
      operation: 'getCommitDetail'
    });

    // Validate commit hash
    if (!commitHash) {
      const error = new Error('Commit hash is required');
      this.logger.logToolError('getCommitDetail', error, params);
      throw error;
    }

    // Validate file path
    if (!filePath) {
      const error = new Error('File path is required');
      this.logger.logToolError('getCommitDetail', error, params);
      throw error;
    }

    // Scope git to the provided file's repo
    const baseDir = dirname(resolve(filePath));
    const git = simpleGit({ baseDir });

    this.logger.info('Git repository scoped', {
      baseDir,
      filePath,
      operation: 'getCommitDetail'
    });

    // Check if we're in a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      const error = new Error('Not in a git repository');
      this.logger.logToolError('getCommitDetail', error, { baseDir, filePath });
      throw error;
    }

    try {
      // Verify the commit exists in this repository first
      try {
        await git.revparse([commitHash]);
        this.logger.info('Commit verified in repository', {
          commitHash,
          baseDir,
          operation: 'getCommitDetail'
        });
      } catch {
        const error = new Error(`Commit not found in repository at ${baseDir}: ${commitHash}`);
        this.logger.logToolError('getCommitDetail', error, { commitHash, baseDir });
        throw error;
      }

      // Use no-patch to get clean sections for reliable parsing
      this.logger.info('Fetching commit information', {
        commitHash,
        operation: 'getCommitDetail'
      });
      
      const headerInfo = await git.show([commitHash, '--format=fuller', '--no-patch']);
      const nameStatusOut = await git.show([commitHash, '--name-status', '--pretty=format:']);
      const numstatOut = await git.show([commitHash, '--numstat', '--pretty=format:']);

      this.logger.info('Git show commands completed', {
        commitHash,
        headerLength: headerInfo.length,
        nameStatusLength: nameStatusOut.length,
        numstatLength: numstatOut.length,
        operation: 'getCommitDetail'
      });

      // Initialize fields
      let hash = '';
      let shortHash = '';
      let author = '';
      let authorEmail = '';
      let authorTime = '';
      let authorTimeZone = '';
      let committer = '';
      let committerEmail = '';
      let committerTime = '';
      let committerTimeZone = '';
      let summary = '';
      let message = '';
      let parentHashes: string[] = [];
      let treeHash = '';

      // Parse header and message
      const headerLines = headerInfo.split('\n');
      for (const raw of headerLines) {
        const line = raw;
        if (line.startsWith('commit ')) {
          hash = line.substring(7).trim();
          shortHash = hash.substring(0, 7);
        } else if (line.startsWith('Author: ')) {
          const m = line.match(/^Author:\s*(.+?)\s*<(.+?)>/);
          if (m) {
            author = m[1].trim();
            authorEmail = m[2].trim();
          }
        } else if (line.startsWith('Commit: ')) {
          const m = line.match(/^Commit:\s*(.+?)\s*<(.+?)>/);
          if (m) {
            committer = m[1].trim();
            committerEmail = m[2].trim();
          }
        } else if (line.startsWith('AuthorDate: ')) {
          const d = line.substring('AuthorDate: '.length).trim();
          const tz = d.match(/ ([-+]\d{4})$/);
          if (tz) {
            authorTimeZone = tz[1];
            authorTime = d.slice(0, -tz[0].length).trim();
          } else {
            authorTime = d;
          }
        } else if (line.startsWith('CommitDate: ')) {
          const d = line.substring('CommitDate: '.length).trim();
          const tz = d.match(/ ([-+]\d{4})$/);
          if (tz) {
            committerTimeZone = tz[1];
            committerTime = d.slice(0, -tz[0].length).trim();
          } else {
            committerTime = d;
          }
        } else if (line.startsWith('Merge: ')) {
          const rest = line.substring('Merge: '.length).trim();
          parentHashes = rest.split(/\s+/).filter(Boolean);
        } else if (line.startsWith('tree ')) {
          treeHash = line.substring(5).trim();
        } else if (line.startsWith('    ')) {
          const msgLine = line.slice(4);
          if (msgLine.length > 0) {
            if (!summary) summary = msgLine.trim();
            message += msgLine + '\n';
          } else {
            message += '\n';
          }
        }
      }
      message = message.trim();

      // Build changed files from name-status and numstat
      const pathToChange: Map<string, GitChangedFile> = new Map();

      // name-status
      for (const line of nameStatusOut.split('\n')) {
        if (!line.trim()) continue;
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const statusRaw = parts[0];
          const status = statusRaw.charAt(0);
          if (status === 'R' || status === 'C') {
            const oldPath = parts[1];
            const newPath = parts[2] || parts[1];
            const existing = pathToChange.get(newPath) || { status: '', path: newPath };
            existing.status = status;
            existing.oldPath = oldPath;
            pathToChange.set(newPath, existing);
          } else {
            const p = parts[1];
            const existing = pathToChange.get(p) || { status: '', path: p };
            existing.status = status;
            pathToChange.set(p, existing);
          }
        }
      }

      // numstat
      for (const line of numstatOut.split('\n')) {
        if (!line.trim()) continue;
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const insStr = parts[0];
          const delStr = parts[1];
          let path = parts[2];
          let oldPath: string | undefined;
          if (parts.length >= 4) {
            // rename case: old\tnew
            oldPath = parts[2];
            path = parts[3];
          }
          const ins = insStr === '-' ? undefined : parseInt(insStr);
          const del = delStr === '-' ? undefined : parseInt(delStr);
          const existing = pathToChange.get(path) || { status: '', path };
          existing.insertions = ins;
          existing.deletions = del;
          if (oldPath && !existing.oldPath) existing.oldPath = oldPath;
          pathToChange.set(path, existing);
        }
      }

      const changedFiles = Array.from(pathToChange.values());
      let filesChanged = changedFiles.length;
      let insertions = 0;
      let deletions = 0;
      for (const f of changedFiles) {
        if (typeof f.insertions === 'number') insertions += f.insertions;
        if (typeof f.deletions === 'number') deletions += f.deletions;
      }

      this.logger.info('Parsed commit details', {
        commitHash,
        filesChanged,
        insertions,
        deletions,
        changedFilesCount: changedFiles.length,
        operation: 'getCommitDetail'
      });

      // Get diff if requested
      let diff: string | undefined;
      if (includeDiff) {
        try {
          this.logger.info('Fetching diff', { commitHash, operation: 'getCommitDetail' });
          diff = await git.show([commitHash]);
          this.logger.info('Diff fetched successfully', {
            commitHash,
            diffLength: diff.length,
            operation: 'getCommitDetail'
          });
        } catch (error) {
          // Diff might fail for some commits, continue without it
          this.logger.warn('Failed to get diff', {
            commitHash,
            error: error instanceof Error ? error.message : String(error),
            operation: 'getCommitDetail'
          });
        }
      }

      // Optionally include per-file unified diffs
      const needFileDiffs = !!includeFileDiffs || includeDiff === true;
      if (needFileDiffs) {
        try {
          // Use existing diff text when available; otherwise fetch just the patches
          let patchSource = diff;
          if (!patchSource) {
            this.logger.info('Fetching per-file patches', { commitHash, operation: 'getCommitDetail' });
            patchSource = await git.show([commitHash, '--pretty=format:', '--patch', '--no-color']);
          }

          if (patchSource) {
            type FilePatch = { aPath: string; bPath: string; patch: string };
            const filePatches: FilePatch[] = [];

            const lines = patchSource.split('\n');
            let current: FilePatch | null = null;
            let buffer: string[] = [];

            const flush = () => {
              if (current) {
                current.patch = buffer.join('\n');
                filePatches.push(current);
              }
              current = null;
              buffer = [];
            };

            const diffHeaderRegex = /^diff --git a\/(.+) b\/(.+)$/;
            for (const line of lines) {
              const m = line.match(diffHeaderRegex);
              if (m) {
                // new file section starts
                flush();
                current = { aPath: m[1], bPath: m[2], patch: '' };
                buffer.push(line);
              } else if (current) {
                buffer.push(line);
              }
            }
            flush();

            const stripPrefix = (p: string) => p.replace(/^a\//, '').replace(/^b\//, '');

            // Build quick index of patches by both aPath and bPath without prefixes
            const pathToPatch: Map<string, string> = new Map();
            for (const fp of filePatches) {
              const aKey = stripPrefix(fp.aPath);
              const bKey = stripPrefix(fp.bPath);
              if (aKey) pathToPatch.set(aKey, fp.patch);
              if (bKey) pathToPatch.set(bKey, fp.patch);
            }

            for (const cf of changedFiles) {
              const keyNow = cf.path.replace(/\\/g, '/');
              const patch = pathToPatch.get(keyNow) || (cf.oldPath ? pathToPatch.get(cf.oldPath.replace(/\\/g, '/')) : undefined);
              if (patch) {
                (cf as GitChangedFile).patch = patch;
              }
            }
          }
        } catch (error) {
          this.logger.warn('Failed to compute per-file patches', {
            commitHash,
            error: error instanceof Error ? error.message : String(error),
            operation: 'getCommitDetail'
          });
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info('getCommitDetail completed successfully', {
        commitHash,
        filesChanged,
        insertions,
        deletions,
        changedFilesCount: changedFiles.length,
        duration: `${duration}ms`,
        operation: 'getCommitDetail'
      });

      return {
        hash,
        shortHash,
        author,
        authorEmail,
        authorTime,
        authorTimeZone,
        committer,
        committerEmail,
        committerTime,
        committerTimeZone,
        summary,
        message,
        parentHashes,
        treeHash,
        filesChanged,
        insertions,
        deletions,
        diff,
        changedFiles
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = `Failed to get commit details: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.logToolError('getCommitDetail', new Error(errorMessage), {
        commitHash,
        filePath,
        duration: `${duration}ms`
      });
      throw new Error(errorMessage);
    }
  }
}
