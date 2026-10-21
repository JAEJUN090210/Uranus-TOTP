import type { Account } from '../core/storage/model';

/** 계정을 보여 줄 때 쓰는 값입니다. 시크릿은 dump로만 꺼낼 수 있도록 넣지 않습니다. */
export function describeAccount(account: Account) {
  return {
    name: account.name,
    length: account.length,
    algorithm: account.algorithm,
    timePeriod: account.timePeriod,
    prefix: account.prefix,
  };
}
