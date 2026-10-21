import { PassThrough } from 'node:stream';

import { Command } from 'commander';
import { afterEach, describe, expect, it } from 'vitest';

import type { CommandGroup } from '../../src/cli/program';
import type { Prompt } from '../../src/cli/prompt';
import type { Runtime } from '../../src/cli/runtime';
import { startShell } from '../../src/repl/shell';
import { Output } from '../../src/ui/output';
import { account, createTempStore, PASSWORD } from '../helpers/store';

const CTRL_C = '\u0003';
const CTRL_U = '\u0015';
const UP = '\u001b[A';

interface ShellSetup {
  readonly terminal?: boolean;
  readonly groups?: readonly CommandGroup[];
  readonly env?: NodeJS.ProcessEnv;
  readonly autoLockMs?: number;
}

function createShell({ terminal = false, groups, env = {}, autoLockMs }: ShellSetup = {}) {
  const input = new PassThrough();
  const output = new PassThrough();
  let screen = '';
  output.on('data', (chunk: Buffer) => {
    screen += chunk.toString();
  });
  const createRuntime = (signal: AbortSignal, prompt: Prompt): Runtime => ({
    stdout: output,
    stderr: output,
    env,
    platform: 'linux',
    signal,
    prompt,
    exitCode: 0,
  });
  const done = startShell({ input, output, createRuntime, groups, terminal, autoLockMs });
  return { input, done, screen: () => screen };
}

function count(text: string, part: string): number {
  return text.split(part).length - 1;
}

/** 질문이 나오기 전에 입력한 줄은 다음 명령으로 가므로, 화면에 글이 나올 때까지 기다렸다가 답합니다. */
async function waitFor(screen: () => string, text: string, times = 1): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (count(screen(), text) >= times) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`timed out waiting for ${JSON.stringify(text)} in:\n${screen()}`);
}

describe('startShell', () => {
  const waiting = Promise.withResolvers<undefined>();
  const groups: readonly CommandGroup[] = [
    {
      heading: 'Testing:',
      commands: [
        (runtime) =>
          new Command('echo').argument('<text>').action((text: string) => {
            new Output(runtime).success(text);
          }),
        (runtime) =>
          new Command('wait').action(async () => {
            waiting.resolve(undefined);
            await new Promise((resolve) => {
              runtime.signal.addEventListener('abort', resolve, { once: true });
            });
            new Output(runtime).summary('stopped');
          }),
        (runtime) =>
          new Command('ask').action(async () => {
            const answer = await runtime.prompt.line('Name: ');
            new Output(runtime).success(`hello ${answer}`);
          }),
      ],
    },
  ];

  it('shows the banner and runs commands until exit', async () => {
    const shell = createShell({ groups });

    shell.input.write('echo hello\nexit\n');

    expect(await shell.done).toBe(0);
    expect(shell.screen()).toContain('TOTP v');
    expect(shell.screen()).toContain('utc ❯ ');
    expect(shell.screen()).toContain('✔ hello');
  });

  it('shows help for the whole program, with the shell commands, or for a single command', async () => {
    const shell = createShell({ groups });

    shell.input.write('help\nhelp echo\nquit\n');

    expect(await shell.done).toBe(0);
    expect(shell.screen()).toContain('Usage: utc [options]');
    expect(shell.screen()).toContain("In the shell: 'lock' forgets the password");
    expect(shell.screen()).toContain('Usage: utc echo');
  });

  it('keeps running after unknown commands, bad input and command errors', async () => {
    const shell = createShell({ groups });

    shell.input.write('nope\necho "oops\necho\necho "still alive"\nexit\n');

    expect(await shell.done).toBe(0);
    expect(shell.screen()).toContain("unknown command 'nope'");
    expect(shell.screen()).toContain('unterminated double quote');
    expect(shell.screen()).toContain("missing required argument 'text'");
    expect(shell.screen()).toContain('✔ still alive');
  });

  it('exits at the end of input', async () => {
    const shell = createShell({ groups });

    shell.input.end('echo bye\n');

    expect(await shell.done).toBe(0);
    expect(shell.screen()).toContain('✔ bye');
  });

  it('lets commands ask questions', async () => {
    const shell = createShell({ groups });

    shell.input.write('ask\n');
    await waitFor(shell.screen, 'Name: ');
    shell.input.write('world\nexit\n');

    expect(await shell.done).toBe(0);
    expect(shell.screen()).toContain('✔ hello world');
  });

  it('cancels only the running command on Ctrl+C', async () => {
    const shell = createShell({ groups, terminal: true });

    shell.input.write('wait\r');
    await waiting.promise;
    shell.input.write(CTRL_C);
    shell.input.write('echo after\r');
    shell.input.write('exit\r');

    expect(await shell.done).toBe(0);
    expect(shell.screen()).toContain('▸ stopped');
    expect(shell.screen()).toContain('✔ after');
  });

  it('exits when Ctrl+C is pressed twice on an empty line', async () => {
    const shell = createShell({ groups, terminal: true });

    shell.input.write(CTRL_C);
    shell.input.write(CTRL_C);

    expect(await shell.done).toBe(0);
    expect(shell.screen()).toContain("press Ctrl+C again or type 'exit' to quit");
  });
});

describe('startShell with the credentials file', () => {
  let store: Awaited<ReturnType<typeof createTempStore>> | undefined;

  afterEach(async () => {
    await store?.cleanup();
  });

  async function unlockedShell(setup: ShellSetup = {}) {
    store = await createTempStore([{ name: 'work', accounts: [account('github')] }]);
    const shell = createShell({
      terminal: true,
      env: { UTC_CREDENTIAL_FILE: store.path },
      ...setup,
    });
    shell.input.write('list\r');
    await waitFor(shell.screen, 'Password: ');
    shell.input.write(`${PASSWORD}\r`);
    await waitFor(shell.screen, 'NAMESPACE');
    return shell;
  }

  it('asks for the password once, without showing it', async () => {
    const shell = await unlockedShell();

    shell.input.write('list work\r');
    await waitFor(shell.screen, 'ACCOUNT');
    shell.input.write('exit\r');

    expect(await shell.done).toBe(0);
    expect(count(shell.screen(), 'Password: ')).toBe(1);
    expect(shell.screen()).not.toContain(PASSWORD);
  });

  it('keeps the password out of the history', async () => {
    const shell = await unlockedShell();

    shell.input.write(UP);
    shell.input.write(UP);
    shell.input.write(UP);
    shell.input.write(`${CTRL_U}exit\r`);

    expect(await shell.done).toBe(0);
    expect(shell.screen()).not.toContain(PASSWORD);
  });

  it('asks again after lock', async () => {
    const shell = await unlockedShell();

    shell.input.write('lock\r');
    await waitFor(shell.screen, 'Locked the credentials file');
    shell.input.write('list\r');
    await waitFor(shell.screen, 'Password: ', 2);
    shell.input.write(`${PASSWORD}\r`);
    await waitFor(shell.screen, 'NAMESPACE', 2);
    shell.input.write('exit\r');

    expect(await shell.done).toBe(0);
  });

  it('locks by itself after a while without commands', async () => {
    const shell = await unlockedShell({ autoLockMs: 50 });

    await new Promise((resolve) => setTimeout(resolve, 150));
    shell.input.write('list\r');
    await waitFor(shell.screen, 'Password: ', 2);
    shell.input.write(`${PASSWORD}\r`);
    await waitFor(shell.screen, 'NAMESPACE', 2);
    shell.input.write('exit\r');

    expect(await shell.done).toBe(0);
    expect(shell.screen()).toContain(
      'The credentials file was locked after 0.05 seconds without commands.',
    );
  });

  it('completes the names of the unlocked credentials file', async () => {
    const shell = await unlockedShell();

    shell.input.write('generate w\t');
    await waitFor(shell.screen, 'generate work');
    shell.input.write(`${CTRL_U}exit\r`);

    expect(await shell.done).toBe(0);
  });
});
