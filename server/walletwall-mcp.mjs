// packages/mcp/src/main.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// packages/mcp/src/server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

// packages/mcp/src/resources.ts
import { z as z4 } from "zod";

// packages/mcp/src/canonical.ts
import { createHash } from "node:crypto";

// packages/mcp/src/errors.ts
var WwError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "WwError";
    this.code = code;
  }
};

// packages/mcp/src/canonical.ts
var MAX_DEPTH = 64;
function fail() {
  throw new WwError("CANONICALIZATION_FAILED", "Value cannot be canonicalized under RFC 8785 / I-JSON rules.");
}
function hasLoneSurrogate(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 55296 && c <= 56319) {
      const n = s.charCodeAt(i + 1);
      if (n >= 56320 && n <= 57343) {
        i++;
        continue;
      }
      return true;
    }
    if (c >= 56320 && c <= 57343) return true;
  }
  return false;
}
function ser(value, numbers, depth) {
  if (depth > MAX_DEPTH) fail();
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "string":
      if (hasLoneSurrogate(value)) fail();
      return JSON.stringify(value);
    case "number":
      if (numbers === "reject" || !Number.isFinite(value)) fail();
      return String(value);
    case "object":
      break;
    default:
      return fail();
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => ser(v, numbers, depth + 1)).join(",")}]`;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) fail();
  const record = value;
  const keys = Object.keys(record);
  for (const k of keys) if (hasLoneSurrogate(k)) fail();
  keys.sort();
  const parts = [];
  for (const k of keys) {
    parts.push(`${JSON.stringify(k)}:${ser(record[k], numbers, depth + 1)}`);
  }
  return `{${parts.join(",")}}`;
}
function canonicalize(value, options = {}) {
  return ser(value, options.numbers ?? "reject", 0);
}
function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
function evidenceDigest(value, options = {}) {
  return sha256Hex(canonicalize(value, options));
}

// packages/mcp/src/quantity.ts
var UINT256_MAX = (1n << 256n) - 1n;
var MAX_DECIMALS = 36;
var ATOMIC_RE = /^(0|[1-9][0-9]{0,77})$/;
var DECIMALS_RE = /^(0|[1-9][0-9]?)$/;
function bad() {
  throw new WwError("INVALID_QUANTITY", "Quantity is not a canonical atomic-unit decimal string.");
}
function parseAtomic(text) {
  if (!ATOMIC_RE.test(text)) bad();
  const v = BigInt(text);
  if (v > UINT256_MAX) bad();
  return v;
}
function parseDecimals(text) {
  if (!DECIMALS_RE.test(text)) bad();
  const n = Number.parseInt(text, 10);
  if (n > MAX_DECIMALS) bad();
  return n;
}
function formatAtomic(amount, decimals) {
  if (amount < 0n || decimals < 0 || decimals > MAX_DECIMALS) bad();
  const digits = amount.toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, "");
  return frac.length === 0 ? whole : `${whole}.${frac}`;
}
var PRICE_RE = /^(0|[1-9][0-9]{0,40})(\.[0-9]{1,18})?$/;
function parsePriceScaled18(text) {
  if (!PRICE_RE.test(text)) bad();
  const [whole = "0", frac = ""] = text.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt(frac.padEnd(18, "0"));
}
function usdValueScaled18(atomic, decimals, priceScaled18) {
  return atomic * priceScaled18 / 10n ** BigInt(decimals);
}

// packages/mcp/src/registry.ts
import { z as z2 } from "zod";

// packages/mcp/registry/chains.json
var chains_default = {
  registryVersion: "0.2.0",
  status: "VERIFIED_POINT_IN_TIME",
  note: "Chain IDs were observed with eth_chainId from a public RPC endpoint on the verification date (a provider observation, not an authority attestation). The finality model is a descriptive WalletWall label, not a verified fact. Verification is a point-in-time check; it does not establish that anything is safe or unchanged since that date.",
  chains: [
    { chainId: "1", name: "Ethereum Mainnet", finalityModel: "ethereum-proof-of-stake-finalized-checkpoint", verification: { status: "CHAIN_OBSERVED", verifiedAt: "2026-10-24", method: "eth_chainId", observedValue: "1" } },
    { chainId: "8453", name: "Base", finalityModel: "l2-derived-from-l1-finality", verification: { status: "CHAIN_OBSERVED", verifiedAt: "2026-10-24", method: "eth_chainId", observedValue: "8453" } },
    { chainId: "42161", name: "Arbitrum One", finalityModel: "l2-derived-from-l1-finality", verification: { status: "CHAIN_OBSERVED", verifiedAt: "2026-10-24", method: "eth_chainId", observedValue: "42161" } }
  ]
};

// packages/mcp/registry/stablecoins.json
var stablecoins_default = {
  registryVersion: "0.2.0",
  status: "VERIFIED_POINT_IN_TIME",
  note: "Each record carries its own verification block. Only records whose identity is AUTHORITY_ATTESTED are loaded for lookups; anything else is excluded from the factual registry. Verification is a point-in-time check on verifiedAt. It does not establish that a contract is safe, solvent or unchanged since that date.",
  assets: [
    {
      symbol: "USDC",
      name: "USD Coin",
      chainId: "1",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      decimals: "6",
      issuerName: "Circle",
      authorityId: "issuer:circle",
      verification: {
        status: "AUTHORITY_ATTESTED",
        verifiedAt: "2026-10-24",
        identity: {
          class: "AUTHORITY_ATTESTED",
          authorityId: "issuer:circle",
          publisher: "Circle",
          url: "https://developers.circle.com/stablecoins/usdc-contract-addresses",
          locator: "Mainnet table, row Ethereum",
          publishedAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          retrievedAt: "2026-10-24"
        },
        decimals: {
          class: "CHAIN_OBSERVED",
          chainId: "1",
          blockNumber: "26259206",
          blockHash: "0x659476146e9835688850b450b798ccc2d5451d718fac9b23d39f2726d6933cc7",
          blockTimestamp: "2026-10-24T01:26:47.000Z",
          finality: "FINALIZED",
          method: "eth_call decimals()",
          observedValue: "6"
        }
      }
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      chainId: "8453",
      address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      decimals: "6",
      issuerName: "Circle",
      authorityId: "issuer:circle",
      verification: {
        status: "AUTHORITY_ATTESTED",
        verifiedAt: "2026-10-24",
        identity: {
          class: "AUTHORITY_ATTESTED",
          authorityId: "issuer:circle",
          publisher: "Circle",
          url: "https://developers.circle.com/stablecoins/usdc-contract-addresses",
          locator: "Mainnet table, row Base",
          publishedAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          retrievedAt: "2026-10-24"
        },
        decimals: {
          class: "CHAIN_OBSERVED",
          chainId: "8453",
          blockNumber: "53007918",
          blockHash: "0x372ea667de43f87f3f1763959e6dc19f3dd78084fb6c0d19c75ef49f417fd7cc",
          blockTimestamp: "2026-10-24T01:26:23.000Z",
          finality: "FINALIZED",
          method: "eth_call decimals()",
          observedValue: "6"
        }
      }
    },
    {
      symbol: "USDC",
      name: "USD Coin",
      chainId: "42161",
      address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      decimals: "6",
      issuerName: "Circle",
      authorityId: "issuer:circle",
      verification: {
        status: "AUTHORITY_ATTESTED",
        verifiedAt: "2026-10-24",
        identity: {
          class: "AUTHORITY_ATTESTED",
          authorityId: "issuer:circle",
          publisher: "Circle",
          url: "https://developers.circle.com/stablecoins/usdc-contract-addresses",
          locator: "Mainnet table, row Arbitrum",
          publishedAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          retrievedAt: "2026-10-24"
        },
        decimals: {
          class: "CHAIN_OBSERVED",
          chainId: "42161",
          blockNumber: "517700527",
          blockHash: "0x3ae0efcc296e8f0f9e07983592dd42d22152877227c0046d8485c672ddbd09aa",
          blockTimestamp: "2026-10-24T01:25:01.000Z",
          finality: "FINALIZED",
          method: "eth_call decimals()",
          observedValue: "6"
        }
      }
    },
    {
      symbol: "USDT",
      name: "Tether USD",
      chainId: "1",
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      decimals: "6",
      issuerName: "Tether",
      authorityId: "issuer:tether",
      verification: {
        status: "AUTHORITY_ATTESTED",
        verifiedAt: "2026-10-24",
        identity: {
          class: "AUTHORITY_ATTESTED",
          authorityId: "issuer:tether",
          publisher: "Tether",
          url: "https://tether.to/en/supported-protocols/",
          locator: "ERC20 Token via Ethereum Blockchain, Ethereum Network, USDT contract address",
          publishedAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
          retrievedAt: "2026-10-24"
        },
        decimals: {
          class: "CHAIN_OBSERVED",
          chainId: "1",
          blockNumber: "26259206",
          blockHash: "0x659476146e9835688850b450b798ccc2d5451d718fac9b23d39f2726d6933cc7",
          blockTimestamp: "2026-10-24T01:26:47.000Z",
          finality: "FINALIZED",
          method: "eth_call decimals()",
          observedValue: "6"
        }
      }
    },
    {
      symbol: "DAI",
      name: "Dai Stablecoin",
      chainId: "1",
      address: "0x6b175474e89094c44da98b954eedeac495271d0f",
      decimals: "18",
      issuerName: "Maker/Sky protocol",
      authorityId: "protocol:sky",
      verification: {
        status: "AUTHORITY_ATTESTED",
        verifiedAt: "2026-10-24",
        identity: {
          class: "AUTHORITY_ATTESTED",
          authorityId: "protocol:sky",
          publisher: "Sky Ecosystem chainlog",
          url: "https://chainlog.sky.money/api/mainnet/active.json",
          locator: "key MCD_DAI",
          publishedAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          retrievedAt: "2026-10-24"
        },
        decimals: {
          class: "CHAIN_OBSERVED",
          chainId: "1",
          blockNumber: "26259206",
          blockHash: "0x659476146e9835688850b450b798ccc2d5451d718fac9b23d39f2726d6933cc7",
          blockTimestamp: "2026-10-24T01:26:47.000Z",
          finality: "FINALIZED",
          method: "eth_call decimals()",
          observedValue: "18"
        }
      }
    }
  ]
};

// packages/mcp/authority-policies/policies.json
var policies_default = {
  policiesVersion: "0.1.0-draft",
  note: "Authority is claim-specific. There is no global source ranking. A policy states which origins may establish a claim type and what only corroborates it.",
  policies: [
    {
      policyId: "wwap/asset-identity/0.1",
      claimType: "ASSET_IDENTITY",
      authority: {
        authorityId: "issuer-publication",
        kind: "ISSUER_PUBLICATION",
        description: "Publication by the issuer or protocol that is appropriate to the specific stablecoin deployment. The source authorityId must equal the registry authorityId for that deployment."
      },
      authoritativeOrigins: ["AUTHORITY_ATTESTED"],
      authorityIdSource: "REGISTRY",
      corroboratingOrigins: ["CHAIN_OBSERVED", "PROVIDER_OBSERVED"],
      maxSupportWithoutAuthority: "PARTIAL",
      requiresFinality: false,
      finalityApplies: false,
      maxAgeSeconds: 2592e3,
      minIndependentCorroboration: 2,
      requiredDependencyClaimTypes: [],
      derived: false,
      subjectKeys: ["chainId", "address"],
      supersessionKeys: ["chainId", "address"],
      valueKeys: ["symbol", "decimals", "issuerAuthorityId"],
      ruleId: null
    },
    {
      policyId: "wwap/token-balance-at-block/0.1",
      claimType: "TOKEN_BALANCE_AT_BLOCK",
      authority: {
        authorityId: "canonical-chain-state",
        kind: "CANONICAL_CHAIN_STATE",
        description: "Canonical finalized chain state at the identified block. RPC and provider endpoints are transport, never authority."
      },
      authoritativeOrigins: ["CHAIN_OBSERVED"],
      authorityIdSource: "NONE",
      corroboratingOrigins: ["PROVIDER_OBSERVED"],
      maxSupportWithoutAuthority: "SUPPORTED",
      requiresFinality: true,
      finalityApplies: true,
      maxAgeSeconds: 120,
      minIndependentCorroboration: 2,
      requiredDependencyClaimTypes: [],
      derived: false,
      subjectKeys: ["chainId", "token", "holder", "blockNumber", "blockHash"],
      supersessionKeys: ["chainId", "token", "holder"],
      valueKeys: ["balanceAtomic", "decimals"],
      ruleId: null
    },
    {
      policyId: "wwap/token-usd-price/0.1",
      claimType: "TOKEN_USD_PRICE",
      authority: {
        authorityId: "none",
        kind: "NONE",
        description: "No canonical authority exists for a market price. A price is always a provider observation and can be at most SUPPORTED."
      },
      authoritativeOrigins: [],
      authorityIdSource: "NONE",
      corroboratingOrigins: ["PROVIDER_OBSERVED", "CHAIN_OBSERVED"],
      maxSupportWithoutAuthority: "SUPPORTED",
      requiresFinality: false,
      finalityApplies: false,
      maxAgeSeconds: 300,
      minIndependentCorroboration: 2,
      requiredDependencyClaimTypes: [],
      derived: false,
      subjectKeys: ["chainId", "token"],
      supersessionKeys: ["chainId", "token"],
      valueKeys: ["priceUsd"],
      ruleId: null
    },
    {
      policyId: "wwap/token-usd-value/0.1",
      claimType: "TOKEN_USD_VALUE",
      authority: {
        authorityId: "walletwall-rules",
        kind: "WALLETWALL_RULES",
        description: "A WalletWall derivation from explicit balance evidence and explicit price evidence. It never carries more support than its weakest dependency."
      },
      authoritativeOrigins: [],
      authorityIdSource: "NONE",
      corroboratingOrigins: [],
      maxSupportWithoutAuthority: "PARTIAL",
      requiresFinality: false,
      finalityApplies: true,
      maxAgeSeconds: null,
      minIndependentCorroboration: 1,
      requiredDependencyClaimTypes: ["TOKEN_BALANCE_AT_BLOCK", "TOKEN_USD_PRICE"],
      derived: true,
      subjectKeys: ["chainId", "token", "holder", "blockNumber", "blockHash"],
      supersessionKeys: ["chainId", "token", "holder"],
      valueKeys: ["usdScaled18", "rounding"],
      ruleId: "wwdr.usd-value"
    },
    {
      policyId: "wwap/vault-technical-readiness/0.1",
      claimType: "VAULT_TECHNICAL_READINESS",
      authority: {
        authorityId: "walletwall-rules",
        kind: "WALLETWALL_RULES",
        description: "WalletWall's published rules, authoritative only for the WalletWall-defined technical-readiness classification and nothing upstream of it."
      },
      authoritativeOrigins: [],
      authorityIdSource: "NONE",
      corroboratingOrigins: [],
      maxSupportWithoutAuthority: "PARTIAL",
      requiresFinality: false,
      finalityApplies: true,
      maxAgeSeconds: null,
      minIndependentCorroboration: 1,
      requiredDependencyClaimTypes: ["ASSET_IDENTITY", "TOKEN_BALANCE_AT_BLOCK"],
      derived: true,
      subjectKeys: ["chainId", "token", "holder", "blockNumber", "blockHash"],
      supersessionKeys: ["chainId", "token", "holder"],
      valueKeys: ["classification"],
      ruleId: "wwvr.vault-technical-readiness"
    }
  ],
  rules: [
    { ruleId: "wwdr.usd-value", rulesVersion: "0.1.0-draft" },
    { ruleId: "wwvr.vault-technical-readiness", rulesVersion: "0.1.0-draft" }
  ]
};

// packages/mcp/src/schemas.ts
import { z } from "zod";
var WWEP_VERSION = "0.1";
var ORIGINS = [
  "CHAIN_OBSERVED",
  "AUTHORITY_ATTESTED",
  "PROVIDER_OBSERVED",
  "USER_SUPPLIED",
  "WALLETWALL_DERIVED"
];
var SUPPORT_STATES = [
  "ESTABLISHED",
  "SUPPORTED",
  "PARTIAL",
  "CONFLICTING",
  "STALE",
  "SUPERSEDED",
  "UNKNOWN",
  "NOT_ESTABLISHED"
];
var FINALITY_STATES = ["FINALIZED", "UNFINALIZED", "UNKNOWN_FINALITY"];
var FRESHNESS_STATES = ["CURRENT", "STALE", "PINNED", "UNKNOWN_FRESHNESS"];
var SOURCE_KINDS = [
  "CHAIN_STATE",
  "ISSUER_PUBLICATION",
  "PROVIDER_ENDPOINT",
  "USER_INPUT",
  "WALLETWALL_RULES"
];
var CLAIM_TYPES = [
  "ASSET_IDENTITY",
  "TOKEN_BALANCE_AT_BLOCK",
  "TOKEN_USD_PRICE",
  "TOKEN_USD_VALUE",
  "VAULT_TECHNICAL_READINESS"
];
var OBSERVATION_RESULTS = ["VALUE", "NO_RESULT", "ERROR"];
var TEMPORALITIES = ["CURRENT", "PINNED"];
var LIMITATION_CODES = [
  "NO_SOURCE",
  "NO_RESULT",
  "DANGLING_REFERENCE",
  "TRANSPORT_FIDELITY_NOT_VERIFIED",
  "NOT_FINALIZED",
  "FINALITY_UNKNOWN",
  "STALE_EVIDENCE",
  "FRESHNESS_UNKNOWN",
  "OBSERVATION_FROM_FUTURE",
  "NO_AUTHORITATIVE_OBSERVATION",
  "NON_AUTHORITATIVE_ONLY",
  "INSUFFICIENT_INDEPENDENT_CORROBORATION",
  "DUPLICATE_EVIDENCE_COLLAPSED",
  "ORIGIN_SOURCE_KIND_MISMATCH",
  "AUTHORITY_ID_MISMATCH",
  "SUBJECT_MISMATCH",
  "INVALID_SUBJECT",
  "VALUE_MISMATCH",
  "OBSERVATION_DISAGREEMENT",
  "NOT_IN_REGISTRY",
  "CHAIN_NOT_IN_REGISTRY",
  "REGISTRY_MISMATCH",
  "REGISTRY_VERIFIED_POINT_IN_TIME",
  "SYMBOL_NOT_AUTHORITY",
  "POLICY_MISSING",
  "DERIVATION_MISSING",
  "DERIVATION_NOT_PERMITTED",
  "MISSING_REQUIRED_DEPENDENCY",
  "DEPENDENCY_CYCLE",
  "DEPENDENCY_SUPERSEDED",
  "PINNED_DEPENDENCY_FOR_CURRENT_CLAIM",
  "RULES_UNKNOWN",
  "WALLETWALL_DERIVED_NOT_UPSTREAM_AUTHORITY",
  "CONFLICT_DECLARED",
  "CONFLICT_DETECTED",
  "SUPERSEDED",
  "REGISTRY_VERSION_MISMATCH",
  "RULES_VERSION_MISMATCH",
  "PRICE_IS_PROVIDER_OBSERVATION",
  "INVALID_VALUE"
];
var CONFLICT_REASONS = ["VALUE_DISAGREEMENT", "AUTHORITY_DISAGREEMENT", "SUBJECT_DISAGREEMENT"];
var SUPERSESSION_REASONS = ["CORRECTED", "NEWER_OBSERVATION", "RULES_UPDATED", "REGISTRY_UPDATED"];
var LIMITS = {
  sources: 64,
  observations: 128,
  assertions: 128,
  derivations: 64,
  conflicts: 32,
  supersessions: 64,
  idsPerList: 32,
  recordEntries: 16,
  textLength: 128
};
var ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
var ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
var HASH_RE = /^0x[0-9a-fA-F]{64}$/;
var CHAIN_ID_RE = /^[1-9][0-9]{0,17}$/;
var ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
var SAFE_TEXT_RE = /^[A-Za-z0-9 _.:/+-]{0,128}$/;
var KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
var Id = z.string().regex(ID_RE);
var Iso = z.string().regex(ISO_RE).refine((s) => Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 19) === s.slice(0, 19), {
  message: "invalid timestamp"
});
var SafeText = z.string().regex(SAFE_TEXT_RE);
var Scalar = z.union([SafeText, z.boolean(), z.null()]);
var FlatRecord = z.record(z.string().regex(KEY_RE), Scalar).refine((r) => Object.keys(r).length <= LIMITS.recordEntries, { message: "too many entries" });
var OriginSchema = z.enum(ORIGINS);
var SupportStateSchema = z.enum(SUPPORT_STATES);
var FinalitySchema = z.enum(FINALITY_STATES);
var FreshnessSchema = z.enum(FRESHNESS_STATES);
var ClaimTypeSchema = z.enum(CLAIM_TYPES);
var LimitationSchema = z.enum(LIMITATION_CODES);
var SourceSchema = z.strictObject({
  id: Id,
  kind: z.enum(SOURCE_KINDS),
  authorityId: Id.optional(),
  transport: z.strictObject({ retrievedVia: SafeText.max(64) }).optional(),
  independenceGroup: Id.optional()
});
var ObservationSchema = z.strictObject({
  id: Id,
  sourceId: Id,
  origin: OriginSchema,
  observedAt: Iso,
  finality: FinalitySchema,
  result: z.enum(OBSERVATION_RESULTS),
  subject: FlatRecord,
  payload: FlatRecord
});
var AssertionSchema = z.strictObject({
  id: Id,
  claimType: ClaimTypeSchema,
  origin: OriginSchema,
  temporality: z.enum(TEMPORALITIES),
  subject: FlatRecord,
  value: FlatRecord.nullable(),
  observationIds: z.array(Id).max(LIMITS.idsPerList),
  derivationId: Id.optional(),
  assertedAt: Iso,
  limitations: z.array(LimitationSchema).max(LIMITS.idsPerList).optional(),
  declared: z.strictObject({
    supportState: SupportStateSchema.optional(),
    freshnessState: FreshnessSchema.optional(),
    finalityState: FinalitySchema.optional(),
    independentCorroboration: z.string().regex(/^[0-9]{1,3}$/).optional()
  }).optional()
});
var DerivationSchema = z.strictObject({
  id: Id,
  ruleId: Id,
  rulesVersion: SafeText.max(64),
  inputAssertionIds: z.array(Id).max(LIMITS.idsPerList),
  outputAssertionId: Id
});
var ConflictSchema = z.strictObject({
  id: Id,
  assertionIds: z.array(Id).min(2).max(16),
  reason: z.enum(CONFLICT_REASONS)
});
var SupersessionSchema = z.strictObject({
  id: Id,
  supersededAssertionId: Id,
  supersedingAssertionId: Id,
  effectiveAt: Iso,
  reason: z.enum(SUPERSESSION_REASONS)
});
var BundleSchema = z.strictObject({
  wwepVersion: z.literal(WWEP_VERSION),
  registryVersion: SafeText.max(64).optional(),
  rulesVersion: SafeText.max(64).optional(),
  sources: z.array(SourceSchema).max(LIMITS.sources),
  observations: z.array(ObservationSchema).max(LIMITS.observations),
  assertions: z.array(AssertionSchema).max(LIMITS.assertions),
  derivations: z.array(DerivationSchema).max(LIMITS.derivations),
  conflicts: z.array(ConflictSchema).max(LIMITS.conflicts).optional(),
  supersessions: z.array(SupersessionSchema).max(LIMITS.supersessions).optional()
});
var EvaluatedAtSchema = Iso;
var FORBIDDEN_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function hasForbiddenStructure(value) {
  let nodes = 0;
  const walk = (v, depth) => {
    if (depth > 12 || ++nodes > 2e4) return true;
    if (v === null || typeof v !== "object") return false;
    if (Array.isArray(v)) return v.some((x) => walk(x, depth + 1));
    for (const k of Object.getOwnPropertyNames(v)) {
      if (FORBIDDEN_KEYS.has(k)) return true;
      if (walk(v[k], depth + 1)) return true;
    }
    return false;
  };
  return walk(value, 0);
}
var KNOWN_PATH_SEGMENTS = /* @__PURE__ */ new Set([
  "bundle",
  "evaluatedAt",
  "assertionId",
  "identityAssertionId",
  "balanceAssertionId",
  "chainId",
  "address",
  "symbol",
  "wwepVersion",
  "registryVersion",
  "rulesVersion",
  "sources",
  "observations",
  "assertions",
  "derivations",
  "conflicts",
  "supersessions",
  "id",
  "kind",
  "authorityId",
  "transport",
  "retrievedVia",
  "independenceGroup",
  "sourceId",
  "origin",
  "observedAt",
  "finality",
  "result",
  "subject",
  "payload",
  "claimType",
  "temporality",
  "value",
  "observationIds",
  "derivationId",
  "assertedAt",
  "limitations",
  "declared",
  "supportState",
  "freshnessState",
  "finalityState",
  "independentCorroboration",
  "ruleId",
  "inputAssertionIds",
  "outputAssertionId",
  "assertionIds",
  "reason",
  "supersededAssertionId",
  "supersedingAssertionId",
  "effectiveAt",
  "token",
  "holder",
  "balanceAtomic",
  "decimals",
  "blockNumber",
  "blockHash"
]);

// packages/mcp/src/registry.ts
var DateOnly = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var Digits = z2.string().regex(/^(0|[1-9][0-9]{0,17})$/);
var ChainVerificationSchema = z2.strictObject({
  status: z2.literal("CHAIN_OBSERVED"),
  verifiedAt: DateOnly,
  method: z2.literal("eth_chainId"),
  observedValue: z2.string().regex(CHAIN_ID_RE)
});
var ChainSchema = z2.strictObject({
  chainId: z2.string().regex(CHAIN_ID_RE),
  name: z2.string().max(64),
  finalityModel: z2.string().max(64),
  verification: ChainVerificationSchema
}).refine((c) => c.verification.observedValue === c.chainId, { message: "observed chain ID differs from the record" });
var ChainsFile = z2.strictObject({
  registryVersion: z2.string(),
  status: z2.literal("VERIFIED_POINT_IN_TIME"),
  note: z2.string(),
  chains: z2.array(ChainSchema)
});
var IdentitySourceSchema = z2.strictObject({
  class: z2.literal("AUTHORITY_ATTESTED"),
  authorityId: z2.string().max(64),
  publisher: z2.string().max(64),
  url: z2.string().regex(/^https:\/\/[a-z0-9.-]+\/[^\s"']*$/).max(256),
  locator: z2.string().max(160),
  publishedAddress: z2.string().regex(ADDRESS_RE),
  retrievedAt: DateOnly
});
var DecimalsObservationSchema = z2.strictObject({
  class: z2.literal("CHAIN_OBSERVED"),
  chainId: z2.string().regex(CHAIN_ID_RE),
  blockNumber: Digits,
  blockHash: z2.string().regex(HASH_RE),
  blockTimestamp: z2.string().regex(ISO_RE),
  finality: z2.literal("FINALIZED"),
  method: z2.literal("eth_call decimals()"),
  observedValue: z2.string().regex(/^[0-9]{1,2}$/)
});
var RECORD_STATUSES = ["AUTHORITY_ATTESTED", "NOT_ESTABLISHED", "FIXTURE_ONLY"];
var AssetVerificationSchema = z2.strictObject({
  status: z2.enum(RECORD_STATUSES),
  verifiedAt: DateOnly,
  identity: IdentitySourceSchema.nullable(),
  decimals: DecimalsObservationSchema.nullable()
});
var AssetSchema = z2.strictObject({
  symbol: z2.string().max(16),
  name: z2.string().max(64),
  chainId: z2.string().regex(CHAIN_ID_RE),
  address: z2.string().regex(ADDRESS_RE),
  decimals: z2.string().regex(/^[0-9]{1,2}$/),
  issuerName: z2.string().max(64),
  authorityId: z2.string().max(64),
  verification: AssetVerificationSchema
}).superRefine((a, ctx) => {
  if (a.address !== a.address.toLowerCase()) ctx.addIssue({ code: "custom", message: "address must be stored lowercase" });
  if (a.verification.status !== "AUTHORITY_ATTESTED") return;
  const { identity, decimals } = a.verification;
  if (identity === null || identity.authorityId !== a.authorityId || identity.publishedAddress.toLowerCase() !== a.address) {
    ctx.addIssue({ code: "custom", message: "an attested record needs an authority publication that names this exact address" });
  }
  if (decimals === null || decimals.chainId !== a.chainId || decimals.observedValue !== a.decimals) {
    ctx.addIssue({ code: "custom", message: "an attested record needs a finalized decimals observation on its own chain that agrees with it" });
  }
});
var StablecoinsFile = z2.strictObject({
  registryVersion: z2.string(),
  status: z2.literal("VERIFIED_POINT_IN_TIME"),
  note: z2.string(),
  assets: z2.array(AssetSchema)
});
var PolicySchema = z2.strictObject({
  policyId: z2.string(),
  claimType: ClaimTypeSchema,
  authority: z2.strictObject({
    authorityId: z2.string(),
    kind: z2.enum(["ISSUER_PUBLICATION", "CANONICAL_CHAIN_STATE", "WALLETWALL_RULES", "NONE"]),
    description: z2.string()
  }),
  authoritativeOrigins: z2.array(OriginSchema),
  authorityIdSource: z2.enum(["REGISTRY", "NONE"]),
  corroboratingOrigins: z2.array(OriginSchema),
  maxSupportWithoutAuthority: SupportStateSchema,
  requiresFinality: z2.boolean(),
  finalityApplies: z2.boolean(),
  maxAgeSeconds: z2.number().int().positive().nullable(),
  minIndependentCorroboration: z2.number().int().positive(),
  requiredDependencyClaimTypes: z2.array(ClaimTypeSchema),
  derived: z2.boolean(),
  subjectKeys: z2.array(z2.string()),
  supersessionKeys: z2.array(z2.string()),
  valueKeys: z2.array(z2.string()),
  ruleId: z2.string().nullable()
});
var PoliciesFile = z2.strictObject({
  policiesVersion: z2.string(),
  note: z2.string(),
  policies: z2.array(PolicySchema),
  rules: z2.array(z2.strictObject({ ruleId: z2.string(), rulesVersion: z2.string() }))
});
function partitionAssets(assets) {
  return {
    established: assets.filter((a) => a.verification.status === "AUTHORITY_ATTESTED"),
    excluded: assets.filter((a) => a.verification.status !== "AUTHORITY_ATTESTED")
  };
}
var chainsFile = ChainsFile.parse(chains_default);
var stablecoinsFile = StablecoinsFile.parse(stablecoins_default);
var policiesFile = PoliciesFile.parse(policies_default);
var REGISTRY_VERSION = stablecoinsFile.registryVersion;
var REGISTRY_STATUS = stablecoinsFile.status;
var POLICIES_VERSION = policiesFile.policiesVersion;
var RULES_VERSION = "0.1.0-draft";
var partitioned = partitionAssets(stablecoinsFile.assets);
var CHAINS = chainsFile.chains;
var ASSETS = partitioned.established;
var EXCLUDED_ASSETS = partitioned.excluded;
var RULES = policiesFile.rules;
var policyByClaim = new Map(policiesFile.policies.map((p) => [p.claimType, p]));
function getPolicy(claimType) {
  return policyByClaim.get(claimType);
}
function allPolicies() {
  return policiesFile.policies;
}
function findChain(chainId) {
  return CHAINS.find((c) => c.chainId === chainId);
}
function lookupFrom(records) {
  const { established, excluded } = partitionAssets(records);
  const at = (set, chainId, address) => {
    const a = address.toLowerCase();
    return set.find((x) => x.chainId === chainId && x.address === a);
  };
  return {
    findAsset: (chainId, address) => at(established, chainId, address),
    findExcluded: (chainId, address) => at(excluded, chainId, address),
    findAssetsBySymbol: (symbol, chainId) => {
      const s = symbol.toUpperCase();
      return established.filter((x) => x.symbol.toUpperCase() === s && (chainId === void 0 || x.chainId === chainId));
    }
  };
}
var DEFAULT_LOOKUP = lookupFrom(stablecoinsFile.assets);
var findAsset = DEFAULT_LOOKUP.findAsset;
var findExcluded = DEFAULT_LOOKUP.findExcluded;
var findAssetsBySymbol = DEFAULT_LOOKUP.findAssetsBySymbol;
function ruleKnown(ruleId, rulesVersion) {
  return RULES.some((r) => r.ruleId === ruleId && r.rulesVersion === rulesVersion);
}
function registryDigest() {
  return evidenceDigest({ chains: chainsFile, assets: stablecoinsFile });
}
function policiesDigest() {
  return evidenceDigest(policiesFile, { numbers: "jcs" });
}
function rawRegistry() {
  return { stablecoins: stablecoinsFile, chains: chainsFile };
}
function rawPolicies() {
  return policiesFile;
}

// packages/mcp/src/claims.ts
var ORIGIN_SOURCE_KINDS = {
  CHAIN_OBSERVED: ["CHAIN_STATE"],
  AUTHORITY_ATTESTED: ["ISSUER_PUBLICATION"],
  PROVIDER_OBSERVED: ["PROVIDER_ENDPOINT"],
  USER_SUPPLIED: ["USER_INPUT"],
  WALLETWALL_DERIVED: ["WALLETWALL_RULES"]
};
var BLOCK_NUMBER_RE = /^(0|[1-9][0-9]{0,17})$/;
var USD_SCALED_18_RE = /^(0|[1-9][0-9]{0,139})$/;
var ROUNDING_MODES = ["FLOOR_SCALED_18"];
var READINESS_CLASSIFICATIONS = ["CRITERIA_MET", "CRITERIA_NOT_MET", "NOT_ESTABLISHED"];
var parses = (parse) => (value) => {
  try {
    parse(value);
    return true;
  } catch {
    return false;
  }
};
var safeText = (description) => ({
  accepts: (v) => SAFE_TEXT_RE.test(v),
  schema: { type: "string", pattern: SAFE_TEXT_RE.source, description }
});
var DECIMALS_RULE = {
  accepts: parses(parseDecimals),
  schema: {
    type: "string",
    pattern: DECIMALS_RE.source,
    description: `Token decimals as a decimal string, 0 to ${MAX_DECIMALS}. For a registered deployment it must equal the registry decimals.`
  }
};
var SUBJECT_KEY_RULES = {
  chainId: {
    accepts: (v) => CHAIN_ID_RE.test(v),
    schema: { type: "string", pattern: CHAIN_ID_RE.source, description: "EIP-155 chain ID as a decimal string." }
  },
  address: {
    accepts: (v) => ADDRESS_RE.test(v),
    schema: { type: "string", pattern: ADDRESS_RE.source, description: "Token contract address: 0x followed by 40 hex digits." },
    caseInsensitive: true
  },
  token: {
    accepts: (v) => ADDRESS_RE.test(v),
    schema: { type: "string", pattern: ADDRESS_RE.source, description: "Token contract address of the balance: 0x followed by 40 hex digits." },
    caseInsensitive: true
  },
  holder: {
    accepts: (v) => ADDRESS_RE.test(v),
    schema: { type: "string", pattern: ADDRESS_RE.source, description: "Account address whose balance is observed: 0x followed by 40 hex digits." },
    caseInsensitive: true
  },
  blockNumber: {
    accepts: (v) => BLOCK_NUMBER_RE.test(v),
    schema: { type: "string", pattern: BLOCK_NUMBER_RE.source, description: "Block height as a decimal string." }
  },
  blockHash: {
    accepts: (v) => HASH_RE.test(v),
    schema: { type: "string", pattern: HASH_RE.source, description: "Block hash: 0x followed by 64 hex digits." },
    caseInsensitive: true
  }
};
var CASE_INSENSITIVE_SUBJECT_KEYS = new Set(
  Object.entries(SUBJECT_KEY_RULES).filter(([, rule]) => rule.caseInsensitive === true).map(([key]) => key)
);
var CASE_NOTE = " Matched case-insensitively between an observation and its assertion; conflict grouping and supersession identity compare the exact string, so supply lowercase hex.";
var VALUE_KEY_RULES = {
  ASSET_IDENTITY: {
    symbol: safeText("Token symbol as published by the issuer or protocol. For an ESTABLISHED identity it must equal the registry symbol. A symbol is never identity on its own."),
    decimals: DECIMALS_RULE,
    issuerAuthorityId: safeText(
      "Authority identifier of the issuer or protocol publication that attests the deployment, for example the registry record's authorityId. It must equal the registry authorityId for the subject deployment and the authorityId of the attesting ISSUER_PUBLICATION source."
    )
  },
  TOKEN_BALANCE_AT_BLOCK: {
    balanceAtomic: {
      accepts: parses(parseAtomic),
      schema: { type: "string", pattern: ATOMIC_RE.source, description: "Balance in atomic units as a canonical decimal integer string, at most 2^256 - 1. Never a JSON number." }
    },
    decimals: DECIMALS_RULE
  },
  TOKEN_USD_PRICE: {
    priceUsd: {
      accepts: parses(parsePriceScaled18),
      schema: { type: "string", pattern: PRICE_RE.source, description: "USD price as a decimal string with at most 18 fractional digits. A price is a provider observation and can be at most SUPPORTED." }
    }
  },
  TOKEN_USD_VALUE: {
    usdScaled18: {
      accepts: (v) => USD_SCALED_18_RE.test(v),
      schema: { type: "string", pattern: USD_SCALED_18_RE.source, description: "USD value scaled by 10^18 as a decimal integer string, computed by rule wwdr.usd-value from balance and price evidence." }
    },
    rounding: {
      accepts: (v) => ROUNDING_MODES.includes(v),
      schema: { type: "string", enum: ROUNDING_MODES, description: "Rounding applied by the derivation rule." }
    }
  },
  VAULT_TECHNICAL_READINESS: {
    classification: {
      accepts: (v) => READINESS_CLASSIFICATIONS.includes(v),
      schema: { type: "string", enum: READINESS_CLASSIFICATIONS, description: "The published VAULT_TECHNICAL_READINESS classification. Never a generic READY." }
    }
  }
};
for (const policy of allPolicies()) {
  const shaped = Object.keys(VALUE_KEY_RULES[policy.claimType]).sort();
  const declared = [...policy.valueKeys].sort();
  if (shaped.length !== declared.length || shaped.some((k, i) => k !== declared[i])) {
    throw new Error(`value keys for ${policy.claimType} differ between the authority policy and the claim shape table`);
  }
  for (const k of policy.subjectKeys) {
    if (SUBJECT_KEY_RULES[k] === void 0) throw new Error(`subject key ${k} of ${policy.claimType} has no shape rule`);
  }
}
var KNOWN_RECORD_KEYS = /* @__PURE__ */ new Set([
  ...KNOWN_PATH_SEGMENTS,
  ...Object.keys(SUBJECT_KEY_RULES),
  ...Object.values(VALUE_KEY_RULES).flatMap((rules) => Object.keys(rules))
]);
function diagnoseRecord(rec, rules, requiredKeys) {
  const missingKeys = [];
  const invalidKeys = [];
  for (const key of requiredKeys) {
    const value = rec === null ? void 0 : rec[key];
    if (value === void 0) missingKeys.push(key);
    else if (typeof value !== "string") invalidKeys.push({ key, reason: "WRONG_TYPE" });
    else if (!(rules[key]?.accepts(value) ?? true)) invalidKeys.push({ key, reason: "INVALID_FORMAT" });
  }
  const required = new Set(requiredKeys);
  const unexpectedKeys = rec === null ? [] : Object.keys(rec).filter((k) => !required.has(k)).slice(0, LIMITS.recordEntries).map((k) => KNOWN_RECORD_KEYS.has(k) ? k : "*").sort();
  return { requiredKeys: [...requiredKeys], missingKeys, invalidKeys, unexpectedKeys };
}
function subjectValid(subject, keys) {
  for (const k of keys) {
    const v = subject[k];
    if (typeof v !== "string") return false;
    const rule = SUBJECT_KEY_RULES[k];
    if (rule !== void 0 && !rule.accepts(v)) return false;
  }
  return true;
}
function valueValid(claimType, rec) {
  if (rec === null) return false;
  const rules = VALUE_KEY_RULES[claimType];
  if (rules === void 0) return false;
  for (const [key, rule] of Object.entries(rules)) {
    const v = rec[key];
    if (typeof v !== "string" || !rule.accepts(v)) return false;
  }
  return true;
}
var CLAIMS_RESOURCE_URI = "walletwall://schemas/claims";
var SHAPE_LIMITATIONS = ["INVALID_SUBJECT", "SUBJECT_MISMATCH", "INVALID_VALUE", "VALUE_MISMATCH"];
function recordSchema(keys, rules, appliesTo) {
  const properties = {};
  for (const k of keys) {
    const rule = rules[k];
    const schema = rule?.schema ?? { type: "string", pattern: SAFE_TEXT_RE.source, description: "Output-safe text." };
    properties[k] = rule?.caseInsensitive === true ? { ...schema, description: `${schema.description}${CASE_NOTE}` } : schema;
  }
  return {
    type: "object",
    appliesTo,
    required: [...keys],
    properties,
    propertyNames: { pattern: KEY_RE.source },
    additionalProperties: {
      type: ["string", "boolean", "null"],
      description: "Accepted by the bundle schema but not part of this claim's contract. Not used to compute support, freshness or finality; still part of the record's digest and inspected by check_invariants (for example a value key naming USD on a quantity claim violates INV-11). Reported as unexpectedKeys in diagnostics when the record fails its shape."
    },
    maxProperties: LIMITS.recordEntries
  };
}
function authorityRequirement(p) {
  const kinds = (origins) => [...new Set(origins.flatMap((o) => ORIGIN_SOURCE_KINDS[o]))].join(", ");
  if (p.derived) {
    return `Established only by the WalletWall rule ${p.ruleId ?? ""} from its dependency assertions (${p.requiredDependencyClaimTypes.join(", ")}). It never carries more support than its weakest dependency and always carries WALLETWALL_DERIVED_NOT_UPSTREAM_AUTHORITY.`;
  }
  if (p.authoritativeOrigins.length === 0) {
    return `No origin can establish this claim. Observations from ${p.corroboratingOrigins.join(", ")} sources (kinds ${kinds(p.corroboratingOrigins)}) corroborate it; with at least ${p.minIndependentCorroboration} independent groups it reaches ${p.maxSupportWithoutAuthority} at most.`;
  }
  const registryRule = p.authorityIdSource === "REGISTRY" ? " The attesting source's authorityId must equal the registry authorityId for the subject deployment, otherwise AUTHORITY_ID_MISMATCH; value.symbol, value.decimals and value.issuerAuthorityId must equal the registry record, otherwise REGISTRY_MISMATCH." : " Transport such as an RPC or provider endpoint is recorded as source.transport.retrievedVia and never counts as authority.";
  const finalityRule = p.requiresFinality ? " The authoritative observation must be FINALIZED to be ESTABLISHED; otherwise it is SUPPORTED." : "";
  return `ESTABLISHED requires at least one observation with origin ${p.authoritativeOrigins.join(" or ")} from a source of kind ${kinds(p.authoritativeOrigins)}.` + registryRule + finalityRule + ` Without an authoritative observation, ${p.corroboratingOrigins.join(", ")} observations from ${p.minIndependentCorroboration} or more independent groups reach ${p.maxSupportWithoutAuthority} at most.`;
}
function claimContracts(examplesByClaim) {
  const claims = {};
  for (const p of allPolicies()) {
    const origins = [...p.authoritativeOrigins, ...p.corroboratingOrigins];
    const sourceKindByOrigin = {};
    for (const o of origins) sourceKindByOrigin[o] = ORIGIN_SOURCE_KINDS[o];
    const caseFolded = p.subjectKeys.filter((k) => CASE_INSENSITIVE_SUBJECT_KEYS.has(k));
    claims[p.claimType] = {
      policyId: p.policyId,
      derived: p.derived,
      subject: recordSchema(p.subjectKeys, SUBJECT_KEY_RULES, p.derived ? "assertion.subject" : "assertion.subject and observation.subject"),
      value: recordSchema(p.valueKeys, VALUE_KEY_RULES[p.claimType], p.derived ? "assertion.value" : "assertion.value and observation.payload"),
      observation: p.derived ? null : {
        origins: { authoritative: p.authoritativeOrigins, corroborating: p.corroboratingOrigins },
        sourceKindByOrigin,
        result: "VALUE",
        finalityApplies: p.finalityApplies,
        requiresFinality: p.requiresFinality,
        linkage: [
          "assertion.observationIds lists the ids of the observations that support it; each must exist in bundle.observations.",
          "observation.sourceId names a bundle source whose kind is listed under sourceKindByOrigin for the observation's origin.",
          caseFolded.length > 0 ? `observation.subject must equal assertion.subject on every subject key; ${caseFolded.join(", ")} match case-insensitively, the other keys exactly.` : "observation.subject must equal assertion.subject on every subject key.",
          "observation.payload must satisfy the value shape; every supporting payload must agree on the value keys and equal assertion.value on them.",
          "assertion.origin must be the origin of at least one supporting observation.",
          "An observation with result NO_RESULT or ERROR carries no value. If no supporting observation carries a value the assertion is UNKNOWN (never zero, never false); otherwise the NO_RESULT limitation is attached and the valued observations are evaluated."
        ]
      },
      assertion: {
        temporality: p.maxAgeSeconds === null ? "CURRENT or PINNED" : `CURRENT (fresh within ${p.maxAgeSeconds} seconds of evaluatedAt) or PINNED (a historical point)`,
        derivationId: p.derived ? "required: names the bundle derivation that produced this assertion" : "absent for this claim type"
      },
      authority: {
        authorityId: p.authority.authorityId,
        kind: p.authority.kind,
        authorityIdSource: p.authorityIdSource,
        maxSupportWithoutAuthority: p.maxSupportWithoutAuthority,
        minIndependentCorroboration: p.minIndependentCorroboration,
        maxAgeSeconds: p.maxAgeSeconds,
        requirement: authorityRequirement(p)
      },
      derivation: p.derived ? {
        ruleId: p.ruleId,
        requiredDependencyClaimTypes: p.requiredDependencyClaimTypes,
        linkage: "assertion.derivationId names a bundle derivation whose outputAssertionId is this assertion's id and whose inputAssertionIds name the dependency assertions; assertion.observationIds is empty and assertion.origin is WALLETWALL_DERIVED."
      } : null,
      example: examplesByClaim[p.claimType] ?? null
    };
  }
  return {
    wwepVersion: WWEP_VERSION,
    policiesVersion: POLICIES_VERSION,
    note: "Per-claim-type contract generated from the bundled authority policies and the evaluator's shape rules. assertion.subject and observation.subject share one subject shape; assertion.value and observation.payload share one value shape. The closed bundle schema is walletwall://schemas/evidence; worked synthetic inputs are served under walletwall://examples/.",
    recordRules: {
      keyPattern: KEY_RE.source,
      scalarValues: "string, boolean or null. Every evidence-critical value is a string; JSON numbers are rejected by the bundle schema.",
      textPattern: SAFE_TEXT_RE.source,
      maxEntries: LIMITS.recordEntries
    },
    diagnostics: {
      limitations: SHAPE_LIMITATIONS,
      note: "When inspect_evidence attaches one of these limitations, the assertion's diagnostics entries name the record checked (ASSERTION_SUBJECT, ASSERTION_VALUE, OBSERVATION_SUBJECT or OBSERVATION_PAYLOAD), the observationId where applicable, requiredKeys, missingKeys, invalidKeys (WRONG_TYPE or INVALID_FORMAT), unexpectedKeys and mismatchedKeys. Record values are never echoed; only observation ids already present in the evaluation appear; key names outside the contract vocabulary are reported as *; one entry per distinct observation."
    },
    claims
  };
}

// packages/mcp/src/examples.ts
var EVALUATED_AT = "2026-10-23T12:00:30Z";
var OBSERVED_AT = "2026-10-23T12:00:00Z";
var USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
var HOLDER = "0x1234567890123456789012345678901234567890";
var BLOCK_HASH = `0x${"ab".repeat(32)}`;
var BLOCK_NUMBER = "21000000";
var SOURCES = {
  chain: { id: "src-chain", kind: "CHAIN_STATE", transport: { retrievedVia: "Alchemy" }, independenceGroup: "grp-chain" },
  issuer: { id: "src-issuer", kind: "ISSUER_PUBLICATION", authorityId: "issuer:circle", independenceGroup: "grp-issuer" },
  provA: { id: "src-prov-a", kind: "PROVIDER_ENDPOINT", transport: { retrievedVia: "ProviderA" }, independenceGroup: "grp-a" },
  provB: { id: "src-prov-b", kind: "PROVIDER_ENDPOINT", transport: { retrievedVia: "ProviderB" }, independenceGroup: "grp-b" },
  user: { id: "src-user", kind: "USER_INPUT", independenceGroup: "grp-user" }
};
var source = (key) => structuredClone(SOURCES[key]);
var publishedChainSource = () => ({ ...source("chain"), transport: { retrievedVia: "ExampleRpcProvider" } });
var identityObservation = (over = {}) => ({
  id: "obs-identity",
  sourceId: "src-issuer",
  origin: "AUTHORITY_ATTESTED",
  observedAt: OBSERVED_AT,
  finality: "UNKNOWN_FINALITY",
  result: "VALUE",
  subject: { chainId: "1", address: USDC },
  payload: { symbol: "USDC", decimals: "6", issuerAuthorityId: "issuer:circle" },
  ...over
});
var balanceObservation = (over = {}) => ({
  id: "obs-balance",
  sourceId: "src-chain",
  origin: "CHAIN_OBSERVED",
  observedAt: OBSERVED_AT,
  finality: "FINALIZED",
  result: "VALUE",
  subject: { chainId: "1", token: USDC, holder: HOLDER, blockNumber: BLOCK_NUMBER, blockHash: BLOCK_HASH },
  payload: { balanceAtomic: "1500000", decimals: "6" },
  ...over
});
var identityAssertion = (over = {}) => ({
  id: "a-identity",
  claimType: "ASSET_IDENTITY",
  origin: "AUTHORITY_ATTESTED",
  temporality: "CURRENT",
  subject: { chainId: "1", address: USDC },
  value: { symbol: "USDC", decimals: "6", issuerAuthorityId: "issuer:circle" },
  observationIds: ["obs-identity"],
  assertedAt: OBSERVED_AT,
  ...over
});
var balanceAssertion = (over = {}) => ({
  id: "a-balance",
  claimType: "TOKEN_BALANCE_AT_BLOCK",
  origin: "CHAIN_OBSERVED",
  temporality: "PINNED",
  subject: { chainId: "1", token: USDC, holder: HOLDER, blockNumber: BLOCK_NUMBER, blockHash: BLOCK_HASH },
  value: { balanceAtomic: "1500000", decimals: "6" },
  observationIds: ["obs-balance"],
  assertedAt: OBSERVED_AT,
  ...over
});
function identityBundle() {
  return { wwepVersion: "0.1", sources: [source("issuer")], observations: [identityObservation()], assertions: [identityAssertion()], derivations: [] };
}
function balanceBundle() {
  return { wwepVersion: "0.1", sources: [publishedChainSource()], observations: [balanceObservation()], assertions: [balanceAssertion()], derivations: [] };
}
function readinessBundle() {
  return {
    wwepVersion: "0.1",
    sources: [source("issuer"), publishedChainSource()],
    observations: [identityObservation(), balanceObservation()],
    assertions: [identityAssertion(), balanceAssertion()],
    derivations: []
  };
}
function incompleteReadinessBundle() {
  return {
    wwepVersion: "0.1",
    sources: [publishedChainSource()],
    observations: [identityObservation({ id: "obs-identity-chain", sourceId: "src-chain", origin: "CHAIN_OBSERVED" }), balanceObservation()],
    assertions: [identityAssertion({ origin: "CHAIN_OBSERVED", observationIds: ["obs-identity-chain"] }), balanceAssertion()],
    derivations: []
  };
}
var SYNTHETIC_NOTICE = "Synthetic, illustrative evidence published by the WalletWall engine for consumers of the MCP contract. The holder address, block number, block hash, balance, timestamps, source ids, independence groups and the transport label are invented placeholders; no provider served these readings. The contract address, symbol, decimals and issuer authority are copied from the bundled registry record for the deployment so that the identity can be established. Nothing here is a claim about any real wallet, balance or chain state, and the expected states describe evidence sufficiency under the published policies, not truth.";
var PUBLISHED_EXAMPLES = [
  {
    name: "identity-established",
    title: "Established asset identity (synthetic)",
    demonstrates: "The exact ASSET_IDENTITY assertion and attesting observation shape that evaluates to ESTABLISHED against the registry.",
    claimType: "ASSET_IDENTITY",
    toolCall: { name: "inspect_evidence", arguments: { bundle: identityBundle(), evaluatedAt: EVALUATED_AT } },
    missingMeasurement: null
  },
  {
    name: "balance-established",
    title: "Established balance at a finalized block (synthetic)",
    demonstrates: "The exact TOKEN_BALANCE_AT_BLOCK assertion and chain-state observation shape that evaluates to ESTABLISHED and FINALIZED.",
    claimType: "TOKEN_BALANCE_AT_BLOCK",
    toolCall: { name: "inspect_evidence", arguments: { bundle: balanceBundle(), evaluatedAt: EVALUATED_AT } },
    missingMeasurement: null
  },
  {
    name: "vault-readiness-established",
    title: "Vault technical readiness: CRITERIA_MET (synthetic)",
    demonstrates: "A complete assess_vault_readiness call over an established identity and an established balance that classifies as CRITERIA_MET.",
    claimType: "VAULT_TECHNICAL_READINESS",
    toolCall: {
      name: "assess_vault_readiness",
      arguments: { bundle: readinessBundle(), evaluatedAt: EVALUATED_AT, identityAssertionId: "a-identity", balanceAssertionId: "a-balance" }
    },
    missingMeasurement: null
  },
  {
    name: "vault-readiness-not-established",
    title: "Vault technical readiness: NOT_ESTABLISHED (synthetic, incomplete evidence)",
    demonstrates: "A well-formed assess_vault_readiness call whose identity is only chain-observed: no issuer attestation exists, the identity is PARTIAL and readiness fails closed to NOT_ESTABLISHED.",
    claimType: "VAULT_TECHNICAL_READINESS",
    toolCall: {
      name: "assess_vault_readiness",
      arguments: { bundle: incompleteReadinessBundle(), evaluatedAt: EVALUATED_AT, identityAssertionId: "a-identity", balanceAssertionId: "a-balance" }
    },
    missingMeasurement: "An AUTHORITY_ATTESTED observation of the identity from an ISSUER_PUBLICATION source whose authorityId equals the registry authorityId for the deployment."
  }
];
var EXAMPLE_URI_PREFIX = "walletwall://examples/";
var EXAMPLE_BY_CLAIM = {
  ASSET_IDENTITY: `${EXAMPLE_URI_PREFIX}identity-established`,
  TOKEN_BALANCE_AT_BLOCK: `${EXAMPLE_URI_PREFIX}balance-established`,
  VAULT_TECHNICAL_READINESS: `${EXAMPLE_URI_PREFIX}vault-readiness-established`
};

// packages/mcp/src/generated/content.ts
var SPEC_WWEP_MD = "# WalletWall Evidence Profile 0.1 (WWEP 0.1) \u2014 DRAFT\n\nStatus: **draft, pre-release**. This is a WalletWall-defined profile. It is **not** an industry standard,\nhas not been reviewed outside WalletWall, and makes no claim of interoperability beyond the W3C PROV alignment\ndescribed in section 9.\n\nKey words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119 / RFC 8174 when in capitals.\n\n## 1. Purpose and non-purpose\n\nWWEP defines a structured record of *what evidence was presented, from where, with what authority, and with what\nlimits*, and a deterministic procedure that classifies how well that evidence supports a claim.\n\nWWEP **does not** establish that upstream evidence is true. Every state defined here describes the *sufficiency of\npresented evidence under a published policy*. A state such as `ESTABLISHED` means \"the presented evidence satisfies\nthe policy for this claim type\", never \"this is verified truth\". WWEP also says nothing about arbitrary natural\nlanguage prose produced later by a language model.\n\n## 2. Versions\n\n| Identifier | Value | Meaning |\n| --- | --- | --- |\n| `EvidenceProfileVersion` | `0.1` | The profile version in every bundle (`wwepVersion`). |\n| `RegistryVersion` | `0.2.0` | Version of the bundled asset and chain registry. Record-level, point-in-time verification (see `DATA_SOURCES.md`). |\n| `RulesVersion` | `0.1.0-draft` | Version of the derivation rules (`wwdr.usd-value`, `wwvr.vault-technical-readiness`). |\n\nA bundle MUST declare `wwepVersion: \"0.1\"`. Any other value MUST be rejected. See `VERSIONING.md`.\n\n## 3. Evidence-origin classes\n\nEvery observation and assertion has exactly one origin class.\n\n| Origin | Meaning |\n| --- | --- |\n| `CHAIN_OBSERVED` | A value read from canonical chain state at an identified block. The transport used to read it (RPC, indexer, local node) is recorded separately and carries no authority. |\n| `AUTHORITY_ATTESTED` | A statement published by the issuer or protocol that is the appropriate authority for the claim. |\n| `PROVIDER_OBSERVED` | A value that a third-party provider reports on its own behalf (price feed, labeling, indexed analytics). |\n| `USER_SUPPLIED` | A value supplied by the person using the tool. |\n| `WALLETWALL_DERIVED` | A value computed by a published WalletWall rule from other assertions. |\n\nEach origin corresponds to a fixed set of source kinds (`CHAIN_OBSERVED`\u2192`CHAIN_STATE`,\n`AUTHORITY_ATTESTED`\u2192`ISSUER_PUBLICATION`, `PROVIDER_OBSERVED`\u2192`PROVIDER_ENDPOINT`, `USER_SUPPLIED`\u2192`USER_INPUT`,\n`WALLETWALL_DERIVED`\u2192`WALLETWALL_RULES`). An observation whose source kind does not match its origin MUST NOT\nqualify as evidence of that origin (limitation `ORIGIN_SOURCE_KIND_MISMATCH`, invariant INV-13).\n\n## 4. Data model\n\nAll evidence-critical values are strings. JSON numbers MUST NOT appear in evidence objects. Quantities are\ncanonical atomic-unit decimal strings (section 7). Every object is closed: unknown properties are rejected.\n\n- **Source** \u2014 `{id, kind, authorityId?, transport?{retrievedVia}, independenceGroup?}`. Where evidence came from.\n  `transport.retrievedVia` is metadata only.\n- **Observation** \u2014 `{id, sourceId, origin, observedAt, finality, result, subject, payload}`. One reading.\n  `result` is `VALUE`, `NO_RESULT` or `ERROR`. `NO_RESULT` and `ERROR` carry no value.\n- **Assertion** \u2014 `{id, claimType, origin, temporality, subject, value|null, observationIds, derivationId?,\n  assertedAt, limitations?, declared?}`. A claim about a subject, backed by observations or by a derivation.\n  `temporality` is `CURRENT` (must be fresh) or `PINNED` (a historical point such as a block).\n  `declared` lets an author state the support, freshness, finality and corroboration they *believe* apply; the\n  engine never trusts it and reports any excess as a violation.\n- **Derivation** \u2014 `{id, ruleId, rulesVersion, inputAssertionIds, outputAssertionId}`. A WalletWall rule applied to\n  assertions. Derivations take assertions only, never raw observations.\n- **EvidenceDependency** \u2014 the directed edge `assertion \u2192 input` induced by a derivation's `inputAssertionIds` (and\n  by an assertion's `observationIds`). Dependencies are computed, not stored separately.\n- **Authority** \u2014 the entity or state that may establish a claim type, e.g. `canonical-chain-state`,\n  `issuer-publication`, `walletwall-rules`.\n- **AuthorityPolicy** \u2014 the per-claim-type rules for authority, corroboration, finality, freshness and required\n  dependencies (`authority-policies/policies.json`, see `AUTHORITY_MODEL.md`).\n- **ClaimContract** \u2014 the per-claim-type subject and value shape (required keys and their formats), the observation\n  origins and source kinds that may establish or corroborate the claim, and the observation-to-assertion linkage. An\n  assertion's `subject` and each supporting observation's `subject` share one shape; an assertion's `value` and each\n  supporting observation's `payload` share one shape. The engine serves the contract as `walletwall://schemas/claims`.\n- **SupportState**, **FreshnessState**, **FinalityState** \u2014 section 5.\n- **Conflict** \u2014 `{id, assertionIds, reason}` declared by an author, or detected by the engine when two\n  non-superseded assertions about the same claim identity carry different values. Conflicts are never auto-resolved.\n- **Limitation** \u2014 a code from a closed enumeration attached to a result that explains why it is weaker than it\n  might look (for example `TRANSPORT_FIDELITY_NOT_VERIFIED`, `NOT_FINALIZED`, `REGISTRY_VERIFIED_POINT_IN_TIME`).\n- **Supersession** \u2014 `{id, supersededAssertionId, supersedingAssertionId, effectiveAt, reason}`. A newer assertion\n  replaces an older one; the older assertion stays in the bundle and is reported `SUPERSEDED`.\n- **RegistryVersion**, **RulesVersion**, **EvidenceProfileVersion** \u2014 section 2.\n\n## 5. States\n\nExact semantics are in `SUPPORT_STATES.md`. Summary:\n\n- Support: `ESTABLISHED`, `SUPPORTED`, `PARTIAL`, `CONFLICTING`, `STALE`, `SUPERSEDED`, `UNKNOWN`, `NOT_ESTABLISHED`.\n- Freshness: `CURRENT`, `STALE`, `PINNED`, `UNKNOWN_FRESHNESS`.\n- Finality: `FINALIZED`, `UNFINALIZED`, `UNKNOWN_FINALITY`; `null` when finality does not apply to the claim type.\n\nWhen states are combined across dependencies the **weakest** member wins, in this order from strongest to weakest:\n`ESTABLISHED > SUPPORTED > PARTIAL > STALE > SUPERSEDED > UNKNOWN > CONFLICTING > NOT_ESTABLISHED`.\n\n## 6. Mandatory evidence invariants\n\nThese are enforced by `check_invariants` and by executable conformance tests. Each has an identifier.\n\n1. **INV-01** `NO_SOURCE \u2192 NO_FACT`. An assertion with no observation and no derivation MUST NOT carry a value or be\n   presented as `PARTIAL` or stronger.\n2. **INV-02** `STALE` MUST NOT satisfy `CURRENT`.\n3. **INV-03** `CONFLICTING` MUST NOT satisfy `ESTABLISHED`.\n4. **INV-04** `NO_RESULT` MUST NOT become `ZERO`.\n5. **INV-05** `UNKNOWN` MUST NOT become `FALSE`.\n6. **INV-06** `WALLETWALL_DERIVED` MUST NOT masquerade as upstream authority.\n7. **INV-07** Processing evidence MUST NOT increase the authority of its inputs.\n8. **INV-08** Duplicate evidence MUST NOT increase independent corroboration.\n9. **INV-09** Multiple provider endpoints MUST NOT automatically imply independent authority.\n10. **INV-10** Derived results retain the limitations of their dependencies.\n11. **INV-11** Token quantity MUST NOT silently become USD value without explicit price evidence.\n12. **INV-12** Historical assertions are superseded, never silently rewritten.\n13. **INV-13** Source transport and source authority are separate concepts. `retrievedVia = Alchemy` does not imply\n    `authority = Alchemy` for Ethereum state.\n\n**INV-00** (engine rule) \u2014 declared states MUST NOT exceed states computed by the published rules.\n\n## 7. Canonicalization and digests\n\nEvidence objects are serialized with the **RFC 8785 JSON Canonicalization Scheme** and hashed with **SHA-256**.\n`JSON.stringify` output MUST NOT be hashed. The implementation additionally rejects lone surrogates (I-JSON),\nnon-plain objects and every JSON number in evidence objects.\n\nEvidence-critical quantities are canonical atomic-unit decimal strings matching `^(0|[1-9][0-9]{0,77})$` and not\nexceeding `2^256 \u2212 1`. Decimals are strings matching `^(0|[1-9][0-9]?)$` and at most 36. Arithmetic uses `BigInt`.\nDecimal renderings are exact and unrounded. JavaScript `Number` MUST NOT hold a token balance.\n\nTwo digests are defined for an observation: the **evidence digest** (canonical form of the whole observation) and the\n**content digest** (canonical form of `{result, subject, payload}`), used to detect duplicate evidence.\n\n## 8. Evaluation\n\nEvaluation is a pure function of `(bundle, evaluatedAt, registry, policies, rules)`. The evaluation time is an\nexplicit input; the engine never reads a clock. Procedure and per-claim policies are in `AUTHORITY_MODEL.md` and\n`SUPPORT_STATES.md`. In outline:\n\n1. Reject any bundle that fails the closed schema.\n2. Mark superseded assertions; detect declared and value-disagreement conflicts among non-superseded assertions.\n3. For each assertion, evaluate directly (observations) or by derivation (dependencies, recursively).\n4. Cap and combine states by the weakest-member rule; apply freshness and finality; attach limitations.\n5. Independently check the invariants and report violations without mutating results.\n\nA shape failure is an evaluation state, not a schema rejection: an assertion whose subject or value, or whose supporting\nobservation's subject or payload, does not meet the claim contract is reported `NOT_ESTABLISHED` with the limitation\n`INVALID_SUBJECT`, `SUBJECT_MISMATCH`, `INVALID_VALUE` or `VALUE_MISMATCH`. Each such limitation carries a structured\n`diagnostics` entry naming the record checked, the required keys and the missing, invalid, unexpected or mismatched keys.\nDiagnostics are deterministic and bounded (one entry per distinct observation), never include record values (only\nobservation ids already present in the evaluation), and report key names outside the contract vocabulary as `*`. The\nlimitation codes are the stable machine-facing reason; diagnostics only explain them.\n\n## 9. Provenance alignment\n\n`trace_provenance` emits a graph shaped like W3C PROV-JSON: observations and assertions are `entity`, derivations are\n`activity`, sources and the WalletWall rule engine are `agent`; relations use `wasDerivedFrom`, `wasAttributedTo`,\n`wasGeneratedBy`, `used` and `wasRevisionOf` (supersession). The mapping is a profile of PROV, not a full\nimplementation, and the namespace `urn:walletwall:wwep:0.1:` is an identifier that is never dereferenced.\n\n## 10. Readiness terminology\n\nWWEP defines `VAULT_TECHNICAL_READINESS`, never a generic `READY`. Its values are `CRITERIA_MET`,\n`CRITERIA_NOT_MET` and `NOT_ESTABLISHED`. It does **not** establish investment merit, solvency, creditworthiness,\nlegal status, regulatory compliance, absence of fraud, or future performance.\n\n## 11. Known limitations of 0.1\n\n- Evidence is evaluated as presented. The engine cannot verify that a `CHAIN_OBSERVED` reading was faithfully\n  retrieved (`TRANSPORT_FIDELITY_NOT_VERIFIED` is always attached).\n- Registry content is verified only at a point in time (`REGISTRY_VERIFIED_POINT_IN_TIME`); later changes to a contract are not observed.\n- Address checksums (EIP-55) are not verified; addresses are compared case-insensitively.\n- No live providers exist; all evidence is supplied by the caller.\n- Only five claim types are defined: `ASSET_IDENTITY`, `TOKEN_BALANCE_AT_BLOCK`, `TOKEN_USD_PRICE`,\n  `TOKEN_USD_VALUE`, `VAULT_TECHNICAL_READINESS`.\n";

// packages/mcp/src/tools.ts
import { z as z3 } from "zod";

// packages/mcp/src/evaluate.ts
var SUPPORT_RANK = {
  ESTABLISHED: 7,
  SUPPORTED: 6,
  PARTIAL: 5,
  STALE: 4,
  SUPERSEDED: 3,
  UNKNOWN: 2,
  CONFLICTING: 1,
  NOT_ESTABLISHED: 0
};
function weakest(states) {
  let out;
  for (const s of states) if (out === void 0 || SUPPORT_RANK[s] < SUPPORT_RANK[out]) out = s;
  return out ?? "NOT_ESTABLISHED";
}
var FINALITY_ORDER = ["UNFINALIZED", "UNKNOWN_FINALITY", "FINALIZED"];
function weakestFinality(states) {
  for (const s of FINALITY_ORDER) if (states.includes(s)) return s;
  return "UNKNOWN_FINALITY";
}
function indexBy(items, dups, kind) {
  const m = /* @__PURE__ */ new Map();
  for (const it of items) {
    if (m.has(it.id)) {
      dups.push({
        invariant: kind === "ASSERTION" ? "INV-12" : "INV-00",
        code: `DUPLICATE_${kind}_ID`,
        assertionId: kind === "ASSERTION" ? it.id : null
      });
    } else {
      m.set(it.id, it);
    }
  }
  return m;
}
function indexBundle(bundle) {
  const duplicateIds = [];
  return {
    sources: indexBy(bundle.sources, duplicateIds, "SOURCE"),
    observations: indexBy(bundle.observations, duplicateIds, "OBSERVATION"),
    assertions: indexBy(bundle.assertions, duplicateIds, "ASSERTION"),
    derivations: indexBy(bundle.derivations, duplicateIds, "DERIVATION"),
    duplicateIds
  };
}
function pick(rec, keys) {
  if (rec === null) return null;
  const out = {};
  for (const k of keys) {
    const v = rec[k];
    if (v === void 0) return null;
    out[k] = v;
  }
  return out;
}
function sameCanonical(a, b) {
  return canonicalize(a) === canonicalize(b);
}
function subjectKeyEqual(key, a, b) {
  return CASE_INSENSITIVE_SUBJECT_KEYS.has(key) ? a.toLowerCase() === b.toLowerCase() : a === b;
}
function subjectMatches(obsSubject, assertionSubject, keys) {
  for (const k of keys) {
    const a = obsSubject[k];
    const b = assertionSubject[k];
    if (typeof a !== "string" || typeof b !== "string") return false;
    if (!subjectKeyEqual(k, a, b)) return false;
  }
  return true;
}
function subjectMismatchDiagnostic(o, a, keys) {
  const mismatchedKeys = [];
  for (const k of keys) {
    const ov = o.subject[k];
    const av = a.subject[k];
    if (typeof ov === "string" && typeof av === "string" && !subjectKeyEqual(k, ov, av)) mismatchedKeys.push(k);
  }
  return {
    limitation: "SUBJECT_MISMATCH",
    record: "OBSERVATION_SUBJECT",
    observationId: o.id,
    ...diagnoseRecord(o.subject, SUBJECT_KEY_RULES, keys),
    mismatchedKeys
  };
}
function independenceGroup(s) {
  return s.independenceGroup ?? "unspecified";
}
function emptyCore(policy) {
  return {
    support: "NOT_ESTABLISHED",
    freshness: "UNKNOWN_FRESHNESS",
    finality: policy?.finalityApplies === true ? "UNKNOWN_FINALITY" : null,
    authoritySatisfied: false,
    limitations: /* @__PURE__ */ new Set(),
    diagnostics: [],
    corroboration: 0,
    observationIds: [],
    assertionIds: []
  };
}
function evaluateBundle(bundle, evaluatedAt) {
  const idx = indexBundle(bundle);
  const evalMs = Date.parse(evaluatedAt);
  const violations = [...idx.duplicateIds];
  const supersededBy = /* @__PURE__ */ new Map();
  for (const s of bundle.supersessions ?? []) {
    if (!supersededBy.has(s.supersededAssertionId)) supersededBy.set(s.supersededAssertionId, s.supersedingAssertionId);
  }
  const conflictsWith = /* @__PURE__ */ new Map();
  const conflictCause = /* @__PURE__ */ new Map();
  const link = (ids, cause) => {
    for (const id of ids) {
      if (!idx.assertions.has(id)) continue;
      const set = conflictsWith.get(id) ?? /* @__PURE__ */ new Set();
      for (const other of ids) if (other !== id && idx.assertions.has(other)) set.add(other);
      if (set.size > 0) {
        conflictsWith.set(id, set);
        if (!conflictCause.has(id)) conflictCause.set(id, cause);
      }
    }
  };
  for (const c of bundle.conflicts ?? []) link(c.assertionIds, "CONFLICT_DECLARED");
  const groups = /* @__PURE__ */ new Map();
  for (const a of idx.assertions.values()) {
    if (supersededBy.has(a.id)) continue;
    const policy = getPolicy(a.claimType);
    const subjectKey = canonicalize(policy ? pick(a.subject, policy.subjectKeys) : a.subject);
    const key = `${a.claimType}|${a.temporality}|${subjectKey}`;
    const arr = groups.get(key) ?? [];
    arr.push(a);
    groups.set(key, arr);
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const policy = getPolicy(members[0]?.claimType ?? "ASSET_IDENTITY");
    const values = new Set(members.map((m) => canonicalize(policy ? pick(m.value, policy.valueKeys) : m.value)));
    if (values.size > 1) link(members.map((m) => m.id), "CONFLICT_DETECTED");
  }
  const memo = /* @__PURE__ */ new Map();
  const inProgress = /* @__PURE__ */ new Set();
  const bundleLimitations = [];
  if (bundle.registryVersion !== void 0 && bundle.registryVersion !== REGISTRY_VERSION) {
    bundleLimitations.push("REGISTRY_VERSION_MISMATCH");
  }
  if (bundle.rulesVersion !== void 0 && bundle.rulesVersion !== RULES_VERSION) {
    bundleLimitations.push("RULES_VERSION_MISMATCH");
  }
  const evalAssertion = (a) => {
    const cached = memo.get(a.id);
    if (cached) return cached;
    const policy = getPolicy(a.claimType);
    let core;
    if (inProgress.has(a.id)) {
      core = emptyCore(policy);
      core.limitations.add("DEPENDENCY_CYCLE");
      return finish(a, policy, core, true);
    }
    inProgress.add(a.id);
    if (policy === void 0) {
      core = emptyCore(policy);
      core.limitations.add("POLICY_MISSING");
    } else if (a.derivationId !== void 0) {
      core = evalDerived(a, policy);
    } else {
      core = evalDirect(a, policy);
    }
    inProgress.delete(a.id);
    return finish(a, policy, core, false);
  };
  const finish = (a, policy, core, transient) => {
    let support = core.support;
    const limitations = new Set(core.limitations);
    for (const l of bundleLimitations) limitations.add(l);
    const sup = supersededBy.get(a.id) ?? null;
    const conflicts = [...conflictsWith.get(a.id) ?? []].sort();
    if (sup !== null) {
      support = "SUPERSEDED";
      limitations.add("SUPERSEDED");
    } else if (conflicts.length > 0) {
      support = "CONFLICTING";
      limitations.add(conflictCause.get(a.id) ?? "CONFLICT_DETECTED");
    }
    const result = {
      assertionId: a.id,
      claimType: a.claimType,
      origin: a.origin,
      temporality: a.temporality,
      supportState: support,
      freshnessState: core.freshness,
      finalityState: core.finality,
      authority: policy ? {
        authorityId: policy.authority.authorityId,
        kind: policy.authority.kind,
        scope: a.claimType,
        satisfied: core.authoritySatisfied
      } : null,
      limitations: [...limitations].sort(),
      diagnostics: core.diagnostics,
      independentCorroboration: core.corroboration,
      conflictsWith: conflicts,
      supersededBy: sup,
      dependencies: { observationIds: core.observationIds, assertionIds: core.assertionIds },
      policyId: policy?.policyId ?? null,
      digest: evidenceDigest(a)
    };
    if (!transient) memo.set(a.id, result);
    return result;
  };
  const evalDirect = (a, policy) => {
    const core = emptyCore(policy);
    const lim = core.limitations;
    const obs = [];
    for (const id of a.observationIds) {
      const o = idx.observations.get(id);
      if (o) {
        obs.push(o);
      } else {
        lim.add("DANGLING_REFERENCE");
        violations.push({ invariant: "INV-00", code: "DANGLING_REFERENCE", assertionId: a.id });
      }
    }
    core.observationIds = obs.map((o) => o.id);
    if (obs.length === 0) {
      lim.add("NO_SOURCE");
      return core;
    }
    if (obs.some((o) => o.origin === "CHAIN_OBSERVED")) lim.add("TRANSPORT_FIDELITY_NOT_VERIFIED");
    const valueObs = obs.filter((o) => o.result === "VALUE");
    if (valueObs.length < obs.length) lim.add("NO_RESULT");
    if (valueObs.length === 0) {
      core.support = "UNKNOWN";
      return core;
    }
    if (!subjectValid(a.subject, policy.subjectKeys)) {
      lim.add("INVALID_SUBJECT");
      core.diagnostics.push({
        limitation: "INVALID_SUBJECT",
        record: "ASSERTION_SUBJECT",
        observationId: null,
        ...diagnoseRecord(a.subject, SUBJECT_KEY_RULES, policy.subjectKeys),
        mismatchedKeys: []
      });
      return core;
    }
    const diagnosed = /* @__PURE__ */ new Set();
    const subjectMismatches = valueObs.filter((o) => !subjectMatches(o.subject, a.subject, policy.subjectKeys));
    if (subjectMismatches.length > 0) {
      lim.add("SUBJECT_MISMATCH");
      for (const o of subjectMismatches) {
        if (diagnosed.has(o.id)) continue;
        diagnosed.add(o.id);
        core.diagnostics.push(subjectMismatchDiagnostic(o, a, policy.subjectKeys));
      }
      return core;
    }
    const invalidPayloads = valueObs.filter((o) => !valueValid(a.claimType, o.payload));
    if (invalidPayloads.length > 0) {
      lim.add("INVALID_VALUE");
      for (const o of invalidPayloads) {
        if (diagnosed.has(o.id)) continue;
        diagnosed.add(o.id);
        core.diagnostics.push({
          limitation: "INVALID_VALUE",
          record: "OBSERVATION_PAYLOAD",
          observationId: o.id,
          ...diagnoseRecord(o.payload, VALUE_KEY_RULES[a.claimType], policy.valueKeys),
          mismatchedKeys: []
        });
      }
      return core;
    }
    const contents = new Set(valueObs.map((o) => canonicalize(pick(o.payload, policy.valueKeys))));
    if (contents.size > 1) {
      lim.add("OBSERVATION_DISAGREEMENT");
      core.support = "CONFLICTING";
      core.finality = policy.finalityApplies ? weakestFinality(valueObs.map((o) => o.finality)) : null;
      return core;
    }
    const first = valueObs[0];
    if (first === void 0) return core;
    if (!valueValid(a.claimType, a.value)) {
      lim.add("VALUE_MISMATCH");
      core.diagnostics.push({
        limitation: "VALUE_MISMATCH",
        record: "ASSERTION_VALUE",
        observationId: null,
        ...diagnoseRecord(a.value, VALUE_KEY_RULES[a.claimType], policy.valueKeys),
        mismatchedKeys: []
      });
      return core;
    }
    if (!sameCanonical(pick(a.value, policy.valueKeys), pick(first.payload, policy.valueKeys))) {
      lim.add("VALUE_MISMATCH");
      core.diagnostics.push({
        limitation: "VALUE_MISMATCH",
        record: "ASSERTION_VALUE",
        observationId: first.id,
        ...diagnoseRecord(a.value, VALUE_KEY_RULES[a.claimType], policy.valueKeys),
        mismatchedKeys: policy.valueKeys.filter((k) => canonicalize(a.value?.[k] ?? null) !== canonicalize(first.payload[k] ?? null))
      });
      return core;
    }
    const chainKnown = typeof a.subject["chainId"] === "string" && findChain(a.subject["chainId"]) !== void 0;
    let cap = "ESTABLISHED";
    if (a.claimType === "ASSET_IDENTITY" || a.claimType === "TOKEN_BALANCE_AT_BLOCK") {
      if (!chainKnown) {
        lim.add("CHAIN_NOT_IN_REGISTRY");
        cap = "PARTIAL";
      }
    }
    const regAddress = a.claimType === "ASSET_IDENTITY" ? a.subject["address"] : a.subject["token"];
    const entry = typeof a.subject["chainId"] === "string" && typeof regAddress === "string" ? findAsset(a.subject["chainId"], regAddress) : void 0;
    if (a.claimType === "ASSET_IDENTITY" || a.claimType === "TOKEN_BALANCE_AT_BLOCK" || a.claimType === "TOKEN_USD_PRICE") {
      if (entry === void 0) {
        lim.add("NOT_IN_REGISTRY");
        if (a.claimType === "ASSET_IDENTITY") cap = "PARTIAL";
      } else {
        lim.add("REGISTRY_VERIFIED_POINT_IN_TIME");
        const decimalsMismatch = a.value !== null && typeof a.value["decimals"] === "string" && a.value["decimals"] !== entry.decimals;
        const identityMismatch = a.claimType === "ASSET_IDENTITY" && a.value !== null && (a.value["symbol"] !== entry.symbol || a.value["issuerAuthorityId"] !== entry.authorityId);
        if (decimalsMismatch || identityMismatch) {
          lim.add("REGISTRY_MISMATCH");
          return core;
        }
      }
    }
    const qualified = [];
    const corroborating = [];
    for (const o of valueObs) {
      const isAuth = policy.authoritativeOrigins.includes(o.origin);
      const isCorro = policy.corroboratingOrigins.includes(o.origin);
      if (!isAuth && !isCorro) continue;
      const s = idx.sources.get(o.sourceId);
      if (s === void 0) {
        lim.add("DANGLING_REFERENCE");
        continue;
      }
      if (!ORIGIN_SOURCE_KINDS[o.origin].includes(s.kind)) {
        lim.add("ORIGIN_SOURCE_KIND_MISMATCH");
        continue;
      }
      if (isAuth) {
        if (policy.authorityIdSource === "REGISTRY" && (entry === void 0 || s.authorityId !== entry.authorityId)) {
          lim.add("AUTHORITY_ID_MISMATCH");
          continue;
        }
        qualified.push(o);
      } else {
        corroborating.push(o);
      }
    }
    const finalityBasis = qualified.length > 0 ? qualified : valueObs;
    const finality = policy.finalityApplies ? weakestFinality(finalityBasis.map((o) => o.finality)) : null;
    core.finality = finality;
    const distinct = /* @__PURE__ */ new Set();
    let raw = 0;
    const counted = [...qualified, ...corroborating];
    for (const o of counted) {
      raw++;
      const s = idx.sources.get(o.sourceId);
      if (s) distinct.add(`${independenceGroup(s)}|${evidenceDigest(pick(o.payload, policy.valueKeys))}`);
    }
    if (distinct.size < raw) lim.add("DUPLICATE_EVIDENCE_COLLAPSED");
    const groupSet = /* @__PURE__ */ new Set();
    for (const o of counted) {
      const s = idx.sources.get(o.sourceId);
      if (s) groupSet.add(independenceGroup(s));
    }
    core.corroboration = groupSet.size;
    let support;
    if (qualified.length > 0) {
      core.authoritySatisfied = true;
      if (policy.requiresFinality && finality !== "FINALIZED") {
        support = "SUPPORTED";
        lim.add(finality === "UNKNOWN_FINALITY" ? "FINALITY_UNKNOWN" : "NOT_FINALIZED");
      } else {
        support = "ESTABLISHED";
      }
    } else if (corroborating.length > 0) {
      lim.add("NO_AUTHORITATIVE_OBSERVATION");
      if (groupSet.size >= policy.minIndependentCorroboration) {
        support = weakest(["SUPPORTED", policy.maxSupportWithoutAuthority]);
      } else {
        support = "PARTIAL";
        lim.add("INSUFFICIENT_INDEPENDENT_CORROBORATION");
      }
      if (policy.requiresFinality && finality !== "FINALIZED") {
        support = weakest([support, "PARTIAL"]);
        lim.add(finality === "UNKNOWN_FINALITY" ? "FINALITY_UNKNOWN" : "NOT_FINALIZED");
      }
    } else {
      support = "PARTIAL";
      lim.add("NON_AUTHORITATIVE_ONLY");
    }
    if (a.claimType === "ASSET_IDENTITY" && qualified.length === 0 && valueObs.some((o) => o.origin === "CHAIN_OBSERVED" || o.origin === "PROVIDER_OBSERVED")) {
      lim.add("SYMBOL_NOT_AUTHORITY");
    }
    if (a.claimType === "TOKEN_USD_PRICE") lim.add("PRICE_IS_PROVIDER_OBSERVATION");
    support = weakest([support, cap]);
    if (a.temporality === "PINNED") {
      core.freshness = "PINNED";
    } else {
      let newest = Number.NEGATIVE_INFINITY;
      for (const o of valueObs) newest = Math.max(newest, Date.parse(o.observedAt));
      if (newest > evalMs) {
        core.freshness = "UNKNOWN_FRESHNESS";
        lim.add("OBSERVATION_FROM_FUTURE");
      } else if (policy.maxAgeSeconds === null) {
        core.freshness = "UNKNOWN_FRESHNESS";
        lim.add("FRESHNESS_UNKNOWN");
      } else if ((evalMs - newest) / 1e3 > policy.maxAgeSeconds) {
        core.freshness = "STALE";
        lim.add("STALE_EVIDENCE");
      } else {
        core.freshness = "CURRENT";
      }
      if (core.freshness === "STALE") support = weakest([support, "STALE"]);
      if (core.freshness === "UNKNOWN_FRESHNESS") support = weakest([support, "PARTIAL"]);
    }
    core.support = support;
    return core;
  };
  const evalDerived = (a, policy) => {
    const core = emptyCore(policy);
    const lim = core.limitations;
    core.corroboration = null;
    const d = a.derivationId === void 0 ? void 0 : idx.derivations.get(a.derivationId);
    if (d === void 0 || d.outputAssertionId !== a.id) {
      lim.add("DERIVATION_MISSING");
      return core;
    }
    if (!policy.derived) {
      lim.add("DERIVATION_NOT_PERMITTED");
      return core;
    }
    const deps = [];
    for (const id of d.inputAssertionIds) {
      const dep = idx.assertions.get(id);
      if (dep === void 0) {
        lim.add("DANGLING_REFERENCE");
        violations.push({ invariant: "INV-00", code: "DANGLING_REFERENCE", assertionId: a.id });
        continue;
      }
      deps.push(evalAssertion(dep));
    }
    core.assertionIds = deps.map((x) => x.assertionId);
    lim.add("WALLETWALL_DERIVED_NOT_UPSTREAM_AUTHORITY");
    for (const dep of deps) for (const l of dep.limitations) lim.add(l);
    if (deps.length === 0 || d.inputAssertionIds.length !== deps.length) {
      lim.add("NO_SOURCE");
      return core;
    }
    for (const required of policy.requiredDependencyClaimTypes) {
      if (!deps.some((x) => x.claimType === required)) {
        lim.add("MISSING_REQUIRED_DEPENDENCY");
        return core;
      }
    }
    const supports = [];
    let anyStale = false;
    for (const dep of deps) {
      if (dep.supportState === "SUPERSEDED") {
        supports.push("STALE");
        anyStale = true;
        lim.add("DEPENDENCY_SUPERSEDED");
      } else {
        supports.push(dep.supportState);
      }
    }
    let support = weakest(supports);
    if (!(policy.ruleId === d.ruleId && ruleKnown(d.ruleId, d.rulesVersion))) {
      lim.add(policy.ruleId === d.ruleId ? "RULES_VERSION_MISMATCH" : "RULES_UNKNOWN");
      support = weakest([support, "PARTIAL"]);
    }
    const finalities = deps.map((x) => x.finalityState).filter((x) => x !== null);
    core.finality = finalities.length > 0 ? weakestFinality(finalities) : null;
    core.authoritySatisfied = true;
    const depFresh = deps.map((x) => x.freshnessState);
    if (a.temporality === "PINNED") {
      core.freshness = "PINNED";
    } else if (anyStale || depFresh.includes("STALE")) {
      core.freshness = "STALE";
      lim.add("STALE_EVIDENCE");
    } else if (depFresh.includes("UNKNOWN_FRESHNESS")) {
      core.freshness = "UNKNOWN_FRESHNESS";
    } else if (depFresh.includes("PINNED")) {
      core.freshness = "UNKNOWN_FRESHNESS";
      lim.add("PINNED_DEPENDENCY_FOR_CURRENT_CLAIM");
      support = weakest([support, "PARTIAL"]);
    } else {
      core.freshness = "CURRENT";
    }
    if (core.freshness === "STALE") support = weakest([support, "STALE"]);
    core.support = support;
    return core;
  };
  const results = [...idx.assertions.values()].map(evalAssertion).sort((x, y) => x.assertionId < y.assertionId ? -1 : 1);
  return {
    evaluatedAt,
    bundleDigest: evidenceDigest(bundle),
    versions: { wwep: bundle.wwepVersion, registry: REGISTRY_VERSION, policies: POLICIES_VERSION, rules: RULES_VERSION },
    assertions: results,
    violations
  };
}

// packages/mcp/src/readiness.ts
var READINESS_RULE_ID = "wwvr.vault-technical-readiness";
var READINESS_RULES_VERSION = RULES_VERSION;
var DOES_NOT_ESTABLISH = [
  "investment merit",
  "solvency",
  "creditworthiness",
  "legal status",
  "regulatory compliance",
  "absence of fraud",
  "future performance"
];
var DESCRIPTIONS = {
  C1: "Asset identity is established against the WalletWall registry and issuer or protocol authority.",
  C2: "Balance observation is established at a finalized block from canonical chain state.",
  C3: "Balance subject refers to the same chain and token contract as the asset identity.",
  C4: "Decimals agree between the identity assertion and the balance assertion.",
  C5: "Neither input assertion is conflicting or superseded.",
  C6: "Every current-temporality input is fresh under its authority policy."
};
function find(evalById, id) {
  return evalById.get(id);
}
function assessReadiness(bundle, evaluation, identityAssertionId, balanceAssertionId) {
  const evalById = new Map(evaluation.assertions.map((e) => [e.assertionId, e]));
  const aById = new Map(bundle.assertions.map((a) => [a.id, a]));
  const idEval = find(evalById, identityAssertionId);
  const balEval = find(evalById, balanceAssertionId);
  const idA = aById.get(identityAssertionId);
  const balA = aById.get(balanceAssertionId);
  const typed = idEval?.claimType === "ASSET_IDENTITY" && balEval?.claimType === "TOKEN_BALANCE_AT_BLOCK";
  const criteria = [];
  const add = (id, outcome, reason) => {
    criteria.push({ id, description: DESCRIPTIONS[id], outcome, reason });
  };
  if (!typed || !idA || !balA || !idEval || !balEval) {
    for (const id of Object.keys(DESCRIPTIONS)) {
      add(id, "INDETERMINATE", "REQUIRED_INPUT_ASSERTION_MISSING_OR_WRONG_CLAIM_TYPE");
    }
  } else {
    if (idEval.limitations.includes("REGISTRY_MISMATCH")) add("C1", "NOT_MET", "REGISTRY_MISMATCH");
    else if (idEval.limitations.includes("NOT_IN_REGISTRY")) add("C1", "NOT_MET", "NOT_IN_REGISTRY");
    else if (idEval.supportState === "ESTABLISHED") add("C1", "MET", "IDENTITY_ESTABLISHED");
    else add("C1", "INDETERMINATE", `IDENTITY_${idEval.supportState}`);
    if (balEval.supportState === "ESTABLISHED") add("C2", "MET", "BALANCE_ESTABLISHED");
    else add("C2", "INDETERMINATE", `BALANCE_${balEval.supportState}`);
    const sameChain = idA.subject["chainId"] === balA.subject["chainId"];
    const idAddr = idA.subject["address"];
    const balToken = balA.subject["token"];
    const sameToken = typeof idAddr === "string" && typeof balToken === "string" && idAddr.toLowerCase() === balToken.toLowerCase();
    add("C3", sameChain && sameToken ? "MET" : "NOT_MET", sameChain && sameToken ? "SUBJECT_CONSISTENT" : "SUBJECT_INCONSISTENT");
    const idDec = idA.value?.["decimals"];
    const balDec = balA.value?.["decimals"];
    if (typeof idDec !== "string" || typeof balDec !== "string") add("C4", "INDETERMINATE", "DECIMALS_MISSING");
    else add("C4", idDec === balDec ? "MET" : "NOT_MET", idDec === balDec ? "DECIMALS_CONSISTENT" : "DECIMALS_INCONSISTENT");
    const bad2 = (e) => e.supportState === "CONFLICTING" || e.supportState === "SUPERSEDED" || e.conflictsWith.length > 0;
    add("C5", bad2(idEval) || bad2(balEval) ? "INDETERMINATE" : "MET", bad2(idEval) || bad2(balEval) ? "CONFLICT_OR_SUPERSESSION" : "NO_CONFLICT");
    const freshOk = (e) => e.temporality === "PINNED" || e.freshnessState === "CURRENT";
    add("C6", freshOk(idEval) && freshOk(balEval) ? "MET" : "INDETERMINATE", freshOk(idEval) && freshOk(balEval) ? "FRESH_OR_PINNED" : "NOT_CURRENT");
  }
  const classification = criteria.some((c) => c.outcome === "NOT_MET") ? "CRITERIA_NOT_MET" : criteria.some((c) => c.outcome === "INDETERMINATE") ? "NOT_ESTABLISHED" : "CRITERIA_MET";
  const inputs = [idEval, balEval].filter((e) => e !== void 0).map((e) => ({ assertionId: e.assertionId, claimType: e.claimType, supportState: e.supportState, digest: e.digest }));
  const limitations = /* @__PURE__ */ new Set(["WALLETWALL_DERIVED_NOT_UPSTREAM_AUTHORITY"]);
  for (const e of [idEval, balEval]) if (e) for (const l of e.limitations) limitations.add(l);
  const subjectBase = balA?.subject ?? {};
  const outputId = "readiness-result";
  const derivationId = "readiness-derivation";
  const balancePinned = balEval?.temporality === "PINNED";
  const suggestedAssertion = {
    id: outputId,
    claimType: "VAULT_TECHNICAL_READINESS",
    origin: "WALLETWALL_DERIVED",
    temporality: balancePinned ? "PINNED" : "CURRENT",
    subject: subjectBase,
    value: { classification },
    observationIds: [],
    derivationId,
    assertedAt: evaluation.evaluatedAt,
    limitations: [...limitations].sort()
  };
  const suggestedDerivation = {
    id: derivationId,
    ruleId: READINESS_RULE_ID,
    rulesVersion: READINESS_RULES_VERSION,
    inputAssertionIds: [identityAssertionId, balanceAssertionId],
    outputAssertionId: outputId
  };
  const core = {
    classification,
    criteria,
    inputs,
    ruleId: READINESS_RULE_ID,
    rulesVersion: READINESS_RULES_VERSION
  };
  return {
    claimType: "VAULT_TECHNICAL_READINESS",
    classification,
    ruleId: READINESS_RULE_ID,
    rulesVersion: READINESS_RULES_VERSION,
    criteria,
    inputs,
    supportOfInputs: weakest(inputs.map((i) => i.supportState)),
    limitations: [...limitations].sort(),
    doesNotEstablish: DOES_NOT_ESTABLISH,
    suggestedDerivation,
    suggestedAssertion,
    resultDigest: evidenceDigest(core)
  };
}

// packages/mcp/src/invariants.ts
var INVARIANT_TEXT = {
  "INV-00": "Declared states MUST NOT exceed states computed by the published rules.",
  "INV-01": "NO_SOURCE -> NO_FACT.",
  "INV-02": "STALE MUST NOT satisfy CURRENT.",
  "INV-03": "CONFLICTING MUST NOT satisfy ESTABLISHED.",
  "INV-04": "NO_RESULT MUST NOT become ZERO.",
  "INV-05": "UNKNOWN MUST NOT become FALSE.",
  "INV-06": "WALLETWALL_DERIVED MUST NOT masquerade as upstream authority.",
  "INV-07": "Processing evidence MUST NOT increase the authority of its inputs.",
  "INV-08": "Duplicate evidence MUST NOT increase independent corroboration.",
  "INV-09": "Multiple provider endpoints MUST NOT automatically imply independent authority.",
  "INV-10": "Derived results retain the limitations of their dependencies.",
  "INV-11": "Token quantity MUST NOT silently become USD value without explicit price evidence.",
  "INV-12": "Historical assertions are superseded, never silently rewritten.",
  "INV-13": "Source transport and source authority are separate concepts."
};
var CANONICAL_AUTHORITY_PREFIXES = ["canonical-chain-state", "issuer:", "protocol:", "issuer-publication"];
var isZeroLike = (v) => typeof v === "string" && /^0+(\.0+)?$/.test(v);
function declaredSupportAtLeast(a, rank) {
  const s = a.declared?.supportState;
  return s !== void 0 && SUPPORT_RANK[s] >= rank;
}
function checkInvariants(bundle, evaluation) {
  const out = [...evaluation.violations];
  const idx = indexBundle(bundle);
  const evalById = new Map(evaluation.assertions.map((e) => [e.assertionId, e]));
  const push = (invariant, code, assertionId) => {
    out.push({ invariant, code, assertionId });
  };
  for (const s of bundle.sources) {
    const via = s.transport?.retrievedVia.toLowerCase();
    if (s.authorityId !== void 0 && (s.kind === "PROVIDER_ENDPOINT" && CANONICAL_AUTHORITY_PREFIXES.some((p) => s.authorityId?.startsWith(p)) || via !== void 0 && s.authorityId.toLowerCase() === via)) {
      push("INV-13", "TRANSPORT_AS_AUTHORITY", null);
    }
  }
  for (const o of bundle.observations) {
    const s = idx.sources.get(o.sourceId);
    if (s === void 0) push("INV-00", "DANGLING_REFERENCE", null);
    else if (!ORIGIN_SOURCE_KINDS[o.origin].includes(s.kind)) push("INV-13", "ORIGIN_SOURCE_KIND_MISMATCH", null);
  }
  for (const a of bundle.assertions) {
    const e = evalById.get(a.id);
    if (e === void 0) continue;
    const obs = a.observationIds.map((id) => idx.observations.get(id)).filter((o) => o !== void 0);
    const derived = a.derivationId !== void 0;
    let specificSupportFlag = false;
    if (!derived && a.observationIds.length === 0 && (a.value !== null || declaredSupportAtLeast(a, SUPPORT_RANK.PARTIAL))) {
      push("INV-01", "NO_SOURCE_PRESENTED_AS_FACT", a.id);
      specificSupportFlag = true;
    }
    if (!derived && obs.length > 0 && obs.every((o) => o.result !== "VALUE") && a.value !== null) {
      const vals = Object.values(a.value);
      if (vals.some(isZeroLike)) push("INV-04", "NO_RESULT_AS_ZERO", a.id);
      else if (vals.some((v) => v === false)) push("INV-05", "UNKNOWN_AS_FALSE", a.id);
      else push("INV-01", "NO_RESULT_AS_VALUE", a.id);
      specificSupportFlag = true;
    }
    const declared = a.declared;
    if (declared?.supportState !== void 0 && SUPPORT_RANK[declared.supportState] >= SUPPORT_RANK.SUPPORTED) {
      if (a.temporality === "CURRENT" && e.freshnessState === "STALE") {
        push("INV-02", "STALE_SATISFIES_CURRENT", a.id);
        specificSupportFlag = true;
      }
    }
    if (declared?.freshnessState === "CURRENT" && e.freshnessState === "STALE") {
      push("INV-02", "STALE_DECLARED_CURRENT", a.id);
    }
    if (declared?.supportState === "ESTABLISHED" && e.supportState === "CONFLICTING") {
      push("INV-03", "CONFLICT_SATISFIES_ESTABLISHED", a.id);
      specificSupportFlag = true;
    }
    if (a.origin !== "WALLETWALL_DERIVED" && derived) {
      push("INV-06", "DERIVED_MASQUERADES_AS_UPSTREAM_ORIGIN", a.id);
    } else if (a.origin === "WALLETWALL_DERIVED" && !derived) {
      push("INV-06", "DERIVED_WITHOUT_DERIVATION", a.id);
    } else if (!derived && obs.length > 0 && !obs.some((o) => o.origin === a.origin)) {
      push("INV-06", "ORIGIN_NOT_PRESENT_IN_BASIS", a.id);
    }
    const policy = getPolicy(a.claimType);
    if (derived) {
      const d = a.derivationId === void 0 ? void 0 : idx.derivations.get(a.derivationId);
      const deps = (d?.inputAssertionIds ?? []).map((id) => evalById.get(id)).filter((x) => x !== void 0);
      if (declared?.supportState !== void 0 && SUPPORT_RANK[declared.supportState] > SUPPORT_RANK[e.supportState]) {
        push("INV-07", "PROCESSING_INCREASES_AUTHORITY", a.id);
        specificSupportFlag = true;
      }
      const declaredLimits = new Set(a.limitations ?? []);
      if (deps.some((dep) => dep.limitations.some((l) => !declaredLimits.has(l)))) {
        push("INV-10", "DEPENDENCY_LIMITATIONS_DROPPED", a.id);
      }
      if (a.claimType === "TOKEN_USD_VALUE" && !deps.some((dep) => dep.claimType === "TOKEN_USD_PRICE")) {
        push("INV-11", "USD_VALUE_WITHOUT_PRICE_EVIDENCE", a.id);
      }
      if (d !== void 0 && policy?.ruleId === d.ruleId) recompute(bundle, evaluation, a, d.inputAssertionIds, push);
    }
    if (a.claimType !== "TOKEN_USD_PRICE" && a.claimType !== "TOKEN_USD_VALUE" && a.value !== null) {
      if (Object.keys(a.value).some((k) => /usd/i.test(k))) push("INV-11", "QUANTITY_CLAIM_CARRIES_USD", a.id);
    }
    if (declared?.independentCorroboration !== void 0 && e.independentCorroboration !== null) {
      if (Number.parseInt(declared.independentCorroboration, 10) > e.independentCorroboration) {
        const providerBasis = obs.some((o) => o.origin === "PROVIDER_OBSERVED");
        const dup = e.limitations.includes("DUPLICATE_EVIDENCE_COLLAPSED");
        if (providerBasis && !dup) push("INV-09", "PROVIDER_ENDPOINTS_COUNTED_AS_INDEPENDENT", a.id);
        else push("INV-08", "CORROBORATION_OVERCOUNT", a.id);
      }
    }
    if (!specificSupportFlag && declared?.supportState !== void 0 && SUPPORT_RANK[declared.supportState] > SUPPORT_RANK[e.supportState]) {
      push("INV-00", "DECLARED_SUPPORT_EXCEEDS_COMPUTED", a.id);
    }
    if (declared?.finalityState === "FINALIZED" && e.finalityState !== null && e.finalityState !== "FINALIZED") {
      push("INV-00", "DECLARED_FINALITY_EXCEEDS_COMPUTED", a.id);
    }
    if (declared?.freshnessState === "CURRENT" && e.freshnessState !== "CURRENT" && e.freshnessState !== "STALE") {
      push("INV-00", "DECLARED_FRESHNESS_EXCEEDS_COMPUTED", a.id);
    }
  }
  const supersededIds = /* @__PURE__ */ new Set();
  for (const s of bundle.supersessions ?? []) {
    const oldA = idx.assertions.get(s.supersededAssertionId);
    const newA = idx.assertions.get(s.supersedingAssertionId);
    if (oldA === void 0 || newA === void 0 || s.supersededAssertionId === s.supersedingAssertionId) {
      push("INV-12", "SUPERSESSION_REFERENCE_INVALID", s.supersededAssertionId);
      continue;
    }
    if (supersededIds.has(oldA.id)) push("INV-12", "SUPERSEDED_MULTIPLE_TIMES", oldA.id);
    supersededIds.add(oldA.id);
    const pol = getPolicy(oldA.claimType);
    const sameIdentity = oldA.claimType === newA.claimType && canonicalize(pol ? pick(oldA.subject, pol.supersessionKeys) : oldA.subject) === canonicalize(pol ? pick(newA.subject, pol.supersessionKeys) : newA.subject);
    if (!sameIdentity) push("INV-12", "SUPERSESSION_CLAIM_IDENTITY_MISMATCH", oldA.id);
    if (Date.parse(newA.assertedAt) <= Date.parse(oldA.assertedAt)) push("INV-12", "SUPERSESSION_NOT_FORWARD_IN_TIME", oldA.id);
  }
  const chain = new Map((bundle.supersessions ?? []).map((s) => [s.supersededAssertionId, s.supersedingAssertionId]));
  for (const start of chain.keys()) {
    const seen = /* @__PURE__ */ new Set([start]);
    let cur = chain.get(start);
    while (cur !== void 0) {
      if (seen.has(cur)) {
        push("INV-12", "SUPERSESSION_CYCLE", start);
        break;
      }
      seen.add(cur);
      cur = chain.get(cur);
    }
  }
  const seenKey = /* @__PURE__ */ new Set();
  return out.filter((v) => {
    const k = `${v.invariant}|${v.code}|${v.assertionId ?? ""}`;
    if (seenKey.has(k)) return false;
    seenKey.add(k);
    return true;
  }).sort((x, y) => {
    const kx = `${x.assertionId ?? ""}|${x.invariant}|${x.code}`;
    const ky = `${y.assertionId ?? ""}|${y.invariant}|${y.code}`;
    return kx < ky ? -1 : kx > ky ? 1 : 0;
  });
}
function recompute(bundle, evaluation, a, inputIds, push) {
  const byId = new Map(bundle.assertions.map((x) => [x.id, x]));
  const inputs = inputIds.map((id) => byId.get(id)).filter((x) => x !== void 0);
  const mismatch = () => push("INV-00", "RECOMPUTATION_MISMATCH", a.id);
  if (a.claimType === "TOKEN_USD_VALUE") {
    const bal = inputs.find((x) => x.claimType === "TOKEN_BALANCE_AT_BLOCK");
    const price = inputs.find((x) => x.claimType === "TOKEN_USD_PRICE");
    if (bal === void 0 || price === void 0 || a.value === null) return;
    try {
      const sameToken = bal.subject["chainId"] === price.subject["chainId"] && String(bal.subject["token"]).toLowerCase() === String(price.subject["token"]).toLowerCase();
      const atomic = parseAtomic(String(bal.value?.["balanceAtomic"]));
      const decimals = parseDecimals(String(bal.value?.["decimals"]));
      const p = parsePriceScaled18(String(price.value?.["priceUsd"]));
      const expected = usdValueScaled18(atomic, decimals, p).toString();
      if (!sameToken || a.value["usdScaled18"] !== expected || a.value["rounding"] !== "FLOOR_SCALED_18") mismatch();
    } catch {
      mismatch();
    }
    return;
  }
  if (a.claimType === "VAULT_TECHNICAL_READINESS") {
    const ident = inputs.find((x) => x.claimType === "ASSET_IDENTITY");
    const bal = inputs.find((x) => x.claimType === "TOKEN_BALANCE_AT_BLOCK");
    if (ident === void 0 || bal === void 0 || a.value === null) return;
    const r = assessReadiness(bundle, evaluation, ident.id, bal.id);
    if (r.ruleId !== READINESS_RULE_ID || a.value["classification"] !== r.classification) mismatch();
  }
}

// packages/mcp/src/normalize.ts
function normalizeObservation(draft) {
  const subject = {
    chainId: draft.chainId,
    token: draft.token.toLowerCase(),
    holder: draft.holder.toLowerCase(),
    blockNumber: draft.blockNumber,
    blockHash: draft.blockHash.toLowerCase()
  };
  let payload = {};
  let balanceDecimal = null;
  if (draft.result === "VALUE") {
    if (draft.balanceAtomic === void 0 || draft.decimals === void 0) {
      throw new WwError("INVALID_QUANTITY", "VALUE observations require balanceAtomic and decimals.");
    }
    const atomic = parseAtomic(draft.balanceAtomic);
    const decimals = parseDecimals(draft.decimals);
    payload = { balanceAtomic: atomic.toString(), decimals: String(decimals) };
    balanceDecimal = formatAtomic(atomic, decimals);
  }
  const observation = {
    id: draft.id,
    sourceId: draft.sourceId,
    origin: draft.origin,
    observedAt: draft.observedAt,
    finality: draft.finality,
    result: draft.result,
    subject,
    payload
  };
  return {
    observation,
    canonicalJson: canonicalize(observation),
    evidenceDigest: evidenceDigest(observation),
    contentDigest: evidenceDigest({ result: draft.result, subject, payload }),
    balanceDecimal
  };
}

// packages/mcp/src/provenance.ts
var NS = "ww";
var PROV_NAMESPACE = "urn:walletwall:wwep:0.1:";
function traceProvenance(bundle, assertionId) {
  const idx = indexBundle(bundle);
  const prov = {
    prefix: { [NS]: PROV_NAMESPACE },
    entity: {},
    activity: {},
    agent: {},
    wasDerivedFrom: {},
    wasAttributedTo: {},
    wasGeneratedBy: {},
    used: {},
    wasRevisionOf: {}
  };
  const issues = [];
  const lineage = [];
  const visited = /* @__PURE__ */ new Set();
  const stack = /* @__PURE__ */ new Set();
  let relCounter = 0;
  const rel = (p) => `${NS}:${p}${++relCounter}`;
  const target = idx.assertions.get(assertionId);
  if (target === void 0) {
    return { target: assertionId, lineage, prov, issues: [{ code: "TARGET_NOT_FOUND", id: null }] };
  }
  const addObservation = (id, depth) => {
    const o = idx.observations.get(id);
    if (o === void 0) {
      issues.push({ code: "DANGLING_REFERENCE", id });
      return;
    }
    const key = `${NS}:obs/${o.id}`;
    if (prov.entity[key] !== void 0) return;
    lineage.push({ id: o.id, kind: "observation", depth });
    prov.entity[key] = {
      "prov:type": "ww:Observation",
      "ww:origin": o.origin,
      "ww:result": o.result,
      "ww:finality": o.finality,
      "prov:generatedAtTime": o.observedAt
    };
    const s = idx.sources.get(o.sourceId);
    if (s === void 0) {
      issues.push({ code: "DANGLING_REFERENCE", id: o.sourceId });
      return;
    }
    const agentKey = `${NS}:source/${s.id}`;
    prov.agent[agentKey] = {
      "prov:type": "ww:Source",
      "ww:kind": s.kind,
      "ww:authorityId": s.authorityId ?? null,
      "ww:independenceGroup": s.independenceGroup ?? null,
      "ww:retrievedVia": s.transport?.retrievedVia ?? null
    };
    prov.wasAttributedTo[rel("attr")] = { "prov:entity": key, "prov:agent": agentKey };
  };
  const walk = (id, depth) => {
    const a = idx.assertions.get(id);
    if (a === void 0) {
      issues.push({ code: "DANGLING_REFERENCE", id });
      return;
    }
    if (stack.has(id)) {
      issues.push({ code: "DEPENDENCY_CYCLE", id });
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    stack.add(id);
    const key = `${NS}:assertion/${a.id}`;
    lineage.push({ id: a.id, kind: "assertion", depth });
    prov.entity[key] = {
      "prov:type": "ww:Assertion",
      "ww:claimType": a.claimType,
      "ww:origin": a.origin,
      "ww:temporality": a.temporality,
      "prov:generatedAtTime": a.assertedAt
    };
    for (const oid of a.observationIds) {
      addObservation(oid, depth + 1);
      if (idx.observations.has(oid)) {
        prov.wasDerivedFrom[rel("der")] = { "prov:generatedEntity": key, "prov:usedEntity": `${NS}:obs/${oid}` };
      }
    }
    if (a.derivationId !== void 0) {
      const d = idx.derivations.get(a.derivationId);
      if (d === void 0) {
        issues.push({ code: "DANGLING_REFERENCE", id: a.derivationId });
      } else {
        const actKey = `${NS}:derivation/${d.id}`;
        prov.activity[actKey] = { "prov:type": "ww:Derivation", "ww:ruleId": d.ruleId, "ww:rulesVersion": d.rulesVersion };
        prov.agent[`${NS}:agent/walletwall-rules`] = { "prov:type": "ww:WalletWallRules" };
        prov.wasGeneratedBy[rel("gen")] = { "prov:entity": key, "prov:activity": actKey };
        prov.wasAttributedTo[rel("attr")] = { "prov:entity": key, "prov:agent": `${NS}:agent/walletwall-rules` };
        for (const dep of d.inputAssertionIds) {
          prov.used[rel("use")] = { "prov:activity": actKey, "prov:entity": `${NS}:assertion/${dep}` };
          prov.wasDerivedFrom[rel("der")] = { "prov:generatedEntity": key, "prov:usedEntity": `${NS}:assertion/${dep}` };
          walk(dep, depth + 1);
        }
      }
    }
    for (const s of bundle.supersessions ?? []) {
      if (s.supersedingAssertionId === id && idx.assertions.has(s.supersededAssertionId)) {
        prov.wasRevisionOf[rel("rev")] = {
          "prov:generatedEntity": key,
          "prov:usedEntity": `${NS}:assertion/${s.supersededAssertionId}`
        };
        walk(s.supersededAssertionId, depth + 1);
      }
    }
    stack.delete(id);
  };
  walk(assertionId, 0);
  return { target: assertionId, lineage, prov, issues };
}

// packages/mcp/src/resolve.ts
var view = (a) => ({
  symbol: a.symbol,
  name: a.name,
  chainId: a.chainId,
  address: a.address,
  decimals: a.decimals,
  issuerName: a.issuerName,
  authorityId: a.authorityId,
  verification: a.verification
});
function resolveAsset(input, lookup = DEFAULT_LOOKUP) {
  const { findAsset: findAsset2, findAssetsBySymbol: findAssetsBySymbol2, findExcluded: findExcluded2 } = lookup;
  const base = { origin: "WALLETWALL_DERIVED", registry: { version: REGISTRY_VERSION, status: REGISTRY_STATUS } };
  const snapshot = "REGISTRY_VERIFIED_POINT_IN_TIME";
  if (input.address !== void 0 && input.chainId !== void 0) {
    if (findChain(input.chainId) === void 0) {
      return {
        ...base,
        resolution: "CHAIN_NOT_IN_REGISTRY",
        supportState: "NOT_ESTABLISHED",
        asset: null,
        candidates: [],
        limitations: ["CHAIN_NOT_IN_REGISTRY"],
        notes: []
      };
    }
    const hit = findAsset2(input.chainId, input.address);
    if (hit === void 0) {
      const excluded = findExcluded2(input.chainId, input.address) !== void 0;
      return {
        ...base,
        resolution: "NOT_IN_REGISTRY",
        supportState: "NOT_ESTABLISHED",
        asset: null,
        candidates: [],
        limitations: ["NOT_IN_REGISTRY"],
        notes: [
          excluded ? "A registry record exists for this address but its identity is not authority-attested, so it is excluded from the factual registry." : "Absence from the registry does not mean the contract is fraudulent; it means WalletWall has no identity for it."
        ]
      };
    }
    return {
      ...base,
      resolution: "REGISTRY_MATCH",
      supportState: "PARTIAL",
      asset: view(hit),
      candidates: [],
      limitations: [snapshot, "NO_AUTHORITATIVE_OBSERVATION"],
      notes: [
        `Registry match only. The record was verified against an authority publication on ${hit.verification.verifiedAt}; no issuer attestation was presented with this query, so identity is not ESTABLISHED.`
      ]
    };
  }
  const matches = findAssetsBySymbol2(input.symbol ?? "", input.chainId);
  if (matches.length === 0) {
    return {
      ...base,
      resolution: "NO_SYMBOL_MATCH",
      supportState: "NOT_ESTABLISHED",
      asset: null,
      candidates: [],
      limitations: ["NOT_IN_REGISTRY", "SYMBOL_NOT_AUTHORITY"],
      notes: ["A symbol is not an identity. Identify assets by chain ID and contract address."]
    };
  }
  return {
    ...base,
    resolution: "SYMBOL_CANDIDATES",
    supportState: "PARTIAL",
    asset: null,
    candidates: matches.map(view),
    limitations: [snapshot, "SYMBOL_NOT_AUTHORITY"],
    notes: ["Symbols are not unique. Spoofed tokens reuse symbols. Confirm chain ID and contract address before relying on any candidate."]
  };
}

// packages/mcp/src/tools.ts
var Id2 = z3.string().regex(ID_RE);
var ChainId = z3.string().regex(CHAIN_ID_RE);
var Address = z3.string().regex(ADDRESS_RE);
var ResolveAssetInput = z3.strictObject({
  chainId: ChainId.optional(),
  address: Address.optional(),
  symbol: z3.string().regex(/^[A-Za-z0-9]{1,16}$/).optional()
}).refine((v) => (v.address === void 0 || v.chainId !== void 0) && (v.address !== void 0 || v.symbol !== void 0), {
  message: "provide chainId with address, or a symbol"
});
var BundleAtInput = z3.strictObject({ bundle: BundleSchema, evaluatedAt: EvaluatedAtSchema });
var TraceInput = z3.strictObject({ bundle: BundleSchema, assertionId: Id2 });
var NormalizeInput = z3.strictObject({
  id: Id2,
  sourceId: Id2,
  origin: z3.enum(ORIGINS),
  observedAt: EvaluatedAtSchema,
  finality: z3.enum(FINALITY_STATES),
  result: z3.enum(OBSERVATION_RESULTS),
  chainId: ChainId,
  token: Address,
  holder: Address,
  blockNumber: z3.string().regex(/^(0|[1-9][0-9]{0,17})$/),
  blockHash: z3.string().regex(HASH_RE),
  balanceAtomic: z3.string().regex(/^(0|[1-9][0-9]{0,77})$/).optional(),
  decimals: z3.string().regex(/^(0|[1-9][0-9]?)$/).optional()
});
var ReadinessInput = z3.strictObject({
  bundle: BundleSchema,
  evaluatedAt: EvaluatedAtSchema,
  identityAssertionId: Id2,
  balanceAssertionId: Id2
});
function defineTool(def) {
  return def;
}
var TOOLS = [
  defineTool({
    name: "resolve_asset",
    title: "Resolve stablecoin deployment",
    description: "Look up a stablecoin deployment in the bundled WalletWall registry by chain ID and contract address, or list candidate deployments for a symbol. Offline and read-only. A registry match is a WalletWall-derived lookup without issuer attestation, so it is reported as PARTIAL. Symbols are never treated as identity. The registry itself is served as walletwall://registry/stablecoins and walletwall://registry/chains.",
    input: ResolveAssetInput,
    run: (args) => resolveAsset(args)
  }),
  defineTool({
    name: "normalize_observation",
    title: "Normalize balance observation",
    description: "Normalize a balance-at-block observation draft into a canonical WWEP observation. Validates atomic-unit decimal strings with BigInt, lowercases addresses and hashes, returns the RFC 8785 canonical JSON, SHA-256 evidence digest, content digest and exact decimal rendering. Offline and read-only; it does not fetch chain data. The returned observation has the TOKEN_BALANCE_AT_BLOCK shape published at walletwall://schemas/claims and can be placed directly in a bundle's observations.",
    input: NormalizeInput,
    run: (args) => normalizeObservation(args)
  }),
  defineTool({
    name: "inspect_evidence",
    title: "Inspect evidence bundle",
    description: "Evaluate every assertion in a WWEP 0.1 evidence bundle against the bundled authority policies at the supplied evaluation time. Returns support, freshness and finality states, claim-specific authority, limitations, conflicts, supersession and digests. States describe how well the presented evidence satisfies policy; they do not verify that upstream evidence is true. Offline and read-only. Input contract: walletwall://schemas/evidence (bundle), walletwall://schemas/claims (per-claim subject, value and observation shapes), walletwall://policies/authority and walletwall://spec/wwep; worked inputs: walletwall://examples/identity-established. Shape failures carry structured diagnostics beside the limitation code.",
    input: BundleAtInput,
    run: (args) => {
      const evaluation = evaluateBundle(args.bundle, args.evaluatedAt);
      const violations = checkInvariants(args.bundle, evaluation);
      return {
        wwepVersion: evaluation.versions.wwep,
        evaluatedAt: evaluation.evaluatedAt,
        bundleDigest: evaluation.bundleDigest,
        versions: evaluation.versions,
        assertions: evaluation.assertions,
        invariantViolationCount: violations.length
      };
    }
  }),
  defineTool({
    name: "check_invariants",
    title: "Check evidence invariants",
    description: "Check a WWEP 0.1 evidence bundle against the thirteen mandatory evidence invariants plus the rule that declared states must not exceed computed states. Returns violations by invariant ID and assertion ID. Offline and read-only. Input contract: walletwall://schemas/evidence, walletwall://schemas/claims and walletwall://policies/authority.",
    input: BundleAtInput,
    run: (args) => {
      const evaluation = evaluateBundle(args.bundle, args.evaluatedAt);
      const violations = checkInvariants(args.bundle, evaluation);
      return {
        pass: violations.length === 0,
        violationCount: violations.length,
        violations: violations.map((v) => ({ ...v, rule: INVARIANT_TEXT[v.invariant] ?? "" })),
        bundleDigest: evaluation.bundleDigest
      };
    }
  }),
  defineTool({
    name: "trace_provenance",
    title: "Trace assertion provenance",
    description: "Return a W3C PROV-JSON-shaped provenance graph for one assertion and all of its ancestors in a WWEP 0.1 bundle. Transport such as retrievedVia is recorded as an attribute and never as authority. Offline and read-only. Input contract: walletwall://schemas/evidence, walletwall://schemas/claims and walletwall://policies/authority.",
    input: TraceInput,
    run: (args) => traceProvenance(args.bundle, args.assertionId)
  }),
  defineTool({
    name: "assess_vault_readiness",
    title: "Assess vault technical readiness",
    description: "Evaluate WalletWall's published VAULT_TECHNICAL_READINESS rules 0.1.0-draft over an asset-identity assertion and a balance-at-block assertion. Returns CRITERIA_MET, CRITERIA_NOT_MET or NOT_ESTABLISHED with a per-criterion breakdown. It does not establish investment merit, solvency, creditworthiness, legal status, regulatory compliance, absence of fraud or future performance. Offline and read-only. Input contract: walletwall://schemas/evidence, walletwall://schemas/claims (ASSET_IDENTITY and TOKEN_BALANCE_AT_BLOCK) and walletwall://policies/authority; worked inputs: walletwall://examples/vault-readiness-established (CRITERIA_MET) and walletwall://examples/vault-readiness-not-established (NOT_ESTABLISHED).",
    input: ReadinessInput,
    run: (args) => {
      const evaluation = evaluateBundle(args.bundle, args.evaluatedAt);
      return assessReadiness(args.bundle, evaluation, args.identityAssertionId, args.balanceAssertionId);
    }
  })
];
var TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};
function inputJsonSchema(def) {
  return z3.toJSONSchema(def.input, { target: "draft-2020-12", io: "input", unrepresentable: "any", reused: "inline" });
}
function sanitizeIssues(error) {
  return error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.slice(0, 6).map((seg) => {
      if (typeof seg === "number") return "#";
      return typeof seg === "string" && KNOWN_PATH_SEGMENTS.has(seg) ? seg : "*";
    }),
    code: issue.code
  }));
}
function callTool(name, rawArgs) {
  const def = TOOLS.find((t) => t.name === name);
  if (def === void 0) return { ok: false, error: { code: "UNKNOWN_TOOL", message: "No such tool." } };
  if (hasForbiddenStructure(rawArgs)) {
    return { ok: false, error: { code: "INVALID_INPUT", message: "Input structure is not permitted.", issues: [] } };
  }
  const parsed = def.input.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "Input failed schema validation.", issues: sanitizeIssues(parsed.error) }
    };
  }
  try {
    return { ok: true, result: def.run(parsed.data) };
  } catch (e) {
    if (e instanceof WwError) return { ok: false, error: { code: e.code, message: e.message } };
    return { ok: false, error: { code: "INTERNAL", message: "Internal error." } };
  }
}

// packages/mcp/src/version.ts
var ENGINE_NAME = "walletwall-mcp";
var ENGINE_TITLE = "WalletWall MCP";
var ENGINE_VERSION = "0.1.0";

// packages/mcp/src/resources.ts
var json = (v) => JSON.stringify(v, null, 2);
function expectedOutcome(example) {
  const outcome = callTool(example.toolCall.name, example.toolCall.arguments);
  if (!outcome.ok) throw new WwError("INTERNAL", "Published example is not accepted by the engine.");
  if (example.toolCall.name === "assess_vault_readiness") {
    const r2 = outcome.result;
    return {
      classification: r2.classification,
      criteria: r2.criteria.map((c) => ({ id: c.id, outcome: c.outcome, reason: c.reason })),
      supportOfInputs: r2.supportOfInputs,
      limitations: r2.limitations,
      // The derivation and assertion the engine suggests: the VAULT_TECHNICAL_READINESS shape a bundle would carry.
      suggestedDerivation: r2.suggestedDerivation,
      suggestedAssertion: r2.suggestedAssertion,
      missingMeasurement: example.missingMeasurement
    };
  }
  const r = outcome.result;
  const assertions = {};
  for (const a of r.assertions) {
    assertions[a.assertionId] = {
      supportState: a.supportState,
      freshnessState: a.freshnessState,
      finalityState: a.finalityState,
      authoritySatisfied: a.authority?.satisfied ?? null,
      limitations: a.limitations
    };
  }
  return { assertions, invariantViolationCount: r.invariantViolationCount };
}
function exampleResource(example) {
  return {
    uri: `${EXAMPLE_URI_PREFIX}${example.name}`,
    name: `example-${example.name}`,
    title: example.title,
    description: `${example.demonstrates} Synthetic, illustrative evidence that conforms to the bundle schema; not a claim about any real wallet or chain state.`,
    mimeType: "application/json",
    read: () => json({
      example: example.name,
      title: example.title,
      demonstrates: example.demonstrates,
      synthetic: true,
      notice: SYNTHETIC_NOTICE,
      contract: CLAIMS_RESOURCE_URI,
      claimType: example.claimType,
      toolCall: example.toolCall,
      expected: expectedOutcome(example),
      versions: { wwep: WWEP_VERSION, registry: REGISTRY_VERSION, policies: POLICIES_VERSION, rules: RULES_VERSION }
    })
  };
}
var RESOURCES = [
  {
    uri: "walletwall://registry/stablecoins",
    name: "registry-stablecoins",
    title: "Stablecoin deployment registry (record-level verification)",
    description: "Bundled, static registry of stablecoin deployments. Each record carries the authority publication and chain observation it was verified against, with the verification date. Point-in-time; not a safety statement.",
    mimeType: "application/json",
    read: () => json(rawRegistry().stablecoins)
  },
  {
    uri: "walletwall://registry/chains",
    name: "registry-chains",
    title: "Chain registry (chain IDs observed, finality labels descriptive)",
    description: "Bundled, static registry of supported chains and their finality models.",
    mimeType: "application/json",
    read: () => json(rawRegistry().chains)
  },
  {
    uri: "walletwall://schemas/evidence",
    name: "schema-evidence",
    title: "WWEP 0.1 evidence bundle JSON Schema",
    description: "JSON Schema for the WWEP 0.1 evidence bundle accepted by the evidence tools. Per-claim subject, value and observation shapes are in walletwall://schemas/claims.",
    mimeType: "application/schema+json",
    read: () => json(z4.toJSONSchema(BundleSchema, { target: "draft-2020-12", io: "input", unrepresentable: "any", reused: "inline" }))
  },
  {
    uri: CLAIMS_RESOURCE_URI,
    name: "schema-claims",
    title: "Per-claim-type contract: subject, value, observation linkage and authority",
    description: "For every claim type: the required subject and value keys with their formats, which observation origins and source kinds may establish or corroborate the claim, how observations link to assertions, the registry and derivation relationships, and the structured diagnostics attached to shape failures. Generated from the bundled authority policies and the evaluator's own rules.",
    mimeType: "application/json",
    read: () => json(claimContracts(EXAMPLE_BY_CLAIM))
  },
  {
    uri: "walletwall://policies/authority",
    name: "policies-authority",
    title: "Claim-specific authority policies",
    description: "Bundled authority policies. Authority is defined per claim type; there is no global source ranking.",
    mimeType: "application/json",
    read: () => json(rawPolicies())
  },
  {
    uri: "walletwall://spec/wwep",
    name: "spec-wwep",
    title: "WalletWall Evidence Profile 0.1 (draft)",
    description: "Normative draft text of the WalletWall Evidence Profile 0.1. Not an industry standard.",
    mimeType: "text/markdown",
    read: () => SPEC_WWEP_MD
  },
  {
    uri: "walletwall://conformance/version",
    name: "conformance-version",
    title: "Engine, rules and data versions",
    description: "Versions and content digests of the bundled engine, registry, policies, rules and specification.",
    mimeType: "application/json",
    read: () => json({
      status: "DRAFT_PRIVATE_PRE_RELEASE",
      wwepVersion: WWEP_VERSION,
      engineVersion: ENGINE_VERSION,
      registryVersion: REGISTRY_VERSION,
      registryStatus: REGISTRY_STATUS,
      registrySha256: registryDigest(),
      policiesVersion: POLICIES_VERSION,
      policiesSha256: policiesDigest(),
      rulesVersion: RULES_VERSION,
      rules: RULES,
      specSha256: sha256Hex(SPEC_WWEP_MD)
    })
  },
  ...PUBLISHED_EXAMPLES.map(exampleResource)
];
function readResource(uri) {
  return RESOURCES.find((r) => r.uri === uri);
}

// packages/mcp/src/server.ts
var INSTRUCTIONS = "WalletWall evidence engine. Local, offline and read-only. It evaluates structured WWEP evidence you supply; it does not fetch chain data, hold keys, sign, or route transactions. Support states describe evidence sufficiency under published policy, not the truth of upstream data. Input shapes: walletwall://schemas/claims (per claim type) and walletwall://schemas/evidence (bundle); worked synthetic inputs: walletwall://examples/vault-readiness-established.";
function createServer() {
  const server2 = new Server(
    { name: ENGINE_NAME, title: ENGINE_TITLE, version: ENGINE_VERSION },
    { capabilities: { tools: {}, resources: {} }, instructions: INSTRUCTIONS }
  );
  server2.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: inputJsonSchema(t),
      annotations: { title: t.title, ...TOOL_ANNOTATIONS }
    }))
  }));
  server2.setRequestHandler(CallToolRequestSchema, (request) => {
    const outcome = callTool(request.params.name, request.params.arguments);
    if (outcome.ok) {
      return {
        content: [{ type: "text", text: JSON.stringify(outcome.result) }],
        structuredContent: outcome.result
      };
    }
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify({ error: outcome.error }) }]
    };
  });
  server2.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: RESOURCES.map((r) => ({
      uri: r.uri,
      name: r.name,
      title: r.title,
      description: r.description,
      mimeType: r.mimeType
    }))
  }));
  server2.setRequestHandler(ReadResourceRequestSchema, (request) => {
    const r = readResource(request.params.uri);
    if (r === void 0) throw new Error("Unknown resource.");
    return { contents: [{ uri: r.uri, mimeType: r.mimeType, text: r.read() }] };
  });
  return server2;
}

// packages/mcp/src/main.ts
function fatal() {
  process.stderr.write("walletwall-mcp: fatal error\n");
  process.exit(1);
}
process.on("uncaughtException", fatal);
process.on("unhandledRejection", fatal);
var server = createServer();
await server.connect(new StdioServerTransport());
process.stdin.on("end", () => process.exit(0));
