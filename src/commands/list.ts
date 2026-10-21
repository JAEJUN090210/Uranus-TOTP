import { Command } from 'commander';

import type { GlobalOptions } from '../cli/program';
import type { Runtime } from '../cli/runtime';
import { openStore } from '../cli/storage';
import type { Account, Namespace } from '../core/storage/model';
import { findNamespace } from '../core/storage/vault';
import { Output } from '../ui/output';
import type { Column } from '../ui/table';
import { describeAccount } from './account-format';

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

const NAMESPACE_COLUMNS: readonly Column<Namespace>[] = [
  { header: 'NAMESPACE', value: (namespace) => namespace.name },
  { header: 'ACCOUNTS', value: (namespace) => String(namespace.accounts.length) },
];

const ACCOUNT_COLUMNS: readonly Column<Account>[] = [
  { header: 'ACCOUNT', value: (account) => account.name },
  { header: 'LENGTH', value: (account) => String(account.length) },
  { header: 'ALGORITHM', value: (account) => account.algorithm },
  { header: 'PERIOD', value: (account) => `${account.timePeriod}s` },
  { header: 'PREFIX', value: (account) => (account.prefix === '' ? '-' : account.prefix) },
];

export function createListCommand(runtime: Runtime): Command {
  return new Command('list')
    .description('list the namespaces, or the accounts in a namespace')
    .argument('[namespace]', 'namespace whose accounts to list')
    .action(async (namespaceName: string | undefined, _options: unknown, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const output = new Output(runtime, globals);
      const store = await openStore(runtime, output, { strength: globals.strength });

      if (namespaceName === undefined) {
        const namespaces = [...store.namespaces].sort(byName);
        output.result(
          namespaces.map((namespace) => ({
            name: namespace.name,
            accounts: namespace.accounts.length,
          })),
          () => {
            if (namespaces.length === 0) {
              output.hint("No accounts yet. Add one with 'utc add-token'.");
            } else {
              output.table(namespaces, NAMESPACE_COLUMNS);
            }
          },
        );
        return;
      }

      const namespace = findNamespace(store.namespaces, namespaceName);
      const accounts = [...namespace.accounts].sort(byName);
      output.result({ name: namespace.name, accounts: accounts.map(describeAccount) }, () => {
        if (accounts.length === 0) {
          output.hint(`'${namespace.name}' has no accounts.`);
        } else {
          output.table(accounts, ACCOUNT_COLUMNS);
        }
      });
    });
}
