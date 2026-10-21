# Uranus-TOTP

**CLI-based TOTP (Time-based One-Time Password) Powered by Uranus**

English | [한국어](README.ko.md)

[![CI](https://github.com/JAEJUN090210/Uranus-TOTP/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/JAEJUN090210/Uranus-TOTP/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Uranus-TOTP (`utc`) is a cross-platform command-line authenticator. Like Google Authenticator or Authy, it generates the time-based one-time passwords (TOTP) that two-factor authentication (2FA) asks for, right in your terminal. Accounts are grouped into namespaces and kept in a single password-encrypted file. Built with TypeScript on Node.js, based on [totp-cli](https://github.com/yitsushi/totp-cli).

> [!NOTE]
> Uranus-TOTP is in early development and has not been released yet. The commands and options below may change before the first release (v1.0.0).

## Features

| Category | Commands |
| --- | --- |
| **Codes** | Generate the code of a saved account once or every time it changes (`generate`), or straight from a secret without saving it (`instant`) |
| **Accounts** | Add (`add-token`), list (`list`), rename (`rename`), update (`update`) and delete (`delete`) accounts, grouped into namespaces |
| **Token options** | Code length, prefix, HMAC algorithm (SHA-1, SHA-256, SHA-512) and time period for each account, with `set-length` and `set-prefix` shortcuts |
| **Storage** | Change the password (`change-password`), export to JSON (`dump`) and import from JSON (`import`) |

- **Encrypted storage**: every account lives in one file encrypted with AES-256-GCM. The key is derived from your password with scrypt, at a strength you choose (fast, normal or strong).
- **Two ways to run**: one-shot subcommands for scripts and pipes, or an interactive shell that asks for the password only once.
- **Human and machine friendly**: readable output by default, `--json` for scripting.
- **Cross-platform**: Windows, Linux, and macOS.

## Usage (preview)

```console
$ utc add-token work github
$ utc generate work github
$ utc list work
$ utc instant < secret.txt

$ utc
utc> generate work github
utc> exit
```

### Global options

| Option | Description |
| --- | --- |
| `--json` | Print results as JSON for scripts |
| `--strength <level>` | How hard a new credentials file or password is to guess: `fast`, `normal` or `strong` |
| `-V, --version` | Print the version |
| `-h, --help` | Show help |

Colors turn off automatically when the output is not a terminal or the `NO_COLOR` environment variable is set.

## Storage

All accounts are kept in one credentials file, encrypted with AES-256-GCM using a key that is derived from your password with scrypt.

| Platform | Location |
| --- | --- |
| Windows | `%APPDATA%\utc\credentials` |
| macOS | `~/Library/Application Support/utc/credentials` |
| Linux | `~/.config/utc/credentials`, or `$XDG_CONFIG_HOME/utc/credentials` when it is set |

The first command that needs your accounts creates the file. In a terminal it asks how hard the password should be to guess, then asks for the new password twice. Pass `--strength` to skip the first question.

| Strength | scrypt cost | Unlocking takes about |
| --- | --- | --- |
| `fast` | N=2^15 | 0.05 seconds |
| `normal` (default) | N=2^17 | 0.2 seconds |
| `strong` | N=2^18 | 0.4 seconds |

Unlocking times were measured on a desktop PC and grow on slower machines. The strength is saved in the file, so files of every strength open the same way.

### Environment variables

| Variable | Description |
| --- | --- |
| `UTC_CREDENTIAL_FILE` | Use this file instead of the default location. It is a file path, not a folder. |
| `UTC_PASS` | The password, so that it is not asked. Use it only where environment variables are safe, such as CI. |

Without `UTC_PASS`, the password is asked in a terminal, or read from the first line of standard input when the input is piped:

```console
$ cat password.txt | utc list
```

## Installation

Uranus-TOTP will be available through the following channels.

| Platform | Channel | Status |
| --- | --- | --- |
| Linux, macOS | Install script | Planned |
| Windows | Install script, winget | Planned |
| Ubuntu, Debian | apt | Planned |
| macOS | Homebrew | Planned |

## Building from source

Until the first release, you can build and run Uranus-TOTP from source. Node.js 22.13 or later is required.

```console
$ git clone https://github.com/JAEJUN090210/Uranus-TOTP.git
$ cd Uranus-TOTP
$ npm install
$ npm run build
$ node dist/utc.cjs --help
```

Run `npm link` after building to use the `utc` command from anywhere.

## Security

- Your password is never stored anywhere. If you forget it, the saved accounts cannot be recovered.
- `dump` writes your secrets without encryption. Keep the file somewhere safe and delete it once you no longer need it.

## Contributing

Contributions are welcome. Before opening an issue or a pull request, please read the following guides (written in Korean):

- [CONTRIBUTING.md](CONTRIBUTING.md): workflow, issues and labels, branches, pull requests, versioning
- [COMMIT_CONVENTION.md](COMMIT_CONVENTION.md): commit message format

## License

Copyright (C) 2026 JAEJUN JEON

Uranus-TOTP is free software, licensed under the [GNU General Public License v3.0](LICENSE).

Uranus-TOTP is based on [totp-cli](https://github.com/yitsushi/totp-cli), which is licensed under the MIT License. Its license notice is kept in [NOTICE](NOTICE).
