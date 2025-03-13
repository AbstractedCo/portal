import type {
  XcmV2Junction,
  XcmV3Junction,
  XcmVersionedLocation,
  XcmV3Junctions,
  XcmV3MultiassetFungibility,
} from "@polkadot-api/descriptors";
import { FixedSizeBinary, type SS58String } from "polkadot-api";

// Chain Configuration
export const CHAIN_CONFIG = {
  INVARCH: {
    paraId: 3340,
    multilocation: {
      parents: 1,
      interior: {
        X1: {
          Parachain: 3340,
        },
      },
    },
  },
  ASSET_HUB: {
    paraId: 1000,
  },
} as const;

// Helper function to extract Asset Hub ID from XCM location
export function getAssetHubId(
  location: XcmVersionedLocation | undefined,
): bigint | undefined {
  if (!location) return undefined;

  const interior = location.value.interior;
  let generalIndex: bigint | undefined;

  // Helper function to find GeneralIndex in junction array
  const findGeneralIndex = (junctions: XcmV2Junction[] | XcmV3Junction[]) => {
    const generalIndexJunction = junctions.find(
      (x) => x.type === "GeneralIndex",
    );
    return generalIndexJunction?.type === "GeneralIndex"
      ? BigInt(generalIndexJunction.value)
      : undefined;
  };

  switch (interior.type) {
    case "X1":
      if (interior.value.type === "GeneralIndex") {
        generalIndex = BigInt(interior.value.value);
      }
      break;
    case "X2":
    case "X3":
    case "X4":
      generalIndex = findGeneralIndex(interior.value);
      break;
    default:
      return undefined;
  }

  return generalIndex;
}

export function getAssetHubRelativeLocation(
  location: XcmVersionedLocation | undefined,
) {
  if (!location) {
    throw new Error("Location is undefined");
  }

  const interior = location.value.interior;
  if (!interior.value) {
    return [];
  }

  // Handle V2 junctions
  if (location.type === "V2") {
    switch (interior.type) {
      case "X1":
        return interior.value.type === "Parachain" ? [] : [interior.value];
      case "X2":
        return interior.value.filter((j) => j.type !== "Parachain");
      case "X3":
        return interior.value.filter((j) => j.type !== "Parachain");
      case "X4":
        return interior.value.filter((j) => j.type !== "Parachain");
      case "X5":
        return interior.value.filter((j) => j.type !== "Parachain");
      case "X6":
        return interior.value.filter((j) => j.type !== "Parachain");
      case "X7":
        return interior.value.filter((j) => j.type !== "Parachain");
      case "X8":
        return interior.value.filter((j) => j.type !== "Parachain");
      default:
        return [];
    }
  }

  // Handle V3/V4 junctions
  switch (interior.type) {
    case "X1":
      return interior.value.type === "Parachain" ? [] : [interior.value];
    case "X2":
      return interior.value.filter((j) => j.type !== "Parachain");
    case "X3":
      return interior.value.filter((j) => j.type !== "Parachain");
    case "X4":
      return interior.value.filter((j) => j.type !== "Parachain");
    case "X5":
      return interior.value.filter((j) => j.type !== "Parachain");
    case "X6":
      return interior.value.filter((j) => j.type !== "Parachain");
    case "X7":
      return interior.value.filter((j) => j.type !== "Parachain");
    case "X8":
      return interior.value.filter((j) => j.type !== "Parachain");
    default:
      return [];
  }
}

// Create XCM transfer parameters for Asset Hub to InvArch transfer
export async function createAssetHubToInvArchTransfer(params: {
  beneficiaryAccount: string;
  location: XcmVersionedLocation;
  assetId: number;
  amount: bigint;
}) {
  const { beneficiaryAccount, location, amount } = params;

  // Construct the XCM message
  return {
    V3: {
      dest: {
        parents: 1,
        interior: {
          X1: {
            Parachain: CHAIN_CONFIG.INVARCH.paraId,
          },
        },
      },
      beneficiary: {
        parents: 0,
        interior: {
          X1: {
            AccountId32: {
              network: undefined,
              id: beneficiaryAccount,
            },
          },
        },
      },
      assets: [
        {
          id: {
            Concrete: {
              parents: 0,
              interior: location.value.interior,
            },
          },
          fun: {
            Fungible: amount,
          },
        },
      ],
      fee_asset_item: 0,
      weight_limit: "Unlimited",
    },
  };
}

// Validate if an asset is from Asset Hub based on its location
export function isAssetFromAssetHub(
  location: XcmVersionedLocation | undefined,
): boolean {
  if (!location) return false;

  if (
    location.type === "V4" ||
    location.type === "V3" ||
    location.type === "V2"
  ) {
    const { parents, interior } = location.value;

    // Check for parent = 1 (indicating relay chain)
    if (parents !== 1) return false;

    // Helper function to check for Parachain(1000)
    const hasParachain1000 = (junctions: XcmV2Junction[] | XcmV3Junction[]) =>
      junctions.some(
        (j) =>
          j.type === "Parachain" &&
          BigInt(j.value) === BigInt(CHAIN_CONFIG.ASSET_HUB.paraId),
      );

    // Check interior for Parachain(1000) based on type
    switch (interior.type) {
      case "X1":
        return (
          interior.value.type === "Parachain" &&
          BigInt(interior.value.value) === BigInt(CHAIN_CONFIG.ASSET_HUB.paraId)
        );
      case "X2":
      case "X3":
      case "X4":
        return hasParachain1000(
          interior.value as XcmV2Junction[] | XcmV3Junction[],
        );
      default:
        return false;
    }
  }

  return false;
}

// Get estimated weight for XCM transfer
export function getXcmTransferWeight() {
  return {
    type: "Limited",
    value: BigInt(1_000_000_000), // Default weight, can be adjusted based on requirements
  };
}

export function createInvArchDestination(): XcmVersionedLocation {
  return {
    type: "V4",
    value: {
      parents: 1,
      interior: {
        type: "X1",
        value: {
          type: "Parachain",
          value: CHAIN_CONFIG.INVARCH.paraId,
        },
      },
    },
  };
}

export function createBeneficiary(account: SS58String): XcmVersionedLocation {
  return {
    type: "V4",
    value: {
      parents: 0,
      interior: {
        type: "X1",
        value: {
          type: "AccountId32",
          value: {
            network: undefined,
            id: FixedSizeBinary.fromAccountId32(account),
          },
        },
      },
    },
  };
}

export function createAssetTransferLocation(
  assetId: bigint,
  amount: bigint,
): {
  type: "V4";
  value: {
    id: { parents: number; interior: XcmV3Junctions };
    fun: XcmV3MultiassetFungibility;
  }[];
} {
  return {
    type: "V4",
    value: [
      {
        id: {
          parents: 0,
          interior: {
            type: "X2",
            value: [
              {
                type: "PalletInstance",
                value: 50,
              },
              {
                type: "GeneralIndex",
                value: assetId,
              },
            ],
          },
        },
        fun: {
          type: "Fungible",
          value: amount,
        },
      },
    ],
  };
}

export function createWeightLimit() {
  return {
    type: "Unlimited",
    value: undefined,
  } as const;
}
