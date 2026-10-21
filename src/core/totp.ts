import { createHmac } from 'node:crypto';

import { UserError } from '../cli/errors';
import type { Algorithm } from './storage/model';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
// RFC 4648에서 마지막 8글자 묶음은 2, 4, 5, 7글자만 될 수 있습니다. 다른 길이는 잘못 옮겨 적은 것입니다.
const VALID_REMAINDERS = new Set([0, 2, 4, 5, 7]);

/** 서비스가 보여 주는 Base32 시크릿을 바이트로 바꿉니다. 공백, 소문자, `=` 패딩은 허용합니다. */
export function decodeBase32(token: string): Buffer {
  const text = token.replace(/\s/g, '').replace(/=+$/, '').toUpperCase();
  if (text === '' || !VALID_REMAINDERS.has(text.length % 8)) {
    throw new UserError('the token is not valid Base32: check that it was copied completely');
  }
  const bytes: number[] = [];
  let value = 0;
  let bits = 0;
  for (const char of text) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new UserError(`the token is not valid Base32: '${char}' is not A-Z or 2-7`);
    }
    // 한 번에 5비트씩 쌓다가 8비트가 모이면 1바이트를 꺼냅니다. 남는 비트는 많아야 12비트입니다.
    value = ((value << 5) | index) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

export interface TotpOptions {
  /** Base32로 적힌 시크릿입니다. */
  readonly token: string;
  readonly algorithm: Algorithm;
  readonly length: number;
  /** 코드가 바뀌는 간격(초)입니다. */
  readonly timePeriod: number;
  /** 코드 앞에 붙이는 문자열입니다. */
  readonly prefix?: string;
}

export interface Code {
  readonly code: string;
  /** 코드가 바뀔 때까지 남은 초입니다. */
  readonly remaining: number;
}

/** RFC 6238 TOTP 코드를 만듭니다. now는 밀리초 단위의 현재 시각입니다. */
export function generateCode(options: TotpOptions, now: number): Code {
  const seconds = Math.floor(now / 1000);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(seconds / options.timePeriod)));
  const digest = createHmac(options.algorithm, decodeBase32(options.token))
    .update(counter)
    .digest();
  // RFC 4226 5.4: 마지막 바이트의 아래 4비트가 가리키는 자리에서 31비트 정수를 꺼냅니다.
  const offset = digest.readUInt8(digest.length - 1) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  const code = String(binary % 10 ** options.length).padStart(options.length, '0');
  return {
    code: `${options.prefix ?? ''}${code}`,
    remaining: options.timePeriod - (seconds % options.timePeriod),
  };
}
