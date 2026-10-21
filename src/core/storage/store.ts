import { randomBytes } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { UserError } from '../../cli/errors';
import {
  deriveKey,
  kdfParamsOf,
  type KdfParams,
  newKdfParams,
  open,
  parseEnvelope,
  seal,
  type Strength,
  strengthOf,
} from './crypto';
import { type Namespace, parseVaultData, type VaultData } from './model';

// 저장소에는 시크릿이 들어 있으므로 본인만 읽고 쓸 수 있게 합니다. Windows에서는 무시됩니다.
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;

/** 다른 프로그램이 반쯤 쓴 파일을 읽지 않도록, 임시 파일에 다 쓴 뒤 이름을 바꿔 한 번에 교체합니다. */
async function writeFileAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: DIRECTORY_MODE });
  const temporary = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await writeFile(temporary, content, { mode: FILE_MODE, flag: 'wx' });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

/**
 * 비밀번호로 연 저장소입니다. namespaces를 고친 뒤 save()로 저장합니다.
 * 한 번 만든 키를 기억해 두므로 저장할 때마다 scrypt를 다시 돌리지 않습니다.
 */
export class Store {
  private constructor(
    readonly path: string,
    private key: Buffer,
    private kdf: KdfParams,
    readonly namespaces: Namespace[],
  ) {}

  static async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  /** 저장소 파일을 비밀번호로 엽니다. 비밀번호가 틀리면 UserError를 던집니다. */
  static async open(path: string, password: string): Promise<Store> {
    const envelope = parseEnvelope(await readFile(path, 'utf8'));
    const kdf = kdfParamsOf(envelope);
    const key = await deriveKey(password, kdf);
    const plaintext = open(envelope, key).toString('utf8');
    let data: VaultData;
    try {
      data = parseVaultData(JSON.parse(plaintext));
    } catch (error) {
      throw new UserError(
        `the credentials file is damaged: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return new Store(path, key, kdf, data.namespaces);
  }

  /** 빈 저장소를 새로 만들어 바로 파일로 저장합니다. */
  static async create(path: string, password: string, strength: Strength): Promise<Store> {
    const kdf = newKdfParams(strength);
    const store = new Store(path, await deriveKey(password, kdf), kdf, []);
    await store.save();
    return store;
  }

  /** 지금 키를 만든 강도입니다. 다른 프로그램이 정한 값이면 undefined입니다. */
  get strength(): Strength | undefined {
    return strengthOf(this.kdf.logN);
  }

  async save(): Promise<void> {
    const data: VaultData = { namespaces: this.namespaces };
    const envelope = seal(Buffer.from(JSON.stringify(data), 'utf8'), this.key, this.kdf);
    await writeFileAtomic(this.path, `${JSON.stringify(envelope, null, 2)}\n`);
  }

  /** 새 비밀번호와 강도로 키를 다시 만들어 저장합니다. 솔트도 새로 만듭니다. */
  async changePassword(password: string, strength: Strength): Promise<void> {
    const kdf = newKdfParams(strength);
    const key = await deriveKey(password, kdf);
    this.kdf = kdf;
    this.key = key;
    await this.save();
  }
}
