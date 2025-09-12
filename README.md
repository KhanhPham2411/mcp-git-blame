# MCP Git Local Blame Server

An MCP (Model Context Protocol) server that provides git local blame information for files and specific line ranges.

## Features

- Get git blame information for entire files
- Get git blame information for specific line ranges
- Detailed commit information including author, committer, timestamps, and commit messages
- Works with any git repository

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

## Usage

### Running the Server

```bash
npm start
```

Or for development:
```bash
npm run dev
```

### Available Tools

#### `git_blame`

Retrieves git blame information for a file or specific lines.

**Parameters:**
- `filePath` (string, required): Full path to the file to get blame information for
- `lineFrom` (number, optional): Starting line number (1-based)
- `lineTo` (number, optional): Ending line number (1-based)

**Example Usage:**

Get blame for entire file:
```json
{
  "name": "git_blame",
  "arguments": {
    "filePath": "/path/to/your/file.js"
  }
}
```

Get blame for specific lines (10-20):
```json
{
  "name": "git_blame",
  "arguments": {
    "filePath": "/path/to/your/file.js",
    "lineFrom": 10,
    "lineTo": 20
  }
}
```

**Response Format:**

The server returns detailed blame information including:
- File path and line range information
- For each line:
  - Line number
  - Commit hash
  - Author name and email
  - Author timestamp and timezone
  - Committer name and email
  - Committer timestamp and timezone
  - Commit summary/message
  - Previous commit hash and filename
  - Line content

## Development

The server is built with TypeScript and uses:
- `@modelcontextprotocol/sdk` for MCP protocol implementation
- `simple-git` for git operations

## Cursor Integration

To add this server to Cursor, add the following to your Cursor MCP configuration:

```json
{
  "mcpServers": {
    "git-blame": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "C:\\Data\\Personal\\Projects\\20250812_MCP\\mcp-git-blame",
      "env": {}
    }
  }
}
```

See `cursor-config-example.md` for detailed integration instructions.

## License

MIT
