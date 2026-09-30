// Stop hook: before Claude says "done", run the fast checks if anything changed.
// Exit code 2 sends the failure output back to Claude, so it keeps working until green.
// This is the core idea of a harness: the agent cannot finish on a broken build.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
// Avoid an endless loop if Claude already retried after a failed check.
if (payload.stop_hook_active) process.exit(0);

const changed = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (!changed) process.exit(0);

try {
  execSync('npm run check --silent', { stdio: 'pipe', encoding: 'utf8' });
} catch (error) {
  const output = `${error.stdout ?? ''}${error.stderr ?? ''}`.slice(-4000);
  process.stderr.write(`npm run check failed. Fix these before finishing:\n${output}`);
  process.exit(2);
}
