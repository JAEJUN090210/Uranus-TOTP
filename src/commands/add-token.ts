import { Command } from 'commander';

import { askIfMissing } from '../cli/ask';
import type { GlobalOptions } from '../cli/program';
import type { Runtime } from '../cli/runtime';
import { openStore } from '../cli/storage';
import {
  type Algorithm,
  DEFAULT_ALGORITHM,
  DEFAULT_LENGTH,
  DEFAULT_TIME_PERIOD,
} from '../core/storage/model';
import { addAccount } from '../core/storage/vault';
import { decodeBase32, normalizeToken } from '../core/totp';
import { Output } from '../ui/output';
import { algorithmOption, lengthOption, prefixOption, timePeriodOption } from './code-options';

interface AddTokenOptions {
  readonly length: number;
  readonly prefix: string;
  readonly algorithm: Algorithm;
  readonly timePeriod: number;
}

export function createAddTokenCommand(runtime: Runtime): Command {
  return new Command('add-token')
    .alias('add')
    .description('add an account; the token is asked so it stays out of your shell history')
    .argument('[namespace]', 'namespace of the account, created when it does not exist')
    .argument('[account]', 'name of the new account')
    .addOption(lengthOption().default(DEFAULT_LENGTH))
    .addOption(prefixOption().default(''))
    .addOption(algorithmOption().default(DEFAULT_ALGORITHM))
    .addOption(timePeriodOption().default(DEFAULT_TIME_PERIOD))
    .action(
      async (
        namespaceArgument: string | undefined,
        accountArgument: string | undefined,
        options: AddTokenOptions,
        command: Command,
      ) => {
        const globals = command.optsWithGlobals<GlobalOptions>();
        const output = new Output(runtime, globals);
        // totp-cli처럼 계정 정보를 먼저 묻고, 비밀번호는 저장소를 열 때 묻습니다.
        const namespace = await askIfMissing(runtime, namespaceArgument, 'namespace');
        const name = await askIfMissing(runtime, accountArgument, 'account');
        const token = normalizeToken(await runtime.prompt.secret('Token: '));
        // 잘못 옮겨 적은 시크릿은 저장하기 전에 알려줍니다.
        decodeBase32(token);

        const store = await openStore(runtime, output, { strength: globals.strength });
        addAccount(store.namespaces, namespace, {
          name,
          token,
          prefix: options.prefix,
          length: options.length,
          algorithm: options.algorithm,
          timePeriod: options.timePeriod,
        });
        await store.save();
        output.result({ namespace, account: name }, () => {
          output.success(`Added '${name}' to '${namespace}'`);
        });
      },
    );
}
