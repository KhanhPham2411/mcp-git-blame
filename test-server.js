// Simple test script to verify the MCP server works
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

// Create a test file
const testContent = `// Test file for git blame
function hello() {
  console.log("Hello, World!");
}

function goodbye() {
  console.log("Goodbye!");
}
`;

writeFileSync('test-file.js', testContent);

// Test the server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send a test request
const testRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'git_blame',
    arguments: {
      filePath: './test-file.js',
      lineFrom: 1,
      lineTo: 3
    }
  }
};

server.stdin.write(JSON.stringify(testRequest) + '\n');

let output = '';
server.stdout.on('data', (data) => {
  output += data.toString();
  console.log('Server response:', output);
  server.kill();
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
  // Clean up test file
  try {
    unlinkSync('test-file.js');
  } catch (e) {
    // File might not exist
  }
});
