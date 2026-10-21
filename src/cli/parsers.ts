import { InvalidArgumentError } from 'commander';

import { MAX_LENGTH, MIN_LENGTH } from '../core/storage/model';

export function parsePositiveInteger(value: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new InvalidArgumentError('must be a positive integer.');
  }
  return number;
}

/** 코드 길이입니다. 코드는 31비트 정수에서 자르므로 10자리까지만 받습니다. */
export function parseCodeLength(value: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < MIN_LENGTH || number > MAX_LENGTH) {
    throw new InvalidArgumentError(`must be a whole number from ${MIN_LENGTH} to ${MAX_LENGTH}.`);
  }
  return number;
}
