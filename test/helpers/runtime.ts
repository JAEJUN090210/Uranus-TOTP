import { UserError } from '../../src/cli/errors';
import type { Prompt } from '../../src/cli/prompt';
import type { Runtime } from '../../src/cli/runtime';

export interface TestRuntimeOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly tty?: boolean;
  readonly signal?: AbortSignal;
  /** 질문에 차례로 돌려줄 답입니다. 다 쓰면 입력이 끝난 것처럼 UserError를 던집니다. */
  readonly answers?: readonly string[];
  /** 사람이 터미널에서 답하는 것처럼 할지 여부입니다. */
  readonly interactive?: boolean;
  /** `import -`처럼 표준 입력을 끝까지 읽을 때 돌려줄 내용입니다. */
  readonly input?: string;
}

/** 출력 내용을 문자열로 모으고, 질문에는 정해 둔 답을 주는 테스트용 실행 환경을 만듭니다. */
export function createTestRuntime(options: TestRuntimeOptions = {}) {
  let stdout = '';
  let stderr = '';
  const tty = options.tty ?? false;
  const answers = [...(options.answers ?? [])];
  const questions: string[] = [];
  const answer = (question: string): Promise<string> => {
    questions.push(question);
    const next = answers.shift();
    return next === undefined
      ? Promise.reject(new UserError(`no answer for '${question}'`))
      : Promise.resolve(next);
  };
  const prompt: Prompt = {
    interactive: options.interactive ?? false,
    line: async (question) => (await answer(question)).trim(),
    secret: answer,
    readAll: () => Promise.resolve(options.input ?? ''),
    close: () => undefined,
  };
  const runtime: Runtime = {
    stdout: {
      write: (text: string) => {
        stdout += text;
      },
      isTTY: tty,
      hasColors: () => tty,
    },
    stderr: {
      write: (text: string) => {
        stderr += text;
      },
      isTTY: tty,
      hasColors: () => tty,
    },
    env: options.env ?? {},
    platform: options.platform ?? 'linux',
    signal: options.signal ?? new AbortController().signal,
    prompt,
    exitCode: 0,
  };
  return { runtime, stdout: () => stdout, stderr: () => stderr, questions: () => questions };
}
