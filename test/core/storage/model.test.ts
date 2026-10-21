import { describe, expect, it } from 'vitest';

import { parseNamespaces, parseVaultData } from '../../../src/core/storage/model';

const TOKEN = 'JBSWY3DPEHPK3PXP';

describe('parseNamespaces', () => {
  it('fills in the defaults that totp-cli leaves empty', () => {
    const namespaces = parseNamespaces([
      {
        name: 'work',
        accounts: [{ name: 'github', token: TOKEN, length: 0, algorithm: '', timePeriod: 0 }],
      },
    ]);

    expect(namespaces).toEqual([
      {
        name: 'work',
        accounts: [
          {
            name: 'github',
            token: TOKEN,
            prefix: '',
            length: 6,
            algorithm: 'sha1',
            timePeriod: 30,
          },
        ],
      },
    ]);
  });

  it('keeps the options that are set', () => {
    const [namespace] = parseNamespaces([
      {
        name: 'bank',
        accounts: [
          {
            name: 'login',
            token: TOKEN,
            prefix: 'pin',
            length: 8,
            algorithm: 'sha256',
            timePeriod: 60,
          },
        ],
      },
    ]);

    expect(namespace?.accounts[0]).toEqual({
      name: 'login',
      token: TOKEN,
      prefix: 'pin',
      length: 8,
      algorithm: 'sha256',
      timePeriod: 60,
    });
  });

  it.each([
    { why: 'a value that is not a list', value: {}, message: 'expected a list of namespaces' },
    { why: 'a namespace without a name', value: [{ accounts: [] }], message: 'has no name' },
    {
      why: 'a namespace without accounts',
      value: [{ name: 'work' }],
      message: "namespace 'work' has no accounts list",
    },
    {
      why: 'an account without a token',
      value: [{ name: 'work', accounts: [{ name: 'github' }] }],
      message: "account 'github' has no token",
    },
    {
      why: 'a code length over 10',
      value: [{ name: 'work', accounts: [{ name: 'github', token: TOKEN, length: 11 }] }],
      message: 'must be a whole number from 1 to 10',
    },
    {
      why: 'an unknown algorithm',
      value: [{ name: 'work', accounts: [{ name: 'github', token: TOKEN, algorithm: 'md5' }] }],
      message: 'must be one of sha1, sha256, sha512',
    },
    {
      why: 'a negative time period',
      value: [{ name: 'work', accounts: [{ name: 'github', token: TOKEN, timePeriod: -30 }] }],
      message: 'must be a positive whole number of seconds',
    },
  ])('rejects $why', ({ value, message }) => {
    expect(() => parseNamespaces(value)).toThrow(message);
  });
});

describe('parseVaultData', () => {
  it('reads the namespaces of the decrypted file', () => {
    expect(parseVaultData({ namespaces: [] })).toEqual({ namespaces: [] });
  });

  it('rejects anything but an object', () => {
    expect(() => parseVaultData([])).toThrow('expected an object with a namespaces list');
  });
});
