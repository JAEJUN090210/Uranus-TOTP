/** 사용자가 고칠 수 있는 문제(잘못된 입력, 없는 계정, 틀린 비밀번호 등)입니다. 스택 없이 메시지만 보여줍니다. */
export class UserError extends Error {
  override name = 'UserError';
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
