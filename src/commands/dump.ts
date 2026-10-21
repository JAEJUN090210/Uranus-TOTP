import { writeFile } from 'node:fs/promises';

import { Command } from 'commander';

import { UserError } from '../cli/errors';
import type { GlobalOptions } from '../cli/program';
import type { Runtime } from '../cli/runtime';
import { openStore } from '../cli/storage';
import { Output } from '../ui/output';

/** 내보낸 파일에는 시크릿이 그대로 들어 있으므로 본인만 읽고 쓸 수 있게 만듭니다. (totp-cli와 같습니다) */
const DUMP_FILE_MODE = 0o600;

interface DumpOptions {
  readonly yes?: boolean;
}

export function createDumpCommand(runtime: Runtime): Command {
  return new Command('dump')
    .description('export every account, tokens included, to a JSON file that is NOT encrypted')
    .argument('<file>', "file to write, or '-' for standard output")
    .option('-y, --yes', 'confirm that the tokens are written without encryption')
    .action(async (file: string, options: DumpOptions, command: Command) => {
      if (options.yes !== true) {
        throw new UserError('dump writes every token without encryption; add --yes to go ahead');
      }
      const globals = command.optsWithGlobals<GlobalOptions>();
      // 표준 출력으로 내보낼 때는 다른 안내가 섞이지 않도록 JSON 모드처럼 상태 줄을 감춥니다.
      const toStdout = file === '-';
      const output = new Output(runtime, { ...globals, json: globals.json === true || toStdout });
      const store = await openStore(runtime, output, { strength: globals.strength });
      // 키 이름과 구조는 totp-cli의 dump(YAML)와 같습니다.
      const text = `${JSON.stringify(store.namespaces, null, 2)}\n`;
      if (toStdout) {
        runtime.stdout.write(text);
        return;
      }

      await writeFile(file, text, { mode: DUMP_FILE_MODE });
      const accounts = store.namespaces.reduce(
        (total, namespace) => total + namespace.accounts.length,
        0,
      );
      output.result({ file, namespaces: store.namespaces.length, accounts }, () => {
        output.success(
          `Wrote ${accounts} account(s) in ${store.namespaces.length} namespace(s) to ${file}`,
        );
        output.warn('The file is not encrypted. Delete it once you no longer need it.');
      });
    });
}
