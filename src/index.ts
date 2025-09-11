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
import { resolve } from 'path';

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
      // Check if we're in a git repository
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        throw new Error('Not in a git repository');
      }

      // Get git blame information
      const blameResult = await this.git.raw([
        'blame',
        '--porcelain',
        '--line-porcelain',
        absolutePath
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
    let currentCommit: Partial<GitBlameLine> = {};
    let lineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('filename ')) {
        // This is the start of a new commit block
        if (currentCommit.line && currentCommit.content !== undefined) {
          blameLines.push(currentCommit as GitBlameLine);
        }
        
        currentCommit = {
          filename: line.substring(9), // Remove 'filename ' prefix
        };
      } else if (line.startsWith('author ')) {
        currentCommit.author = line.substring(7);
      } else if (line.startsWith('author-mail ')) {
        currentCommit.authorEmail = line.substring(12);
      } else if (line.startsWith('author-time ')) {
        currentCommit.authorTime = line.substring(12);
      } else if (line.startsWith('author-tz ')) {
        currentCommit.authorTimeZone = line.substring(10);
      } else if (line.startsWith('committer ')) {
        currentCommit.committer = line.substring(10);
      } else if (line.startsWith('committer-mail ')) {
        currentCommit.committerEmail = line.substring(15);
      } else if (line.startsWith('committer-time ')) {
        currentCommit.committerTime = line.substring(15);
      } else if (line.startsWith('committer-tz ')) {
        currentCommit.committerTimeZone = line.substring(13);
      } else if (line.startsWith('summary ')) {
        currentCommit.summary = line.substring(8);
      } else if (line.startsWith('previous ')) {
        currentCommit.previousHash = line.substring(9);
      } else if (line.startsWith('filename ')) {
        currentCommit.previousFilename = line.substring(9);
      } else if (line.startsWith('hash ')) {
        currentCommit.hash = line.substring(5);
      } else if (line.match(/^\d+\s+\d+\s+\d+$/)) {
        // This is a line number marker: "lineNumber numLines numLines"
        const parts = line.split(/\s+/);
        lineNumber = parseInt(parts[0], 10);
        currentCommit.line = lineNumber;
      } else if (line.startsWith('\t')) {
        // This is the actual line content
        currentCommit.content = line.substring(1);
      }
    }

    // Add the last commit if it exists
    if (currentCommit.line && currentCommit.content !== undefined) {
      blameLines.push(currentCommit as GitBlameLine);
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
