import { useLazyLoadQuery } from "@reactive-dot/react";

export function useLazyLoadRegisteredAssets() {
  const assetMetadata = useLazyLoadQuery((builder) =>
    builder.readStorageEntries("AssetRegistry", "Metadata", []),
  );

  const tokens = assetMetadata
    .filter((token) => token.keyArgs[0] !== 0)
    .map((token) => ({
      id: token.keyArgs[0],
      metadata: {
        symbol: token.value.symbol.asText(),
        decimals: token.value.decimals,
        name: token.value.name.asText(),
        existential_deposit: token.value.existential_deposit,
        location: token.value.location,
        additional: token.value.additional,
      },
    }));

  tokens.push({
    id: 0,
    metadata: {
      symbol: "VARCH",
      name: "InvArch",
      decimals: 12,
      existential_deposit: 10_000_000_000n,
      location: undefined,
      additional: 0n,
    },
  });

  return tokens;
}

export function useLazyLoadInvArchExistentialDeposit() {
  const existentialDeposit = useLazyLoadQuery((builder) =>
    builder.getConstant("Balances", "ExistentialDeposit"),
  );
  const buffer = existentialDeposit + existentialDeposit / BigInt(30);

  return buffer;
}

export function useLazyLoadRelayDotExistentialDeposit() {
  const existentialDeposit = useLazyLoadQuery(
    (builder) => builder.getConstant("Balances", "ExistentialDeposit"),
    { chainId: "polkadot" },
  );
  const buffer = existentialDeposit + existentialDeposit / BigInt(30);

  return buffer;
}

export function useLazyLoadAssetHubDotExistentialDeposit() {
  const existentialDeposit = useLazyLoadQuery(
    (builder) => builder.getConstant("Balances", "ExistentialDeposit"),
    { chainId: "polkadot_asset_hub" },
  );
  const buffer = existentialDeposit * BigInt(6);

  return buffer;
}
