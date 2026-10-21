import { Command } from 'commander';

import { askIfMissing } from '../cli/ask';
import type { GlobalOptions } from '../cli/program';
import type { Runtime } from '../cli/runtime';
import { openStore } from '../cli/storage';
import { findAccount } from '../core/storage/vault';
import { Output } from '../ui/output';
import { describeAccount } from './account-format';

interface SetPrefixOptions {
  readonly clear?: boolean;
}

export function createSetPrefixCommand(runtime: Runtime): Command {
  return new Command('set-prefix')
    .description('set the text put in front of the code of an account')
    .argument('[namespace]', 'namespace of the account')
    .argument('[account]', 'name of the account')
    .argument('[prefix]', 'new prefix')
    .option('--clear', 'remove the prefix')
    .action(
      async (
        namespaceArgument: string | undefined,
        accountArgument: string | undefined,
        prefixArgument: string | undefined,
        options: SetPrefixOptions,
        command: Command,
      ) => {
        const namespace = await askIfMissing(runtime, namespaceArgument, 'namespace');
        const name = await askIfMissing(runtime, accountArgument, 'account');
        const prefix =
          options.clear === true ? '' : await askIfMissing(runtime, prefixArgument, 'prefix');

        const globals = command.optsWithGlobals<GlobalOptions>();
        const output = new Output(runtime, globals);
        const store = await openStore(runtime, output, { strength: globals.strength });
        const account = findAccount(store.namespaces, namespace, name);
        account.prefix = prefix;
        await store.save();
        // 접두어는 PIN일 수도 있으므로 화면에 다시 보여 주지 않습니다.
        output.result({ namespace, account: describeAccount(account) }, () => {
          output.success(
            prefix === ''
              ? `Removed the prefix of '${name}' in '${namespace}'`
              : `Set the prefix of '${name}' in '${namespace}'`,
          );
        });
      },
    );
}
