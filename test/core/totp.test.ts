import { describe, expect, it } from 'vitest';

import type { Algorithm } from '../../src/core/storage/model';
import { decodeBase32, generateCode } from '../../src/core/totp';

/** RFC 6238 부록 B의 시드를 Base32로 적은 값입니다. */
const RFC_SEEDS: Readonly<Record<Algorithm, string>> = {
  sha1: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
  sha256: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA',
  sha512:
    'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA',
};

/** totp-cli 테스트가 쓰는 시크릿('82394783472398472348')입니다. */
const TOTP_CLI_TOKEN = 'HAZDGOJUG44DGNBXGIZTSOBUG4ZDGNBY';

function at(isoDate: string): number {
  return Date.parse(isoDate);
}

describe('generateCode', () => {
  it.each([
    { seconds: 59, sha1: '94287082', sha256: '46119246', sha512: '90693936' },
    { seconds: 1111111109, sha1: '07081804', sha256: '68084774', sha512: '25091201' },
    { seconds: 1111111111, sha1: '14050471', sha256: '67062674', sha512: '99943326' },
    { seconds: 1234567890, sha1: '89005924', sha256: '91819424', sha512: '93441116' },
    { seconds: 2000000000, sha1: '69279037', sha256: '90698825', sha512: '38618901' },
    { seconds: 20000000000, sha1: '65353130', sha256: '77737706', sha512: '47863826' },
  ])('matches the RFC 6238 test vectors at $seconds seconds', ({ seconds, ...expected }) => {
    for (const algorithm of ['sha1', 'sha256', 'sha512'] as const) {
      const { code } = generateCode(
        { token: RFC_SEEDS[algorithm], algorithm, length: 8, timePeriod: 30 },
        seconds * 1000,
      );
      expect(code, algorithm).toBe(expected[algorithm]);
    }
  });

  it.each([
    { when: '1970-01-01T00:00:59Z', code: '007459' },
    { when: '2005-03-18T01:58:29Z', code: '227921' },
    { when: '2009-02-13T23:31:30Z', code: '144100' },
    { when: '2603-10-11T11:33:20Z', code: '041334' },
  ])('matches the totp-cli test vectors at $when', ({ when, code }) => {
    expect(
      generateCode(
        { token: TOTP_CLI_TOKEN, algorithm: 'sha1', length: 6, timePeriod: 30 },
        at(when),
      ).code,
    ).toBe(code);
  });

  it('accepts tokens with spaces and lowercase letters, like totp-cli', () => {
    const { code } = generateCode(
      { token: '37kh vdxt c5hj ttfp ujok cipy jy', algorithm: 'sha1', length: 6, timePeriod: 30 },
      at('1970-01-01T00:00:59Z'),
    );

    expect(code).toBe('066634');
  });

  it('puts the prefix in front of the code', () => {
    const { code } = generateCode(
      { token: TOTP_CLI_TOKEN, algorithm: 'sha1', length: 6, timePeriod: 30, prefix: 'pin' },
      59_000,
    );

    expect(code).toBe('pin007459');
  });

  it('counts the seconds until the code changes', () => {
    const options = {
      token: TOTP_CLI_TOKEN,
      algorithm: 'sha1',
      length: 6,
      timePeriod: 30,
    } as const;

    expect(generateCode(options, 0).remaining).toBe(30);
    expect(generateCode(options, 59_999).remaining).toBe(1);
    expect(generateCode({ ...options, timePeriod: 60 }, 61_000).remaining).toBe(59);
  });
});

describe('decodeBase32', () => {
  it('ignores padding', () => {
    expect(decodeBase32('MZXW6===')).toEqual(Buffer.from('foo'));
  });

  it('names a character that is not Base32', () => {
    expect(() => decodeBase32('ABC1')).toThrow("'1' is not A-Z or 2-7");
  });

  it('rejects a token that was cut short', () => {
    expect(() => decodeBase32('ABC')).toThrow('check that it was copied completely');
  });
});
