import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runUtc } from '../helpers/command';
import { account, createTempStore } from '../helpers/store';

let store: Awaited<ReturnType<typeof createTempStore>>;

beforeEach(async () => {
  store = await createTempStore([{ name: 'work', accounts: [account('github')] }]);
});

afterEach(async () => {
  await store.cleanup();
});

describe('set-length', () => {
  it('sets the code length', async () => {
    const { code, stdout } = await runUtc(['set-length', 'work', 'github', '8'], {
      env: store.env,
    });

    expect(code).toBe(0);
    expect(stdout).toBe("✔ Set the code length of 'github' in 'work' to 8\n");
    expect((await store.reopen())[0]?.accounts[0]?.length).toBe(8);
  });

  it('asks for what is missing', async () => {
    const { questions } = await runUtc(['set-length'], {
      env: store.env,
      answers: ['work', 'github', '7'],
    });

    expect(questions).toEqual(['Namespace: ', 'Account: ', 'Length: ']);
    expect((await store.reopen())[0]?.accounts[0]?.length).toBe(7);
  });

  it.each([
    { how: 'as an argument', args: ['set-length', 'work', 'github', '11'], answers: [] },
    { how: 'as an answer', args: ['set-length', 'work', 'github'], answers: ['zero'] },
  ])('refuses a length outside 1 to 10 given $how', async ({ args, answers }) => {
    const { code, stderr } = await runUtc(args, { env: store.env, answers });

    expect(code).toBe(1);
    expect(stderr).toContain('whole number from 1 to 10');
    expect((await store.reopen())[0]?.accounts[0]?.length).toBe(6);
  });
});
