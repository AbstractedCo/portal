import { canPayFees, needsFeePayment, calculateFeeAmount } from "./fee-assets";
import { CHAIN_CONFIG, isAssetFromAssetHub } from "./xcm-utils";
import type {
  XcmV3Junction,
  XcmV3Junctions,
  XcmVersionedLocation,
} from "@polkadot-api/descriptors";
import { MutationError, pending } from "@reactive-dot/core";
import { useMutation, useMutationEffect } from "@reactive-dot/react";
import { FixedSizeBinary, type SS58String } from "polkadot-api";
import { useState } from "react";

// Status change interface for bridge operations
export interface BridgeStatusChange {
  status: "pending" | "success" | "error";
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
  usePolkadotTransfer?: boolean;
}

// Parameters for outbound bridge operations
export interface BridgeOutParams {
  destinationAccount?: SS58String;
  assetId?: bigint;
  amount?: bigint;
  onStatusChange?: (status: BridgeStatusChange) => void;
  onComplete?: () => void;
  daoId?: number;
  feeAssetId?: number | undefined;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface BridgeValidationParams {
  amount: string;
  assetDecimals: number;
  existentialDeposit: bigint;
  currentBalance?: bigint;
  minAmount?: bigint;
  location?: XcmVersionedLocation;
  account?: SS58String;
}

// Known supported bridge chains
export type SupportedBridgeChain = "polkadot_asset_hub";
// Add more chains in the future like: | "kusama_asset_hub" | "other_chain"

// Function to check if location is a native token (like DOT)
// Native tokens have a single "Here" junction
export function isNativeToken(
  location: XcmVersionedLocation | undefined,
): boolean {
  if (!location) return false;

  return (
    (location.type === "V3" || location.type === "V4") &&
    location.value.interior.type === "Here"
  );
}

// Helper to create asset reference based on asset location structure
export function createAssetReference(
  location: XcmVersionedLocation | undefined,
  assetId: bigint,
): {
  parents: number;
  interior:
    | {
        type: "Here";
        value: undefined;
      }
    | {
        type: "X2";
        value: [
          {
            type: "PalletInstance";
            value: number;
          },
          {
            type: "GeneralIndex";
            value: bigint;
          },
        ];
      };
} {
  // Case for native tokens (like DOT)
  if (isNativeToken(location)) {
    return {
      parents: 1,
      interior: {
        type: "Here" as const,
        value: undefined,
      },
    };
  }

  // Standard assets from Asset Hub
  return {
    parents: 0,
    interior: {
      type: "X2" as const,
      value: [
        {
          type: "PalletInstance" as const,
          value: 50, // Assets pallet
        },
        {
          type: "GeneralIndex" as const,
          value: assetId,
        },
      ],
    },
  };
}

// Custom hook for bridging assets into InvArch from Asset Hub
export function useAssetHubBridgeInOperation(params?: BridgeParams) {
  const {
    beneficiaryAccount,
    assetLocation,
    assetId,
    amount,
    onStatusChange,
    onComplete,
  } = params || {};

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);

  // Set up the mutation
  const [_, execute] = useMutation(
    (builder) => {
      if (!beneficiaryAccount || !amount || assetLocation === undefined) {
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
                value: 3340, // InvArch parachain ID
              },
            },
          },
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
                  id: FixedSizeBinary.fromAccountId32(beneficiaryAccount),
                },
              },
            },
          },
        },
        assets: {
          type: "V4",
          value: [
            {
              id: assetReference,
              fun: {
                type: "Fungible",
                value: amount,
              },
            },
          ],
        },
        fee_asset_item: 0,
        weight_limit: {
          type: "Unlimited",
          value: undefined,
        },
      });
    },
    { chainId: "polkadot_asset_hub" },
  );

  // Handle mutation events and status changes
  useMutationEffect((event) => {
    if (event.value === pending) {
      setIsProcessing(true);
      onStatusChange?.({
        status: "pending",
        message: "Submitting bridge transaction...",
      });
      return;
    }

    if (event.value instanceof MutationError) {
      setIsProcessing(false);
      onStatusChange?.({
        status: "error",
        message: "Failed to submit bridge transaction",
        details: event.value,
      });
      return;
    }

    switch (event.value.type) {
      case "finalized":
        setIsProcessing(false);
        if (event.value.ok) {
          onStatusChange?.({
            status: "success",
            message: "Bridge transaction was successful!",
            details: event.value,
          });
          onComplete?.();
        } else {
          onStatusChange?.({
            status: "error",
            message: "Transaction failed",
            details: event.value,
          });
        }
        break;
      default:
        onStatusChange?.({
          status: "pending",
          message: "Transaction pending...",
          details: event.value,
        });
    }
  });

  // Function to execute the bridge operation
  const executeBridge = async () => {
    if (!beneficiaryAccount || !amount || assetLocation === undefined) {
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
  const validateBridge = ({
    location,
    amount,
    account,
  }: BridgeValidationParams) => {
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
    },
  };
}

// Export fee-related functions from fee-assets.ts
export { canPayFees, needsFeePayment, calculateFeeAmount };

// Custom hook for bridging assets out from InvArch to Asset Hub
export function useInvArchBridgeOutOperation(
  params?: BridgeOutParams & { daoId?: number; feeAssetId?: number },
) {
  const {
    destinationAccount,
    assetId,
    amount,
    onStatusChange,
    onComplete,
    daoId,
    feeAssetId,
  } = params || {};

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);

  // Set up the mutation for xTokens.transfer through the DAO's multisig
  const [_, execute] = useMutation(
    (builder) => {
      if (!destinationAccount || !amount || !assetId || daoId === undefined) {
        throw new Error("Missing required parameters for bridge out operation");
      }

      if (typeof assetId !== "number" && typeof assetId !== "bigint") {
        throw new Error("Invalid asset ID type");
      }

      // Create the destination for Asset Hub using the helper function
      const assetHubDest = createAssetHubDestination(destinationAccount);

      // If the asset is DOT (assetId === 3) or can pay fees directly, use simple transfer
      if (Number(assetId) === 3 || canPayFees(Number(assetId))) {
        const transferCall = builder.XTokens.transfer({
          currency_id: Number(assetId),
          amount,
          dest: assetHubDest,
          dest_weight_limit: {
            type: "Unlimited",
            value: undefined,
          },
        });

        return builder.INV4.operate_multisig({
          dao_id: daoId,
          call: transferCall.decodedCall,
          fee_asset: { type: "Native", value: undefined },
          metadata: undefined,
        });
      }

      // For other assets, we need a fee paying asset
      if (!feeAssetId || !canPayFees(feeAssetId)) {
        throw new Error(
          "A valid fee paying asset is required for this transfer",
        );
      }

      // Calculate fee amount using the fee-assets module
      const feeAmount = calculateFeeAmount(feeAssetId);

      // Use transfer_multicurrencies for assets that need fee payment
      const transferMultiCall = builder.XTokens.transfer_multicurrencies({
        currencies: [
          [feeAssetId, feeAmount],
          [Number(assetId), amount],
        ] as [number, bigint][],
        fee_item: 0, // First currency is used for fees
        dest: assetHubDest,
        dest_weight_limit: {
          type: "Unlimited",
          value: undefined,
        },
      });

      return builder.INV4.operate_multisig({
        dao_id: daoId,
        call: transferMultiCall.decodedCall,
        fee_asset: { type: "Native", value: undefined },
        metadata: undefined,
      });
    },
    { chainId: "invarch" },
  );

  // Handle mutation events and status changes
  useMutationEffect((event) => {
    if (event.value === pending) {
      setIsProcessing(true);
      onStatusChange?.({
        status: "pending",
        message: "Submitting bridge out transaction...",
      });
      return;
    }

    if (event.value instanceof MutationError) {
      setIsProcessing(false);
      onStatusChange?.({
        status: "error",
        message: "Failed to submit bridge out transaction",
        details: event.value,
      });
      return;
    }

    switch (event.value.type) {
      case "finalized":
        setIsProcessing(false);
        if (event.value.ok) {
          onStatusChange?.({
            status: "success",
            message: "Bridge out transaction was successful!",
            details: event.value,
          });
          onComplete?.();
        } else {
          onStatusChange?.({
            status: "error",
            message: "Transaction failed",
            details: event.value,
          });
        }
        break;
      default:
        onStatusChange?.({
          status: "pending",
          message: "Transaction pending...",
          details: event.value,
        });
    }
  });

  // Function to execute the bridge out operation
  const executeBridgeOut = async () => {
    if (!destinationAccount || !amount || !assetId || daoId === undefined) {
      throw new Error("Missing required parameters for bridge out operation");
    }

    setIsProcessing(true);
    return execute() as Promise<unknown>;
  };

  // Validation function for outbound bridge
  const validateBridgeOut = ({
    amount,
    account,
    assetDecimals,
    existentialDeposit,
  }: BridgeValidationParams) => {
    if (!amount || !account) return false;
    const amountValidation = validateBridgeAmount({
      amount,
      assetDecimals,
      existentialDeposit,
    });
    return amountValidation.isValid;
  };

  return {
    executeBridgeOut,
    isProcessing,
    validateBridgeOut,
    getChainId: () => "invarch",
    isLocationSupported: (_location: XcmVersionedLocation | undefined) => {
      // For now, assume all assets in InvArch can be bridged out to Asset Hub
      return true;
    },
  };
}

// Helper function to check if a location is supported by any bridge implementation
export function isBridgeSupportedIn(
  location: XcmVersionedLocation | undefined,
): boolean {
  if (!location) return false;

  // Support native tokens (like DOT)
  if (isNativeToken(location)) {
    return true;
  }

  // Other assets from Asset Hub
  return isAssetFromAssetHub(location);
}

// Helper function to check if an asset can be bridged out (simplified for now)
export function isBridgeSupportedOut(assetId: number): boolean {
  // This can be expanded with more complex logic to determine
  // which assets can be bridged out from InvArch to Asset Hub
  if (assetId < 0) return false;
  return true;
}

// Helper function to get the chain ID for a given location
export function getBridgeSourceChain(
  location: XcmVersionedLocation | undefined,
): SupportedBridgeChain | undefined {
  if (!location) return undefined;

  // Both native tokens and other Asset Hub assets come from polkadot_asset_hub
  if (isBridgeSupportedIn(location)) {
    return "polkadot_asset_hub";
  }

  console.warn("Unexpected asset location structure:", location);
  return undefined;
}

export function validateBridgeAmount(
  params: BridgeValidationParams,
): ValidationResult {
  const {
    amount,
    assetDecimals,
    existentialDeposit,
    currentBalance,
    minAmount,
  } = params;

  // Basic amount validation
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return {
      isValid: false,
      error: "Please enter a valid amount greater than zero.",
    };
  }

  // Convert amount to bigint with proper decimals
  const amountBigInt = BigInt(
    Math.floor(parsedAmount * Math.pow(10, assetDecimals)),
  );

  // Check minimum amount if specified
  if (minAmount && amountBigInt < minAmount) {
    return {
      isValid: false,
      error: `Amount is below the minimum required amount.`,
    };
  }

  // Check if amount exceeds balance
  if (currentBalance && amountBigInt > currentBalance) {
    return {
      isValid: false,
      error: "Amount exceeds available balance.",
    };
  }

  // Check existential deposit
  if (amountBigInt < existentialDeposit) {
    return {
      isValid: false,
      error: "Amount is below the existential deposit.",
    };
  }

  return { isValid: true };
}

// Helper function to create Asset Hub destination
function createAssetHubDestination(
  destinationAccount: SS58String,
): XcmVersionedLocation {
  const parachainJunction: XcmV3Junction = {
    type: "Parachain",
    value: CHAIN_CONFIG.ASSET_HUB.paraId,
  };

  const accountJunction: XcmV3Junction = {
    type: "AccountId32",
    value: {
      network: undefined,
      id: FixedSizeBinary.fromAccountId32(destinationAccount),
    },
  };

  const interior: XcmV3Junctions = {
    type: "X2",
    value: [parachainJunction, accountJunction],
  };

  return {
    type: "V4",
    value: {
      parents: 1,
      interior,
    },
  };
}

// Add a new hook for Polkadot bridge operations
export function usePolkadotBridgeInOperation(params?: BridgeParams) {
  const { beneficiaryAccount, amount, onStatusChange, onComplete } =
    params || {};

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);

  // Set up the mutation specifically for Polkadot
  const [_, execute] = useMutation(
    (builder) => {
      if (!beneficiaryAccount || !amount) {
        throw new Error("Missing required parameters for bridge operation");
      }

      return builder.XcmPallet.limited_reserve_transfer_assets({
        dest: {
          type: "V4",
          value: {
            parents: 0,
            interior: {
              type: "X1",
              value: {
                type: "Parachain",
                value: CHAIN_CONFIG.INVARCH.paraId,
              },
            },
          },
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
                  id: FixedSizeBinary.fromAccountId32(beneficiaryAccount),
                },
              },
            },
          },
        },
        assets: {
          type: "V4",
          value: [
            {
              id: {
                parents: 0,
                interior: {
                  type: "Here",
                  value: undefined,
                },
              },
              fun: {
                type: "Fungible",
                value: amount,
              },
            },
          ],
        },
        fee_asset_item: 0,
        weight_limit: {
          type: "Unlimited",
          value: undefined,
        },
      });
    },
    { chainId: "polkadot" }, // Fixed chain ID for Polkadot
  );

  // Handle mutation events and status changes
  useMutationEffect((event) => {
    if (event.value === pending) {
      setIsProcessing(true);
      onStatusChange?.({
        status: "pending",
        message: "Submitting Polkadot bridge transaction...",
      });
      return;
    }

    if (event.value instanceof MutationError) {
      setIsProcessing(false);
      onStatusChange?.({
        status: "error",
        message: "Failed to submit Polkadot bridge transaction",
        details: event.value,
      });
      return;
    }

    switch (event.value.type) {
      case "finalized":
        setIsProcessing(false);
        if (event.value.ok) {
          onStatusChange?.({
            status: "success",
            message: "Polkadot bridge transaction was successful!",
            details: event.value,
          });
          onComplete?.();
        } else {
          onStatusChange?.({
            status: "error",
            message: "Transaction failed",
            details: event.value,
          });
        }
        break;
      default:
        onStatusChange?.({
          status: "pending",
          message: "Transaction pending...",
          details: event.value,
        });
    }
  });

  // Function to execute the bridge operation
  const executeBridge = async () => {
    if (!beneficiaryAccount || !amount) {
      throw new Error("Missing required parameters for bridge operation");
    }

    setIsProcessing(true);
    return execute() as Promise<unknown>;
  };

  return {
    executeBridge,
    isProcessing,
  };
}

type Asset = {
  id: number;
  value: {
    free: bigint;
    reserved: bigint;
    frozen: bigint;
  };
  metadata: {
    symbol: string;
    decimals: number;
    name: string;
    existential_deposit: bigint;
    source?: string;
  };
};

export function useAssetHubBridgeOutOperation(params: {
  daoId: string;
  selectedAsset: Asset | null;
  amount: bigint | undefined;
  destinationAccount: SS58String | undefined;
  onStatusChange: (status: BridgeStatusChange) => void;
}) {
  const { daoId, selectedAsset, amount, destinationAccount, onStatusChange } =
    params;
  const [_, execute] = useMutation(
    (builder) => {
      if (!selectedAsset || !amount || !destinationAccount) {
        throw new Error("Missing required parameters for bridge");
      }

      // For DOT (assetId === 3), use the special transfer method
      if (selectedAsset.id === 3) {
        const transferCall =
          builder.PolkadotXcm.transfer_assets_using_type_and_then({
            dest: {
              type: "V4",
              value: {
                parents: 1,
                interior: {
                  type: "X1",
                  value: {
                    type: "Parachain",
                    value: CHAIN_CONFIG.ASSET_HUB.paraId,
                  },
                },
              },
            },
            assets: {
              type: "V4",
              value: [
                {
                  id: {
                    parents: 1,
                    interior: {
                      type: "Here",
                      value: undefined,
                    },
                  },
                  fun: {
                    type: "Fungible",
                    value: amount,
                  },
                },
              ],
            },
            assets_transfer_type: {
              type: "DestinationReserve",
              value: undefined,
            },
            remote_fees_id: {
              type: "V4",
              value: {
                parents: 1,
                interior: {
                  type: "Here",
                  value: undefined,
                },
              },
            },
            fees_transfer_type: {
              type: "DestinationReserve",
              value: undefined,
            },
            custom_xcm_on_dest: {
              type: "V4",
              value: [
                {
                  type: "DepositAsset",
                  value: {
                    assets: {
                      type: "Wild",
                      value: {
                        type: "All",
                        value: undefined,
                      },
                    },
                    beneficiary: {
                      parents: 0,
                      interior: {
                        type: "X1",
                        value: {
                          type: "AccountId32",
                          value: {
                            network: undefined,
                            id: FixedSizeBinary.fromAccountId32(
                              destinationAccount,
                            ),
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
            weight_limit: {
              type: "Unlimited",
              value: undefined,
            },
          });

        // Wrap in DAO operation
        return builder.INV4.operate_multisig({
          dao_id: parseInt(daoId),
          call: transferCall.decodedCall,
          fee_asset: { type: "Native", value: undefined },
          metadata: undefined,
        });
      }

      // For other assets, use the standard transfer
      const transferCall = builder.XTokens.transfer({
        currency_id: selectedAsset.id,
        amount,
        dest: createAssetHubDestination(destinationAccount),
        dest_weight_limit: {
          type: "Unlimited",
          value: undefined,
        },
      });

      // Wrap in DAO operation
      return builder.INV4.operate_multisig({
        dao_id: parseInt(daoId),
        call: transferCall.decodedCall,
        fee_asset: { type: "Native", value: undefined },
        metadata: undefined,
      });
    },
    { chainId: "invarch" },
  );

  // Handle mutation events
  useMutationEffect((event) => {
    if (event.value === pending) {
      onStatusChange({
        status: "pending",
        message: "Submitting bridge to Asset Hub transaction...",
      });
      return;
    }

    if (event.value instanceof MutationError) {
      onStatusChange({
        status: "error",
        message: "Failed to submit bridge transaction: " + event.value.message,
      });
      return;
    }

    switch (event.value.type) {
      case "finalized":
        if (event.value.ok) {
          onStatusChange({
            status: "success",
            message: "Bridge to Asset Hub transaction was successful!",
          });
        } else {
          onStatusChange({
            status: "error",
            message: "Transaction failed",
          });
        }
        break;
      default:
        onStatusChange({
          status: "pending",
          message: "Transaction pending...",
        });
    }
  });

  const executeBridge = async () => {
    if (!selectedAsset || !amount || !destinationAccount) {
      throw new Error("Missing required parameters for bridge");
    }
    return execute() as Promise<unknown>;
  };

  return { executeBridge };
}

export function usePolkadotBridgeOutOperation(params: {
  daoId: string;
  selectedAsset: Asset | null;
  amount: bigint | undefined;
  destinationAccount: SS58String | undefined;
  onStatusChange: (status: BridgeStatusChange) => void;
}) {
  const { daoId, selectedAsset, amount, destinationAccount, onStatusChange } =
    params;
  const [_, execute] = useMutation(
    (builder) => {
      if (!selectedAsset || !amount || !destinationAccount) {
        throw new Error("Missing required parameters for bridge");
      }

      // Create the transfer call for Polkadot
      const transferCall = builder.XTokens.transfer({
        currency_id: selectedAsset.id,
        amount,
        dest: {
          type: "V4",
          value: {
            parents: 1,
            interior: {
              type: "X1",
              value: {
                type: "AccountId32",
                value: {
                  network: undefined,
                  id: FixedSizeBinary.fromAccountId32(destinationAccount),
                },
              },
            },
          },
        },
        dest_weight_limit: {
          type: "Unlimited",
          value: undefined,
        },
      });

      // Wrap in DAO operation
      return builder.INV4.operate_multisig({
        dao_id: parseInt(daoId),
        call: transferCall.decodedCall,
        fee_asset: { type: "Native", value: undefined },
        metadata: undefined,
      });
    },
    { chainId: "invarch" },
  );

  // Handle mutation events
  useMutationEffect((event) => {
    if (event.value === pending) {
      onStatusChange({
        status: "pending",
        message: "Submitting bridge to Polkadot transaction...",
      });
      return;
    }

    if (event.value instanceof MutationError) {
      onStatusChange({
        status: "error",
        message: "Failed to submit bridge transaction: " + event.value.message,
      });
      return;
    }

    switch (event.value.type) {
      case "finalized":
        if (event.value.ok) {
          onStatusChange({
            status: "success",
            message: "Bridge to Polkadot transaction was successful!",
          });
        } else {
          onStatusChange({
            status: "error",
            message: "Transaction failed",
          });
        }
        break;
      default:
        onStatusChange({
          status: "pending",
          message: "Transaction pending...",
        });
    }
  });

  const executeBridge = async () => {
    if (!selectedAsset || !amount || !destinationAccount) {
      throw new Error("Missing required parameters for bridge");
    }
    return execute() as Promise<unknown>;
  };

  return { executeBridge };
}
