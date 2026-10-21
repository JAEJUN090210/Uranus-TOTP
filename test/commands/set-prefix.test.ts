import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runUtc } from '../helpers/command';
import { account, createTempStore } from '../helpers/store';

let store: Awaited<ReturnType<typeof createTempStore>>;

beforeEach(async () => {
  store = await createTempStore([
    { name: 'work', accounts: [account('github', { prefix: 'old' })] },
  ]);
});

afterEach(async () => {
  await store.cleanup();
});

describe('set-prefix', () => {
  it('sets the prefix without printing it back', async () => {
    const { code, stdout } = await runUtc(['set-prefix', 'work', 'github', '1234'], {
      env: store.env,
    });

    expect(code).toBe(0);
    expect(stdout).toBe("✔ Set the prefix of 'github' in 'work'\n");
    expect((await store.reopen())[0]?.accounts[0]?.prefix).toBe('1234');
  });

  it('asks for the prefix when it is not given', async () => {
    const { questions } = await runUtc(['set-prefix', 'work', 'github'], {
      env: store.env,
      answers: ['new'],
    });

    expect(questions).toEqual(['Prefix: ']);
    expect((await store.reopen())[0]?.accounts[0]?.prefix).toBe('new');
  });

  it('removes the prefix with --clear', async () => {
    const { stdout, questions } = await runUtc(['set-prefix', 'work', 'github', '--clear'], {
      env: store.env,
    });

    expect(stdout).toBe("✔ Removed the prefix of 'github' in 'work'\n");
    expect(questions).toEqual([]);
    expect((await store.reopen())[0]?.accounts[0]?.prefix).toBe('');
  });
});
