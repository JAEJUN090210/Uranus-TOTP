import { describe, expect, it } from 'vitest';

import { confirmOrStop, isYes } from '../../src/cli/confirm';
import { createTestRuntime } from '../helpers/runtime';

describe('isYes', () => {
  it.each(['y', 'Y', 'yes', 'YES', ' yes '])('accepts %j', (answer) => {
    expect(isYes(answer)).toBe(true);
  });

  it.each(['', 'n', 'no', 'yeah', 'sure'])('refuses %j', (answer) => {
    expect(isYes(answer)).toBe(false);
  });
});

describe('confirmOrStop', () => {
  it('goes ahead on yes', async () => {
    const { runtime } = createTestRuntime({ interactive: true, answers: ['y'] });

    await expect(confirmOrStop(runtime, 'Delete? ', 'cancelled')).resolves.toBeUndefined();
  });

  it('stops on anything else', async () => {
    const { runtime } = createTestRuntime({ interactive: true, answers: ['n'] });

    await expect(confirmOrStop(runtime, 'Delete? ', 'cancelled')).rejects.toThrow('cancelled');
  });

  it('asks for --yes instead of reading standard input in a pipe', async () => {
    const { runtime, questions } = createTestRuntime({ answers: ['y'] });

    await expect(confirmOrStop(runtime, 'Delete? ', 'cancelled')).rejects.toThrow(
      'cancelled: add --yes',
    );
    expect(questions()).toEqual([]);
  });
});
