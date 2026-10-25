# Contributing to WalletWall for Claude

`Wallet-Wall/walletwall-claude` is a generated distribution repository. It is intentionally **not** the source of truth for WalletWall evidence semantics, readiness rules, registries, MCP tools, or runtime behavior.

## Where changes belong

Open implementation changes in [`Wallet-Wall/walletwall-copilot`](https://github.com/Wallet-Wall/walletwall-copilot).

That includes changes to:

- MCP tools, schemas, resources, or server behavior
- Vault technical-readiness rules
- evidence semantics and invariant logic
- stablecoin registries and authority records
- Claude skills packaged into the distribution
- `.claude-plugin/plugin.json`
- the generated public README
- runtime dependencies included in the Claude Directory package

This repository should normally receive those changes only through the deterministic source-to-distribution sync.

## What may be changed here

Distribution-only repository governance may live under `.github/`, including:

- CI for the committed distribution
- source-pin/sync automation
- security reporting guidance
- contribution and pull-request templates

Do not hand-edit generated payload files such as `server/`, `skills/`, `node_modules/`, `README.md`, `.mcp.json`, `.claude-plugin/`, `LICENSE`, or `PROVENANCE.json` to change behavior. Those edits would create a semantic fork and will be overwritten by the next deterministic sync.

## Required release chain

A normal release follows this chain:

1. change and review the source in `Wallet-Wall/walletwall-copilot`;
2. merge the source change;
3. update `.github/source-pin.json` here to that canonical merged source SHA;
4. let the sync workflow regenerate the distribution;
5. verify `PROVENANCE.json` matches the source pin;
6. require distribution CI to pass before merging the release PR.

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
