import type { Prompt } from './prompt';

export interface TextStream {
  write(text: string): unknown;
  readonly isTTY?: boolean;
  hasColors?(): boolean;
}

/** 명령이 실행되는 환경입니다. 테스트와 대화형 셸에서는 다른 값을 넣어 씁니다. */
export interface Runtime {
  readonly stdout: TextStream;
  readonly stderr: TextStream;
  readonly env: NodeJS.ProcessEnv;
  readonly platform: NodeJS.Platform;
  /** Ctrl+C를 누르면 abort됩니다. 오래 걸리는 명령은 이 신호를 보고 결과를 정리하며 끝내야 합니다. */
  readonly signal: AbortSignal;
  /** 사용자에게 값을 묻습니다. 터미널이면 사람에게 묻고, 파이프면 표준 입력을 한 줄씩 읽습니다. */
  readonly prompt: Prompt;
  /** 명령이 실패를 알릴 때 설정하는 종료 코드입니다. */
  exitCode: number;
}

export function createProcessRuntime(signal: AbortSignal, prompt: Prompt): Runtime {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    platform: process.platform,
    signal,
    prompt,
    exitCode: 0,
  };
}
