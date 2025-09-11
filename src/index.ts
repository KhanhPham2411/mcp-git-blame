#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { GitBlameParams, GitCommitDetailParams } from './types.js';
import { GitService } from './git-service.js';
import { Logger } from './logger.js';

class GitBlameServer {
  private server: Server;
  private gitService: GitService;
  private logger: Logger;

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

    this.gitService = new GitService();
    this.logger = Logger.getInstance();
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
          {
            name: 'git_commit_detail',
            description: 'Get detailed information about a specific commit',
            inputSchema: {
              type: 'object',
              properties: {
                commitHash: {
                  type: 'string',
                  description: 'The commit hash to get details for',
                },
                includeDiff: {
                  type: 'boolean',
                  description: 'Whether to include the full diff in the response (optional, defaults to false)',
                },
                filePath: {
                  type: 'string',
                  description: 'Optional file path to scope the repository for the commit lookup',
                },
              },
              required: ['commitHash'],
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
      } else if (request.params.name === 'git_commit_detail') {
        const args = request.params.arguments || {};
        const params: GitCommitDetailParams = {
          commitHash: args.commitHash as string,
          includeDiff: args.includeDiff as boolean | undefined,
          filePath: args.filePath as string | undefined,
        };
        return await this.handleGitCommitDetail(params);
      }
      throw new Error(`Unknown tool: ${request.params.name}`);
    });
  }

  private async handleGitBlame(params: GitBlameParams) {
    try {
      const result = await this.gitService.getBlameInfo(params);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };

    } catch (error) {
      throw new Error(`Failed to get git blame information: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleGitCommitDetail(params: GitCommitDetailParams) {
    const startTime = Date.now();
    this.logger.logToolCall('git_commit_detail', params);

    try {
      const result = await this.gitService.getCommitDetail(params);
      const duration = Date.now() - startTime;

      this.logger.info('git_commit_detail completed successfully', {
        commitHash: params.commitHash,
        filePath: params.filePath,
        filesChanged: result.filesChanged,
        changedFilesCount: result.changedFiles?.length || 0,
        duration: `${duration}ms`
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.logToolError('git_commit_detail', error as Error, {
        ...params,
        duration: `${duration}ms`
      });
      throw new Error(`Failed to get commit details: ${error instanceof Error ? error.message : String(error)}`);
    }
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
