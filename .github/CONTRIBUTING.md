# Contributing to WalletWall for Claude

`Wallet-Wall/walletwall-claude` is a generated distribution repository. It is intentionally **not** the source of truth for WalletWall evidence semantics, readiness rules, registries, MCP tools, or runtime behavior.

## Repository layout

- `plugin/` is the complete installable Claude plugin and the folder submitted to the Claude Directory (plugin path `plugin`). It is byte-for-byte the output of the source repository's generator at the commit pinned in `.github/source-pin.json`.
- `.github/` holds this repository's own CI, source pin, sync workflow and policies. It is never installed and is not part of the plugin.

Distribution CI requires exactly these two entries at the repository root, and requires `.github/` to hold nothing a Claude Code plugin loader reads.

## Where changes belong

Open implementation changes in [`Wallet-Wall/walletwall-copilot`](https://github.com/Wallet-Wall/walletwall-copilot).

That includes changes to:

- MCP tools, schemas, resources, or server behavior
- Vault technical-readiness rules
- evidence semantics and invariant logic
- stablecoin registries and authority records
- Claude skills packaged into the distribution
- `plugin/.claude-plugin/plugin.json`
- the generated public README
- runtime dependencies included in the Claude Directory package

This repository should normally receive those changes only through the deterministic source-to-distribution sync.

## What may be changed here

Distribution-only repository governance may live under `.github/`, including:

- CI for the committed distribution
- source-pin/sync automation
- security reporting guidance
- contribution and pull-request templates

Do not hand-edit the generated plugin in `plugin/`: `server/`, `skills/`, `node_modules/`, `assets/`, `README.md`, `.mcp.json`, `.claude-plugin/`, `.gitattributes`, `LICENSE` or `PROVENANCE.json` there. Never edit them to change behavior. Those edits would create a semantic fork and will be overwritten by the next deterministic sync.

## Required release chain

A normal release follows this chain:

1. change and review the source in `Wallet-Wall/walletwall-copilot`;
2. merge the source change;
3. update `.github/source-pin.json` here to that canonical merged source SHA;
4. let the sync workflow regenerate the distribution;
5. verify `plugin/PROVENANCE.json` matches the source pin;
6. require distribution CI to pass before merging the release PR.

Distribution CI proves origin, not only self-consistency. Its `origin` job requires the pin to name `Wallet-Wall/walletwall-copilot` and a commit reachable from that repository's `main`, regenerates the package from that commit with the source's own generator, and fails on any difference from the committed `plugin/` folder, including files that are missing from `plugin/PROVENANCE.json`. The sync workflow applies the same rule before it installs or builds anything: it builds only a pinned commit that is reachable from the source repository's `main`. On a release PR that changes the pin, `origin` fails until the sync commit with the regenerated payload lands; that is expected.

## Security boundary

WalletWall for Claude is local-first and read-only. Contributions must not add signing, custody, transaction construction, transaction broadcast, trading, fund transfer, arbitrary SQL, credential injection, or silent substitution of a remote MCP endpoint.

Never commit private keys, seed phrases, credentials, service-account material, or real private user data.

## Review expectations

A reviewer should be able to answer all of the following before approving a distribution release:

- Does the source pin identify a canonical reviewed source commit?
- Does the generated provenance agree with that pin?
- Does the local MCP still expose exactly the approved six-tool surface?
- Does the package remain credential-free and local stdio by default?
- Are uncertainty and fail-closed readiness semantics preserved?
- Did the distribution verification workflow pass on the exact proposed head?
