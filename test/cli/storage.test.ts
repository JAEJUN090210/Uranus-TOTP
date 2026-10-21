import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openStore } from '../../src/cli/storage';
import { Store } from '../../src/core/storage/store';
import { Output } from '../../src/ui/output';
import { createTestRuntime, type TestRuntimeOptions } from '../helpers/runtime';

let directory: string;
let path: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'utc-open-'));
  path = join(directory, 'credentials');
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

function setup(options: TestRuntimeOptions = {}) {
  const test = createTestRuntime({
    ...options,
    env: { UTC_CREDENTIAL_FILE: path, ...options.env },
  });
  return { ...test, output: new Output(test.runtime) };
}

describe('openStore for a new credentials file', () => {
  it('uses UTC_PASS and --strength without asking anything', async () => {
    const { runtime, output, stdout, questions } = setup({ env: { UTC_PASS: 'secret' } });

    const store = await openStore(runtime, output, { strength: 'fast' });

    expect(store.strength).toBe('fast');
    expect(questions()).toEqual([]);
    expect(stdout()).toContain(`Created the credentials file (strength: fast) at ${path}`);
    expect((await Store.open(path, 'secret')).namespaces).toEqual([]);
  });

  it('asks for the strength and the new password twice in a terminal', async () => {
    const { runtime, output, stderr, questions } = setup({
      interactive: true,
      answers: ['fast', 'secret', 'secret'],
    });

    const store = await openStore(runtime, output);

    expect(store.strength).toBe('fast');
    expect(questions()).toEqual([
      'Strength (fast, normal, strong) [normal]: ',
      'New password: ',
      'Confirm password: ',
    ]);
    expect(stderr()).toContain(`No credentials file at ${path} yet`);
  });

  it('asks again when the strength is unknown', async () => {
    const { runtime, output, stderr } = setup({
      interactive: true,
      answers: ['ultra', 'fast', 'secret', 'secret'],
    });

    const store = await openStore(runtime, output);

    expect(store.strength).toBe('fast');
    expect(stderr()).toContain("'ultra' is not a strength. Choose fast, normal, strong.");
  });

  it('reads the password once and uses the default strength from a pipe', async () => {
    const { runtime, output, questions } = setup({ answers: ['secret'] });

    const store = await openStore(runtime, output);

    expect(store.strength).toBe('normal');
    expect(questions()).toEqual(['New password: ']);
  });

  it('rejects passwords that do not match', async () => {
    const { runtime, output } = setup({ interactive: true, answers: ['fast', 'one', 'two'] });

    await expect(openStore(runtime, output)).rejects.toThrow('the passwords do not match');
    expect(await Store.exists(path)).toBe(false);
  });

  it('rejects an empty password', async () => {
    const { runtime, output } = setup({ answers: [''] });

    await expect(openStore(runtime, output, { strength: 'fast' })).rejects.toThrow(
      'the password must not be empty',
    );
  });
});

describe('openStore for an existing credentials file', () => {
  beforeEach(async () => {
    await Store.create(path, 'secret', 'fast');
  });

  it('asks for the password', async () => {
    const { runtime, output, questions } = setup({ answers: ['secret'] });

    const store = await openStore(runtime, output);

    expect(store.path).toBe(path);
    expect(questions()).toEqual(['Password: ']);
  });

  it('uses UTC_PASS instead of asking', async () => {
    const { runtime, output, questions } = setup({ env: { UTC_PASS: 'secret' } });

    await openStore(runtime, output);

    expect(questions()).toEqual([]);
  });

  it('reports a wrong password', async () => {
    const { runtime, output } = setup({ answers: ['wrong'] });

    await expect(openStore(runtime, output)).rejects.toThrow('wrong password');
  });
});
