import { Command } from 'commander';

import { UserError } from '../cli/errors';
import type { GlobalOptions } from '../cli/program';
import type { Runtime } from '../cli/runtime';
import { openStore } from '../cli/storage';
import { findAccount } from '../core/storage/vault';
import { Output } from '../ui/output';
import { describeAccount } from './account-format';
import {
  algorithmOption,
  type CodeOptions,
  lengthOption,
  prefixOption,
  timePeriodOption,
} from './code-options';

export function createUpdateCommand(runtime: Runtime): Command {
  return new Command('update')
    .description('change the code options of an account; only the options given are changed')
    .argument('<namespace>', 'namespace of the account')
    .argument('<account>', 'name of the account')
    .addOption(lengthOption())
    .addOption(prefixOption())
    .addOption(algorithmOption())
    .addOption(timePeriodOption())
    .action(async (namespace: string, name: string, options: CodeOptions, command: Command) => {
      // 바꿀 것이 없으면 비밀번호를 묻기 전에 알려줍니다.
      if (Object.values(options).every((value) => value === undefined)) {
        throw new UserError(
          'nothing to update: give --length, --prefix, --algorithm or --time-period',
        );
      }
      const globals = command.optsWithGlobals<GlobalOptions>();
      const output = new Output(runtime, globals);
      const store = await openStore(runtime, output, { strength: globals.strength });
      const account = findAccount(store.namespaces, namespace, name);
      if (options.length !== undefined) {
        account.length = options.length;
      }
      if (options.prefix !== undefined) {
        account.prefix = options.prefix;
      }
      if (options.algorithm !== undefined) {
        account.algorithm = options.algorithm;
      }
      if (options.timePeriod !== undefined) {
        account.timePeriod = options.timePeriod;
      }
      await store.save();
      output.result({ namespace, account: describeAccount(account) }, () => {
        output.success(`Updated '${name}' in '${namespace}'`);
      });
    });
}
