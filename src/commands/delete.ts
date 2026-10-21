import { Command } from 'commander';

import { confirmOrStop } from '../cli/confirm';
import type { GlobalOptions } from '../cli/program';
import type { Runtime } from '../cli/runtime';
import { openStore } from '../cli/storage';
import { deleteAccount, deleteNamespace, findAccount, findNamespace } from '../core/storage/vault';
import { Output } from '../ui/output';

interface DeleteOptions {
  readonly yes?: boolean;
}

export function createDeleteCommand(runtime: Runtime): Command {
  return new Command('delete')
    .description('delete an account, or a namespace with all of its accounts')
    .argument('<namespace>', 'namespace to delete, or the namespace of the account')
    .argument('[account]', 'account to delete')
    .option('-y, --yes', 'delete without asking')
    .action(
      async (
        namespace: string,
        account: string | undefined,
        options: DeleteOptions,
        command: Command,
      ) => {
        const globals = command.optsWithGlobals<GlobalOptions>();
        const output = new Output(runtime, globals);
        const store = await openStore(runtime, output, { strength: globals.strength });

        if (account !== undefined) {
          // 없는 계정이면 묻기 전에 알려줍니다.
          findAccount(store.namespaces, namespace, account);
          if (options.yes !== true) {
            await confirmOrStop(
              runtime,
              `Delete the account '${account}' in '${namespace}'? [y/N] `,
              'nothing was deleted',
            );
          }
          deleteAccount(store.namespaces, namespace, account);
          await store.save();
          output.result({ namespace, account, deleted: true }, () => {
            output.success(`Deleted '${account}' from '${namespace}'`);
          });
          return;
        }

        const { accounts } = findNamespace(store.namespaces, namespace);
        if (options.yes !== true) {
          // totp-cli처럼 함께 지워질 계정을 먼저 보여 줍니다.
          if (accounts.length > 0) {
            runtime.stderr.write(
              `'${namespace}' has ${accounts.length} account(s): ${accounts.map((item) => item.name).join(', ')}\n`,
            );
          }
          await confirmOrStop(
            runtime,
            `Delete the namespace '${namespace}' and all of its accounts? [y/N] `,
            'nothing was deleted',
          );
        }
        deleteNamespace(store.namespaces, namespace);
        await store.save();
        output.result({ namespace, deleted: true }, () => {
          output.success(`Deleted the namespace '${namespace}'`);
        });
      },
    );
}
