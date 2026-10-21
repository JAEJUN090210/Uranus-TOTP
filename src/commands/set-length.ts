import { Argument, Command } from 'commander';

import { askIfMissing } from '../cli/ask';
import { UserError } from '../cli/errors';
import { parseCodeLength } from '../cli/parsers';
import type { GlobalOptions } from '../cli/program';
import type { Runtime } from '../cli/runtime';
import { openStore } from '../cli/storage';
import { MAX_LENGTH, MIN_LENGTH } from '../core/storage/model';
import { findAccount } from '../core/storage/vault';
import { Output } from '../ui/output';
import { describeAccount } from './account-format';

/** 입력으로 받은 길이를 확인합니다. 인자로 받은 길이는 commander가 parseCodeLength로 확인합니다. */
function toLength(text: string): number {
  try {
    return parseCodeLength(text);
  } catch {
    throw new UserError(`the length must be a whole number from ${MIN_LENGTH} to ${MAX_LENGTH}`);
  }
}

export function createSetLengthCommand(runtime: Runtime): Command {
  return new Command('set-length')
    .description('set the length of the code of an account')
    .argument('[namespace]', 'namespace of the account')
    .argument('[account]', 'name of the account')
    .addArgument(
      new Argument('[length]', 'new length of the code, from 1 to 10').argParser(parseCodeLength),
    )
    .action(
      async (
        namespaceArgument: string | undefined,
        accountArgument: string | undefined,
        lengthArgument: number | undefined,
        _options: unknown,
        command: Command,
      ) => {
        const namespace = await askIfMissing(runtime, namespaceArgument, 'namespace');
        const name = await askIfMissing(runtime, accountArgument, 'account');
        const length = lengthArgument ?? toLength(await askIfMissing(runtime, undefined, 'length'));

        const globals = command.optsWithGlobals<GlobalOptions>();
        const output = new Output(runtime, globals);
        const store = await openStore(runtime, output, { strength: globals.strength });
        const account = findAccount(store.namespaces, namespace, name);
        account.length = length;
        await store.save();
        output.result({ namespace, account: describeAccount(account) }, () => {
          output.success(`Set the code length of '${name}' in '${namespace}' to ${length}`);
        });
      },
    );
}
