import { Command } from 'commander';

import type { GlobalOptions } from '../cli/program';
import type { Runtime } from '../cli/runtime';
import { askNewPassword, chooseStrength, openStore } from '../cli/storage';
import { DEFAULT_STRENGTH } from '../core/storage/crypto';
import { Output } from '../ui/output';

export function createChangePasswordCommand(runtime: Runtime): Command {
  return new Command('change-password')
    .description('change the password, and choose the strength again')
    .action(async (_options: unknown, command: Command) => {
      const globals = command.optsWithGlobals<GlobalOptions>();
      const output = new Output(runtime, globals);
      const store = await openStore(runtime, output, { strength: globals.strength });
      const strength =
        globals.strength ?? (await chooseStrength(runtime, store.strength ?? DEFAULT_STRENGTH));
      // UTC_PASS는 지금 비밀번호이므로 새 비밀번호로 쓰지 않고 따로 묻습니다.
      const password = await askNewPassword(runtime, { useEnv: false });
      await store.changePassword(password, strength);
      output.result({ strength }, () => {
        output.success(`Changed the password (strength: ${strength})`);
        output.hint('Do not forget the new password. There is no way to recover it.');
      });
    });
}
