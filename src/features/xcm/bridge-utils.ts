import type { XcmVersionedLocation } from "@polkadot-api/descriptors";
import { FixedSizeBinary, type SS58String } from "polkadot-api";
import { isAssetFromAssetHub } from "./xcm-utils";
import { useMutation, useMutationEffect } from "@reactive-dot/react";
import { MutationError, pending } from "@reactive-dot/core";
import { useState } from "react";

// Status change interface for bridge operations
export interface BridgeStatusChange {
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: unknown;
}

// Parameters for bridge operations
export interface BridgeParams {
  beneficiaryAccount?: SS58String;
  assetLocation?: XcmVersionedLocation | undefined;
  assetId?: bigint;
  amount?: bigint;
  onStatusChange?: (status: BridgeStatusChange) => void;
  onComplete?: () => void;
}

// Parameters for validation
export interface BridgeValidationParams {
  location: XcmVersionedLocation | undefined;
  amount: string;
  account: SS58String | undefined;
}

// Known supported bridge chains
export type SupportedBridgeChain = "polkadot_asset_hub";
// Add more chains in the future like: | "kusama_asset_hub" | "other_chain"

// Function to check if location is a native token (like DOT)
// Native tokens have a single "Here" junction
export function isNativeToken(location: XcmVersionedLocation | undefined): boolean {
  if (!location) return false;

  return (
    location.type === "V3" || location.type === "V4"
  ) && location.value.interior.type === "Here";
}

// Helper to create asset reference based on asset location structure
export function createAssetReference(location: XcmVersionedLocation | undefined, assetId: bigint): {
  parents: number;
  interior: {
    type: "Here";
    value: undefined
  } | {
    type: "X2";
    value: [
      {
        type: "PalletInstance";
        value: number;
      },
      {
        type: "GeneralIndex";
        value: bigint;
      }
    ]
  }
} {
  // // Case for native tokens (like DOT)
  // if (isNativeToken(location)) {
  //   return {
  //     parents: 1,
  //     interior: {
  //       type: "Here" as const,
  //       value: undefined
  //     }
  //   };
  // }

  // Standard assets from Asset Hub
  return {
    parents: 0,
    interior: {
      type: "X2" as const,
      value: [
        {
          type: "PalletInstance" as const,
          value: 50 // Assets pallet
        },
        {
          type: "GeneralIndex" as const,
          value: assetId
        }
      ]
    }
  };
}

// Custom hook for Asset Hub bridge
export function useAssetHubBridgeOperation(params?: BridgeParams) {
  const { beneficiaryAccount, assetLocation, assetId, amount, onStatusChange, onComplete } = params || {};

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);

  // Set up the mutation
  const [_, execute] = useMutation((builder) => {
    if (!beneficiaryAccount || !amount) {
      throw new Error("Missing required parameters for bridge operation");
    }

    // For non-native tokens we need an assetId
    if (!isNativeToken(assetLocation) && !assetId) {
      throw new Error("Asset ID is required for non-native tokens");
    }

    // Create the appropriate asset reference based on asset type
    const assetReference = createAssetReference(assetLocation, assetId || 0n);

    return builder.PolkadotXcm.limited_reserve_transfer_assets({
      dest: {
        type: "V4",
        value: {
          parents: 1,
          interior: {
            type: "X1",
            value: {
              type: "Parachain",
              value: 3340 // InvArch parachain ID
            }
          }
        }
      },
      beneficiary: {
        type: "V4",
        value: {
          parents: 0,
          interior: {
            type: "X1",
            value: {
              type: "AccountId32",
              value: {
                network: undefined,
                id: FixedSizeBinary.fromAccountId32(beneficiaryAccount)
              }
            }
          }
        }
      },
      assets: {
        type: "V4",
        value: [
          {
            id: assetReference,
            fun: {
              type: "Fungible",
              value: amount
            }
          }
        ]
      },
      fee_asset_item: 0,
      weight_limit: {
        type: "Unlimited",
        value: undefined
      }
    });
  }, { chainId: "polkadot_asset_hub" });

  // Handle mutation events and status changes
  useMutationEffect((event) => {
    if (event.value === pending) {
      setIsProcessing(true);
      onStatusChange?.({
        status: 'pending',
        message: "Submitting bridge transaction..."
      });
      return;
    }

    if (event.value instanceof MutationError) {
      setIsProcessing(false);
      onStatusChange?.({
        status: 'error',
        message: "Failed to submit bridge transaction",
        details: event.value
      });
      return;
    }

    switch (event.value.type) {
      case "finalized":
        setIsProcessing(false);
        if (event.value.ok) {
          onStatusChange?.({
            status: 'success',
            message: "Bridge transaction was successful!",
            details: event.value
          });
          onComplete?.();
        } else {
          onStatusChange?.({
            status: 'error',
            message: "Transaction failed",
            details: event.value
          });
        }
        break;
      default:
        onStatusChange?.({
          status: 'pending',
          message: "Transaction pending...",
          details: event.value
        });
    }
  });

  // Function to execute the bridge operation
  const executeBridge = async () => {
    if (!beneficiaryAccount || !amount) {
      throw new Error("Missing required parameters for bridge operation");
    }

    // For non-native tokens we need an assetId
    if (!isNativeToken(assetLocation) && !assetId) {
      throw new Error("Asset ID is required for non-native tokens");
    }

    setIsProcessing(true);
    return execute() as Promise<unknown>;
  };

  // Validation function based on location structure
  const validateBridge = ({ location, amount, account }: BridgeValidationParams) => {
    if (!amount || !account) return false;

    // If we have a location, check if it's from Asset Hub or is a native token
    if (location) {
      return isAssetFromAssetHub(location) || isNativeToken(location);
    }

    return false;
  };

  return {
    executeBridge,
    isProcessing,
    validateBridge,
    getChainId: () => "polkadot_asset_hub",
    isLocationSupported: (location: XcmVersionedLocation | undefined) => {
      if (!location) return false;
      return isAssetFromAssetHub(location) || isNativeToken(location);
    }
  };
}

// Helper function to check if a location is supported by any bridge implementation
export function isBridgeSupported(location: XcmVersionedLocation | undefined): boolean {
  if (!location) return false;

  // Support native tokens (like DOT)
  if (isNativeToken(location)) {
    return false;
    // return true;
  }

  // Other assets from Asset Hub
  return isAssetFromAssetHub(location);
}

// Helper function to get the chain ID for a given location
export function getBridgeSourceChain(location: XcmVersionedLocation | undefined): SupportedBridgeChain | undefined {
  if (!location) return undefined;

  // Both native tokens and other Asset Hub assets come from polkadot_asset_hub
  if (isBridgeSupported(location)) {
    return "polkadot_asset_hub";
  }

  return undefined;
} 