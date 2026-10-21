import { describe, expect, it } from 'vitest';

import { credentialsPath } from '../../../src/core/storage/paths';

describe('credentialsPath', () => {
  it('uses the roaming application data folder on Windows', () => {
    expect(
      credentialsPath({ APPDATA: 'C:\\Users\\me\\AppData\\Roaming' }, 'win32', 'C:\\Users\\me'),
    ).toBe('C:\\Users\\me\\AppData\\Roaming\\utc\\credentials');
  });

  it('falls back to the home folder when APPDATA is missing on Windows', () => {
    expect(credentialsPath({}, 'win32', 'C:\\Users\\me')).toBe(
      'C:\\Users\\me\\AppData\\Roaming\\utc\\credentials',
    );
  });

  it('uses Application Support on macOS', () => {
    expect(credentialsPath({}, 'darwin', '/Users/me')).toBe(
      '/Users/me/Library/Application Support/utc/credentials',
    );
  });

  it('uses ~/.config on Linux', () => {
    expect(credentialsPath({}, 'linux', '/home/me')).toBe('/home/me/.config/utc/credentials');
  });

  it('follows an absolute XDG_CONFIG_HOME and ignores a relative one', () => {
    expect(credentialsPath({ XDG_CONFIG_HOME: '/xdg' }, 'linux', '/home/me')).toBe(
      '/xdg/utc/credentials',
    );
    expect(credentialsPath({ XDG_CONFIG_HOME: 'xdg' }, 'linux', '/home/me')).toBe(
      '/home/me/.config/utc/credentials',
    );
  });

  it('uses UTC_CREDENTIAL_FILE as it is', () => {
    expect(credentialsPath({ UTC_CREDENTIAL_FILE: '/mnt/usb/totp' }, 'linux', '/home/me')).toBe(
      '/mnt/usb/totp',
    );
  });
});
