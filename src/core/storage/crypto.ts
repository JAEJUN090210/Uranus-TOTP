import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';

import { UserError } from '../../cli/errors';

/** 비밀번호에서 키를 만드는 scrypt의 강도입니다. 값은 비용 N의 지수(log2 N)입니다. */
export const STRENGTHS = { fast: 15, normal: 17, strong: 18 } as const;
export type Strength = keyof typeof STRENGTHS;
export const STRENGTH_NAMES = Object.keys(STRENGTHS) as readonly Strength[];
export const DEFAULT_STRENGTH: Strength = 'normal';

export function isStrength(value: unknown): value is Strength {
  return typeof value === 'string' && Object.hasOwn(STRENGTHS, value);
}

/** logN이 어느 강도인지 찾습니다. 세 가지 중 어느 것도 아니면 undefined입니다. */
export function strengthOf(logN: number): Strength | undefined {
  return STRENGTH_NAMES.find((name) => STRENGTHS[name] === logN);
}

const FORMAT = 'uranus-totp';
const VERSION = 1;
const KDF = 'scrypt';
const CIPHER = 'aes-256-gcm';
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
// scrypt 권장값입니다. r은 메모리 블록 크기, p는 병렬도입니다.
const SCRYPT_R = 8;
const SCRYPT_P = 1;
// 손상되거나 조작된 파일 때문에 메모리를 지나치게 쓰지 않도록 받아들이는 값을 제한합니다.
const MIN_LOG_N = 10;
const MAX_LOG_N = 20;
const MAX_SCRYPT_MEMORY = 1024 * 1024 * 1024;

export interface KdfParams {
  readonly logN: number;
  readonly r: number;
  readonly p: number;
  readonly salt: Buffer;
}

/** 저장소 파일의 JSON 형식입니다. 바이너리 값은 base64로 적습니다. */
export interface Envelope {
  readonly format: typeof FORMAT;
  readonly version: typeof VERSION;
  readonly kdf: {
    readonly name: typeof KDF;
    readonly logN: number;
    readonly r: number;
    readonly p: number;
    readonly salt: string;
  };
  readonly cipher: { readonly name: typeof CIPHER; readonly iv: string; readonly tag: string };
  readonly data: string;
}

/** scrypt가 쓰는 메모리 크기(바이트)입니다. */
function scryptMemory(logN: number, r: number, p: number): number {
  return 128 * 2 ** logN * r * p;
}

/** 새 솔트로 강도에 맞는 키 생성 값을 만듭니다. */
export function newKdfParams(strength: Strength): KdfParams {
  return { logN: STRENGTHS[strength], r: SCRYPT_R, p: SCRYPT_P, salt: randomBytes(SALT_LENGTH) };
}

export function kdfParamsOf(envelope: Envelope): KdfParams {
  const { logN, r, p, salt } = envelope.kdf;
  return { logN, r, p, salt: Buffer.from(salt, 'base64') };
}

/** 비밀번호에서 암호화 키를 만듭니다. 강도가 높을수록 오래 걸리므로 이벤트 루프를 막지 않게 비동기로 씁니다. */
export function deriveKey(password: string, params: KdfParams): Promise<Buffer> {
  const { logN, r, p, salt } = params;
  return new Promise((resolve, reject) => {
    // 같은 글자를 다른 방식(NFC, NFD)으로 입력해도 같은 키가 나오도록 정규화합니다.
    scrypt(
      password.normalize('NFC'),
      salt,
      KEY_LENGTH,
      { N: 2 ** logN, r, p, maxmem: 2 * scryptMemory(logN, r, p) },
      (error, key) => {
        if (error) {
          reject(error);
        } else {
          resolve(key);
        }
      },
    );
  });
}

/** 암호문과 함께 인증하는 머리글입니다. 강도나 솔트를 바꾼 파일은 열리지 않습니다. */
function associatedData(kdf: Envelope['kdf'], iv: string): Buffer {
  return Buffer.from(
    JSON.stringify([FORMAT, VERSION, kdf.name, kdf.logN, kdf.r, kdf.p, kdf.salt, CIPHER, iv]),
    'utf8',
  );
}

/** 평문을 키로 암호화해 봉투를 만듭니다. IV는 저장할 때마다 새로 만듭니다. */
export function seal(plaintext: Buffer, key: Buffer, params: KdfParams): Envelope {
  const kdf = {
    name: KDF,
    logN: params.logN,
    r: params.r,
    p: params.p,
    salt: params.salt.toString('base64'),
  } as const;
  const iv = randomBytes(IV_LENGTH).toString('base64');
  const cipher = createCipheriv(CIPHER, key, Buffer.from(iv, 'base64'), {
    authTagLength: TAG_LENGTH,
  });
  cipher.setAAD(associatedData(kdf, iv));
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    format: FORMAT,
    version: VERSION,
    kdf,
    cipher: { name: CIPHER, iv, tag: cipher.getAuthTag().toString('base64') },
    data: data.toString('base64'),
  };
}

/** 키로 봉투를 엽니다. 키가 틀렸거나 내용이 바뀌었으면 UserError를 던집니다. */
export function open(envelope: Envelope, key: Buffer): Buffer {
  const decipher = createDecipheriv(CIPHER, key, Buffer.from(envelope.cipher.iv, 'base64'), {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAAD(associatedData(envelope.kdf, envelope.cipher.iv));
  decipher.setAuthTag(Buffer.from(envelope.cipher.tag, 'base64'));
  try {
    return Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
  } catch {
    throw new UserError('wrong password, or the credentials file is damaged');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function hasBytes(value: unknown, min: number, max = min): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const length = Buffer.from(value, 'base64').length;
  return length >= min && length <= max;
}

/** 저장소 파일의 내용을 읽어 봉투인지 확인합니다. */
export function parseEnvelope(text: string): Envelope {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    value = undefined;
  }
  if (!isRecord(value) || value.format !== FORMAT) {
    throw new UserError('the credentials file is not a Uranus-TOTP file');
  }
  if (value.version !== VERSION) {
    throw new UserError(
      `the credentials file has format version ${String(value.version)}, which this utc cannot read; update utc`,
    );
  }

  const damaged = new UserError('the credentials file is damaged');
  const { kdf, cipher, data } = value;
  if (
    !isRecord(kdf) ||
    kdf.name !== KDF ||
    !isInteger(kdf.logN, MIN_LOG_N, MAX_LOG_N) ||
    !isInteger(kdf.r, 1, 32) ||
    !isInteger(kdf.p, 1, 16) ||
    scryptMemory(kdf.logN, kdf.r, kdf.p) > MAX_SCRYPT_MEMORY ||
    !hasBytes(kdf.salt, SALT_LENGTH, 1024)
  ) {
    throw damaged;
  }
  if (
    !isRecord(cipher) ||
    cipher.name !== CIPHER ||
    !hasBytes(cipher.iv, IV_LENGTH) ||
    !hasBytes(cipher.tag, TAG_LENGTH) ||
    typeof data !== 'string'
  ) {
    throw damaged;
  }

  return {
    format: FORMAT,
    version: VERSION,
    kdf: { name: KDF, logN: kdf.logN, r: kdf.r, p: kdf.p, salt: kdf.salt },
    cipher: { name: CIPHER, iv: cipher.iv, tag: cipher.tag },
    data,
  };
}
