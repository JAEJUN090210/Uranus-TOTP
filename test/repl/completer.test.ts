import { describe, expect, it } from 'vitest';

import { createProgram } from '../../src/cli/program';
import type { Namespace } from '../../src/core/storage/model';
import { createCompleter } from '../../src/repl/completer';
import { createTestRuntime } from '../helpers/runtime';
import { account } from '../helpers/store';

const program = createProgram(createTestRuntime().runtime);
const NAMESPACES: Namespace[] = [
  { name: 'work', accounts: [account('github'), account('gitlab')] },
  { name: 'home', accounts: [account('router')] },
];
const locked = createCompleter(program);
const unlocked = createCompleter(program, () => NAMESPACES);

describe('createCompleter', () => {
  it('completes command names, aliases and shell commands for the first word', () => {
    expect(locked('')[0]).toEqual(
      expect.arrayContaining(['add', 'add-token', 'clear', 'exit', 'g', 'generate', 'lock']),
    );
    expect(locked('ge')).toEqual([['generate'], 'ge']);
    expect(locked('  set')).toEqual([['set-length', 'set-prefix'], 'set']);
  });

  it('completes options of the command and global options', () => {
    expect(locked('instant --al')).toEqual([['--algorithm'], '--al']);
    expect(locked('g work github --f')).toEqual([['--follow'], '--f']);
    expect(locked('list --')[0]).toEqual(
      expect.arrayContaining(['--help', '--json', '--strength']),
    );
  });

  it('completes command names after help and subcommands of rename', () => {
    expect(locked('help ins')).toEqual([['instant'], 'ins']);
    expect(locked('rename ')).toEqual([['account', 'namespace'], '']);
  });

  it('offers no names while the credentials file is locked', () => {
    expect(locked('generate w')).toEqual([[], 'w']);
  });

  it('completes namespaces and the accounts in them once unlocked', () => {
    expect(unlocked('generate ')).toEqual([['home', 'work'], '']);
    expect(unlocked('g work g')).toEqual([['github', 'gitlab'], 'g']);
    expect(unlocked('rename account work git')).toEqual([['github', 'gitlab'], 'git']);
    expect(unlocked('rename namespace h')).toEqual([['home'], 'h']);
  });

  it('skips options and their values when counting arguments', () => {
    expect(unlocked('add-token --length 8 w')).toEqual([['work'], 'w']);
    expect(unlocked('delete --yes work r')).toEqual([[], 'r']);
    expect(unlocked('delete --yes home r')).toEqual([['router'], 'r']);
  });

  it('offers nothing after the last name', () => {
    expect(unlocked('generate work github ')).toEqual([[], '']);
    expect(unlocked('instant x')).toEqual([[], 'x']);
  });
});
