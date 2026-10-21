import { createInterface, type Interface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

import { UserError } from './errors';

/** 사용자에게 값을 묻는 창구입니다. 질문은 표준 에러로 보내서 결과 출력과 섞이지 않게 합니다. */
export interface Prompt {
  /** 사람이 터미널에서 답하는지 여부입니다. 아니면(파이프) 질문을 출력하지 않고 줄을 차례로 읽습니다. */
  readonly interactive: boolean;
  /** 한 줄을 입력받습니다. 앞뒤 공백은 지웁니다. */
  line(question: string): Promise<string>;
  /** 입력한 글자를 화면에 보이지 않게 받습니다. 비밀번호와 시크릿에 쓰며, 공백도 그대로 둡니다. */
  secret(question: string): Promise<string>;
  /** 입력 스트림을 놓아 프로세스가 끝날 수 있게 합니다. */
  close(): void;
}

export interface PromptInput extends Readable {
  readonly isTTY?: boolean;
  setRawMode?(mode: boolean): unknown;
  /** 파이프로 연결된 표준 입력(소켓)에만 있습니다. ref된 동안에는 프로세스가 끝나지 않습니다. */
  ref?(): unknown;
  unref?(): unknown;
}

export interface PromptOptions {
  readonly input: PromptInput;
  readonly output: Writable;
  /** Ctrl+C로 abort되면 기다리던 질문도 취소합니다. */
  readonly signal: AbortSignal;
}

export function createPrompt(options: PromptOptions): Prompt {
  return options.input.isTTY === true ? new TerminalPrompt(options) : new PipePrompt(options.input);
}

function cancelled(): DOMException {
  return new DOMException('cancelled', 'AbortError');
}

/** 질문 끝의 콜론을 뗀 이름입니다. 입력이 끝났을 때 무엇이 빠졌는지 알려줄 때 씁니다. */
function labelOf(question: string): string {
  return question.trim().replace(/:$/, '').toLowerCase();
}

/** 파이프로 들어온 입력을 한 줄씩 차례로 읽습니다. 질문은 출력하지 않습니다. */
class PipePrompt implements Prompt {
  readonly interactive = false;
  private readonly lines: string[] = [];
  private readonly waiting: ((line: string | undefined) => void)[] = [];
  private reader: Interface | undefined;
  private ended = false;

  constructor(private readonly input: PromptInput) {}

  async line(question: string): Promise<string> {
    return (await this.secret(question)).trim();
  }

  async secret(question: string): Promise<string> {
    const line = await this.next();
    if (line === undefined) {
      throw new UserError(`standard input ended before the ${labelOf(question)} was given`);
    }
    return line;
  }

  close(): void {
    this.reader?.close();
    this.input.unref?.();
  }

  private next(): Promise<string | undefined> {
    const reader = this.start();
    const line = this.lines.shift();
    if (line !== undefined) {
      return Promise.resolve(line);
    }
    if (this.ended) {
      return Promise.resolve(undefined);
    }
    this.input.ref?.();
    reader.resume();
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  private start(): Interface {
    if (this.reader !== undefined) {
      return this.reader;
    }
    const reader = createInterface({ input: this.input, crlfDelay: Infinity, terminal: false });
    reader.on('line', (line) => {
      const resolve = this.waiting.shift();
      if (resolve) {
        resolve(line);
      } else {
        this.lines.push(line);
      }
      // 기다리는 질문이 없으면 읽기를 멈추고 핸들을 놓아서, 열린 파이프 때문에 프로세스가 끝나지 않게 합니다.
      if (this.waiting.length === 0) {
        reader.pause();
        this.input.unref?.();
      }
    });
    reader.on('close', () => {
      this.ended = true;
      for (const resolve of this.waiting.splice(0)) {
        resolve(undefined);
      }
    });
    this.reader = reader;
    return reader;
  }
}

/** 사람이 터미널에서 답합니다. 질문은 output(표준 에러)에 씁니다. */
class TerminalPrompt implements Prompt {
  readonly interactive = true;

  constructor(private readonly options: PromptOptions) {}

  async line(question: string): Promise<string> {
    const { input, output, signal } = this.options;
    const rl = createInterface({ input, output, terminal: true });
    try {
      return await new Promise<string>((resolve, reject) => {
        const cancel = () => {
          reject(cancelled());
        };
        if (signal.aborted) {
          cancel();
          return;
        }
        signal.addEventListener('abort', cancel, { once: true });
        // 질문하는 동안에는 Ctrl+C가 SIGINT 대신 readline으로 오고, Ctrl+D는 입력을 닫습니다.
        rl.on('SIGINT', cancel);
        rl.on('close', cancel);
        rl.question(question, (answer) => {
          signal.removeEventListener('abort', cancel);
          resolve(answer.trim());
        });
      });
    } finally {
      rl.close();
    }
  }

  /** 터미널을 raw 모드로 바꿔 한 글자씩 받고, 화면에는 아무것도 보여주지 않습니다. */
  secret(question: string): Promise<string> {
    const { input, output, signal } = this.options;
    output.write(question);
    return new Promise((resolve, reject) => {
      const decoder = new StringDecoder('utf8');
      let value = '';

      const finish = (error?: Error) => {
        input.off('data', onData);
        signal.removeEventListener('abort', onAbort);
        input.setRawMode?.(false);
        input.pause();
        output.write('\n');
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      };
      const onAbort = () => {
        finish(cancelled());
      };
      const onData = (chunk: Buffer | string) => {
        const text = typeof chunk === 'string' ? chunk : decoder.write(chunk);
        // 화살표 같은 특수 키는 ESC로 시작하는 한 묶음으로 들어옵니다. 비밀번호에는 쓰지 않으므로 버립니다.
        if (text.startsWith('\u001b')) {
          return;
        }
        for (const char of text) {
          if (char === '\r' || char === '\n') {
            finish();
            return;
          }
          // Ctrl+C와 Ctrl+D는 입력을 취소합니다.
          if (char === '\u0003' || char === '\u0004') {
            finish(cancelled());
            return;
          }
          // Backspace는 터미널에 따라 DEL이나 BS로 옵니다. 한글이나 이모지도 한 글자씩 지웁니다.
          if (char === '\u007f' || char === '\b') {
            value = Array.from(value).slice(0, -1).join('');
          } else if (char >= ' ') {
            value += char;
          }
        }
      };

      if (signal.aborted) {
        finish(cancelled());
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      input.setRawMode?.(true);
      input.on('data', onData);
      input.resume();
    });
  }

  close(): void {
    // 질문마다 입력을 열고 닫으므로 붙잡고 있는 것이 없습니다.
  }
}
