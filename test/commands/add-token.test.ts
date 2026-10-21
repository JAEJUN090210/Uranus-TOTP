import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runUtc } from '../helpers/command';
import { account, createTempStore, TOKEN } from '../helpers/store';

let store: Awaited<ReturnType<typeof createTempStore>>;

beforeEach(async () => {
  store = await createTempStore([{ name: 'work', accounts: [account('github')] }]);
});

afterEach(async () => {
  await store.cleanup();
});

describe('add-token', () => {
  it('adds an account with the default options, asking only for the token', async () => {
    const { code, stdout, questions } = await runUtc(['add-token', 'work', 'gitlab'], {
      env: store.env,
      answers: [TOKEN],
    });

    expect(code).toBe(0);
    expect(stdout).toBe("✔ Added 'gitlab' to 'work'\n");
    expect(questions).toEqual(['Token: ']);
    expect((await store.reopen())[0]?.accounts[1]).toEqual(account('gitlab'));
  });

  it('asks for the namespace and the account when they are not given', async () => {
    const { questions } = await runUtc(['add'], {
      env: store.env,
      answers: ['personal', 'discord', TOKEN],
    });

    expect(questions).toEqual(['Namespace: ', 'Account: ', 'Token: ']);
    expect((await store.reopen()).map((namespace) => namespace.name)).toEqual(['work', 'personal']);
  });

  it('saves the code options and a tidied up token', async () => {
    await runUtc(
      [
        'add-token',
        'work',
        'vpn',
        '--length',
        '8',
        '--prefix',
        'pin',
        '--algorithm',
        'sha256',
        '--time-period',
        '60',
      ],
      { env: store.env, answers: ['jbsw y3dp ehpk 3pxp'] },
    );

    expect((await store.reopen())[0]?.accounts[1]).toEqual(
      account('vpn', { length: 8, prefix: 'pin', algorithm: 'sha256', timePeriod: 60 }),
    );
  });

  it('refuses an account that already exists', async () => {
    const { code, stderr } = await runUtc(['add-token', 'work', 'github'], {
      env: store.env,
      answers: [TOKEN],
    });

    expect(code).toBe(1);
    expect(stderr).toBe("✖ 'work' already has an account named 'github'\n");
  });

  it('refuses a token that is not Base32 before asking for the password', async () => {
    const { code, stderr, questions } = await runUtc(['add-token', 'work', 'gitlab'], {
      env: { UTC_CREDENTIAL_FILE: store.path },
      answers: ['not base32!'],
    });

    expect(code).toBe(1);
    expect(stderr).toContain('the token is not valid Base32');
    expect(questions).toEqual(['Token: ']);
  });

  it('refuses an empty namespace', async () => {
    const { code, stderr } = await runUtc(['add-token'], { env: store.env, answers: [''] });

    expect(code).toBe(1);
    expect(stderr).toBe('✖ the namespace must not be empty\n');
  });
});
