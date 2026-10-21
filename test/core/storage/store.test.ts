import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Account } from '../../../src/core/storage/model';
import { Store } from '../../../src/core/storage/store';

const ACCOUNT: Account = {
  name: 'github',
  token: 'JBSWY3DPEHPK3PXP',
  prefix: '',
  length: 6,
  algorithm: 'sha1',
  timePeriod: 30,
};

let directory: string;
let path: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'utc-store-'));
  path = join(directory, 'credentials');
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('Store', () => {
  it('creates an empty file, including missing folders, that opens with the password', async () => {
    const nested = join(directory, 'a', 'b', 'credentials');
    await Store.create(nested, 'secret', 'fast');

    const store = await Store.open(nested, 'secret');

    expect(await Store.exists(nested)).toBe(true);
    expect(store.namespaces).toEqual([]);
    expect(store.strength).toBe('fast');
  });

  it('reports that a file does not exist yet', async () => {
    expect(await Store.exists(path)).toBe(false);
  });

  it('saves changes to the namespaces', async () => {
    const store = await Store.create(path, 'secret', 'fast');
    store.namespaces.push({ name: 'work', accounts: [ACCOUNT] });
    await store.save();

    const reopened = await Store.open(path, 'secret');

    expect(reopened.namespaces).toEqual([{ name: 'work', accounts: [ACCOUNT] }]);
  });

  it('never writes the secrets in plain text', async () => {
    const store = await Store.create(path, 'secret', 'fast');
    store.namespaces.push({ name: 'work', accounts: [ACCOUNT] });
    await store.save();

    const text = await readFile(path, 'utf8');

    expect(text).not.toContain(ACCOUNT.token);
    expect(text).not.toContain('github');
  });

  it('rejects a wrong password', async () => {
    await Store.create(path, 'secret', 'fast');

    await expect(Store.open(path, 'wrong')).rejects.toThrow('wrong password');
  });

  it('changes the password and the strength', async () => {
    const store = await Store.create(path, 'secret', 'fast');
    store.namespaces.push({ name: 'work', accounts: [ACCOUNT] });

    await store.changePassword('new secret', 'normal');

    await expect(Store.open(path, 'secret')).rejects.toThrow('wrong password');
    const reopened = await Store.open(path, 'new secret');
    expect(reopened.strength).toBe('normal');
    expect(reopened.namespaces).toEqual([{ name: 'work', accounts: [ACCOUNT] }]);
  });

  it('leaves no temporary files behind', async () => {
    const store = await Store.create(path, 'secret', 'fast');
    await store.save();

    expect(await readdir(directory)).toEqual(['credentials']);
  });

  it.skipIf(process.platform === 'win32')('lets only the owner read the file', async () => {
    await Store.create(path, 'secret', 'fast');

    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('reports a file that is not a credentials file', async () => {
    await writeFile(path, 'hello');

    await expect(Store.open(path, 'secret')).rejects.toThrow('not a Uranus-TOTP file');
  });
});
