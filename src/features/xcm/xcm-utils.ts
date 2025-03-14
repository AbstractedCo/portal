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
  if (!location?.value?.interior) {
    console.warn("Invalid location structure:", location);
    return undefined;
  }

  const interior = location.value.interior;
  let generalIndex: bigint | undefined;

  try {
    // Helper function to find GeneralIndex in junction array
    const findGeneralIndex = (junctions: XcmV2Junction[] | XcmV3Junction[]) => {
      try {
        const generalIndexJunction = junctions.find(
          (x) => x?.type === "GeneralIndex",
        );
        return generalIndexJunction?.type === "GeneralIndex"
          ? BigInt(generalIndexJunction.value)
          : undefined;
      } catch (error) {
        console.warn("Error finding GeneralIndex:", error);
        return undefined;
      }
    };

    switch (interior.type) {
      case "X1":
        if (interior.value?.type === "GeneralIndex") {
          generalIndex = BigInt(interior.value.value);
        }
        break;
      case "X2":
      case "X3":
      case "X4":
        generalIndex = findGeneralIndex(interior.value);
        break;
      default:
        console.warn("Unsupported interior type:", interior.type);
        return undefined;
    }

    return generalIndex;
  } catch (error) {
    console.warn("Error processing asset hub ID:", error);
    return undefined;
  }
}

export function getAssetHubRelativeLocation(
  location: XcmVersionedLocation | undefined,
) {
  if (!location?.value?.interior) {
    console.warn("Invalid or undefined location:", location);
    return [];
  }

  try {
    const interior = location.value.interior;
    if (!interior.value) {
      return [];
    }

    // Handle V2 junctions
    if (location.type === "V2") {
      switch (interior.type) {
        case "X1":
          return interior.value?.type === "Parachain" ? [] : [interior.value];
        case "X2":
        case "X3":
        case "X4":
        case "X5":
        case "X6":
        case "X7":
        case "X8":
          return (interior.value || []).filter((j) => j?.type !== "Parachain");
        default:
          return [];
      }
    }

    // Handle V3/V4 junctions
    switch (interior.type) {
      case "X1":
        return interior.value?.type === "Parachain" ? [] : [interior.value];
      case "X2":
      case "X3":
      case "X4":
      case "X5":
      case "X6":
      case "X7":
      case "X8":
        return (interior.value || []).filter((j) => j?.type !== "Parachain");
      default:
        return [];
    }
  } catch (error) {
    console.warn("Error processing relative location:", error);
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
  try {
    const { beneficiaryAccount, location, amount } = params;

    if (
      !beneficiaryAccount ||
      !location?.value?.interior ||
      amount === undefined
    ) {
      console.warn("Missing required parameters:", {
        beneficiaryAccount,
        location,
        amount,
      });
      throw new Error("Missing required parameters for transfer");
    }

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
  } catch (error) {
    console.warn("Error creating transfer parameters:", error);
    throw error;
  }
}

// Validate if an asset is from Asset Hub based on its location
export function isAssetFromAssetHub(
  location: XcmVersionedLocation | undefined,
): boolean {
  if (!location?.value?.interior) {
    console.warn("Invalid location structure:", location);
    return false;
  }

  try {
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
        (junctions || []).some(
          (j) =>
            j?.type === "Parachain" &&
            BigInt(j?.value || 0) === BigInt(CHAIN_CONFIG.ASSET_HUB.paraId),
        );

      // Check interior for Parachain(1000) based on type
      switch (interior.type) {
        case "X1":
          return (
            interior.value?.type === "Parachain" &&
            BigInt(interior.value?.value || 0) ===
              BigInt(CHAIN_CONFIG.ASSET_HUB.paraId)
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
  } catch (error) {
    console.warn("Error checking if asset is from Asset Hub:", error);
    return false;
  }
}

// Get estimated weight for XCM transfer
export function getXcmTransferWeight() {
  return {
    type: "Limited",
    value: BigInt(10_000_000_000), // Default weight, can be adjusted based on requirements
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
