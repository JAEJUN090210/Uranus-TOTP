import { UserError } from '../../cli/errors';

/** TOTP 코드를 계산하는 HMAC 알고리즘입니다. */
export const ALGORITHMS = ['sha1', 'sha256', 'sha512'] as const;
export type Algorithm = (typeof ALGORITHMS)[number];

/** totp-cli와 같은 기본값입니다. 대부분의 서비스가 6자리, SHA-1, 30초를 씁니다. */
export const DEFAULT_LENGTH = 6;
export const DEFAULT_ALGORITHM: Algorithm = 'sha1';
export const DEFAULT_TIME_PERIOD = 30;

/** 코드 길이의 범위입니다. 코드는 31비트 정수에서 자르므로 10자리를 넘을 수 없습니다. */
export const MIN_LENGTH = 1;
export const MAX_LENGTH = 10;

/** 필드 이름은 totp-cli의 JSON·YAML과 같습니다. */
export interface Account {
  name: string;
  /** Base32로 적힌 시크릿입니다. */
  token: string;
  /** 코드 앞에 붙이는 문자열입니다. 없으면 빈 문자열입니다. */
  prefix: string;
  length: number;
  algorithm: Algorithm;
  /** 코드가 바뀌는 간격(초)입니다. */
  timePeriod: number;
}

export interface Namespace {
  name: string;
  accounts: Account[];
}

/** 복호화한 저장소 내용입니다. 나중에 다른 항목을 더할 수 있도록 객체로 감쌉니다. */
export interface VaultData {
  namespaces: Namespace[];
}

export function isAlgorithm(value: unknown): value is Algorithm {
  return typeof value === 'string' && (ALGORITHMS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JSON에서 읽은 값이 저장소 내용인지 확인합니다. */
export function parseVaultData(value: unknown): VaultData {
  if (!isRecord(value)) {
    throw new UserError('expected an object with a namespaces list');
  }
  return { namespaces: parseNamespaces(value.namespaces) };
}

/** 네임스페이스 목록을 확인하고, 빠진 옵션은 기본값으로 채웁니다. */
export function parseNamespaces(value: unknown): Namespace[] {
  if (!Array.isArray(value)) {
    throw new UserError('expected a list of namespaces');
  }
  return value.map((item, index) => parseNamespace(item, `namespace #${index + 1}`));
}

function parseNamespace(value: unknown, where: string): Namespace {
  if (!isRecord(value)) {
    throw new UserError(`${where} is not an object`);
  }
  const name = parseName(value.name, where);
  if (!Array.isArray(value.accounts)) {
    throw new UserError(`namespace '${name}' has no accounts list`);
  }
  return {
    name,
    accounts: value.accounts.map((item, index) =>
      parseAccount(item, `account #${index + 1} of namespace '${name}'`),
    ),
  };
}

function parseName(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new UserError(`${where} has no name`);
  }
  return value;
}

// totp-cli는 값이 없으면 0이나 빈 문자열로 저장하고 코드를 만들 때 기본값을 씁니다. 같은 뜻으로 읽습니다.
function isUnset(value: unknown): boolean {
  return value === undefined || value === null || value === 0 || value === '';
}

function isWholeNumber(
  value: unknown,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function parseAccount(value: unknown, where: string): Account {
  if (!isRecord(value)) {
    throw new UserError(`${where} is not an object`);
  }
  const name = parseName(value.name, where);
  const label = `account '${name}'`;

  if (typeof value.token !== 'string' || value.token.trim() === '') {
    throw new UserError(`${label} has no token`);
  }

  const prefix = value.prefix ?? '';
  if (typeof prefix !== 'string') {
    throw new UserError(`the prefix of ${label} must be text`);
  }

  const length = isUnset(value.length) ? DEFAULT_LENGTH : value.length;
  if (!isWholeNumber(length, MIN_LENGTH, MAX_LENGTH)) {
    throw new UserError(
      `the length of ${label} must be a whole number from ${MIN_LENGTH} to ${MAX_LENGTH}`,
    );
  }

  const algorithm = isUnset(value.algorithm) ? DEFAULT_ALGORITHM : value.algorithm;
  if (!isAlgorithm(algorithm)) {
    throw new UserError(`the algorithm of ${label} must be one of ${ALGORITHMS.join(', ')}`);
  }

  const timePeriod = isUnset(value.timePeriod) ? DEFAULT_TIME_PERIOD : value.timePeriod;
  if (!isWholeNumber(timePeriod, 1)) {
    throw new UserError(`the time period of ${label} must be a positive whole number of seconds`);
  }

  return { name, token: value.token, prefix, length, algorithm, timePeriod };
}
