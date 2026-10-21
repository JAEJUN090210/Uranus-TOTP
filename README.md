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
