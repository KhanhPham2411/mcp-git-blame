import { GitBlameLine } from './types.js';

export class BlameParser {
  parseBlameOutput(blameOutput: string): GitBlameLine[] {
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
}
