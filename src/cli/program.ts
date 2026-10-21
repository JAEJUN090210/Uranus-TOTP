import { Command, Option } from 'commander';

import pkg from '../../package.json' with { type: 'json' };
import { STRENGTH_NAMES } from '../core/storage/crypto';
import { createColors, shouldUseColor } from '../ui/colors';
import type { Runtime } from './runtime';

export type CommandFactory = (runtime: Runtime) => Command;

export interface CommandGroup {
  readonly heading: string;
  readonly commands: readonly CommandFactory[];
}

/** 도움말에 보여줄 명령 분류입니다. 새 명령은 알맞은 분류의 commands에 추가합니다. */
export const COMMAND_GROUPS: readonly CommandGroup[] = [
  { heading: 'Codes:', commands: [] },
  { heading: 'Accounts:', commands: [] },
  { heading: 'Storage:', commands: [] },
];

export function createProgram(
  runtime: Runtime,
  groups: readonly CommandGroup[] = COMMAND_GROUPS,
): Command {
  const errorColors = createColors(shouldUseColor(runtime.stderr, runtime.env));
  const program = new Command('utc')
    .description(pkg.description)
    .version(pkg.version)
    .option('--json', 'print results as JSON')
    // 저장소는 어느 명령에서든 처음 쓸 때 만들어지므로 강도는 전역 옵션으로 받습니다.
    .addOption(
      new Option(
        '--strength <level>',
        'how hard a new credentials file or password is to guess',
      ).choices(STRENGTH_NAMES),
    )
    // 대화형 셸 안에서도 쓸 수 있도록 commander가 프로세스를 끝내는 대신 예외를 던지게 합니다.
    .exitOverride()
    .configureOutput({
      writeOut: (text) => runtime.stdout.write(text),
      writeErr: (text) => runtime.stderr.write(text),
      outputError: (text, write) => {
        write(errorColors.red(text));
      },
    })
    .showHelpAfterError("(run 'utc --help' for usage)");

  for (const group of groups) {
    program.commandsGroup(group.heading);
    for (const createCommand of group.commands) {
      // addCommand는 .command()와 달리 부모 설정을 물려주지 않으므로 직접 복사합니다.
      program.addCommand(createCommand(runtime).copyInheritedSettings(program));
    }
  }
  return program;
}
