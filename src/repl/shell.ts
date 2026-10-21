import * as readline from 'node:readline';
import { type Readable, Writable } from 'node:stream';

import pkg from '../../package.json' with { type: 'json' };
import { UserError } from '../cli/errors';
import { COMMAND_GROUPS, type CommandGroup, createProgram } from '../cli/program';
import type { Prompt } from '../cli/prompt';
import { runCommand } from '../cli/run';
import type { Runtime, Session } from '../cli/runtime';
import { Output } from '../ui/output';
import { supportsUnicode } from '../ui/symbols';
import { renderBanner } from './banner';
import { type Completer, createCompleter, namesOf, SHELL_COMMANDS } from './completer';
import { tokenize } from './tokenize';

/** 아무 명령도 입력하지 않고 이만큼 지나면 저장소를 다시 잠급니다. */
export const AUTO_LOCK_MS = 5 * 60 * 1000;

export type ShellOutput = Writable & { readonly isTTY?: boolean; readonly columns?: number };

export interface ShellOptions {
  readonly input: Readable;
  readonly output: ShellOutput;
  /** 명령마다 새 취소 신호와 셸의 입력 창구를 받아 실행 환경을 만듭니다. */
  readonly createRuntime: (signal: AbortSignal, prompt: Prompt) => Runtime;
  readonly groups?: readonly CommandGroup[];
  /** 기본값은 output이 터미널인지 여부입니다. */
  readonly terminal?: boolean;
  /** 자동으로 잠그기까지 기다리는 시간입니다. 테스트에서 줄여 씁니다. */
  readonly autoLockMs?: number;
}

/**
 * readline이 그리는 것을 잠시 막을 수 있는 출력 통로입니다.
 * 비밀번호를 입력받는 동안 입력한 글자가 화면에 다시 그려지지 않게 합니다.
 */
class MaskableOutput extends Writable {
  masked = false;

  constructor(private readonly target: ShellOutput) {
    super();
    // readline은 터미널 너비가 바뀌면 줄을 다시 그립니다.
    target.on('resize', () => this.emit('resize'));
  }

  get columns(): number | undefined {
    return this.target.columns;
  }

  get isTTY(): boolean | undefined {
    return this.target.isTTY;
  }

  override _write(chunk: unknown, encoding: BufferEncoding, callback: () => void): void {
    if (!this.masked) {
      // 명령은 원래 출력에 바로 쓰므로, 순서가 섞이지 않도록 기다리지 않고 넘깁니다.
      this.target.write(chunk, encoding);
    }
    callback();
  }
}

/** 비밀번호가 ↑ 키로 다시 나오지 않도록 readline의 입력 기록에서 지웁니다. */
function forget(rl: readline.Interface, line: string): void {
  const { history } = rl as unknown as { history?: string[] };
  const index = history?.indexOf(line) ?? -1;
  if (index !== -1) {
    history?.splice(index, 1);
  }
}

/** 셸의 readline으로 묻는 입력 창구입니다. 명령마다 그 명령의 취소 신호로 만들어 Ctrl+C로 질문도 취소합니다. */
class ShellPrompt implements Prompt {
  constructor(
    private readonly rl: readline.Interface,
    private readonly screen: MaskableOutput,
    private readonly signal: AbortSignal,
    readonly interactive: boolean,
    private readonly state: { typingSecret: boolean },
  ) {}

  async line(question: string): Promise<string> {
    return (await this.ask(question)).trim();
  }

  async secret(question: string): Promise<string> {
    if (!this.interactive) {
      return this.ask(question);
    }
    this.screen.write(question);
    this.screen.masked = true;
    this.state.typingSecret = true;
    let answer: string | undefined;
    try {
      answer = await this.ask('');
      return answer;
    } finally {
      this.screen.masked = false;
      this.state.typingSecret = false;
      this.screen.write('\n');
      if (answer !== undefined) {
        forget(this.rl, answer);
      }
    }
  }

  readAll(): Promise<string> {
    return Promise.reject(new UserError("'-' does not work in the shell: give a file name"));
  }

  close(): void {
    // 셸이 끝날 때 readline을 닫습니다.
  }

  private ask(question: string): Promise<string> {
    const { rl, signal } = this;
    return new Promise<string>((resolve, reject) => {
      const onAbort = () => {
        reject(signal.reason as Error);
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      rl.question(question, { signal }, (answer) => {
        signal.removeEventListener('abort', onAbort);
        resolve(answer);
      });
    });
  }
}

function describeDuration(ms: number): string {
  return ms >= 60_000 ? `${ms / 60_000} minutes` : `${ms / 1000} seconds`;
}

/**
 * 대화형 셸을 실행합니다. exit, quit, Ctrl+D, 또는 빈 줄에서 Ctrl+C를 두 번 누르면 끝납니다.
 * 저장소는 처음 필요할 때 비밀번호를 묻고, lock이나 자동 잠금 전까지 다시 묻지 않습니다.
 */
export async function startShell(options: ShellOptions): Promise<number> {
  const { input, output, createRuntime, groups = COMMAND_GROUPS } = options;
  const autoLockMs = options.autoLockMs ?? AUTO_LOCK_MS;
  const terminal = options.terminal ?? output.isTTY === true;
  const screen = new MaskableOutput(output);
  const session: Session = {};
  const state = { typingSecret: false };

  // 자동완성은 프로그램이 있어야 만들 수 있고, 프로그램은 readline으로 묻는 실행 환경이 있어야 만들 수 있습니다.
  let complete: Completer = (line) => [[], line];
  const rl = readline.createInterface({
    input,
    output: screen,
    // 비밀번호를 입력하는 동안에는 Tab이 아무것도 보여 주지 않게 합니다.
    completer: (line: string) => (state.typingSecret ? [[], line] : complete(line)),
    terminal,
  });
  const neverAborted = new AbortController().signal;
  const runtime = createRuntime(
    neverAborted,
    new ShellPrompt(rl, screen, neverAborted, terminal, state),
  );
  const ui = new Output(runtime);
  const program = createProgram(runtime, groups);
  complete = createCompleter(program, () => session.store?.namespaces);
  const knownCommands = new Set<string>([...SHELL_COMMANDS, ...program.commands.flatMap(namesOf)]);
  const unicode = supportsUnicode(runtime.env, runtime.platform);
  rl.setPrompt(`${ui.colors.cyan(unicode ? 'utc ❯' : 'utc>')} `);

  let running: AbortController | undefined;
  let exitArmed = false;
  // 타이머 콜백이 바꾸는 값이라 객체에 담아 둡니다.
  const idle = { timer: undefined as NodeJS.Timeout | undefined, locked: false };

  const lock = () => {
    clearTimeout(idle.timer);
    session.store = undefined;
  };
  // 다음 명령을 기다리는 동안만 잽니다. generate --follow처럼 오래 걸리는 명령 중에는 잠그지 않습니다.
  const startIdleTimer = () => {
    clearTimeout(idle.timer);
    if (session.store === undefined) {
      return;
    }
    idle.timer = setTimeout(() => {
      lock();
      idle.locked = true;
    }, autoLockMs);
    idle.timer.unref();
  };

  rl.on('SIGINT', () => {
    // 실행 중인 명령이 있으면 그 명령만 취소하고 셸은 계속 둡니다.
    if (running) {
      running.abort();
      return;
    }
    if (exitArmed && rl.line === '') {
      rl.close();
      return;
    }
    exitArmed = rl.line === '';
    rl.write(null, { ctrl: true, name: 'e' });
    rl.write(null, { ctrl: true, name: 'u' });
    output.write(
      exitArmed ? `\n${ui.colors.dim("(press Ctrl+C again or type 'exit' to quit)")}\n` : '\n',
    );
    rl.prompt();
  });

  async function execute(line: string): Promise<'exit' | undefined> {
    let args: string[];
    try {
      args = tokenize(line);
    } catch (error) {
      ui.error(error instanceof Error ? error.message : String(error));
      return undefined;
    }

    const [name, ...rest] = args;
    if (name === undefined) {
      return undefined;
    }
    if (name === 'exit' || name === 'quit') {
      return 'exit';
    }
    if (name === 'clear') {
      readline.cursorTo(output, 0, 0);
      readline.clearScreenDown(output);
      return undefined;
    }
    if (name === 'lock') {
      if (session.store === undefined) {
        ui.hint('The credentials file is already locked.');
      } else {
        lock();
        ui.success('Locked the credentials file. The password is asked again when it is needed.');
      }
      return undefined;
    }
    if (!knownCommands.has(name) && !name.startsWith('-')) {
      ui.error(`unknown command '${name}' (type 'help' to see the commands)`);
      return undefined;
    }

    running = new AbortController();
    const { signal } = running;
    try {
      await runCommand(
        name === 'help' ? [...rest, '--help'] : args,
        {
          ...createRuntime(signal, new ShellPrompt(rl, screen, signal, terminal, state)),
          session,
        },
        groups,
      );
      if (name === 'help' && rest.length === 0) {
        ui.hint(
          "In the shell: 'lock' forgets the password, 'clear' clears the screen, 'exit' quits.",
        );
      }
    } finally {
      running = undefined;
    }
    return undefined;
  }

  output.write(`${renderBanner(pkg.version, ui.colors, unicode)}\n`);
  rl.prompt();
  for await (const line of rl) {
    exitArmed = false;
    clearTimeout(idle.timer);
    if (idle.locked) {
      idle.locked = false;
      ui.hint(
        `The credentials file was locked after ${describeDuration(autoLockMs)} without commands.`,
      );
    }
    if ((await execute(line)) === 'exit') {
      break;
    }
    startIdleTimer();
    rl.prompt();
  }
  lock();
  rl.close();
  return 0;
}
