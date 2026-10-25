# Security

WalletWall Claude is a generated, read-only distribution of the WalletWall Vault evidence and technical-readiness MCP engine.

## Security boundary

The published Claude package:

- runs locally over stdio;
- does not require WalletWall-hosted MCP execution;
- does not inject credentials through `.mcp.json`;
- does not sign transactions or messages;
- does not custody assets;
- does not broadcast transactions;
- does not trade or transfer funds;
- does not expose arbitrary SQL or generic blockchain-write capabilities;
- preserves evidence uncertainty and provenance instead of inferring missing facts.

The distribution repository is generated from a pinned commit in `Wallet-Wall/walletwall-copilot`. Changes to evidence semantics, readiness rules, runtime behavior, or registries must originate there and pass its source-repository security and conformance gates before distribution.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the WalletWall maintainers through GitHub's private vulnerability reporting feature when available. Do not include secrets, private keys, seed phrases, or sensitive wallet credentials in reports.

## Release expectations

A release is not considered submission-ready unless repository CI verifies:

- provenance SHA-512 digests;
- source commit pinning;
- package file-count and file-size limits;
- exact six-tool MCP surface;
- local stdio startup;
- absence of credential injection or remote MCP substitution;
- fail-closed validation boundary.
