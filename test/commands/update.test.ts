import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runUtc } from '../helpers/command';
import { account, createTempStore } from '../helpers/store';

let store: Awaited<ReturnType<typeof createTempStore>>;

beforeEach(async () => {
  store = await createTempStore([
    { name: 'work', accounts: [account('github', { prefix: 'pin' })] },
  ]);
});

afterEach(async () => {
  await store.cleanup();
});

describe('update', () => {
  it('changes only the options that are given', async () => {
    const { code, stdout } = await runUtc(
      ['update', 'work', 'github', '--length', '8', '--algorithm', 'sha512'],
      { env: store.env },
    );

    expect(code).toBe(0);
    expect(stdout).toBe("✔ Updated 'github' in 'work'\n");
    expect((await store.reopen())[0]?.accounts[0]).toEqual(
      account('github', { prefix: 'pin', length: 8, algorithm: 'sha512' }),
    );
  });

  it('can clear the prefix with an empty value', async () => {
    await runUtc(['update', 'work', 'github', '--prefix', ''], { env: store.env });

    expect((await store.reopen())[0]?.accounts[0]?.prefix).toBe('');
  });

  it('refuses to run without any option, before asking for the password', async () => {
    const { code, stderr, questions } = await runUtc(['update', 'work', 'github'], {
      env: { UTC_CREDENTIAL_FILE: store.path },
    });

    expect(code).toBe(1);
    expect(stderr).toBe(
      '✖ nothing to update: give --length, --prefix, --algorithm or --time-period\n',
    );
    expect(questions).toEqual([]);
  });

  it('prints the updated options as JSON', async () => {
    const { stdout } = await runUtc(['--json', 'update', 'work', 'github', '--time-period', '60'], {
      env: store.env,
    });

    expect(JSON.parse(stdout) as unknown).toEqual({
      namespace: 'work',
      account: { name: 'github', length: 6, algorithm: 'sha1', timePeriod: 60, prefix: 'pin' },
    });
  });
});
