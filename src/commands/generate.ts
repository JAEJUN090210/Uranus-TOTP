import { Command } from 'commander';

import type { GlobalOptions } from '../cli/program';
import type { Runtime } from '../cli/runtime';
import { openStore } from '../cli/storage';
import { type Clock, systemClock } from '../core/clock';
import { findAccount } from '../core/storage/vault';
import { Output } from '../ui/output';
import { printCodes } from './code-format';

interface GenerateOptions {
  readonly showRemaining?: boolean;
  readonly follow?: boolean;
}

export function createGenerateCommand(runtime: Runtime, clock: Clock = systemClock): Command {
  return new Command('generate')
    .alias('g')
    .description('generate the code of a saved account')
    .argument('<namespace>', 'namespace of the account')
    .argument('<account>', 'name of the account')
    .option('--show-remaining', 'also show how many seconds the code stays valid')
    .option('--follow', 'print a new code every time it changes, until Ctrl+C')
    .action(
      async (namespace: string, account: string, options: GenerateOptions, command: Command) => {
        const globals = command.optsWithGlobals<GlobalOptions>();
        const output = new Output(runtime, globals);
        const store = await openStore(runtime, output, { strength: globals.strength });
        await printCodes(
          output,
          findAccount(store.namespaces, namespace, account),
          clock,
          runtime.signal,
          {
            showRemaining: options.showRemaining === true,
            follow: options.follow === true,
            fields: { namespace, account },
          },
        );
      },
    );
}
