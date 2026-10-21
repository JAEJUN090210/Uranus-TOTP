# Uranus-TOTP

**CLI-based TOTP (Time-based One-Time Password) Powered by Uranus**

[English](README.md) | 한국어

[![CI](https://github.com/JAEJUN090210/Uranus-TOTP/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/JAEJUN090210/Uranus-TOTP/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Uranus-TOTP(`utc`)는 Windows, Linux, macOS에서 동작하는 커맨드라인 OTP 인증기입니다. Google Authenticator나 Authy처럼 2단계 인증(2FA)에 쓰는 시간 기반 일회용 비밀번호(TOTP)를 터미널에서 바로 만들어 줍니다. 계정은 네임스페이스로 묶어 관리하고, 비밀번호로 암호화한 파일 하나에 보관합니다. TypeScript와 Node.js로 만들며, [totp-cli](https://github.com/yitsushi/totp-cli)를 바탕으로 합니다.

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

## 사용법

```console
$ utc add-token work github
$ utc generate work github
$ utc list work
$ utc instant < secret.txt

$ utc
utc ❯ generate work github
utc ❯ exit
```

### 공통 옵션

| 옵션 | 설명 |
| --- | --- |
| `--json` | 스크립트에서 쓰기 좋게 결과를 JSON으로 출력 |
| `--strength <level>` | 새 저장소 파일이나 비밀번호의 암호화 강도: `fast`, `normal`, `strong` |
| `-V, --version` | 버전 출력 |
| `-h, --help` | 도움말 출력 |

출력이 터미널이 아니거나 `NO_COLOR` 환경 변수가 있으면 색이 자동으로 꺼집니다.

### 대화형 셸

인자 없이 `utc`를 실행하면 대화형 셸이 열립니다. 모든 명령을 명령줄에서와 똑같이 쓸 수 있습니다.

- 비밀번호는 저장소 파일이 필요한 명령을 처음 실행할 때 한 번만 묻습니다.
- `lock`을 입력하면 바로 비밀번호를 잊습니다. 5분 동안 명령이 없어도 잊습니다.
- `Tab`으로 명령 이름과 옵션을, 잠금이 풀려 있으면 네임스페이스와 계정 이름도 자동완성합니다.
- `help [명령]`은 도움말, `clear`는 화면 지우기, `exit`나 `quit`는 셸 종료입니다.
- `Ctrl+C`는 셸을 끄지 않고 실행 중인 명령만 취소합니다. 빈 줄에서 두 번 누르거나 `Ctrl+D`를 누르면 종료합니다.

## 명령

### generate

저장한 계정의 코드를 출력합니다. totp-cli처럼 코드만 출력하므로 파이프로 넘기거나 복사하기 쉽습니다.

```console
$ utc generate work github                     # 482913
$ utc g work github --show-remaining           # 482913 (remaining time: 17s)
$ utc generate work github --follow            # Ctrl+C를 누를 때까지 코드가 바뀔 때마다 한 줄씩
$ utc generate work github --json
```

| 옵션 | 설명 |
| --- | --- |
| `--show-remaining` | 코드가 몇 초 더 유효한지 함께 출력 |
| `--follow` | Ctrl+C를 누를 때까지 코드가 바뀔 때마다 새 코드 출력 |

계정에 저장한 접두어, 코드 길이, 알고리즘, 시간 간격을 씁니다. `--json`이면 `namespace`, `account`, `code`, `remaining`을 출력하고, `--follow --json`이면 코드마다 JSON 한 줄을 출력합니다.

### instant

시크릿을 저장하지 않고 바로 코드를 만듭니다. 시크릿은 `UTC_TOKEN`에서 읽거나, 터미널에서는 보이지 않게 입력받고, 파이프로 넘기면 표준 입력의 첫 줄을 씁니다. 인자로는 받지 않으므로 셸 기록에 남지 않습니다.

```console
$ utc instant                                  # 시크릿을 입력받음
$ cat token.txt | utc instant --length 8
```

| 옵션 | 설명 |
| --- | --- |
| `--length <digits>` | 코드 길이, 1~10 (기본값: 6) |
| `--algorithm <name>` | HMAC 알고리즘: `sha1`, `sha256`, `sha512` (기본값: `sha1`) |
| `--time-period <seconds>` | 코드 하나가 유효한 시간(초) (기본값: 30) |
| `--show-remaining` | 코드가 몇 초 더 유효한지 함께 출력 |

### add-token

계정을 추가합니다. 시크릿은 항상 입력으로 받고 터미널에서는 보이지 않게 받으므로 셸 기록에 남지 않습니다. 네임스페이스나 계정 이름이 빠지면 함께 묻고, 없는 네임스페이스는 새로 만듭니다.

```console
$ utc add-token work github                    # 시크릿을 입력받음
$ utc add work vpn --length 8 --prefix pin     # 별칭 add
$ utc add-token                                # 네임스페이스와 계정 이름도 입력받음
```

| 옵션 | 설명 |
| --- | --- |
| `--length <digits>` | 코드 길이, 1~10 (기본값: 6) |
| `--prefix <text>` | 코드 앞에 붙일 문자열 |
| `--algorithm <name>` | HMAC 알고리즘: `sha1`, `sha256`, `sha512` (기본값: `sha1`) |
| `--time-period <seconds>` | 코드 하나가 유효한 시간(초) (기본값: 30) |

시크릿은 저장하기 전에 확인하므로, 덜 복사한 시크릿은 바로 알 수 있습니다. 입력을 파이프로 넘기면 묻는 순서대로 줄을 읽습니다. 빠진 네임스페이스와 계정 이름, 시크릿, 비밀번호 순서입니다.

### list

네임스페이스 목록이나 네임스페이스 안의 계정 목록을 이름순으로 보여 줍니다.

```console
$ utc list
NAMESPACE  ACCOUNTS
home       1
work       2

$ utc list work
ACCOUNT  LENGTH  ALGORITHM  PERIOD  PREFIX
github   6       sha1       30s     -
vpn      8       sha256     60s     pin
```

시크릿은 `--json`에서도 보여 주지 않습니다.

### update, set-length, set-prefix

계정의 코드 옵션을 바꿉니다. `update`는 준 옵션만 바꾸며 `add-token`과 같은 옵션을 받습니다. `set-length`와 `set-prefix`는 totp-cli처럼 빠진 값을 묻습니다.

```console
$ utc update work github --length 8 --algorithm sha256
$ utc set-length work github 8
$ utc set-prefix work vpn 1234
$ utc set-prefix work vpn --clear              # 접두어 지우기
```

### rename

```console
$ utc rename account work github gh
$ utc rename namespace work office
```

빠진 이름은 묻습니다. totp-cli와 달리 이미 있는 이름으로는 바꾸지 않습니다.

### delete

계정 하나나, 네임스페이스를 그 안의 계정까지 모두 지웁니다. 지울 항목을 보여 주고 먼저 묻습니다. 물어볼 터미널이 없으면 `--yes`가 필요합니다.

```console
$ utc delete work github
$ utc delete work --yes
```

| 옵션 | 설명 |
| --- | --- |
| `-y, --yes` | 묻지 않고 지우기 |

### change-password

비밀번호를 바꿉니다. 터미널에서는 지금 강도를 기본값으로 강도를 다시 묻고, 새 비밀번호를 두 번 입력받습니다. `--strength`를 주면 강도 질문을 건너뜁니다. `UTC_PASS`는 지금 비밀번호로만 쓰고 새 비밀번호로는 쓰지 않습니다.

```console
$ utc change-password
$ utc --strength strong change-password
```

### dump

모든 계정을 시크릿까지 JSON으로 내보냅니다. 파일이 **암호화되지 않으므로** `--yes`가 필요하고, 본인만 읽을 수 있는 권한으로 만듭니다. `-`를 주면 표준 출력으로 내보내므로 다른 도구로 바로 암호화할 수 있습니다.

```console
$ utc dump backup.json --yes
$ utc dump - --yes | age -e -r age1... > backup.json.age
```

| 옵션 | 설명 |
| --- | --- |
| `-y, --yes` | 시크릿을 암호화하지 않고 쓴다는 확인 |

### import

`dump`가 쓰는 형식의 JSON에서 계정을 가져옵니다. 저장하기 전에 모든 계정과 시크릿을 확인합니다. 이미 있는 계정이면 터미널에서는 덮어쓸지 묻고, 터미널이 없으면 그대로 두고 알려 줍니다. `-`를 주면 표준 입력을 읽으며, 이때 비밀번호는 `UTC_PASS`로 줘야 합니다.

```console
$ utc import backup.json
$ utc import backup.json --overwrite
```

| 옵션 | 설명 |
| --- | --- |
| `--overwrite` | 이미 있는 계정을 묻지 않고 덮어쓰기 |

#### totp-cli에서 옮겨 오기

`dump`가 쓰는 JSON은 totp-cli `dump`의 YAML과 구조와 키 이름이 같습니다. 그래서 totp-cli에서 내보낸 파일을 JSON으로 바꾸면 그대로 가져올 수 있습니다. 예를 들어 [yq](https://github.com/mikefarah/yq)를 쓰면 다음과 같습니다.

```console
$ totp-cli dump --yes-please --output totp-cli.yaml
$ yq -o=json totp-cli.yaml > totp-cli.json
$ utc import totp-cli.json
```

두 파일에는 시크릿이 암호화되지 않은 채로 들어 있으니 다 옮긴 뒤에는 지우세요.

## 저장소

모든 계정은 저장소 파일 하나에 보관합니다. 비밀번호에서 scrypt로 만든 키로 AES-256-GCM 암호화를 합니다.

| 플랫폼 | 위치 |
| --- | --- |
| Windows | `%APPDATA%\utc\credentials` |
| macOS | `~/Library/Application Support/utc/credentials` |
| Linux | `~/.config/utc/credentials`, `$XDG_CONFIG_HOME`이 있으면 `$XDG_CONFIG_HOME/utc/credentials` |

계정이 필요한 명령을 처음 실행하면 파일을 만듭니다. 터미널에서는 비밀번호를 얼마나 풀기 어렵게 할지 묻고, 새 비밀번호를 두 번 입력받습니다. `--strength`를 주면 첫 질문을 건너뜁니다.

| 강도 | scrypt 비용 | 잠금 해제에 걸리는 시간 |
| --- | --- | --- |
| `fast` | N=2^15 | 약 0.05초 |
| `normal` (기본) | N=2^17 | 약 0.2초 |
| `strong` | N=2^18 | 약 0.4초 |

시간은 데스크톱 PC에서 잰 값이며 느린 기기에서는 더 걸립니다. 강도는 파일에 함께 저장되므로 어느 강도로 만든 파일이든 똑같이 열 수 있습니다.

### 환경 변수

| 변수 | 설명 |
| --- | --- |
| `UTC_CREDENTIAL_FILE` | 기본 위치 대신 이 파일을 씁니다. 폴더가 아니라 파일 경로입니다. |
| `UTC_PASS` | 비밀번호를 묻지 않도록 미리 줍니다. CI처럼 환경 변수가 안전한 곳에서만 쓰세요. |
| `UTC_TOKEN` | `instant`에 쓸 시크릿을 묻지 않도록 미리 줍니다. |

`UTC_PASS`가 없으면 터미널에서는 비밀번호를 묻고, 입력을 파이프로 넘기면 표준 입력의 첫 줄을 비밀번호로 씁니다.

```console
$ cat password.txt | utc list
```

## 설치

`utc`는 Node.js를 함께 담은 실행 파일 하나라서 따로 설치할 것이 없습니다. Windows 10 이상(x64), macOS 13.5 이상(Apple 실리콘, Intel), glibc 2.28 이상인 Linux(x64, arm64)에서 동작합니다.

| 플랫폼 | 설치 방법 |
| --- | --- |
| Linux, macOS | [설치 스크립트](#설치-스크립트) |
| Windows | [설치 스크립트](#설치-스크립트), winget(준비 중) |
| Ubuntu, Debian | [apt](#apt-ubuntu-debian) |
| macOS | [Homebrew](#homebrew-macos) |
| 모든 플랫폼 | [직접 내려받기](#직접-내려받기) |

### 설치 스크립트

Linux와 macOS:

```console
$ curl -fsSL https://jaejun090210.github.io/Uranus-TOTP/install.sh | sh
```

Windows(PowerShell):

```console
> irm https://jaejun090210.github.io/Uranus-TOTP/install.ps1 | iex
```

스크립트는 최신 릴리스에서 운영체제와 CPU에 맞는 파일을 골라 `SHA256SUMS`로 검사한 뒤, 관리자 권한 없이 설치합니다.

- **Linux, macOS**: `~/.local/bin/utc`에 설치합니다(root로 실행하면 `/usr/local/bin/utc`). 이 폴더가 `PATH`에 없으면 쓰고 있는 셸의 설정 파일(`~/.zshrc`, `~/.bashrc`, macOS의 `~/.bash_profile`, fish의 `conf.d`, 그 밖에는 `~/.profile`)에 한 줄을 넣으므로, 설치 후 새 터미널을 여세요.
- **Windows**: `%LOCALAPPDATA%\Programs\utc\utc.exe`에 설치하고 사용자 `PATH`에 추가합니다. 설치한 창에서 바로 쓸 수 있습니다.

다시 실행하면 업데이트되고, 실행 파일을 지우면 삭제됩니다. 저장소 파일은 그대로 남습니다. 아래 환경 변수로 동작을 바꿀 수 있습니다.

| 변수 | 효과 |
| --- | --- |
| `UTC_VERSION` | 최신 버전 대신 이 버전을 설치. 예: `1.0.0` |
| `UTC_INSTALL_DIR` | 이 폴더에 설치 |
| `UTC_NO_MODIFY_PATH` | `1`이면 `PATH`와 셸 설정 파일을 건드리지 않음 |

```console
$ curl -fsSL https://jaejun090210.github.io/Uranus-TOTP/install.sh | UTC_VERSION=1.0.0 sh
> $env:UTC_VERSION = '1.0.0'; irm https://jaejun090210.github.io/Uranus-TOTP/install.ps1 | iex
```

### apt (Ubuntu, Debian)

저장소와 서명 키를 한 번 등록한 뒤 설치합니다.

```console
$ sudo install -d -m 0755 /etc/apt/keyrings
$ curl -fsSL https://jaejun090210.github.io/Uranus-TOTP/apt/uranus-totp.gpg | sudo tee /etc/apt/keyrings/uranus-totp.gpg > /dev/null
$ echo "deb [signed-by=/etc/apt/keyrings/uranus-totp.gpg] https://jaejun090210.github.io/Uranus-TOTP/apt stable main" | sudo tee /etc/apt/sources.list.d/uranus-totp.list
$ sudo apt update
$ sudo apt install utc
```

새 버전은 `sudo apt upgrade`로 받습니다. amd64와 arm64용 패키지가 있고, Ubuntu 20.04와 Debian 11 이후 버전에 설치됩니다.

### Homebrew (macOS)

```console
$ brew install jaejun090210/tap/utc
```

새 버전은 `brew upgrade`로 받습니다.

### 직접 내려받기

[릴리스](https://github.com/JAEJUN090210/Uranus-TOTP/releases/latest)마다 아래 파일이 올라갑니다.

| 플랫폼 | 파일 |
| --- | --- |
| Windows x64 | `utc-<버전>-windows-x64.zip` |
| macOS Apple 실리콘 | `utc-<버전>-macos-arm64.tar.gz` |
| macOS Intel | `utc-<버전>-macos-x64.tar.gz` |
| Linux x64 | `utc-<버전>-linux-x64.tar.gz`, `utc_<버전>_amd64.deb` |
| Linux arm64 | `utc-<버전>-linux-arm64.tar.gz`, `utc_<버전>_arm64.deb` |

압축 파일에는 `utc` 실행 파일(Windows는 `utc.exe`)과 라이선스, totp-cli 고지, 함께 담긴 Node.js와 라이브러리의 라이선스가 들어 있습니다. 압축을 풀고 실행 파일을 `PATH`에 있는 폴더로 옮기세요. 모든 파일의 체크섬은 `SHA256SUMS`에 있습니다.

실행 파일에 코드 서명을 하지 않았기 때문에 처음 실행할 때 막힐 수 있습니다.

- **Windows**: SmartScreen이 "Windows의 PC 보호" 창을 띄우면 **추가 정보**를 누른 뒤 **실행**을 누르세요. PowerShell에서 `Unblock-File .\utc.exe`로 내려받은 파일 표시를 한 번 지워도 됩니다. 설치 스크립트로 설치했다면 해당하지 않습니다.
- **macOS**: 브라우저로 받은 파일은 공증을 받지 않았다는 이유로 Gatekeeper가 열지 않습니다. `xattr -d com.apple.quarantine utc`로 내려받은 파일 표시를 한 번 지우세요. Homebrew나 설치 스크립트로 설치했거나 `curl`로 받은 파일은 해당하지 않습니다.

## 소스에서 빌드하기

소스를 직접 빌드해 실행할 수도 있습니다. Node.js 22.13 이상이 필요합니다.

```console
$ git clone https://github.com/JAEJUN090210/Uranus-TOTP.git
$ cd Uranus-TOTP
$ npm install
$ npm run build
$ node dist/utc.cjs --help
```

빌드 후 `npm link`를 실행하면 어디서나 `utc` 명령을 쓸 수 있습니다.

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
