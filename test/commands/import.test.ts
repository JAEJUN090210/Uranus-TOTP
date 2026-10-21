import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Namespace } from '../../src/core/storage/model';
import { runUtc } from '../helpers/command';
import { account, createTempStore, TOKEN } from '../helpers/store';

let store: Awaited<ReturnType<typeof createTempStore>>;

beforeEach(async () => {
  store = await createTempStore([
    { name: 'work', accounts: [account('github'), account('gitlab')] },
  ]);
});

afterEach(async () => {
  await store.cleanup();
});

/** 가져올 내용을 저장소 옆 파일로 쓰고 경로를 돌려줍니다. */
async function importFile(content: unknown): Promise<string> {
  const file = join(dirname(store.path), 'import.json');
  await writeFile(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

function names(namespaces: readonly Namespace[]) {
  return namespaces.map((namespace) => ({
    name: namespace.name,
    accounts: namespace.accounts.map((item) => item.name),
  }));
}

describe('import', () => {
  it('adds new accounts and namespaces, empty ones included', async () => {
    const file = await importFile([
      { name: 'work', accounts: [account('vpn')] },
      { name: 'home', accounts: [account('router')] },
      { name: 'empty', accounts: [] },
    ]);

    const { code, stdout } = await runUtc(['import', file], { env: store.env });

    expect(code).toBe(0);
    expect(stdout).toBe('✔ Imported 2 account(s): 2 added, 0 overwritten\n');
    expect(names(await store.reopen())).toEqual([
      { name: 'work', accounts: ['github', 'gitlab', 'vpn'] },
      { name: 'home', accounts: ['router'] },
      { name: 'empty', accounts: [] },
    ]);
  });

  it('reads the values totp-cli leaves empty as the defaults and tidies the tokens', async () => {
    const file = await importFile([
      {
        name: 'home',
        accounts: [
          {
            name: 'router',
            token: 'jbsw y3dp ehpk 3pxp',
            prefix: '',
            length: 0,
            algorithm: '',
            timePeriod: 0,
          },
        ],
      },
    ]);

    await runUtc(['import', file], { env: store.env });

    expect((await store.reopen())[1]?.accounts[0]).toEqual(account('router', { token: TOKEN }));
  });

  it('keeps existing accounts when there is no terminal to ask in', async () => {
    const file = await importFile([
      { name: 'work', accounts: [account('github', { length: 8 }), account('vpn')] },
    ]);

    const { code, stdout, stderr } = await runUtc(['import', file], { env: store.env });

    expect(code).toBe(0);
    expect(stdout).toBe('✔ Imported 1 account(s): 1 added, 0 overwritten\n');
    expect(stderr).toBe(
      '⚠ Kept 1 existing account(s): work/github (add --overwrite to replace them)\n',
    );
    expect((await store.reopen())[0]?.accounts[0]?.length).toBe(6);
  });

  it('replaces existing accounts with --overwrite', async () => {
    const file = await importFile([{ name: 'work', accounts: [account('github', { length: 8 })] }]);

    const { stdout } = await runUtc(['import', file, '--overwrite'], { env: store.env });

    expect(stdout).toBe('✔ Imported 1 account(s): 0 added, 1 overwritten\n');
    expect((await store.reopen())[0]?.accounts[0]?.length).toBe(8);
  });

  it('asks about each existing account in a terminal', async () => {
    const file = await importFile([
      {
        name: 'work',
        accounts: [account('github', { length: 8 }), account('gitlab', { length: 8 })],
      },
    ]);

    const { questions, stderr } = await runUtc(['import', file], {
      env: store.env,
      interactive: true,
      answers: ['y', 'n'],
    });

    expect(questions).toEqual([
      "Overwrite 'work/github'? [y/N] ",
      "Overwrite 'work/gitlab'? [y/N] ",
    ]);
    expect(stderr).toBe('⚠ Kept 1 existing account(s): work/gitlab\n');
    expect((await store.reopen())[0]?.accounts.map((item) => item.length)).toEqual([8, 6]);
  });

  it("reads standard input for '-' with the password from UTC_PASS", async () => {
    const { stdout } = await runUtc(['--json', 'import', '-'], {
      env: store.env,
      input: JSON.stringify([{ name: 'home', accounts: [account('router')] }]),
    });

    expect(JSON.parse(stdout) as unknown).toEqual({
      added: ['home/router'],
      overwritten: [],
      skipped: [],
    });
  });

  it("needs UTC_PASS for '-'", async () => {
    const { code, stderr } = await runUtc(['import', '-'], {
      env: { UTC_CREDENTIAL_FILE: store.path },
      input: '[]',
    });

    expect(code).toBe(1);
    expect(stderr).toContain('set UTC_PASS to import from standard input');
  });

  it.each([
    { why: 'is not JSON', content: '{oops', message: 'not valid JSON' },
    {
      why: 'has an account without a token',
      content: [{ name: 'work', accounts: [{ name: 'vpn' }] }],
      message: "account 'vpn' has no token",
    },
    {
      why: 'has a token that is not Base32',
      content: [{ name: 'work', accounts: [{ name: 'vpn', token: 'ABC1' }] }],
      message: "the token of 'work/vpn': the token is not valid Base32",
    },
  ])('changes nothing when the file $why', async ({ content, message }) => {
    const file = await importFile(content);

    const { code, stderr } = await runUtc(['import', file], { env: store.env });

    expect(code).toBe(1);
    expect(stderr).toContain(`cannot import ${file}: ${message}`);
    expect(names(await store.reopen())).toEqual([{ name: 'work', accounts: ['github', 'gitlab'] }]);
  });

  it('says when the file does not exist', async () => {
    const { code, stderr } = await runUtc(['import', 'missing.json'], { env: store.env });

    expect(code).toBe(1);
    expect(stderr).toBe('✖ cannot import missing.json: the file does not exist\n');
  });
});
