import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// The server loads the typing sessions before the duels; a service cycle back to them crashed it at start
// ("Cannot access 'MAX_SESSION_MS' before initialization") while the tests, whose setup loads the app in another order,
// still passed. So the module is loaded alone, in a process of its own.
describe('service imports', () => {
  it('loads the typing session service on its own without a cycle', () => {
    const run = spawnSync(
      process.execPath,
      ['--import', 'tsx', '-e', "import('./src/services/typing-session.service.ts').then((m) => console.log('max', m.MAX_SESSION_MS))"],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 60_000 }
    );

    expect(`${run.stdout}${run.stderr}`).toContain('max 180000');
  }, 60_000);

  it('loads the match service on its own without a cycle (it records duels for the daily tasks, SCRUM-300)', () => {
    const run = spawnSync(
      process.execPath,
      ['--import', 'tsx', '-e', "import('./src/services/match.service.ts').then((m) => console.log('loaded', typeof m.createMatch))"],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 60_000 }
    );

    expect(`${run.stdout}${run.stderr}`).toContain('loaded function');
  }, 60_000);
});
