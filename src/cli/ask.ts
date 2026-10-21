import { UserError } from './errors';
import type { Runtime } from './runtime';

/**
 * 인자로 받지 못한 값을 묻습니다. totp-cli처럼 빠진 인자만 차례로 묻고, 빈 값은 받지 않습니다.
 * label은 질문과 에러에 쓰는 이름입니다. (예: 'namespace' → "Namespace: ")
 */
export async function askIfMissing(
  runtime: Runtime,
  value: string | undefined,
  label: string,
): Promise<string> {
  if (value !== undefined && value !== '') {
    return value;
  }
  const answer = await runtime.prompt.line(`${label.charAt(0).toUpperCase()}${label.slice(1)}: `);
  if (answer === '') {
    throw new UserError(`the ${label} must not be empty`);
  }
  return answer;
}
