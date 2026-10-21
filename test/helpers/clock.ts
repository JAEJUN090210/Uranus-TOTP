import type { Clock } from '../../src/core/clock';

/**
 * 기다리는 동안 시간을 그만큼 앞으로 옮기는 가짜 시계입니다.
 * stopAfter번 기다리고 나면 controller를 abort해서 Ctrl+C를 누른 것처럼 만듭니다.
 */
export function createFakeClock(start: number, controller?: AbortController, stopAfter = 0) {
  let now = start;
  const waits: number[] = [];
  const clock: Clock = {
    now: () => now,
    sleep: (ms, signal) => {
      if (signal.aborted) {
        return Promise.reject(new DOMException('cancelled', 'AbortError'));
      }
      waits.push(ms);
      now += ms;
      if (controller !== undefined && waits.length > stopAfter) {
        controller.abort();
        return Promise.reject(new DOMException('cancelled', 'AbortError'));
      }
      return Promise.resolve();
    },
  };
  return { clock, waits: () => waits };
}
