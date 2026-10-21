import { access, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runUtc } from '../helpers/command';
import { account, createTempStore } from '../helpers/store';

const NAMESPACES = [
  { name: 'work', accounts: [account('github'), account('vpn', { prefix: 'pin', length: 8 })] },
  { name: 'home', accounts: [] },
];

let store: Awaited<ReturnType<typeof createTempStore>>;
let file: string;

beforeEach(async () => {
  store = await createTempStore(NAMESPACES);
  file = join(dirname(store.path), 'backup.json');
});

afterEach(async () => {
  await store.cleanup();
});

describe('dump', () => {
  it('refuses to write without --yes, before asking for the password', async () => {
    const { code, stderr, questions } = await runUtc(['dump', file], {
      env: { UTC_CREDENTIAL_FILE: store.path },
    });

    expect(code).toBe(1);
    expect(stderr).toBe('✖ dump writes every token without encryption; add --yes to go ahead\n');
    expect(questions).toEqual([]);
    await expect(access(file)).rejects.toThrow();
  });

  it('writes every account with its token in the totp-cli layout', async () => {
    const { code, stdout, stderr } = await runUtc(['dump', file, '--yes'], { env: store.env });

    expect(code).toBe(0);
    expect(stdout).toBe(`✔ Wrote 2 account(s) in 2 namespace(s) to ${file}\n`);
    expect(stderr).toBe('⚠ The file is not encrypted. Delete it once you no longer need it.\n');
    expect(JSON.parse(await readFile(file, 'utf8')) as unknown).toEqual(NAMESPACES);
  });

  it("writes only the JSON to standard output for '-'", async () => {
    const { stdout } = await runUtc(['dump', '-', '-y'], { env: store.env });

    expect(JSON.parse(stdout) as unknown).toEqual(NAMESPACES);
  });

  it.skipIf(process.platform === 'win32')('lets only the owner read the file', async () => {
    await runUtc(['dump', file, '--yes'], { env: store.env });

    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });
});
