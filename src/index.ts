#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { simpleGit, SimpleGit } from 'simple-git';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

interface GitBlameLine {
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

interface GitBlameParams {
  filePath: string;
  lineFrom?: number;
  lineTo?: number;
}

class GitBlameServer {
  private server: Server;
  private git: SimpleGit;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-git-blame',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Default instance; per-request we will construct a scoped instance
    // with baseDir pointing at the file's directory to ensure repo detection.
    this.git = simpleGit();
    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'git_blame',
            description: 'Get git blame information for a file or specific lines',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Full path to the file to get blame information for',
                },
                lineFrom: {
                  type: 'number',
                  description: 'Starting line number (1-based, optional)',
                  minimum: 1,
                },
                lineTo: {
                  type: 'number',
                  description: 'Ending line number (1-based, optional)',
                  minimum: 1,
                },
              },
              required: ['filePath'],
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'git_blame') {
        const args = request.params.arguments || {};
        const params: GitBlameParams = {
          filePath: args.filePath as string,
          lineFrom: args.lineFrom as number | undefined,
          lineTo: args.lineTo as number | undefined,
        };
        return await this.handleGitBlame(params);
      }
      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  private async handleGitBlame(params: GitBlameParams) {
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

    try {
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

      const blameLines = this.parseBlameOutput(blameResult);
      
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
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              filePath: absolutePath,
              totalLines: blameLines.length,
              requestedLines: filteredLines.length,
              lineRange: {
                from: lineFrom || 1,
                to: lineTo || blameLines.length
              },
              blame: filteredLines
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      throw new Error(`Failed to get git blame information: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseBlameOutput(blameOutput: string): GitBlameLine[] {
    const lines = blameOutput.split('\n');
    const blameLines: GitBlameLine[] = [];

    // State for the current line's blame info
    let current: Partial<GitBlameLine> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (raw.length === 0) {
        continue;
      }

      // Header line example: "<hash> <orig_lineno> <final_lineno> <num_lines>"
      // e.g., "da39a3ee5e6b4b0d3255bfef95601890afd80709 1 1 1"
      const headerMatch = raw.match(/^([0-9a-f]{8,40})\s+\d+\s+(\d+)\s+\d+/i);
      if (headerMatch) {
        // If there was a previous entry that never received content, drop it
        // (content is required to finalize an entry).
        current = {
          hash: headerMatch[1],
          line: parseInt(headerMatch[2], 10),
        };
        continue;
      }

      // Key-value metadata lines
      if (current) {
        if (raw.startsWith('author ')) {
          current.author = raw.substring('author '.length);
          continue;
        }
        if (raw.startsWith('author-mail ')) {
          current.authorEmail = raw.substring('author-mail '.length);
          continue;
        }
        if (raw.startsWith('author-time ')) {
          current.authorTime = raw.substring('author-time '.length);
          continue;
        }
        if (raw.startsWith('author-tz ')) {
          current.authorTimeZone = raw.substring('author-tz '.length);
          continue;
        }
        if (raw.startsWith('committer ')) {
          current.committer = raw.substring('committer '.length);
          continue;
        }
        if (raw.startsWith('committer-mail ')) {
          current.committerEmail = raw.substring('committer-mail '.length);
          continue;
        }
        if (raw.startsWith('committer-time ')) {
          current.committerTime = raw.substring('committer-time '.length);
          continue;
        }
        if (raw.startsWith('committer-tz ')) {
          current.committerTimeZone = raw.substring('committer-tz '.length);
          continue;
        }
        if (raw.startsWith('summary ')) {
          current.summary = raw.substring('summary '.length);
          continue;
        }
        if (raw.startsWith('previous ')) {
          // Format: previous <hash> <filename>
          const prev = raw.substring('previous '.length).split(' ');
          current.previousHash = prev[0];
          current.previousFilename = prev.slice(1).join(' ');
          continue;
        }
        if (raw.startsWith('filename ')) {
          current.filename = raw.substring('filename '.length);
          continue;
        }

        // Content line starts with a tab, keep content exactly as-is after the tab
        if (raw.startsWith('\t')) {
          current.content = raw.substring(1);
          // Finalize the current entry when content is read
          if (typeof current.line === 'number' && current.content !== undefined) {
            blameLines.push(current as GitBlameLine);
          }
          current = null;
          continue;
        }
      }
    }

    return blameLines;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Git Blame server running on stdio');
  }
}

// Start the server
const server = new GitBlameServer();
server.run().catch(console.error);
