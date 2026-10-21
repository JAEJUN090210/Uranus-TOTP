import { afterEach, describe, expect, it } from 'vitest';

import { runUtc } from '../helpers/command';
import { account, createTempStore } from '../helpers/store';

let store: Awaited<ReturnType<typeof createTempStore>> | undefined;

afterEach(async () => {
  await store?.cleanup();
});

describe('list', () => {
  it('lists the namespaces by name with the number of accounts', async () => {
    store = await createTempStore([
      { name: 'work', accounts: [account('github'), account('vpn')] },
      { name: 'home', accounts: [account('router')] },
    ]);

    const { code, stdout } = await runUtc(['list'], { env: store.env });

    expect(code).toBe(0);
    expect(stdout).toBe('NAMESPACE  ACCOUNTS\nhome       1\nwork       2\n');
  });

  it('lists the accounts of a namespace with their options, but not their tokens', async () => {
    store = await createTempStore([
      {
        name: 'work',
        accounts: [
          account('vpn', { length: 8, algorithm: 'sha256', timePeriod: 60, prefix: 'pin' }),
          account('github'),
        ],
      },
    ]);

    const text = await runUtc(['list', 'work'], { env: store.env });
    const json = await runUtc(['list', 'work', '--json'], { env: store.env });

    expect(text.stdout).toBe(
      [
        'ACCOUNT  LENGTH  ALGORITHM  PERIOD  PREFIX',
        'github   6       sha1       30s     -',
        'vpn      8       sha256     60s     pin',
        '',
      ].join('\n'),
    );
    expect(JSON.parse(json.stdout) as unknown).toEqual({
      name: 'work',
      accounts: [
        { name: 'github', length: 6, algorithm: 'sha1', timePeriod: 30, prefix: '' },
        { name: 'vpn', length: 8, algorithm: 'sha256', timePeriod: 60, prefix: 'pin' },
      ],
    });
    expect(json.stdout).not.toContain('JBSW');
  });

  it('prints the namespaces as JSON', async () => {
    store = await createTempStore([{ name: 'work', accounts: [account('github')] }]);

    const { stdout } = await runUtc(['--json', 'list'], { env: store.env });

    expect(JSON.parse(stdout) as unknown).toEqual([{ name: 'work', accounts: 1 }]);
  });

  it('suggests add-token when there are no accounts', async () => {
    store = await createTempStore();

    const { stdout } = await runUtc(['list'], { env: store.env });

    expect(stdout).toBe("No accounts yet. Add one with 'utc add-token'.\n");
  });

  it('reports a namespace that does not exist', async () => {
    store = await createTempStore();

    const { code, stderr } = await runUtc(['list', 'work'], { env: store.env });

    expect(code).toBe(1);
    expect(stderr).toBe("✖ no namespace named 'work' (run 'utc list' to see them)\n");
  });
});
