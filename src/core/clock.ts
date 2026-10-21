import { setTimeout } from 'node:timers/promises';

/** 현재 시각과 기다리기입니다. 테스트에서는 시간을 마음대로 움직이는 가짜를 넣어 씁니다. */
export interface Clock {
  /** 밀리초 단위의 현재 시각입니다. */
  now(): number;
  /** ms만큼 기다립니다. signal이 abort되면 AbortError로 거부됩니다. */
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) => setTimeout(ms, undefined, { signal }),
};
