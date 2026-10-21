import { describe, expect, it } from 'vitest';

import { tokenize } from '../../src/repl/tokenize';

describe('tokenize', () => {
  it.each([
    ['', []],
    ['generate work github', ['generate', 'work', 'github']],
    ['  list   work  ', ['list', 'work']],
    ['rename account "my work" "git hub"', ['rename', 'account', 'my work', 'git hub']],
    [`set-prefix work vpn 'say "hi"'`, ['set-prefix', 'work', 'vpn', 'say "hi"']],
    ['echo "say \\"hi\\""', ['echo', 'say "hi"']],
    ['echo "a\\\\b"', ['echo', 'a\\b']],
    ['import C:\\Users\\me\\backup.json', ['import', 'C:\\Users\\me\\backup.json']],
    ['set-prefix work vpn ""', ['set-prefix', 'work', 'vpn', '']],
    ['echo a"b c"d', ['echo', 'ab cd']],
  ])('%j → %j', (line, tokens) => {
    expect(tokenize(line)).toEqual(tokens);
  });

  it.each([
    ['echo "oops', 'unterminated double quote'],
    ["echo 'oops", 'unterminated single quote'],
  ])('rejects %j', (line, message) => {
    expect(() => tokenize(line)).toThrow(message);
  });
});
