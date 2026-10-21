import { UserError } from '../../cli/errors';
import type { Account, Namespace } from './model';

/** 이름으로 네임스페이스를 찾습니다. 없으면 UserError를 던집니다. */
export function findNamespace(namespaces: readonly Namespace[], name: string): Namespace {
  const namespace = namespaces.find((item) => item.name === name);
  if (namespace === undefined) {
    throw new UserError(`no namespace named '${name}' (run 'utc list' to see them)`);
  }
  return namespace;
}

/** 네임스페이스와 계정 이름으로 계정을 찾습니다. 없으면 UserError를 던집니다. */
export function findAccount(
  namespaces: readonly Namespace[],
  namespaceName: string,
  accountName: string,
): Account {
  const account = findNamespace(namespaces, namespaceName).accounts.find(
    (item) => item.name === accountName,
  );
  if (account === undefined) {
    throw new UserError(
      `no account named '${accountName}' in '${namespaceName}' (run 'utc list ${namespaceName}' to see them)`,
    );
  }
  return account;
}
