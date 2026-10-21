import { Command } from 'commander';

import type { Runtime } from '../cli/runtime';
import { type Clock, systemClock } from '../core/clock';
import {
  type Algorithm,
  DEFAULT_ALGORITHM,
  DEFAULT_LENGTH,
  DEFAULT_TIME_PERIOD,
} from '../core/storage/model';
import { Output } from '../ui/output';
import { printCodes } from './code-format';
import { algorithmOption, lengthOption, timePeriodOption } from './code-options';

/** instant가 시크릿을 읽는 환경 변수입니다. 없으면 입력으로 받습니다. */
export const TOKEN_ENV = 'UTC_TOKEN';

interface InstantOptions {
  readonly length: number;
  readonly algorithm: Algorithm;
  readonly timePeriod: number;
  readonly showRemaining?: boolean;
}

export function createInstantCommand(runtime: Runtime, clock: Clock = systemClock): Command {
  return new Command('instant')
    .description(`generate a code from ${TOKEN_ENV} or standard input without saving the token`)
    .addOption(lengthOption().default(DEFAULT_LENGTH))
    .addOption(algorithmOption().default(DEFAULT_ALGORITHM))
    .addOption(timePeriodOption().default(DEFAULT_TIME_PERIOD))
    .option('--show-remaining', 'also show how many seconds the code stays valid')
    .action(async (options: InstantOptions, command: Command) => {
      const output = new Output(runtime, command.optsWithGlobals());
      const fromEnv = runtime.env[TOKEN_ENV];
      // 시크릿이 셸 기록에 남지 않도록 인자로는 받지 않습니다.
      const token =
        fromEnv !== undefined && fromEnv !== '' ? fromEnv : await runtime.prompt.secret('Token: ');
      await printCodes(
        output,
        {
          token,
          algorithm: options.algorithm,
          length: options.length,
          timePeriod: options.timePeriod,
        },
        clock,
        runtime.signal,
        { showRemaining: options.showRemaining === true, follow: false },
      );
    });
}
