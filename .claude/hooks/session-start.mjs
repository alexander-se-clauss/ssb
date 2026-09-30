// SessionStart hook: in Claude Code on the web (a fresh cloud container) install
// dependencies so tests and lint work immediately. Locally it does nothing.
import { execSync } from 'node:child_process';

if (process.env.CLAUDE_CODE_REMOTE === 'true') {
  execSync('npm ci --no-audit --no-fund', { stdio: 'inherit' });
}
