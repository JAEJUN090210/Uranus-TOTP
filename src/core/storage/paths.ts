import { posix, win32 } from 'node:path';

/** 저장소 파일 경로를 바꾸는 환경 변수입니다. 디렉터리가 아니라 파일 경로입니다. */
export const CREDENTIAL_FILE_ENV = 'UTC_CREDENTIAL_FILE';

/**
 * 저장소 파일 경로를 정합니다. UTC_CREDENTIAL_FILE이 있으면 그 경로를 쓰고,
 * 없으면 운영체제의 표준 설정 폴더 아래 utc/credentials를 씁니다.
 */
export function credentialsPath(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  home: string,
): string {
  const custom = env[CREDENTIAL_FILE_ENV];
  if (custom !== undefined && custom !== '') {
    return custom;
  }
  const path = platform === 'win32' ? win32 : posix;
  return path.join(configDirectory(env, platform, home), 'utc', 'credentials');
}

function configDirectory(env: NodeJS.ProcessEnv, platform: NodeJS.Platform, home: string): string {
  if (platform === 'win32') {
    const appData = env.APPDATA;
    return appData !== undefined && appData !== ''
      ? appData
      : win32.join(home, 'AppData', 'Roaming');
  }
  if (platform === 'darwin') {
    return posix.join(home, 'Library', 'Application Support');
  }
  // XDG 규격은 절대 경로만 인정하고, 상대 경로는 없는 것으로 봅니다.
  const xdg = env.XDG_CONFIG_HOME;
  return xdg !== undefined && posix.isAbsolute(xdg) ? xdg : posix.join(home, '.config');
}
