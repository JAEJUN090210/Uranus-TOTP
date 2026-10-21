import { readFile } from 'node:fs/promises';

import { Command } from 'commander';

import { isYes } from '../cli/confirm';
import { UserError } from '../cli/errors';
import type { GlobalOptions } from '../cli/program';
import type { Runtime } from '../cli/runtime';
import { openStore, PASSWORD_ENV, passwordFromEnv } from '../cli/storage';
import { type Namespace, parseNamespaces } from '../core/storage/model';
import { ensureNamespace } from '../core/storage/vault';
import { decodeBase32, normalizeToken } from '../core/totp';
import { Output } from '../ui/output';

interface ImportOptions {
  readonly overwrite?: boolean;
}

interface ImportResult {
  readonly added: string[];
  readonly overwritten: string[];
  readonly skipped: string[];
}

/** 파일 이름을 잘못 적은 경우가 가장 흔하므로 그때는 알아보기 쉬운 메시지를 보여 줍니다. */
async function readImportFile(file: string): Promise<string> {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new UserError(`cannot import ${file}: the file does not exist`);
    }
    throw error;
  }
}

/** dump 형식의 JSON을 읽고, 저장하기 전에 모든 계정과 시크릿을 확인합니다. */
function parseImport(text: string, source: string): Namespace[] {
  try {
    const namespaces = parseNamespaces(JSON.parse(text));
    for (const namespace of namespaces) {
      for (const account of namespace.accounts) {
        account.token = normalizeToken(account.token);
        try {
          decodeBase32(account.token);
        } catch (error) {
          throw new UserError(
            `the token of '${namespace.name}/${account.name}': ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    return namespaces;
  } catch (error) {
    const reason = error instanceof SyntaxError ? `not valid JSON (${error.message})` : error;
    throw new UserError(
      `cannot import ${source}: ${reason instanceof Error ? reason.message : String(reason)}`,
    );
  }
}

export function createImportCommand(runtime: Runtime): Command {
  return new Command('import')
    .description('import accounts from a JSON file in the format that dump writes')
    .argument('<file>', "file to read, or '-' for standard input")
    .option('--overwrite', 'replace accounts that already exist without asking')
    .action(async (file: string, options: ImportOptions, command: Command) => {
      const fromStdin = file === '-';
      // 표준 입력을 파일로 쓰면 비밀번호까지 거기서 읽을 수 없습니다.
      if (fromStdin && passwordFromEnv(runtime) === undefined) {
        throw new UserError(
          `set ${PASSWORD_ENV} to import from standard input, because the password cannot be read from it as well`,
        );
      }
      const text = fromStdin ? await runtime.prompt.readAll() : await readImportFile(file);
      const imported = parseImport(text, fromStdin ? 'standard input' : file);

      const globals = command.optsWithGlobals<GlobalOptions>();
      const output = new Output(runtime, globals);
      const store = await openStore(runtime, output, { strength: globals.strength });
      const result: ImportResult = { added: [], overwritten: [], skipped: [] };
      for (const namespace of imported) {
        const target = ensureNamespace(store.namespaces, namespace.name);
        for (const account of namespace.accounts) {
          const label = `${namespace.name}/${account.name}`;
          const existing = target.accounts.find((item) => item.name === account.name);
          if (existing === undefined) {
            target.accounts.push(account);
            result.added.push(label);
          } else if (
            options.overwrite === true ||
            (runtime.prompt.interactive &&
              isYes(await runtime.prompt.line(`Overwrite '${label}'? [y/N] `)))
          ) {
            Object.assign(existing, account);
            result.overwritten.push(label);
          } else {
            result.skipped.push(label);
          }
        }
      }
      await store.save();

      output.result(result, () => {
        output.success(
          `Imported ${result.added.length + result.overwritten.length} account(s): ${result.added.length} added, ${result.overwritten.length} overwritten`,
        );
        if (result.skipped.length > 0) {
          output.warn(
            `Kept ${result.skipped.length} existing account(s): ${result.skipped.join(', ')}${runtime.prompt.interactive ? '' : ' (add --overwrite to replace them)'}`,
          );
        }
      });
    });
}
