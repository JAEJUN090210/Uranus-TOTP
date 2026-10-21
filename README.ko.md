# Uranus-TOTP

**CLI-based TOTP (Time-based One-Time Password) Powered by Uranus**

[English](README.md) | 한국어

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Uranus-TOTP(`utc`)는 Windows, Linux, macOS에서 동작하는 커맨드라인 OTP 인증기입니다. Google Authenticator나 Authy처럼 2단계 인증(2FA)에 쓰는 시간 기반 일회용 비밀번호(TOTP)를 터미널에서 바로 만들어 줍니다. 계정은 네임스페이스로 묶어 관리하고, 비밀번호로 암호화한 파일 하나에 보관합니다. TypeScript와 Node.js로 만들며, [totp-cli](https://github.com/yitsushi/totp-cli)를 바탕으로 합니다.

> [!NOTE]
> 아직 초기 개발 단계이며 정식 릴리즈 전입니다. 아래 명령과 옵션은 첫 릴리즈(v1.0.0) 전에 바뀔 수 있습니다.

## 기능

| 분류 | 명령 |
| --- | --- |
| **코드 생성** | 저장한 계정의 코드를 한 번 또는 바뀔 때마다 생성(`generate`), 저장하지 않은 시크릿으로 바로 생성(`instant`) |
| **계정 관리** | 계정 추가(`add-token`), 목록(`list`), 이름 변경(`rename`), 옵션 변경(`update`), 삭제(`delete`). 계정은 네임스페이스로 묶어 관리 |
| **토큰 옵션** | 계정마다 코드 길이, 접두어, HMAC 알고리즘(SHA-1, SHA-256, SHA-512), 시간 간격 지정. `set-length`, `set-prefix`로 바로 변경 |
| **저장소** | 비밀번호 변경(`change-password`), JSON으로 내보내기(`dump`)와 가져오기(`import`) |

- **암호화 저장**: 모든 계정을 AES-256-GCM으로 암호화한 파일 하나에 보관합니다. 키는 비밀번호에서 scrypt로 만들며, 강도(fast, normal, strong)를 직접 고를 수 있습니다.
- **두 가지 실행 방식**: 스크립트와 파이프에 쓰기 좋은 서브커맨드, 비밀번호를 한 번만 입력하는 대화형 셸
- **사람도 기계도 읽기 쉬운 출력**: 기본은 읽기 쉬운 출력, 스크립트용으로는 `--json`
- **크로스플랫폼**: Windows, Linux, macOS

## 사용법 (미리보기)

```console
$ utc add-token work github
$ utc generate work github
$ utc list work
$ utc instant < secret.txt

$ utc
utc> generate work github
utc> exit
```

## 설치

아래 방법으로 배포할 예정입니다.

| 플랫폼 | 배포 방법 | 상태 |
| --- | --- | --- |
| Linux, macOS | 설치 스크립트 | 예정 |
| Windows | 설치 스크립트, winget | 예정 |
| Ubuntu, Debian | apt | 예정 |
| macOS | Homebrew | 예정 |

## 보안

- 비밀번호는 어디에도 저장하지 않습니다. 비밀번호를 잊으면 저장한 계정을 되살릴 수 없습니다.
- `dump`는 시크릿을 암호화하지 않은 채로 씁니다. 파일을 안전한 곳에 두고, 필요 없어지면 지우세요.

## 기여하기

기여를 환영합니다. 이슈나 PR을 올리기 전에 아래 문서를 읽어주세요.

- [CONTRIBUTING.md](CONTRIBUTING.md): 개발 프로세스, 이슈와 라벨, 브랜치, PR, 버전 규칙
- [COMMIT_CONVENTION.md](COMMIT_CONVENTION.md): 커밋 메시지 규칙

## 라이선스

Copyright (C) 2026 JAEJUN JEON

Uranus-TOTP는 [GNU General Public License v3.0](LICENSE)에 따라 배포되는 자유 소프트웨어입니다.

Uranus-TOTP는 MIT 라이선스로 배포되는 [totp-cli](https://github.com/yitsushi/totp-cli)를 바탕으로 합니다. totp-cli의 라이선스 고지는 [NOTICE](NOTICE)에 있습니다.
