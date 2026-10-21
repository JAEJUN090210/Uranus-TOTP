import { CommanderError } from 'commander';

import { Output } from '../ui/output';
import { isAbortError } from './errors';
import { COMMAND_GROUPS, type CommandGroup, createProgram } from './program';
import type { Runtime } from './runtime';

/** Ctrl+C로 취소된 명령의 종료 코드입니다. (128 + SIGINT) */
export const EXIT_INTERRUPTED = 130;

/** 인자를 한 번 실행하고 종료 코드를 돌려줍니다. 한 번 실행 모드와 대화형 셸이 함께 씁니다. */
export async function runCommand(
  args: readonly string[],
  runtime: Runtime,
  groups: readonly CommandGroup[] = COMMAND_GROUPS,
): Promise<number> {
  const program = createProgram(runtime, groups);
  try {
    await program.parseAsync(args, { from: 'user' });
    return runtime.exitCode;
  } catch (error) {
    // 도움말, 버전, 잘못된 인자는 commander가 이미 출력했으므로 종료 코드만 넘깁니다.
    if (error instanceof CommanderError) {
      return error.exitCode;
    }
    if (isAbortError(error)) {
      return EXIT_INTERRUPTED;
    }
    // UserError든 예상 못 한 에러든 스택 없이 메시지만 보여줍니다.
    new Output(runtime, program.opts()).error(
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}
