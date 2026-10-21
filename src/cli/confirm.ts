import { UserError } from './errors';
import type { Runtime } from './runtime';

/** y나 yes(대소문자 무관)만 동의로 봅니다. 그냥 Enter를 누르면 거절입니다. */
export function isYes(answer: string): boolean {
  return /^y(es)?$/i.test(answer.trim());
}

/**
 * 되돌릴 수 없는 일을 하기 전에 확인을 받습니다. 거절하면 UserError로 명령을 멈춥니다.
 * 파이프에서는 표준 입력의 다른 줄(비밀번호 등)을 답으로 잘못 읽지 않도록 묻지 않고 --yes를 요구합니다.
 */
export async function confirmOrStop(
  runtime: Runtime,
  question: string,
  cancelled: string,
): Promise<void> {
  if (!runtime.prompt.interactive) {
    throw new UserError(`${cancelled}: add --yes to go ahead without a terminal to ask in`);
  }
  if (!isYes(await runtime.prompt.line(question))) {
    throw new UserError(cancelled);
  }
}
