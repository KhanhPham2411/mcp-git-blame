# Cursor MCP Configuration

To add this MCP Git Blame server to Cursor, you need to add the following configuration to your Cursor settings.

## Method 1: Add to Cursor Settings

1. Open Cursor
2. Go to Settings (Ctrl+,)
3. Search for "MCP" or "Model Context Protocol"
4. Add the following JSON to your MCP servers configuration:

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

## Method 2: Using the provided config file

1. Copy the contents of `cursor-mcp-config.json`
2. Add it to your Cursor MCP configuration
3. Update the `cwd` path to match your actual project location

## Method 3: Relative path configuration

If you want to use a relative path, you can modify the configuration like this:

```json
{
  "mcpServers": {
    "git-blame": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "./mcp-git-blame",
      "env": {}
    }
  }
}
```

## Usage in Cursor

Once configured, you can use the git blame functionality in Cursor by:

1. Opening a file in Cursor
2. Asking Cursor to get git blame information for specific lines
3. Example prompts:
   - "Get git blame for lines 10-20 in this file"
   - "Show me who wrote the code in lines 5-15"
   - "Get commit history for the current file"

## Available Tools

The server provides one tool:
- **git_blame**: Retrieves git blame information for files and line ranges

### Parameters:
- `filePath` (required): Full path to the file
- `lineFrom` (optional): Starting line number (1-based)
- `lineTo` (optional): Ending line number (1-based)

## Troubleshooting

If the server doesn't work:

1. Make sure you've built the project: `npm run build`
2. Verify the path in the `cwd` field is correct
3. Check that Node.js is available in your PATH
4. Ensure you're in a git repository when using the tool

## Testing the Configuration

You can test if the server is working by running:

```bash
cd C:\Data\Personal\Projects\20250812_MCP\mcp-git-blame
npm run build
npm start
```

The server should start and display "MCP Git Blame server running on stdio".
