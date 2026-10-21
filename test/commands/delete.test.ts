import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runUtc } from '../helpers/command';
import { account, createTempStore } from '../helpers/store';

let store: Awaited<ReturnType<typeof createTempStore>>;

beforeEach(async () => {
  store = await createTempStore([
    { name: 'work', accounts: [account('github'), account('gitlab')] },
    { name: 'home', accounts: [account('router')] },
  ]);
});

afterEach(async () => {
  await store.cleanup();
});

describe('delete', () => {
  it('deletes an account after asking in a terminal', async () => {
    const { code, stdout, questions } = await runUtc(['delete', 'work', 'github'], {
      env: store.env,
      interactive: true,
      answers: ['y'],
    });

    expect(code).toBe(0);
    expect(questions).toEqual(["Delete the account 'github' in 'work'? [y/N] "]);
    expect(stdout).toBe("✔ Deleted 'github' from 'work'\n");
    expect((await store.reopen())[0]?.accounts.map((item) => item.name)).toEqual(['gitlab']);
  });

  it('shows the accounts that go with a namespace before asking', async () => {
    const { stderr, questions } = await runUtc(['delete', 'work'], {
      env: store.env,
      interactive: true,
      answers: ['yes'],
    });

    expect(stderr).toBe("'work' has 2 account(s): github, gitlab\n");
    expect(questions).toEqual(["Delete the namespace 'work' and all of its accounts? [y/N] "]);
    expect((await store.reopen()).map((namespace) => namespace.name)).toEqual(['home']);
  });

  it('keeps everything when the answer is not yes', async () => {
    const { code, stderr } = await runUtc(['delete', 'work'], {
      env: store.env,
      interactive: true,
      answers: [''],
    });

    expect(code).toBe(1);
    expect(stderr).toContain('✖ nothing was deleted\n');
    expect(await store.reopen()).toHaveLength(2);
  });

  it('needs --yes when there is no terminal to ask in', async () => {
    const { code, stderr, questions } = await runUtc(['delete', 'work', 'github'], {
      env: store.env,
    });

    expect(code).toBe(1);
    expect(stderr).toBe(
      '✖ nothing was deleted: add --yes to go ahead without a terminal to ask in\n',
    );
    expect(questions).toEqual([]);
  });

  it('deletes without asking with --yes and prints JSON', async () => {
    const { stdout, questions } = await runUtc(['--json', 'delete', 'home', '-y'], {
      env: store.env,
    });

    expect(questions).toEqual([]);
    expect(JSON.parse(stdout) as unknown).toEqual({ namespace: 'home', deleted: true });
    expect((await store.reopen()).map((namespace) => namespace.name)).toEqual(['work']);
  });

  it('reports a missing account before asking', async () => {
    const { code, stderr, questions } = await runUtc(['delete', 'work', 'nope'], {
      env: store.env,
      interactive: true,
    });

    expect(code).toBe(1);
    expect(stderr).toContain("no account named 'nope' in 'work'");
    expect(questions).toEqual([]);
  });
});
