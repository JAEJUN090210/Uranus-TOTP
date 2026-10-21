import { runCommand } from '../../src/cli/run';
import { createTestRuntime, type TestRuntimeOptions } from './runtime';

/** 실제 명령 목록으로 인자를 실행하고, 종료 코드와 출력과 받은 질문을 돌려줍니다. */
export async function runUtc(args: readonly string[], options: TestRuntimeOptions = {}) {
  const { runtime, stdout, stderr, questions } = createTestRuntime(options);
  const code = await runCommand(args, runtime);
  return { code, stdout: stdout(), stderr: stderr(), questions: questions() };
}
