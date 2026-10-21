import { styleText } from 'node:util';

import { describe, expect, it } from 'vitest';

import { Output } from '../../src/ui/output';
import { createTestRuntime } from '../helpers/runtime';

describe('Output', () => {
  it('prints JSON instead of the human-readable rendering with --json', () => {
    const { runtime, stdout } = createTestRuntime();
    const output = new Output(runtime, { json: true });

    output.result({ ok: true }, () => {
      output.line('human');
    });
    output.success('ignored');

    expect(stdout()).toBe('{\n  "ok": true\n}\n');
  });

  it('streams one compact JSON line per result with --json', () => {
    const json = createTestRuntime();
    const plain = createTestRuntime();
    const streamTo = (output: Output) => {
      for (const code of ['1', '2']) {
        output.stream({ code }, () => {
          output.line(code);
        });
      }
    };

    streamTo(new Output(json.runtime, { json: true }));
    streamTo(new Output(plain.runtime));

    expect(json.stdout()).toBe('{"code":"1"}\n{"code":"2"}\n');
    expect(plain.stdout()).toBe('1\n2\n');
  });

  it('uses ASCII symbols on consoles without Unicode glyphs', () => {
    const { runtime, stdout } = createTestRuntime({ platform: 'win32' });
    const output = new Output(runtime);

    output.success('added');
    output.failure('wrong password');
    output.summary('2 accounts');

    expect(stdout()).toBe('[OK] added\n[FAIL] wrong password\n> 2 accounts\n');
  });

  it('colors symbols on a color terminal', () => {
    const { runtime, stdout } = createTestRuntime({ tty: true });

    new Output(runtime).success('added');

    expect(stdout()).toBe(`${styleText('green', '✔', { validateStream: false })} added\n`);
  });

  it('prints hints, but not with --json', () => {
    const plain = createTestRuntime();
    const json = createTestRuntime();

    new Output(plain.runtime).hint('press Ctrl+C to stop');
    new Output(json.runtime, { json: true }).hint('press Ctrl+C to stop');

    expect(plain.stdout()).toBe('press Ctrl+C to stop\n');
    expect(json.stdout()).toBe('');
  });

  it('sends warnings and errors to stderr', () => {
    const { runtime, stdout, stderr } = createTestRuntime();
    const output = new Output(runtime);

    output.warn('the code expires in 3 seconds');
    output.error('account not found');

    expect(stdout()).toBe('');
    expect(stderr()).toBe('⚠ the code expires in 3 seconds\n✖ account not found\n');
  });

  it('renders tables to stdout', () => {
    const { runtime, stdout } = createTestRuntime();

    new Output(runtime).table(
      [{ account: 'github' }],
      [{ header: 'ACCOUNT', value: (row) => row.account }],
    );

    expect(stdout()).toBe('ACCOUNT\ngithub\n');
  });
});
