import type { Store } from '../core/storage/store';
import type { Prompt } from './prompt';

/**
 * 대화형 셸에서 명령끼리 함께 쓰는 상태입니다. 잠금을 푼 저장소를 기억해 두어
 * 명령마다 비밀번호를 다시 묻지 않습니다. lock이나 자동 잠금이 store를 비웁니다.
 */
export interface Session {
  store?: Store;
}

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
  /** 대화형 셸에서만 있습니다. 한 번 실행 모드에서는 명령마다 저장소를 새로 엽니다. */
  readonly session?: Session;
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
