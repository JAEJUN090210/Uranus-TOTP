import { describe, expect, it } from 'vitest';

import type { CommandGroup } from '../../src/cli/program';
import { runCommand } from '../../src/cli/run';
import { createInstantCommand } from '../../src/commands/instant';
import { createFakeClock } from '../helpers/clock';
import { createTestRuntime, type TestRuntimeOptions } from '../helpers/runtime';

/** totp-cli 테스트가 쓰는 시크릿입니다. 59초에는 007459가 나옵니다. */
const TOKEN = 'HAZDGOJUG44DGNBXGIZTSOBUG4ZDGNBY';
/** RFC 6238 부록 B의 SHA-256 시드입니다. 59초에는 8자리 46119246이 나옵니다. */
const SHA256_SEED = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA';

async function run(args: string[], options: TestRuntimeOptions = {}) {
  const { runtime, stdout, stderr, questions } = createTestRuntime(options);
  const groups: readonly CommandGroup[] = [
    {
      heading: 'Codes:',
      commands: [(runtime) => createInstantCommand(runtime, createFakeClock(59_000).clock)],
    },
  ];
  const code = await runCommand(args, runtime, groups);
  return { code, stdout: stdout(), stderr: stderr(), questions: questions() };
}

describe('instant', () => {
  it('reads the token from UTC_TOKEN', async () => {
    const { code, stdout, questions } = await run(['instant'], { env: { UTC_TOKEN: TOKEN } });

    expect(code).toBe(0);
    expect(stdout).toBe('007459\n');
    expect(questions).toEqual([]);
  });

  it('asks for the token when UTC_TOKEN is not set', async () => {
    const { stdout, questions } = await run(['instant'], { answers: [TOKEN] });

    expect(stdout).toBe('007459\n');
    expect(questions).toEqual(['Token: ']);
  });

  it('uses the length, algorithm and time period options', async () => {
    const { stdout } = await run(
      ['instant', '--length', '8', '--algorithm', 'sha256', '--time-period', '30'],
      { env: { UTC_TOKEN: SHA256_SEED } },
    );

    expect(stdout).toBe('46119246\n');
  });

  it('shows the remaining time and prints JSON', async () => {
    const text = await run(['instant', '--show-remaining'], { env: { UTC_TOKEN: TOKEN } });
    const json = await run(['instant', '--json'], { env: { UTC_TOKEN: TOKEN } });

    expect(text.stdout).toBe('007459 (remaining time: 1s)\n');
    expect(JSON.parse(json.stdout) as unknown).toEqual({ code: '007459', remaining: 1 });
  });

  it('rejects a token that is not Base32', async () => {
    const { code, stderr } = await run(['instant'], { env: { UTC_TOKEN: 'nope!' } });

    expect(code).toBe(1);
    expect(stderr).toContain("'!' is not A-Z or 2-7");
  });

  it('rejects a code length over 10', async () => {
    const { code, stderr } = await run(['instant', '--length', '11'], {
      env: { UTC_TOKEN: TOKEN },
    });

    expect(code).toBe(1);
    expect(stderr).toContain('must be a whole number from 1 to 10');
  });
});
