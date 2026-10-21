import { Command, Option } from 'commander';

import { parseCodeLength, parsePositiveInteger } from '../cli/parsers';
import type { Runtime } from '../cli/runtime';
import { type Clock, systemClock } from '../core/clock';
import {
  type Algorithm,
  ALGORITHMS,
  DEFAULT_ALGORITHM,
  DEFAULT_LENGTH,
  DEFAULT_TIME_PERIOD,
} from '../core/storage/model';
import { Output } from '../ui/output';
import { printCodes } from './code-format';

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
    .addOption(
      new Option('--length <digits>', 'length of the code')
        .argParser(parseCodeLength)
        .default(DEFAULT_LENGTH),
    )
    .addOption(
      new Option('--algorithm <name>', 'HMAC algorithm')
        .choices(ALGORITHMS)
        .default(DEFAULT_ALGORITHM),
    )
    .addOption(
      new Option('--time-period <seconds>', 'how many seconds each code stays valid')
        .argParser(parsePositiveInteger)
        .default(DEFAULT_TIME_PERIOD),
    )
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
