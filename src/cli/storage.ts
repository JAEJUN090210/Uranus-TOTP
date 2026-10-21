import { homedir } from 'node:os';

import {
  DEFAULT_STRENGTH,
  isStrength,
  STRENGTH_NAMES,
  STRENGTHS,
  type Strength,
} from '../core/storage/crypto';
import { credentialsPath } from '../core/storage/paths';
import { Store } from '../core/storage/store';
import type { Output } from '../ui/output';
import { UserError } from './errors';
import type { Runtime } from './runtime';

/** 비밀번호를 담는 환경 변수입니다. 다른 프로그램에 노출될 수 있으니 CI처럼 꼭 필요할 때만 씁니다. */
export const PASSWORD_ENV = 'UTC_PASS';

export interface OpenStoreOptions {
  /** 저장소를 새로 만들 때 쓸 강도입니다. 없으면 터미널에서 묻고, 파이프면 기본값을 씁니다. */
  readonly strength?: Strength;
}

/** UTC_PASS에 담긴 비밀번호입니다. 없거나 비어 있으면 undefined입니다. */
export function passwordFromEnv(runtime: Runtime): string | undefined {
  const password = runtime.env[PASSWORD_ENV];
  return password === undefined || password === '' ? undefined : password;
}

/** 저장소를 엽니다. 아직 없으면 강도와 새 비밀번호를 물어 새로 만듭니다. */
export async function openStore(
  runtime: Runtime,
  output: Output,
  options: OpenStoreOptions = {},
): Promise<Store> {
  const path = credentialsPath(runtime.env, runtime.platform, homedir());
  if (await Store.exists(path)) {
    return Store.open(path, await askPassword(runtime));
  }

  if (runtime.prompt.interactive) {
    runtime.stderr.write(`No credentials file at ${path} yet, so a new one will be created.\n`);
  }
  const strength = options.strength ?? (await chooseStrength(runtime));
  const store = await Store.create(path, await askNewPassword(runtime), strength);
  output.success(`Created the credentials file (strength: ${strength}) at ${path}`);
  output.hint('Do not forget the password. There is no way to recover it.');
  return store;
}

/** 저장소를 열 비밀번호를 받습니다. UTC_PASS가 있으면 묻지 않습니다. */
export async function askPassword(runtime: Runtime): Promise<string> {
  return passwordFromEnv(runtime) ?? runtime.prompt.secret('Password: ');
}

export interface NewPasswordOptions {
  /**
   * UTC_PASS를 새 비밀번호로 쓸지 여부입니다. 저장소를 처음 만들 때는 쓰고,
   * change-password에서는 UTC_PASS가 지금 비밀번호이므로 쓰지 않습니다.
   */
  readonly useEnv?: boolean;
}

/** 새 비밀번호를 받습니다. 터미널에서는 오타로 잠기지 않도록 두 번 입력받습니다. */
export async function askNewPassword(
  runtime: Runtime,
  { useEnv = true }: NewPasswordOptions = {},
): Promise<string> {
  const fromEnv = useEnv ? passwordFromEnv(runtime) : undefined;
  if (fromEnv !== undefined) {
    return fromEnv;
  }
  const password = await runtime.prompt.secret('New password: ');
  if (password === '') {
    throw new UserError('the password must not be empty');
  }
  if (runtime.prompt.interactive) {
    const confirmation = await runtime.prompt.secret('Confirm password: ');
    if (confirmation !== password) {
      throw new UserError('the passwords do not match');
    }
  }
  return password;
}

/**
 * 저장소를 보호할 강도를 묻습니다. 그냥 Enter를 누르거나 사람이 답할 수 없으면 fallback을 씁니다.
 * change-password는 지금 강도를 fallback으로 넘겨서, 묻지 않으면 강도가 그대로 유지되게 합니다.
 */
export async function chooseStrength(
  runtime: Runtime,
  fallback: Strength = DEFAULT_STRENGTH,
): Promise<Strength> {
  if (!runtime.prompt.interactive) {
    return fallback;
  }
  runtime.stderr.write(
    [
      'Choose how hard the password should be to guess. Stronger takes longer to unlock.',
      `  fast    scrypt N=2^${STRENGTHS.fast}`,
      `  normal  scrypt N=2^${STRENGTHS.normal} (recommended)`,
      `  strong  scrypt N=2^${STRENGTHS.strong}`,
      '',
    ].join('\n'),
  );
  for (;;) {
    const answer = (
      await runtime.prompt.line(`Strength (${STRENGTH_NAMES.join(', ')}) [${fallback}]: `)
    ).toLowerCase();
    if (answer === '') {
      return fallback;
    }
    if (isStrength(answer)) {
      return answer;
    }
    runtime.stderr.write(`'${answer}' is not a strength. Choose ${STRENGTH_NAMES.join(', ')}.\n`);
  }
}
