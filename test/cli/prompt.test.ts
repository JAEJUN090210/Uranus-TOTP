import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createPrompt } from '../../src/cli/prompt';

function collect(stream: PassThrough): () => string {
  let text = '';
  stream.on('data', (chunk) => {
    text += String(chunk);
  });
  return () => text;
}

function pipe() {
  const input = new PassThrough();
  const output = new PassThrough();
  const written = collect(output);
  const prompt = createPrompt({ input, output, signal: new AbortController().signal });
  return { input, prompt, written };
}

/** raw 모드를 바꿀 수 있는 가짜 터미널 입력입니다. */
class FakeTerminal extends PassThrough {
  readonly isTTY = true;
  rawMode = false;

  setRawMode(mode: boolean): this {
    this.rawMode = mode;
    return this;
  }
}

function terminal() {
  const input = new FakeTerminal();
  const output = new PassThrough();
  const written = collect(output);
  const controller = new AbortController();
  const prompt = createPrompt({ input, output, signal: controller.signal });
  return { input, prompt, written, controller };
}

describe('createPrompt with piped input', () => {
  it('reads one line per question without printing the questions', async () => {
    const { input, prompt, written } = pipe();
    input.end('  work  \npass word \n');

    expect(prompt.interactive).toBe(false);
    expect(await prompt.line('Namespace: ')).toBe('work');
    expect(await prompt.secret('Password: ')).toBe('pass word ');
    expect(written()).toBe('');
  });

  it('waits for lines that arrive later', async () => {
    const { input, prompt } = pipe();
    const answer = prompt.secret('Password: ');

    input.write('late\n');

    expect(await answer).toBe('late');
  });

  it('accepts Windows line endings', async () => {
    const { input, prompt } = pipe();
    input.end('secret\r\nwork\r\n');

    expect(await prompt.secret('Password: ')).toBe('secret');
    expect(await prompt.line('Namespace: ')).toBe('work');
  });

  it('says what was missing when the input ends', async () => {
    const { input, prompt } = pipe();
    input.end('');

    await expect(prompt.secret('Password: ')).rejects.toThrow(
      'standard input ended before the password was given',
    );
  });

  it('reads the rest of the input at once', async () => {
    const { input, prompt } = pipe();
    input.end('first\n[\n  1\n]\n');

    expect(await prompt.line('Name: ')).toBe('first');
    expect(await prompt.readAll()).toBe('[\n  1\n]');
  });
});

describe('createPrompt in a terminal', () => {
  it('asks for a file instead of reading the whole input', async () => {
    const { prompt } = terminal();

    await expect(prompt.readAll()).rejects.toThrow(
      'standard input is a terminal: pipe the file into it, or give a file name',
    );
  });

  it('hides what is typed for secrets and restores the terminal', async () => {
    const { input, prompt, written } = terminal();
    const answer = prompt.secret('Password: ');

    input.write('pa');
    input.write('ss\r');

    expect(await answer).toBe('pass');
    expect(written()).toBe('Password: \n');
    expect(input.rawMode).toBe(false);
  });

  it('erases one character per backspace, including Korean', async () => {
    const { input, prompt } = terminal();
    const answer = prompt.secret('Password: ');

    input.write('ab\u007f한글\b\r');

    expect(await answer).toBe('a한');
  });

  it('ignores arrow keys', async () => {
    const { input, prompt } = terminal();
    const answer = prompt.secret('Password: ');

    input.write('a');
    input.write('\u001b[D');
    input.write('b\r');

    expect(await answer).toBe('ab');
  });

  it('cancels a secret with Ctrl+C', async () => {
    const { input, prompt } = terminal();
    const answer = prompt.secret('Password: ');

    input.write('\u0003');

    await expect(answer).rejects.toMatchObject({ name: 'AbortError' });
    expect(input.rawMode).toBe(false);
  });

  it('cancels a secret when the command is cancelled', async () => {
    const { prompt, controller } = terminal();
    const answer = prompt.secret('Password: ');

    controller.abort();

    await expect(answer).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('asks a question and trims the answer', async () => {
    const { input, prompt, written } = terminal();
    const answer = prompt.line('Strength: ');

    input.write(' fast \r');

    expect(prompt.interactive).toBe(true);
    expect(await answer).toBe('fast');
    expect(written()).toContain('Strength: ');
  });
});
