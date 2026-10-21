import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Store } from '../../src/core/storage/store';
import { runUtc } from '../helpers/command';
import { account, createTempStore, PASSWORD } from '../helpers/store';

let store: Awaited<ReturnType<typeof createTempStore>>;

beforeEach(async () => {
  // createTempStore는 fast 강도로 만듭니다.
  store = await createTempStore([{ name: 'work', accounts: [account('github')] }]);
});

afterEach(async () => {
  await store.cleanup();
});

async function strengthAfter(password: string) {
  const reopened = await Store.open(store.path, password);
  return { strength: reopened.strength, namespaces: reopened.namespaces };
}

describe('change-password', () => {
  it('asks for the strength, keeping the current one by default, and the new password twice', async () => {
    const { code, stdout, questions } = await runUtc(['change-password'], {
      env: store.env,
      interactive: true,
      answers: ['', 'new secret', 'new secret'],
    });

    expect(code).toBe(0);
    expect(questions).toEqual([
      'Strength (fast, normal, strong) [fast]: ',
      'New password: ',
      'Confirm password: ',
    ]);
    expect(stdout).toContain('✔ Changed the password (strength: fast)');
    expect(await strengthAfter('new secret')).toEqual({
      strength: 'fast',
      namespaces: [{ name: 'work', accounts: [account('github')] }],
    });
    await expect(Store.open(store.path, PASSWORD)).rejects.toThrow('wrong password');
  });

  it('uses --strength without asking for it', async () => {
    const { questions } = await runUtc(['--strength', 'normal', 'change-password'], {
      env: store.env,
      interactive: true,
      answers: ['new secret', 'new secret'],
    });

    expect(questions).toEqual(['New password: ', 'Confirm password: ']);
    expect((await strengthAfter('new secret')).strength).toBe('normal');
  });

  it('never takes UTC_PASS as the new password, and reads it once from a pipe', async () => {
    const { questions } = await runUtc(['change-password'], {
      env: store.env,
      answers: ['new secret'],
    });

    expect(questions).toEqual(['New password: ']);
    expect((await strengthAfter('new secret')).strength).toBe('fast');
  });

  it('asks for the current password when UTC_PASS is not set', async () => {
    const { questions } = await runUtc(['change-password'], {
      env: { UTC_CREDENTIAL_FILE: store.path },
      answers: [PASSWORD, 'new secret'],
    });

    expect(questions).toEqual(['Password: ', 'New password: ']);
  });

  it('keeps the old password when the new ones do not match', async () => {
    const { code, stderr } = await runUtc(['change-password'], {
      env: store.env,
      interactive: true,
      answers: ['', 'one', 'two'],
    });

    expect(code).toBe(1);
    expect(stderr).toContain('✖ the passwords do not match\n');
    expect((await strengthAfter(PASSWORD)).strength).toBe('fast');
  });
});
