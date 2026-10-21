import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CommandGroup } from '../../src/cli/program';
import { runCommand } from '../../src/cli/run';
import { createGenerateCommand } from '../../src/commands/generate';
import type { Clock } from '../../src/core/clock';
import { Store } from '../../src/core/storage/store';
import { generateCode, type TotpOptions } from '../../src/core/totp';
import { createFakeClock } from '../helpers/clock';
import { createTestRuntime } from '../helpers/runtime';

/** totp-cli 테스트가 쓰는 시크릿입니다. 59초에는 007459가 나옵니다. */
const TOKEN = 'HAZDGOJUG44DGNBXGIZTSOBUG4ZDGNBY';
const GITHUB: TotpOptions = { token: TOKEN, algorithm: 'sha1', length: 6, timePeriod: 30 };
const VPN: TotpOptions = {
  token: TOKEN,
  algorithm: 'sha256',
  length: 8,
  timePeriod: 60,
  prefix: 'pin',
};

let directory: string;
let path: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'utc-generate-'));
  path = join(directory, 'credentials');
  const store = await Store.create(path, 'secret', 'fast');
  store.namespaces.push({
    name: 'work',
    accounts: [
      { name: 'github', prefix: '', ...GITHUB },
      { name: 'vpn', prefix: 'pin', ...VPN },
    ],
  });
  await store.save();
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function run(args: string[], clock: Clock, controller = new AbortController()) {
  const { runtime, stdout, stderr } = createTestRuntime({
    env: { UTC_CREDENTIAL_FILE: path, UTC_PASS: 'secret' },
    signal: controller.signal,
  });
  const groups: readonly CommandGroup[] = [
    { heading: 'Codes:', commands: [(runtime) => createGenerateCommand(runtime, clock)] },
  ];
  const code = await runCommand(args, runtime, groups);
  return { code, stdout: stdout(), stderr: stderr() };
}

describe('generate', () => {
  it('prints only the code, like totp-cli', async () => {
    const { code, stdout } = await run(
      ['generate', 'work', 'github'],
      createFakeClock(59_000).clock,
    );

    expect(code).toBe(0);
    expect(stdout).toBe('007459\n');
  });

  it('has the alias g and shows the remaining time on request', async () => {
    const { stdout } = await run(
      ['g', 'work', 'github', '--show-remaining'],
      createFakeClock(59_000).clock,
    );

    expect(stdout).toBe('007459 (remaining time: 1s)\n');
  });

  it('uses the prefix, length, algorithm and time period of the account', async () => {
    const { stdout } = await run(['generate', 'work', 'vpn'], createFakeClock(59_000).clock);

    expect(stdout).toBe(`${generateCode(VPN, 59_000).code}\n`);
    expect(stdout).toMatch(/^pin\d{8}\n$/);
  });

  it('prints the account and the code as JSON', async () => {
    const { stdout } = await run(
      ['--json', 'generate', 'work', 'github'],
      createFakeClock(59_000).clock,
    );

    expect(JSON.parse(stdout) as unknown).toEqual({
      namespace: 'work',
      account: 'github',
      code: '007459',
      remaining: 1,
    });
  });

  it('prints a new code every time it changes until Ctrl+C, then exits normally', async () => {
    const controller = new AbortController();
    const { clock, waits } = createFakeClock(59_000, controller, 2);
    const later = [generateCode(GITHUB, 60_010).code, generateCode(GITHUB, 90_010).code];

    const { code, stdout } = await run(
      ['generate', 'work', 'github', '--follow'],
      clock,
      controller,
    );

    expect(code).toBe(0);
    expect(stdout).toBe(`007459\n${later.join('\n')}\n`);
    expect(waits()).toEqual([1010, 30_000, 30_000]);
  });

  it('prints one JSON line per code with --follow --json', async () => {
    const controller = new AbortController();
    const { clock } = createFakeClock(59_000, controller, 1);

    const { stdout } = await run(
      ['generate', 'work', 'github', '--follow', '--json'],
      clock,
      controller,
    );

    const lines = stdout.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? '') as unknown).toEqual({
      namespace: 'work',
      account: 'github',
      code: '007459',
      remaining: 1,
    });
    expect(JSON.parse(lines[1] ?? '') as unknown).toMatchObject({ remaining: 30 });
  });

  it('reports an account that does not exist', async () => {
    const { code, stderr } = await run(
      ['generate', 'work', 'gitlab'],
      createFakeClock(59_000).clock,
    );

    expect(code).toBe(1);
    expect(stderr).toBe(
      "✖ no account named 'gitlab' in 'work' (run 'utc list work' to see them)\n",
    );
  });
});
