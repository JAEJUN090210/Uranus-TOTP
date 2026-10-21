import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runUtc } from '../helpers/command';
import { account, createTempStore } from '../helpers/store';

let store: Awaited<ReturnType<typeof createTempStore>>;

beforeEach(async () => {
  store = await createTempStore([
    { name: 'work', accounts: [account('github'), account('gitlab')] },
    { name: 'home', accounts: [] },
  ]);
});

afterEach(async () => {
  await store.cleanup();
});

describe('rename account', () => {
  it('renames an account', async () => {
    const { code, stdout } = await runUtc(['rename', 'account', 'work', 'github', 'gh'], {
      env: store.env,
    });

    expect(code).toBe(0);
    expect(stdout).toBe("✔ Renamed 'github' in 'work' to 'gh'\n");
    expect((await store.reopen())[0]?.accounts.map((item) => item.name)).toEqual(['gh', 'gitlab']);
  });

  it('asks for what is missing', async () => {
    const { questions } = await runUtc(['rename', 'account'], {
      env: store.env,
      answers: ['work', 'github', 'gh'],
    });

    expect(questions).toEqual(['Namespace: ', 'Account: ', 'New name: ']);
  });

  it('refuses a name that another account in the namespace has', async () => {
    const { code, stderr } = await runUtc(['rename', 'account', 'work', 'github', 'gitlab'], {
      env: store.env,
    });

    expect(code).toBe(1);
    expect(stderr).toBe("✖ 'work' already has an account named 'gitlab'\n");
  });

  it('reports too many arguments without leaving the process', async () => {
    const { code, stderr } = await runUtc(['rename', 'account', 'a', 'b', 'c', 'd'], {
      env: store.env,
    });

    expect(code).toBe(1);
    expect(stderr).toContain("too many arguments for 'account'");
  });
});

describe('rename namespace', () => {
  it('renames a namespace', async () => {
    const { stdout } = await runUtc(['rename', 'namespace', 'work', 'office'], {
      env: store.env,
    });

    expect(stdout).toBe("✔ Renamed the namespace 'work' to 'office'\n");
    expect((await store.reopen()).map((namespace) => namespace.name)).toEqual(['office', 'home']);
  });

  it('refuses a name that another namespace has', async () => {
    const { code, stderr } = await runUtc(['rename', 'namespace', 'work', 'home'], {
      env: store.env,
    });

    expect(code).toBe(1);
    expect(stderr).toBe("✖ a namespace named 'home' already exists\n");
  });
});
