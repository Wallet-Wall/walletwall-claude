# Security

WalletWall Claude is a generated, read-only distribution of the WalletWall Vault evidence and technical-readiness MCP engine.

## Security boundary

The published Claude package runs locally over stdio and does not require WalletWall-hosted MCP execution. It does not inject credentials through `.mcp.json`, sign transactions or messages, custody assets, broadcast transactions, trade, transfer funds, expose arbitrary SQL, or provide generic blockchain-write capabilities.

The distribution is generated from the exact source commit recorded in `.github/source-pin.json` and `PROVENANCE.json`. Changes to evidence semantics, readiness rules, registries, or MCP behavior must originate in `Wallet-Wall/walletwall-copilot` and pass its source-repository gates before propagation here.

## Reporting a vulnerability

Use GitHub private vulnerability reporting when available. Do not include private keys, seed phrases, credentials, or other secrets in reports.

## Release expectations

A release is not submission-ready unless CI verifies provenance SHA-512 digests, source pinning, package size limits, exact six-tool MCP discovery, local stdio startup, absence of credential injection or remote MCP substitution, and the fail-closed validation boundary.
