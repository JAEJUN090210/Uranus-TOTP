import { describe, expect, it } from 'vitest';

import type { Namespace } from '../../../src/core/storage/model';
import {
  addAccount,
  deleteAccount,
  deleteNamespace,
  findAccount,
  findNamespace,
  renameAccount,
  renameNamespace,
} from '../../../src/core/storage/vault';
import { account } from '../../helpers/store';

function sample(): Namespace[] {
  return [
    { name: 'work', accounts: [account('github'), account('gitlab')] },
    { name: 'home', accounts: [] },
  ];
}

function names(namespaces: readonly Namespace[]): string[] {
  return namespaces.flatMap((namespace) =>
    namespace.accounts.length === 0
      ? [namespace.name]
      : namespace.accounts.map((item) => `${namespace.name}/${item.name}`),
  );
}

describe('findAccount', () => {
  it('finds an account by namespace and name', () => {
    expect(findAccount(sample(), 'work', 'github').name).toBe('github');
  });

  it('says which namespace is missing', () => {
    expect(() => findNamespace(sample(), 'office')).toThrow("no namespace named 'office'");
  });

  it('says which account is missing and how to see the others', () => {
    expect(() => findAccount(sample(), 'work', 'vpn')).toThrow(
      "no account named 'vpn' in 'work' (run 'utc list work' to see them)",
    );
  });
});

describe('addAccount', () => {
  it('adds to an existing namespace or creates a new one', () => {
    const namespaces = sample();

    addAccount(namespaces, 'work', account('vpn'));
    addAccount(namespaces, 'office', account('mail'));

    expect(names(namespaces)).toEqual([
      'work/github',
      'work/gitlab',
      'work/vpn',
      'home',
      'office/mail',
    ]);
  });

  it('refuses a name that the namespace already has', () => {
    expect(() => {
      addAccount(sample(), 'work', account('github'));
    }).toThrow("'work' already has an account named 'github'");
  });
});

describe('renaming', () => {
  it('renames an account and a namespace', () => {
    const namespaces = sample();

    renameAccount(namespaces, 'work', 'github', 'gh');
    renameNamespace(namespaces, 'home', 'house');

    expect(names(namespaces)).toEqual(['work/gh', 'work/gitlab', 'house']);
  });

  it('allows keeping the same name', () => {
    const namespaces = sample();

    renameAccount(namespaces, 'work', 'github', 'github');
    renameNamespace(namespaces, 'work', 'work');

    expect(names(namespaces)).toEqual(names(sample()));
  });

  it('refuses names that are taken, unlike totp-cli', () => {
    expect(() => {
      renameAccount(sample(), 'work', 'github', 'gitlab');
    }).toThrow("'work' already has an account named 'gitlab'");
    expect(() => {
      renameNamespace(sample(), 'work', 'home');
    }).toThrow("a namespace named 'home' already exists");
  });
});

describe('deleting', () => {
  it('deletes an account and keeps its namespace even when it becomes empty', () => {
    const namespaces = sample();

    deleteAccount(namespaces, 'work', 'github');
    deleteAccount(namespaces, 'work', 'gitlab');

    expect(names(namespaces)).toEqual(['work', 'home']);
  });

  it('deletes a namespace with its accounts', () => {
    const namespaces = sample();

    deleteNamespace(namespaces, 'work');

    expect(names(namespaces)).toEqual(['home']);
  });

  it('reports what is missing', () => {
    expect(() => {
      deleteNamespace(sample(), 'office');
    }).toThrow("no namespace named 'office'");
    expect(() => {
      deleteAccount(sample(), 'work', 'vpn');
    }).toThrow("no account named 'vpn'");
  });
});
