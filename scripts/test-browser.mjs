import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const env = { ...process.env, NO_COLOR: '1', VITE_E2E_BYPASS_AUTH: '1' };
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
let runner;
let log = '';
const cleanup = () => { runner?.kill('SIGTERM'); server.kill('SIGTERM'); };
process.once('SIGINT', cleanup);
process.once('SIGTERM', cleanup);
try {
  const url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`테스트 서버 시작 시간 초과\n${log}`)), 15_000);
    server.once('error', (error) => { clearTimeout(timeout); reject(error); });
    server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`테스트 서버 종료 (${code})\n${log}`)); });
    server.stderr.on('data', (data) => { log += data.toString(); });
    server.stdout.on('data', (data) => {
      log += data.toString();
      const match = log.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const files = (await readdir(new URL('../tests/browser/', import.meta.url)))
    .filter((file) => file.endsWith('.test.js')).sort().map((file) => `tests/browser/${file}`);
  runner = spawn(process.execPath, ['--test', '--test-concurrency=1', ...process.argv.slice(2), ...files], { cwd: root, env: { ...env, SOUNDCAPSULE_TEST_URL: url }, stdio: 'inherit' });
  process.exitCode = await new Promise((resolve, reject) => {
    runner.once('error', reject);
    runner.once('exit', (code) => resolve(code ?? 1));
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  cleanup();
}
