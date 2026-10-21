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

/** 계정을 추가합니다. 네임스페이스가 없으면 만들고, 같은 이름의 계정이 있으면 UserError를 던집니다. */
export function addAccount(namespaces: Namespace[], namespaceName: string, account: Account): void {
  let namespace = namespaces.find((item) => item.name === namespaceName);
  if (namespace === undefined) {
    namespace = { name: namespaceName, accounts: [] };
    namespaces.push(namespace);
  }
  if (namespace.accounts.some((item) => item.name === account.name)) {
    throw new UserError(`'${namespaceName}' already has an account named '${account.name}'`);
  }
  namespace.accounts.push(account);
}

/** 네임스페이스 이름을 바꿉니다. 이미 있는 이름으로는 바꾸지 않습니다. */
export function renameNamespace(
  namespaces: readonly Namespace[],
  name: string,
  newName: string,
): void {
  const namespace = findNamespace(namespaces, name);
  if (newName !== name && namespaces.some((item) => item.name === newName)) {
    throw new UserError(`a namespace named '${newName}' already exists`);
  }
  namespace.name = newName;
}

/** 계정 이름을 바꿉니다. 같은 네임스페이스에 이미 있는 이름으로는 바꾸지 않습니다. */
export function renameAccount(
  namespaces: readonly Namespace[],
  namespaceName: string,
  accountName: string,
  newName: string,
): void {
  const account = findAccount(namespaces, namespaceName, accountName);
  const { accounts } = findNamespace(namespaces, namespaceName);
  if (newName !== accountName && accounts.some((item) => item.name === newName)) {
    throw new UserError(`'${namespaceName}' already has an account named '${newName}'`);
  }
  account.name = newName;
}

/** 네임스페이스를 그 안의 계정까지 모두 지웁니다. */
export function deleteNamespace(namespaces: Namespace[], name: string): void {
  namespaces.splice(namespaces.indexOf(findNamespace(namespaces, name)), 1);
}

/** 계정 하나를 지웁니다. 네임스페이스는 비어도 남겨 둡니다. (totp-cli와 같습니다) */
export function deleteAccount(
  namespaces: readonly Namespace[],
  namespaceName: string,
  accountName: string,
): void {
  const account = findAccount(namespaces, namespaceName, accountName);
  const { accounts } = findNamespace(namespaces, namespaceName);
  accounts.splice(accounts.indexOf(account), 1);
}
