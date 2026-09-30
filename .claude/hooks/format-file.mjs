// PostToolUse hook: formats every file Claude edits with Prettier, so style never
// needs to be discussed in review and diffs stay clean. Never blocks the agent.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

try {
  const payload = JSON.parse(readFileSync(0, 'utf8'));
  const file = payload?.tool_input?.file_path;
  if (typeof file === 'string' && file.length > 0) {
    execFileSync('npx', ['prettier', '--write', '--ignore-unknown', file], { stdio: 'ignore' });
  }
} catch {
  // Formatting is best effort; a failure here must not interrupt the agent.
}
