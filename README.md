# Uranus-TOTP

**CLI-based TOTP (Time-based One-Time Password) Powered by Uranus**

English | [한국어](README.ko.md)

[![CI](https://github.com/JAEJUN090210/Uranus-TOTP/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/JAEJUN090210/Uranus-TOTP/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

Uranus-TOTP (`utc`) is a cross-platform command-line authenticator. Like Google Authenticator or Authy, it generates the time-based one-time passwords (TOTP) that two-factor authentication (2FA) asks for, right in your terminal. Accounts are grouped into namespaces and kept in a single password-encrypted file. Built with TypeScript on Node.js, based on [totp-cli](https://github.com/yitsushi/totp-cli).

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

## Usage

```console
$ utc add-token work github
$ utc generate work github
$ utc list work
$ utc instant < secret.txt

$ utc
utc ❯ generate work github
utc ❯ exit
```

### Global options

| Option | Description |
| --- | --- |
| `--json` | Print results as JSON for scripts |
| `--strength <level>` | How hard a new credentials file or password is to guess: `fast`, `normal` or `strong` |
| `-V, --version` | Print the version |
| `-h, --help` | Show help |

Colors turn off automatically when the output is not a terminal or the `NO_COLOR` environment variable is set.

### Interactive shell

Run `utc` without arguments to open an interactive shell. Every command works the same way as on the command line.

- The password is asked the first time a command needs the credentials file, and not again after that.
- `lock` forgets the password at once. It is also forgotten after 5 minutes without commands.
- `Tab` completes command names and options, and also namespace and account names while the credentials file is unlocked.
- `help [command]` shows help, `clear` clears the screen, and `exit` or `quit` leaves the shell.
- `Ctrl+C` cancels the running command without leaving the shell. Press it twice on an empty line, or press `Ctrl+D`, to quit.

## Commands

### generate

Prints the code of a saved account. Only the code is printed, as in totp-cli, so it is easy to pipe or copy.

```console
$ utc generate work github                     # 482913
$ utc g work github --show-remaining           # 482913 (remaining time: 17s)
$ utc generate work github --follow            # a new line every time the code changes, until Ctrl+C
$ utc generate work github --json
```

| Option | Description |
| --- | --- |
| `--show-remaining` | Also show how many seconds the code stays valid |
| `--follow` | Print a new code every time it changes, until Ctrl+C |

The account's prefix, code length, algorithm and time period are used. With `--json` the result has `namespace`, `account`, `code` and `remaining`, and with `--follow --json` every code is one line of JSON.

### instant

Generates a code from a token without saving it. The token comes from `UTC_TOKEN`, from a hidden question in a terminal, or from the first line of standard input. It is never taken as an argument, so it does not end up in your shell history.

```console
$ utc instant                                  # asks for the token
$ cat token.txt | utc instant --length 8
```

| Option | Description |
| --- | --- |
| `--length <digits>` | Length of the code, from 1 to 10 (default: 6) |
| `--algorithm <name>` | HMAC algorithm: `sha1`, `sha256` or `sha512` (default: `sha1`) |
| `--time-period <seconds>` | How many seconds each code stays valid (default: 30) |
| `--show-remaining` | Also show how many seconds the code stays valid |

### add-token

Adds an account. The token is always asked, hidden in a terminal, so it never ends up in your shell history. A missing namespace or account name is asked too, and a namespace is created when it does not exist yet.

```console
$ utc add-token work github                    # asks for the token
$ utc add work vpn --length 8 --prefix pin     # alias add
$ utc add-token                                # also asks for the namespace and the account
```

| Option | Description |
| --- | --- |
| `--length <digits>` | Length of the code, from 1 to 10 (default: 6) |
| `--prefix <text>` | Text to put in front of the code |
| `--algorithm <name>` | HMAC algorithm: `sha1`, `sha256` or `sha512` (default: `sha1`) |
| `--time-period <seconds>` | How many seconds each code stays valid (default: 30) |

The token is checked before it is saved, so a token that was not copied completely is caught right away. When the input is piped, the lines are read in the order they are asked: the namespace and the account when they are missing, the token, then the password.

### list

Lists the namespaces, or the accounts in a namespace, sorted by name.

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

Tokens are never shown, not even with `--json`.

### update, set-length, set-prefix

Change the code options of an account. `update` changes only the options that are given and takes the same options as `add-token`. `set-length` and `set-prefix` ask for anything that is missing, as in totp-cli.

```console
$ utc update work github --length 8 --algorithm sha256
$ utc set-length work github 8
$ utc set-prefix work vpn 1234
$ utc set-prefix work vpn --clear              # removes the prefix
```

### rename

```console
$ utc rename account work github gh
$ utc rename namespace work office
```

Missing names are asked. Unlike totp-cli, a name that is already taken is refused.

### delete

Deletes an account, or a namespace with all of its accounts. It shows what will be deleted and asks first. Without a terminal to ask in, `--yes` is required.

```console
$ utc delete work github
$ utc delete work --yes
```

| Option | Description |
| --- | --- |
| `-y, --yes` | Delete without asking |

### change-password

Changes the password. In a terminal it also asks for the strength again, with the current strength as the default, and asks for the new password twice. `--strength` skips the strength question. `UTC_PASS` is used as the current password, never as the new one.

```console
$ utc change-password
$ utc --strength strong change-password
```

### dump

Exports every account, tokens included, as JSON. The file is **not encrypted**, so `--yes` is required, and it is created so that only you can read it. `-` writes to standard output, for example to encrypt it with another tool right away.

```console
$ utc dump backup.json --yes
$ utc dump - --yes | age -e -r age1... > backup.json.age
```

| Option | Description |
| --- | --- |
| `-y, --yes` | Confirm that the tokens are written without encryption |

### import

Imports accounts from JSON in the format that `dump` writes. Every account and token is checked before anything is saved. When an account already exists, a terminal asks whether to overwrite it; without a terminal it is kept and reported. `-` reads standard input, in which case the password has to come from `UTC_PASS`.

```console
$ utc import backup.json
$ utc import backup.json --overwrite
```

| Option | Description |
| --- | --- |
| `--overwrite` | Replace accounts that already exist without asking |

#### Moving from totp-cli

The JSON that `dump` writes has the same layout and key names as the YAML of totp-cli's `dump`, so a totp-cli export can be imported once it is converted to JSON, for example with [yq](https://github.com/mikefarah/yq):

```console
$ totp-cli dump --yes-please --output totp-cli.yaml
$ yq -o=json totp-cli.yaml > totp-cli.json
$ utc import totp-cli.json
```

Delete both files afterwards, because they hold your tokens without encryption.

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
| `UTC_TOKEN` | The token for `instant`, so that it is not asked. |

Without `UTC_PASS`, the password is asked in a terminal, or read from the first line of standard input when the input is piped:

```console
$ cat password.txt | utc list
```

## Installation

`utc` ships as a single executable with Node.js built in, so nothing else needs to be installed. It runs on Windows 10 or later (x64), macOS 13.5 or later (Apple silicon and Intel), and Linux with glibc 2.28 or later (x64 and arm64).

| Platform | Ways to install |
| --- | --- |
| Linux, macOS | [Install script](#install-script) |
| Windows | [Install script](#install-script), winget (coming soon) |
| Ubuntu, Debian | [apt](#apt-ubuntu-debian) |
| macOS | [Homebrew](#homebrew-macos) |
| Any | [Direct download](#direct-download) |

### Install script

On Linux and macOS:

```console
$ curl -fsSL https://jaejun090210.github.io/Uranus-TOTP/install.sh | sh
```

On Windows, in PowerShell:

```console
> irm https://jaejun090210.github.io/Uranus-TOTP/install.ps1 | iex
```

The script picks the build for your operating system and CPU from the latest release, checks it against `SHA256SUMS`, and installs it without administrator rights:

- **Linux and macOS**: `~/.local/bin/utc` (`/usr/local/bin/utc` when run as root). If the folder is not on your `PATH`, one line is added to your shell's startup file (`~/.zshrc`, `~/.bashrc`, `~/.bash_profile` on macOS, fish's `conf.d`, or `~/.profile`), so open a new terminal afterwards.
- **Windows**: `%LOCALAPPDATA%\Programs\utc\utc.exe`, added to your user `PATH`. It works right away in the same window.

Run the script again to update, and delete the executable to uninstall. Your credentials file stays where it is. These environment variables change what the script does:

| Variable | Effect |
| --- | --- |
| `UTC_VERSION` | Install this version instead of the latest, such as `1.0.0` |
| `UTC_INSTALL_DIR` | Install into this folder |
| `UTC_NO_MODIFY_PATH` | Set to `1` to leave `PATH` and startup files alone |

```console
$ curl -fsSL https://jaejun090210.github.io/Uranus-TOTP/install.sh | UTC_VERSION=1.0.0 sh
> $env:UTC_VERSION = '1.0.0'; irm https://jaejun090210.github.io/Uranus-TOTP/install.ps1 | iex
```

### apt (Ubuntu, Debian)

Add the repository and its signing key once, then install:

```console
$ sudo install -d -m 0755 /etc/apt/keyrings
$ curl -fsSL https://jaejun090210.github.io/Uranus-TOTP/apt/uranus-totp.gpg | sudo tee /etc/apt/keyrings/uranus-totp.gpg > /dev/null
$ echo "deb [signed-by=/etc/apt/keyrings/uranus-totp.gpg] https://jaejun090210.github.io/Uranus-TOTP/apt stable main" | sudo tee /etc/apt/sources.list.d/uranus-totp.list
$ sudo apt update
$ sudo apt install utc
```

New versions arrive with `sudo apt upgrade`. The packages are built for amd64 and arm64 and install on Ubuntu 20.04, Debian 11, and newer.

### Homebrew (macOS)

```console
$ brew install jaejun090210/tap/utc
```

New versions arrive with `brew upgrade`.

### Direct download

Every [release](https://github.com/JAEJUN090210/Uranus-TOTP/releases/latest) has these files:

| Platform | File |
| --- | --- |
| Windows x64 | `utc-<version>-windows-x64.zip` |
| macOS Apple silicon | `utc-<version>-macos-arm64.tar.gz` |
| macOS Intel | `utc-<version>-macos-x64.tar.gz` |
| Linux x64 | `utc-<version>-linux-x64.tar.gz`, `utc_<version>_amd64.deb` |
| Linux arm64 | `utc-<version>-linux-arm64.tar.gz`, `utc_<version>_arm64.deb` |

Each archive holds the `utc` executable (`utc.exe` on Windows), the license, the notice of totp-cli, and the licenses of the bundled Node.js and libraries. Extract it and move the executable to a folder on your `PATH`. `SHA256SUMS` lists the checksum of every file.

The executables are not code-signed, so the first run may be blocked:

- **Windows**: if SmartScreen shows "Windows protected your PC", choose **More info**, then **Run anyway**. You can also clear the download mark once in PowerShell with `Unblock-File .\utc.exe`. The install script is not affected.
- **macOS**: Gatekeeper refuses to open a file downloaded with a browser because it is not notarized. Clear the download mark once with `xattr -d com.apple.quarantine utc`. Homebrew, the install script, and files downloaded with `curl` are not affected.

## Building from source

You can also build and run Uranus-TOTP from source. Node.js 22.13 or later is required.

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
