#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { GitBlameParams } from './types.js';
import { GitService } from './git-service.js';

class GitBlameServer {
  private server: Server;
  private gitService: GitService;

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


  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Git Blame server running on stdio');
  }
}

// Start the server
const server = new GitBlameServer();
server.run().catch(console.error);
