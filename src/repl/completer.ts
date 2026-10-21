import type { Command, Option } from 'commander';

import type { Namespace } from '../core/storage/model';

/** commander 명령이 아니라 셸이 직접 처리하는 명령입니다. */
export const SHELL_COMMANDS = ['help', 'clear', 'lock', 'exit', 'quit'] as const;

export type Completer = (line: string) => [string[], string];

type NameKind = 'namespace' | 'account';

/**
 * 위치 인자가 무엇의 이름인지 적어 둔 표입니다. 하위 명령은 'rename account'처럼 띄어 씁니다.
 * add-token은 새 이름을 받지만, 이미 있는 네임스페이스에 추가하는 일이 많으므로 네임스페이스만 완성합니다.
 */
const NAME_ARGUMENTS: Readonly<Record<string, readonly NameKind[]>> = {
  generate: ['namespace', 'account'],
  list: ['namespace'],
  'add-token': ['namespace'],
  update: ['namespace', 'account'],
  'set-length': ['namespace', 'account'],
  'set-prefix': ['namespace', 'account'],
  delete: ['namespace', 'account'],
  'rename account': ['namespace', 'account'],
  'rename namespace': ['namespace'],
};

export function namesOf(command: Command): string[] {
  return [command.name(), ...command.aliases()];
}

function flagsOf(command: Command): string[] {
  return command.options
    .flatMap((option) => [option.long, option.short])
    .filter((flag) => flag !== undefined);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function findCommand(commands: readonly Command[], name: string): Command | undefined {
  return commands.find((command) => namesOf(command).includes(name));
}

/** --length 8처럼 값을 받는 옵션이면 참입니다. 그 다음 단어는 위치 인자로 세지 않습니다. */
function takesValue(options: readonly Option[], flag: string): boolean {
  const option = options.find((item) => item.long === flag || item.short === flag);
  return option !== undefined && (option.required || option.optional) && !flag.includes('=');
}

/** 옵션과 옵션 값을 뺀 위치 인자만 남깁니다. */
function positionalArguments(words: readonly string[], options: readonly Option[]): string[] {
  const positional: string[] = [];
  for (let index = 0; index < words.length; index++) {
    const word = words[index] ?? '';
    if (word.startsWith('-')) {
      if (takesValue(options, word)) {
        index++;
      }
    } else {
      positional.push(word);
    }
  }
  return positional;
}

/**
 * 첫 단어는 명령 이름으로, '-'로 시작하는 단어는 해당 명령과 전역 옵션으로 완성합니다.
 * 잠금이 풀려 있으면(namespaces가 목록을 돌려주면) 네임스페이스와 계정 이름도 완성합니다.
 */
export function createCompleter(
  program: Command,
  namespaces: () => readonly Namespace[] | undefined = () => undefined,
): Completer {
  const commandNames = unique(program.commands.flatMap(namesOf));
  const firstWords = unique([...SHELL_COMMANDS, ...commandNames]);
  const globalFlags = [...flagsOf(program), '--help'];

  return (line) => {
    const words = line.trimStart().split(/\s+/);
    const [first = ''] = words;
    const current = words.at(-1) ?? '';
    const match = (candidates: readonly string[]): [string[], string] => [
      candidates.filter((candidate) => candidate.startsWith(current)),
      current,
    ];

    if (words.length === 1) {
      return match(firstWords);
    }
    if (first === 'help' && words.length === 2) {
      return match(commandNames);
    }
    const command = findCommand(program.commands, first);
    if (command === undefined) {
      return [[], current];
    }

    // rename처럼 하위 명령이 있으면 두 번째 단어는 하위 명령 이름입니다.
    let target = command;
    let key = command.name();
    let rest = words.slice(1);
    if (command.commands.length > 0) {
      if (rest.length === 1) {
        return match(unique(command.commands.flatMap(namesOf)));
      }
      const subcommand = findCommand(command.commands, rest[0] ?? '');
      if (subcommand === undefined) {
        return [[], current];
      }
      target = subcommand;
      key = `${command.name()} ${subcommand.name()}`;
      rest = rest.slice(1);
    }

    if (current.startsWith('-')) {
      return match(unique([...flagsOf(target), ...globalFlags]));
    }

    const options = [...target.options, ...program.options];
    const positional = positionalArguments(rest.slice(0, -1), options);
    const kind = NAME_ARGUMENTS[key]?.[positional.length];
    const known = namespaces();
    if (kind === undefined || known === undefined) {
      return [[], current];
    }
    if (kind === 'namespace') {
      return match(unique(known.map((namespace) => namespace.name)));
    }
    const namespace = known.find((item) => item.name === positional[0]);
    return match(unique(namespace?.accounts.map((account) => account.name) ?? []));
  };
}
