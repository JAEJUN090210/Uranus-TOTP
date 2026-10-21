import { describe, expect, it } from 'vitest';

import type { Namespace } from '../../../src/core/storage/model';
import { findAccount, findNamespace } from '../../../src/core/storage/vault';

const NAMESPACES: Namespace[] = [
  {
    name: 'work',
    accounts: [
      {
        name: 'github',
        token: 'JBSWY3DPEHPK3PXP',
        prefix: '',
        length: 6,
        algorithm: 'sha1',
        timePeriod: 30,
      },
    ],
  },
];

describe('findAccount', () => {
  it('finds an account by namespace and name', () => {
    expect(findAccount(NAMESPACES, 'work', 'github').token).toBe('JBSWY3DPEHPK3PXP');
  });

  it('says which namespace is missing', () => {
    expect(() => findNamespace(NAMESPACES, 'home')).toThrow("no namespace named 'home'");
  });

  it('says which account is missing and how to see the others', () => {
    expect(() => findAccount(NAMESPACES, 'work', 'gitlab')).toThrow(
      "no account named 'gitlab' in 'work' (run 'utc list work' to see them)",
    );
  });
});
