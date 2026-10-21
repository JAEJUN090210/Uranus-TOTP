import { describe, expect, it } from 'vitest';

import {
  deriveKey,
  type Envelope,
  isStrength,
  kdfParamsOf,
  newKdfParams,
  open,
  parseEnvelope,
  seal,
  strengthOf,
} from '../../../src/core/storage/crypto';

const PLAINTEXT = Buffer.from('{"namespaces":[]}', 'utf8');

async function sealWith(password: string) {
  const params = newKdfParams('fast');
  const key = await deriveKey(password, params);
  return { key, envelope: seal(PLAINTEXT, key, params) };
}

function withHeader(envelope: Envelope, kdf: Partial<Envelope['kdf']>): Envelope {
  return { ...envelope, kdf: { ...envelope.kdf, ...kdf } };
}

describe('seal and open', () => {
  it('opens what was sealed with the same password', async () => {
    const { envelope } = await sealWith('secret');

    const key = await deriveKey('secret', kdfParamsOf(envelope));

    expect(open(envelope, key)).toEqual(PLAINTEXT);
  });

  it('gives the same key for a password typed in NFC or NFD', async () => {
    const { envelope } = await sealWith('비밀번호');

    const key = await deriveKey('비밀번호'.normalize('NFD'), kdfParamsOf(envelope));

    expect(open(envelope, key)).toEqual(PLAINTEXT);
  });

  it('rejects a wrong password', async () => {
    const { envelope } = await sealWith('secret');

    const key = await deriveKey('wrong', kdfParamsOf(envelope));

    expect(() => open(envelope, key)).toThrow('wrong password, or the credentials file is damaged');
  });

  it('rejects a file whose header was changed', async () => {
    const { key, envelope } = await sealWith('secret');

    expect(() => open(withHeader(envelope, { logN: 16 }), key)).toThrow('wrong password');
  });

  it('uses a new IV every time', async () => {
    const params = newKdfParams('fast');
    const key = await deriveKey('secret', params);

    expect(seal(PLAINTEXT, key, params).cipher.iv).not.toBe(seal(PLAINTEXT, key, params).cipher.iv);
  });
});

describe('parseEnvelope', () => {
  it('reads what seal wrote', async () => {
    const { envelope } = await sealWith('secret');

    expect(parseEnvelope(JSON.stringify(envelope))).toEqual(envelope);
  });

  it.each(['hello', '{}', '{"format":"something-else"}'])('rejects other files: %s', (text) => {
    expect(() => parseEnvelope(text)).toThrow('the credentials file is not a Uranus-TOTP file');
  });

  it('asks to update utc for a newer format', () => {
    expect(() => parseEnvelope('{"format":"uranus-totp","version":2}')).toThrow('update utc');
  });

  it.each([
    { why: 'too much scrypt memory', change: { logN: 40 } },
    { why: 'a short salt', change: { salt: 'AAAA' } },
  ])('rejects a damaged header: $why', async ({ change }) => {
    const { envelope } = await sealWith('secret');

    expect(() => parseEnvelope(JSON.stringify(withHeader(envelope, change)))).toThrow(
      'the credentials file is damaged',
    );
  });
});

describe('strengths', () => {
  it('maps each strength to a scrypt cost and back', () => {
    expect(newKdfParams('fast').logN).toBe(15);
    expect(newKdfParams('normal').logN).toBe(17);
    expect(newKdfParams('strong').logN).toBe(18);
    expect(strengthOf(17)).toBe('normal');
    expect(strengthOf(16)).toBeUndefined();
  });

  it('accepts only the three strength names', () => {
    expect(isStrength('fast')).toBe(true);
    expect(isStrength('toString')).toBe(false);
    expect(isStrength(17)).toBe(false);
  });
});
