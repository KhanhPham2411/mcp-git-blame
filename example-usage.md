# MCP Git Blame Server - Example Usage

## Basic Setup

1. Install dependencies:
```bash
npm install
```

2. Build the server:
```bash
npm run build
```

3. Run the server:
```bash
npm start
```

## Example MCP Client Requests

### 1. Get blame for entire file

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "git_blame",
    "arguments": {
      "filePath": "/path/to/your/file.js"
    }
  }
}
```

### 2. Get blame for specific lines (10-20)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "git_blame",
    "arguments": {
      "filePath": "/path/to/your/file.js",
      "lineFrom": 10,
      "lineTo": 20
    }
  }
}
```

### 3. Get blame for single line

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "git_blame",
    "arguments": {
      "filePath": "/path/to/your/file.js",
      "lineFrom": 15,
      "lineTo": 15
    }
  }
}
```

## Expected Response Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"filePath\": \"/absolute/path/to/file.js\",\n  \"totalLines\": 25,\n  \"requestedLines\": 3,\n  \"lineRange\": {\n    \"from\": 1,\n    \"to\": 3\n  },\n  \"blame\": [\n    {\n      \"line\": 1,\n      \"hash\": \"abc123def456\",\n      \"author\": \"John Doe\",\n      \"authorEmail\": \"john@example.com\",\n      \"authorTime\": \"1640995200\",\n      \"authorTimeZone\": \"+0000\",\n      \"committer\": \"John Doe\",\n      \"committerEmail\": \"john@example.com\",\n      \"committerTime\": \"1640995200\",\n      \"committerTimeZone\": \"+0000\",\n      \"summary\": \"Initial commit\",\n      \"previousHash\": \"\",\n      \"previousFilename\": \"\",\n      \"filename\": \"file.js\",\n      \"content\": \"// Test file for git blame\"\n    }\n  ]\n}"
      }
    ]
  }
}
```

## Error Handling

The server will return appropriate errors for:
- File not found
- Not in a git repository
- Invalid line numbers
- Git command failures

Example error response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Failed to get git blame information: File does not exist: /path/to/nonexistent.js"
  }
}
```
