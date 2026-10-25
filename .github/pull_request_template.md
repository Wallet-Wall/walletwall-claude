## Distribution change

### Change type

- [ ] Canonical source-pin / regenerated distribution release
- [ ] Distribution-only CI or repository governance
- [ ] Security documentation
- [ ] Other (explain below)

### Source authority

- Source repository: `Wallet-Wall/walletwall-copilot`
- Canonical source commit: `<sha or N/A>`
- `.github/source-pin.json` updated if required: [ ]
- `PROVENANCE.json` agrees with source pin if payload changed: [ ]

### Boundary checks

- [ ] No hand-maintained semantic fork was introduced in generated payload files.
- [ ] No signing, custody, transaction construction, broadcast, trading, or fund-transfer capability was added.
- [ ] No credential injection or silent remote-MCP substitution was added.
- [ ] Local stdio remains the default execution path.
- [ ] The approved six-tool surface is unchanged, or the source change explicitly reviews the contract change.
- [ ] Fail-closed evidence/readiness semantics remain intact.

### Verification

- [ ] Distribution structure/provenance verification passes.
- [ ] Raw stdio MCP startup passes.
- [ ] Exact expected tool discovery passes.
- [ ] Execution-capability drift guard passes.
- [ ] Any source-side CI required for the pinned source commit is green.

### Reviewer focus

Describe anything that deserves special attention, especially provenance, packaging, security-boundary, dependency, or Directory-facing changes.
