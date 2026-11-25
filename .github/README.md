# walletwall-claude

The WalletWall plugin for Claude, **WalletWall Vault Readiness**, generated from
[`Wallet-Wall/walletwall-copilot`](https://github.com/Wallet-Wall/walletwall-copilot). This repository is a distribution
surface, not a second WalletWall implementation.

## Layout

| Path | What it is |
| --- | --- |
| [`plugin/`](https://github.com/Wallet-Wall/walletwall-claude/tree/main/plugin) | The complete installable Claude plugin: manifests, the four skills, the local MCP server and its vendored runtime dependencies, the listing icon, the license, the README and `PROVENANCE.json`. It is byte-for-byte the output of the source repository's generator at the commit pinned in `.github/source-pin.json`, and it is the folder submitted to the Claude Directory (plugin path `plugin`). |
| `.github/` | This repository's own CI, source pin, sync workflow and policies. It is never installed and is not part of the plugin. |

The plugin's [README](https://github.com/Wallet-Wall/walletwall-claude/blob/main/plugin/README.md) describes what it does,
its tools, privacy and data flow, and its limitations.

## Local review with Claude Code

Requirements: Node.js 22.18 or newer on `PATH`, and Claude Code.

```bash
git clone https://github.com/Wallet-Wall/walletwall-claude.git
cd walletwall-claude
claude --plugin-dir ./plugin
```

## If you already have a clone

The plugin moved from the repository root into `plugin/`. Nothing in the plugin changed: every file kept its bytes, and
`plugin/PROVENANCE.json` records the same source commit.

- `claude --plugin-dir ./plugin` works on every Claude Code version that supports `--plugin-dir`.
- `claude --plugin-dir .` from the repository root keeps working on Claude Code 2.1.265 or later, which loads each plugin
  folder inside the folder it is given. An older Claude Code finds no plugin manifest at the root; pass `./plugin` instead.
- The plugin name (`walletwall`), its four skills and its six read-only tools are unchanged.

## Security and contributing

- Security boundary and vulnerability reporting: [SECURITY.md](https://github.com/Wallet-Wall/walletwall-claude/blob/main/.github/SECURITY.md).
- Where changes belong and how a release is made: [CONTRIBUTING.md](https://github.com/Wallet-Wall/walletwall-claude/blob/main/.github/CONTRIBUTING.md).
