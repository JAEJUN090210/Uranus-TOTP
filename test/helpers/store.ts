import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Account, Namespace } from '../../src/core/storage/model';
import { Store } from '../../src/core/storage/store';

export const PASSWORD = 'secret';
export const TOKEN = 'JBSWY3DPEHPK3PXP';

/** 기본 옵션을 가진 계정을 만듭니다. 바꿀 값만 넘기면 됩니다. */
export function account(name: string, options: Partial<Account> = {}): Account {
  return {
    name,
    token: TOKEN,
    prefix: '',
    length: 6,
    algorithm: 'sha1',
    timePeriod: 30,
    ...options,
  };
}

/**
 * 임시 폴더에 저장소 파일을 만듭니다. env를 테스트 실행 환경에 넘기면 명령이 이 파일을 비밀번호 없이 엽니다.
 * 테스트가 끝나면 cleanup을 불러 지웁니다.
 */
export async function createTempStore(namespaces: readonly Namespace[] = []) {
  const directory = await mkdtemp(join(tmpdir(), 'utc-test-'));
  const path = join(directory, 'credentials');
  const store = await Store.create(path, PASSWORD, 'fast');
  store.namespaces.push(...structuredClone(namespaces));
  await store.save();
  return {
    path,
    env: { UTC_CREDENTIAL_FILE: path, UTC_PASS: PASSWORD },
    /** 명령이 저장한 내용을 확인할 때 씁니다. */
    reopen: async () => (await Store.open(path, PASSWORD)).namespaces,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}
