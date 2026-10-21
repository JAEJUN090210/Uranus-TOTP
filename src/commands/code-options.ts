import { Option } from 'commander';

import { parseCodeLength, parsePositiveInteger } from '../cli/parsers';
import { type Algorithm, ALGORITHMS } from '../core/storage/model';

/**
 * 코드 모양을 정하는 옵션입니다. instant와 add-token은 .default()로 기본값을 붙여 쓰고,
 * update는 준 옵션만 바꾸도록 기본값 없이 씁니다.
 */
export interface CodeOptions {
  readonly length?: number;
  readonly algorithm?: Algorithm;
  readonly timePeriod?: number;
  readonly prefix?: string;
}

export function lengthOption(): Option {
  return new Option('--length <digits>', 'length of the code, from 1 to 10').argParser(
    parseCodeLength,
  );
}

export function algorithmOption(): Option {
  return new Option('--algorithm <name>', 'HMAC algorithm').choices(ALGORITHMS);
}

export function timePeriodOption(): Option {
  return new Option('--time-period <seconds>', 'how many seconds each code stays valid').argParser(
    parsePositiveInteger,
  );
}

export function prefixOption(): Option {
  return new Option('--prefix <text>', 'text to put in front of the code');
}
