import { isAbortError } from '../cli/errors';
import type { Clock } from '../core/clock';
import { type Code, generateCode, type TotpOptions } from '../core/totp';
import type { Output } from '../ui/output';

/** totp-cli와 같은 형식입니다. --show-remaining이면 남은 시간을 붙입니다. */
export function formatCode(code: Code, showRemaining: boolean): string {
  return showRemaining ? `${code.code} (remaining time: ${code.remaining}s)` : code.code;
}

export interface PrintCodesOptions {
  readonly showRemaining: boolean;
  readonly follow: boolean;
  /** JSON에 코드와 함께 적을 값입니다. (예: 네임스페이스와 계정 이름) */
  readonly fields?: Readonly<Record<string, string>>;
}

/** 코드를 출력합니다. follow면 Ctrl+C로 멈출 때까지 코드가 바뀔 때마다 한 줄씩 더 출력합니다. */
export async function printCodes(
  output: Output,
  totp: TotpOptions,
  clock: Clock,
  signal: AbortSignal,
  options: PrintCodesOptions,
): Promise<void> {
  const print = (code: Code) => {
    const data = { ...options.fields, ...code };
    const render = () => {
      output.line(formatCode(code, options.showRemaining));
    };
    if (options.follow) {
      output.stream(data, render);
    } else {
      output.result(data, render);
    }
  };

  let current = generateCode(totp, clock.now());
  print(current);
  if (!options.follow) {
    return;
  }

  const period = totp.timePeriod * 1000;
  while (!signal.aborted) {
    // 코드는 시간 간격의 배수가 되는 시각에 바뀝니다. 그때까지 기다렸다가 조금 늦게 깨어나도 되도록 여유를 둡니다.
    try {
      await clock.sleep(period - (clock.now() % period) + 10, signal);
    } catch (error) {
      // Ctrl+C는 --follow를 멈추는 정상적인 방법이므로 에러 없이 끝냅니다.
      if (isAbortError(error)) {
        return;
      }
      throw error;
    }
    const next = generateCode(totp, clock.now());
    if (next.code !== current.code) {
      print(next);
    }
    current = next;
  }
}
