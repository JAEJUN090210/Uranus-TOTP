import { Command } from 'commander';

import { askIfMissing } from '../cli/ask';
import type { GlobalOptions } from '../cli/program';
import type { Runtime } from '../cli/runtime';
import { openStore } from '../cli/storage';
import { renameAccount, renameNamespace } from '../core/storage/vault';
import { Output } from '../ui/output';

function createRenameAccountCommand(runtime: Runtime): Command {
  return new Command('account')
    .description('rename an account')
    .argument('[namespace]', 'namespace of the account')
    .argument('[account]', 'current name of the account')
    .argument('[new name]', 'new name of the account')
    .action(
      async (
        namespaceArgument: string | undefined,
        accountArgument: string | undefined,
        newNameArgument: string | undefined,
        _options: unknown,
        command: Command,
      ) => {
        const namespace = await askIfMissing(runtime, namespaceArgument, 'namespace');
        const name = await askIfMissing(runtime, accountArgument, 'account');
        const newName = await askIfMissing(runtime, newNameArgument, 'new name');

        const globals = command.optsWithGlobals<GlobalOptions>();
        const output = new Output(runtime, globals);
        const store = await openStore(runtime, output, { strength: globals.strength });
        renameAccount(store.namespaces, namespace, name, newName);
        await store.save();
        output.result({ namespace, account: name, newName }, () => {
          output.success(`Renamed '${name}' in '${namespace}' to '${newName}'`);
        });
      },
    );
}

function createRenameNamespaceCommand(runtime: Runtime): Command {
  return new Command('namespace')
    .description('rename a namespace')
    .argument('[namespace]', 'current name of the namespace')
    .argument('[new name]', 'new name of the namespace')
    .action(
      async (
        namespaceArgument: string | undefined,
        newNameArgument: string | undefined,
        _options: unknown,
        command: Command,
      ) => {
        const namespace = await askIfMissing(runtime, namespaceArgument, 'namespace');
        const newName = await askIfMissing(runtime, newNameArgument, 'new name');

        const globals = command.optsWithGlobals<GlobalOptions>();
        const output = new Output(runtime, globals);
        const store = await openStore(runtime, output, { strength: globals.strength });
        renameNamespace(store.namespaces, namespace, newName);
        await store.save();
        output.result({ namespace, newName }, () => {
          output.success(`Renamed the namespace '${namespace}' to '${newName}'`);
        });
      },
    );
}

export function createRenameCommand(runtime: Runtime): Command {
  return new Command('rename')
    .description('rename an account or a namespace')
    .addCommand(createRenameAccountCommand(runtime))
    .addCommand(createRenameNamespaceCommand(runtime));
}
