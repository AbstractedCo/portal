import { css } from "../../styled-system/css";
import { useNotification } from "../contexts/notification-context";
import { selectedAccountAtom } from "../features/accounts/store";
import {
  useLazyLoadRegisteredAssets,
  useLazyLoadInvArchExistentialDeposit,
  useLazyLoadRelayDotExistentialDeposit,
  useLazyLoadAssetHubDotExistentialDeposit,
} from "../features/assets/store";
import {
  useAssetHubBridgeInOperation,
  type BridgeStatusChange,
  isBridgeSupportedIn,
  isNativeToken,
  needsFeePayment,
} from "../features/xcm/bridge-utils";
import { usePolkadotBridgeInOperation } from "../features/xcm/bridge-utils";
import { calculateSafeMaxAmount } from "../features/xcm/fee-assets";
import { getAssetHubId } from "../features/xcm/xcm-utils";
import { Button } from "./button";
import { ModalDialog } from "./modal-dialog";
import { TextInput } from "./text-input";
import { TokenIcon } from "./token-icon";
import type { XcmVersionedLocation } from "@polkadot-api/descriptors";
import { MutationError, pending } from "@reactive-dot/core";
import { useLazyLoadQuery } from "@reactive-dot/react";
import { useMutation, useMutationEffect } from "@reactive-dot/react";
import { DenominatedNumber } from "@reactive-dot/utils";
import { useAtomValue } from "jotai";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

// Define the Asset type used throughout the component
type Asset = {
  id: number;
  metadata: {
    symbol: string;
    decimals: number;
    name: string;
    existential_deposit: bigint;
    location: XcmVersionedLocation | undefined;
    additional: bigint;
    source?: string;
  };
  isNativeVarch?: boolean;
};

interface BridgeAssetsInDialogProps {
  daoAddress: string;
  onClose: () => void;
}

// Add a helper function to create DOT asset entries
function createDOTAssetEntries(baseAsset: Asset): Asset[] {
  if (baseAsset.id !== 3 || baseAsset.metadata.symbol !== "DOT") {
    return [baseAsset];
  }

  return [
    // DOT from Polkadot (parent chain)
    {
      ...baseAsset,
      metadata: {
        ...baseAsset.metadata,
        name: "DOT (from Polkadot)",
        location: {
          type: "V4",
          value: {
            parents: 0,
            interior: {
              type: "Here",
              value: undefined,
            },
          },
        },
        source: "polkadot",
      },
    },
    // DOT from Asset Hub
    {
      ...baseAsset,
      metadata: {
        ...baseAsset.metadata,
        name: "DOT (from Asset Hub)",
        location: {
          type: "V4",
          value: {
            parents: 1,
            interior: {
              type: "Here",
              value: undefined,
            },
          },
        },
        source: "asset_hub",
      },
    },
  ];
}

export function BridgeAssetsInDialog({
  daoAddress,
  onClose,
}: BridgeAssetsInDialogProps) {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<"select-asset" | "enter-amount" | "review">(
    "select-asset",
  );
  const [showEDConfirmation, setShowEDConfirmation] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const { showNotification } = useNotification();
  const registeredAssets = useLazyLoadRegisteredAssets();
  const selectedAccount = useAtomValue(selectedAccountAtom);

  // Get buffered existential deposits
  const varchExistentialDeposit = useLazyLoadInvArchExistentialDeposit();
  const relayDotExistentialDeposit = useLazyLoadRelayDotExistentialDeposit();
  const assetHubDotExistentialDeposit =
    useLazyLoadAssetHubDotExistentialDeposit();

  // Add state for max amount
  const [maxAmountValue, setMaxAmountValue] = useState("0");

  // Query user's native VARCH balance
  const nativeBalance = useLazyLoadQuery((builder) =>
    daoAddress ? builder.readStorage("System", "Account", [daoAddress]) : null,
  );

  // Get the asset ID for the selected asset
  const getAssetId = () => {
    if (!selectedAsset) return undefined;

    try {
      console.log("Getting asset ID for:", selectedAsset);

      // For native tokens like DOT, use the asset ID directly
      if (
        selectedAsset.metadata.location &&
        isNativeToken(selectedAsset.metadata.location)
      ) {
        // Ensure the ID is a valid number before converting to BigInt
        if (typeof selectedAsset.id === "number" && !isNaN(selectedAsset.id)) {
          console.log(
            "Converting native token ID to BigInt:",
            selectedAsset.id,
          );
          return BigInt(selectedAsset.id);
        }
        console.log("Invalid native token ID:", selectedAsset.id);
        return undefined;
      }

      // For other assets, get the ID from the location
      if (selectedAsset.metadata.location) {
        const assetHubId = getAssetHubId(selectedAsset.metadata.location);
        console.log("Asset Hub ID from location:", assetHubId);
        return assetHubId;
      }

      console.log("No valid location found for asset ID");
      return undefined;
    } catch (error) {
      console.warn("Error getting asset ID:", error);
      return undefined;
    }
  };

  // Convert amount to proper decimals
  const getRawAmount = () => {
    if (!amount || !selectedAsset) {
      console.log("Missing amount or asset for conversion:", {
        amount,
        asset: selectedAsset?.id,
      });
      return undefined;
    }

    // Parse the amount to a float, ensuring it's a valid number
    const parsedAmount = parseFloat(amount);
    console.log("Parsed amount:", parsedAmount);

    if (isNaN(parsedAmount)) {
      console.log("Amount is not a valid number:", amount);
      return undefined;
    }

    try {
      // Use Math.round instead of Math.floor to avoid potential precision issues
      const decimals = selectedAsset.metadata.decimals;
      console.log("Using decimals:", decimals);

      const scaled = parsedAmount * Math.pow(10, decimals);
      console.log("Scaled amount:", scaled);

      const rounded = Math.round(scaled);
      console.log("Rounded amount:", rounded);

      // Ensure it's a valid number before converting to BigInt
      if (isNaN(rounded) || !isFinite(rounded)) {
        console.log("Invalid rounded amount:", rounded);
        return undefined;
      }

      console.log("Converting to BigInt:", rounded);
      return BigInt(rounded);
    } catch (error) {
      console.error("Error converting amount to BigInt:", error);
      return undefined;
    }
  };

  // Query user's balance on Asset Hub for the selected asset
  const assetHubBalance = useLazyLoadQuery(
    (builder) => {
      if (!selectedAsset || !selectedAccount?.address) return undefined;

      // Skip query if the asset is from Polkadot
      if (selectedAsset.metadata.source === "polkadot") return undefined;

      // For native tokens like DOT from Asset Hub
      if (
        selectedAsset.metadata.location &&
        isNativeToken(selectedAsset.metadata.location)
      ) {
        // Use the special query for native token balance
        return builder.readStorage("System", "Account", [
          selectedAccount.address,
        ]);
      }

      // For other assets from Asset Hub
      if (selectedAsset.metadata.location) {
        const assetHubId = getAssetHubId(selectedAsset.metadata.location);
        if (assetHubId === undefined) return undefined;

        return builder.readStorage("Assets", "Account", [
          Number(assetHubId),
          selectedAccount.address,
        ]);
      }

      return undefined;
    },
    { chainId: "polkadot_asset_hub" },
  );

  // Add a new query for Polkadot balance
  const polkadotBalance = useLazyLoadQuery(
    (builder) => {
      if (
        !selectedAsset ||
        !selectedAccount?.address ||
        selectedAsset.metadata.source !== "polkadot"
      )
        return undefined;

      // Query balance directly from Polkadot for DOT
      return builder.readStorage("System", "Account", [
        selectedAccount.address,
      ]);
    },
    { chainId: "polkadot" },
  );

  // Function to handle status changes from the bridge
  const handleBridgeStatusChange = (status: BridgeStatusChange) => {
    // Update processing state
    setIsProcessing(status.status === "pending");

    // Display appropriate notification
    showNotification({
      variant: status.status === "error" ? "error" : "success",
      message: status.message,
    });

    // Close dialog on successful completion
    if (status.status === "success" && status.message.includes("successful")) {
      onClose();
    }
  };

  // Set up the transfer mutation for native VARCH
  const [_nativeTransferState, executeNativeTransfer] = useMutation(
    (builder) => {
      if (!daoAddress || !amount || !selectedAccount?.address) {
        throw new Error("Missing required parameters for transfer");
      }

      const rawAmount = getRawAmount();
      if (!rawAmount) {
        throw new Error("Could not convert amount to the correct format");
      }

      // Regular transfer of native VARCH to the DAO account
      return builder.Balances.transfer_keep_alive({
        dest: {
          type: "Id",
          value: daoAddress,
        },
        value: rawAmount,
      });
    },
  );

  // Handle native transfer mutation events
  useMutationEffect((event) => {
    if (event.value === pending) {
      setIsProcessing(true);
      showNotification({
        variant: "success",
        message: "Submitting VARCH transfer...",
      });
      return;
    }

    if (event.value instanceof MutationError) {
      setIsProcessing(false);
      showNotification({
        variant: "error",
        message: "Failed to submit transfer",
      });
      return;
    }

    switch (event.value.type) {
      case "finalized":
        setIsProcessing(false);
        if (event.value.ok) {
          showNotification({
            variant: "success",
            message: `Transfer of ${amount} VARCH was successful!`,
          });
          onClose();
        } else {
          showNotification({
            variant: "error",
            message: "Transaction failed",
          });
        }
        break;
      default:
        showNotification({
          variant: "success",
          message: "Transaction pending...",
        });
    }
  });

  // Modify the getFilteredAssets function to use proper typing
  const getFilteredAssets = (): Asset[] => {
    return registeredAssets.flatMap((asset: Asset) => {
      try {
        // Only include assets that have location and supported bridge
        if (!asset.metadata.location) return [];

        // For DOT, create two entries
        if (asset.id === 3 && asset.metadata.symbol === "DOT") {
          return createDOTAssetEntries(asset);
        }

        // For other assets, check bridge support normally
        return isBridgeSupportedIn(asset.metadata.location) ? [asset] : [];
      } catch (error) {
        console.warn("Error checking bridge support for asset:", asset, error);
        return [];
      }
    });
  };

  // Modify the getBridgeParams function to handle different DOT sources
  const getBridgeParams = () => {
    const assetId = getAssetId();
    const rawAmount = getRawAmount();
    const beneficiaryAccount = daoAddress;

    console.log("Asset ID:", assetId);
    console.log("Raw amount:", rawAmount);
    console.log("Selected asset:", selectedAsset);

    if (!rawAmount || !beneficiaryAccount || !selectedAsset) {
      console.log("Missing required parameters", {
        rawAmount,
        beneficiaryAccount,
        selectedAsset,
      });
      return undefined;
    }

    // If this is DOT from Polkadot, use different transfer parameters
    if (
      selectedAsset.id === 3 &&
      selectedAsset.metadata.source === "polkadot"
    ) {
      return {
        beneficiaryAccount,
        assetId: BigInt(3),
        amount: rawAmount,
        onStatusChange: handleBridgeStatusChange,
        onComplete: () => {
          setIsProcessing(false);
          showNotification({
            variant: "success",
            message: `Bridge of ${amount} ${selectedAsset.metadata.symbol} initiated successfully!`,
          });
          onClose();
        },
        usePolkadotTransfer: true, // Flag to use Polkadot transfer
      };
    }

    // For DOT from Asset Hub or other assets, use the regular parameters
    return {
      beneficiaryAccount,
      assetLocation: selectedAsset.metadata.location,
      assetId: assetId !== undefined ? assetId : 0n,
      amount: rawAmount,
      onStatusChange: handleBridgeStatusChange,
      onComplete: () => {
        setIsProcessing(false);
        showNotification({
          variant: "success",
          message: `Bridge of ${amount} ${selectedAsset.metadata.symbol} initiated successfully!`,
        });
        onClose();
      },
    };
  };

  // Set up the Asset Hub bridge with the current parameters
  const assetHubBridge = useAssetHubBridgeInOperation(getBridgeParams());

  // Set up the Polkadot bridge with the current parameters
  const polkadotBridge = usePolkadotBridgeInOperation(getBridgeParams());

  // Add new state variables for existential deposit check
  const [isRemainderBelowED, setIsRemainderBelowED] = useState(false);

  // Add effect to check for existential deposit issues
  useEffect(() => {
    if (step === "enter-amount" && selectedAsset) {
      if (amount) {
        const amountValue = parseFloat(amount) || 0;

        // Create a proper DenominatedNumber for the existential deposit
        const edDenominated = new DenominatedNumber(
          selectedAsset.metadata.existential_deposit,
          selectedAsset.metadata.decimals,
        );

        // Get the formatted existential deposit value
        const existentialDepositValue = parseFloat(
          edDenominated.toLocaleString(),
        );

        // For bridge in, we only need to check if the amount is below ED
        setIsRemainderBelowED(
          amountValue > 0 && amountValue < existentialDepositValue,
        );
      } else {
        setIsRemainderBelowED(false);
      }
    }
  }, [step, selectedAsset, amount]);

  // Get formatted balance for display
  const getFormattedBalance = () => {
    if (!selectedAsset) return "Loading...";

    try {
      console.log("Getting balance for asset:", {
        asset: selectedAsset,
        source: selectedAsset.metadata.source,
        polkadotBalance,
        assetHubBalance,
      });

      // For native VARCH token
      if (selectedAsset.isNativeVarch) {
        if (
          nativeBalance &&
          typeof nativeBalance === "object" &&
          "data" in nativeBalance &&
          nativeBalance.data
        ) {
          return (
            new DenominatedNumber(
              nativeBalance.data.free || 0n,
              selectedAsset.metadata.decimals,
            ).toLocaleString() +
            " " +
            selectedAsset.metadata.symbol
          );
        }
        return "Loading...";
      }

      // For DOT from Polkadot
      if (selectedAsset.metadata.source === "polkadot") {
        console.log("Formatting Polkadot balance:", polkadotBalance);
        if (!polkadotBalance) return "Loading...";
        if (
          typeof polkadotBalance === "object" &&
          "data" in polkadotBalance &&
          polkadotBalance.data
        ) {
          const freeBalance = polkadotBalance.data.free || 0n;
          return (
            new DenominatedNumber(
              freeBalance,
              selectedAsset.metadata.decimals,
            ).toLocaleString() +
            " " +
            selectedAsset.metadata.symbol
          );
        }
        return "Loading...";
      }

      // For other assets from Asset Hub
      console.log("Formatting Asset Hub balance:", assetHubBalance);
      if (!assetHubBalance) return "Loading...";

      // For native tokens from Asset Hub (like DOT)
      if (
        selectedAsset.metadata.location &&
        isNativeToken(selectedAsset.metadata.location)
      ) {
        if (
          typeof assetHubBalance === "object" &&
          "data" in assetHubBalance &&
          assetHubBalance.data
        ) {
          const freeBalance = assetHubBalance.data.free || 0n;
          return (
            new DenominatedNumber(
              freeBalance,
              selectedAsset.metadata.decimals,
            ).toLocaleString() +
            " " +
            selectedAsset.metadata.symbol
          );
        }
      }

      // For other assets
      if (typeof assetHubBalance === "object" && "balance" in assetHubBalance) {
        return (
          new DenominatedNumber(
            assetHubBalance.balance ?? 0n,
            selectedAsset.metadata.decimals,
          ).toLocaleString() +
          " " +
          selectedAsset.metadata.symbol
        );
      }

      return "Loading...";
    } catch (error) {
      console.warn("Error formatting balance:", error);
      return "Error loading balance";
    }
  };

  // Add effect to calculate max amount when balance changes
  useEffect(() => {
    const calculateMaxAmount = () => {
      if (!selectedAsset || !selectedAccount?.address) {
        setMaxAmountValue("0");
        return;
      }

      try {
        // For DOT from Polkadot
        if (selectedAsset.metadata.source === "polkadot" && polkadotBalance) {
          if (
            typeof polkadotBalance === "object" &&
            "data" in polkadotBalance &&
            polkadotBalance.data
          ) {
            const freeBalance = polkadotBalance.data.free || 0n;
            const { formattedAmount } = calculateSafeMaxAmount({
              balance: freeBalance,
              existentialDeposit: relayDotExistentialDeposit,
              decimals: selectedAsset.metadata.decimals,
            });
            setMaxAmountValue(formattedAmount);
            return;
          }
        }

        // For DOT from Asset Hub
        if (selectedAsset.metadata.source === "asset_hub" && assetHubBalance) {
          if (
            typeof assetHubBalance === "object" &&
            "data" in assetHubBalance &&
            assetHubBalance.data
          ) {
            const freeBalance = assetHubBalance.data.free || 0n;
            const { formattedAmount } = calculateSafeMaxAmount({
              balance: freeBalance,
              existentialDeposit: assetHubDotExistentialDeposit,
              decimals: selectedAsset.metadata.decimals,
            });
            setMaxAmountValue(formattedAmount);
            return;
          }
        }

        // For native VARCH
        if (selectedAsset.isNativeVarch && nativeBalance) {
          if (
            typeof nativeBalance === "object" &&
            "data" in nativeBalance &&
            nativeBalance.data
          ) {
            const freeBalance = nativeBalance.data.free || 0n;
            const { formattedAmount } = calculateSafeMaxAmount({
              balance: freeBalance,
              existentialDeposit: varchExistentialDeposit,
              decimals: selectedAsset.metadata.decimals,
            });
            setMaxAmountValue(formattedAmount);
            return;
          }
        }

        setMaxAmountValue("0");
      } catch (error) {
        console.error("Error calculating max amount:", error);
        setMaxAmountValue("0");
      }
    };

    calculateMaxAmount();
  }, [
    selectedAsset,
    polkadotBalance,
    assetHubBalance,
    nativeBalance,
    selectedAccount,
    varchExistentialDeposit,
    relayDotExistentialDeposit,
    assetHubDotExistentialDeposit,
  ]);

  // Get the free balance based on token type
  const getFreeBalance = useCallback(() => {
    if (!selectedAsset?.isNativeVarch) {
      // For DOT from Polkadot
      if (selectedAsset?.metadata.source === "polkadot") {
        if (!polkadotBalance) return 0n;
        if (typeof polkadotBalance === "object" && "data" in polkadotBalance) {
          return polkadotBalance.data?.free || 0n;
        }
        return 0n;
      }

      // For Asset Hub assets
      if (!assetHubBalance) return 0n;
      if (typeof assetHubBalance === "object" && "balance" in assetHubBalance) {
        return assetHubBalance.balance ?? 0n;
      }
      if (typeof assetHubBalance === "object" && "data" in assetHubBalance) {
        return assetHubBalance.data?.free || 0n;
      }
    } else {
      if (!nativeBalance || typeof nativeBalance !== "object") return 0n;
      if ("data" in nativeBalance) {
        return nativeBalance.data.free;
      }
    }
    return 0n;
  }, [selectedAsset, assetHubBalance, polkadotBalance, nativeBalance]);

  // Modify validateAmount to avoid state updates during render
  const validateAmount = (value: string) => {
    if (!selectedAsset) return false;

    try {
      // Parse the amount to a float
      const parsedAmount = parseFloat(value);
      if (isNaN(parsedAmount) || parsedAmount <= 0) return false;

      const rawAmount = BigInt(
        Math.floor(
          parsedAmount * Math.pow(10, selectedAsset.metadata.decimals),
        ),
      );
      const freeBalance = getFreeBalance();

      // Check minimum balance requirements based on asset type
      if (selectedAsset.metadata.source === "polkadot") {
        if (freeBalance - rawAmount < relayDotExistentialDeposit) {
          return false;
        }
      } else if (selectedAsset.metadata.source === "asset_hub") {
        if (freeBalance - rawAmount < assetHubDotExistentialDeposit) {
          return false;
        }
      } else if (selectedAsset.isNativeVarch) {
        if (freeBalance - rawAmount < varchExistentialDeposit) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Error validating amount:", error);
      return false;
    }
  };

  // Add useEffect to handle warning message updates
  useEffect(() => {
    if (!amount || !selectedAsset) {
      setWarningMessage(null);
      return;
    }

    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        setWarningMessage(null);
        return;
      }

      const rawAmount = BigInt(
        Math.floor(
          parsedAmount * Math.pow(10, selectedAsset.metadata.decimals),
        ),
      );
      const freeBalance = getFreeBalance();

      if (selectedAsset.metadata.source === "polkadot") {
        if (freeBalance - rawAmount < relayDotExistentialDeposit) {
          setWarningMessage(
            "You must keep enough DOT to maintain the existential deposit",
          );
          return;
        }
      } else if (selectedAsset.metadata.source === "asset_hub") {
        if (freeBalance - rawAmount < assetHubDotExistentialDeposit) {
          setWarningMessage(
            "You must keep enough DOT to maintain the existential deposit",
          );
          return;
        }
      } else if (selectedAsset.isNativeVarch) {
        if (freeBalance - rawAmount < varchExistentialDeposit) {
          setWarningMessage(
            "You must keep enough VARCH to maintain the existential deposit",
          );
          return;
        }
      }

      setWarningMessage(null);
    } catch (error) {
      console.error("Error updating warning message:", error);
      setWarningMessage(null);
    }
  }, [
    amount,
    selectedAsset,
    getFreeBalance,
    relayDotExistentialDeposit,
    assetHubDotExistentialDeposit,
    varchExistentialDeposit,
  ]);

  // Determine if we can proceed based on current step
  const canProceed = () => {
    if (step === "select-asset") return !!selectedAsset;
    if (step === "enter-amount") {
      if (!amount || parseFloat(amount) <= 0) return false;
      return validateAmount(amount);
    }
    return true;
  };

  // Handle bridge operation
  const handleBridgeIn = async () => {
    try {
      if (!selectedAsset || !amount || !daoAddress) {
        showNotification({
          variant: "error",
          message: "Please fill in all required fields",
        });
        return;
      }

      // Validate amount before proceeding
      if (!validateAmount(amount)) {
        return;
      }

      setIsProcessing(true);

      // Get bridge parameters
      const params = getBridgeParams();
      if (!params) {
        showNotification({
          variant: "error",
          message: "Failed to get bridge parameters",
        });
        setIsProcessing(false);
        return;
      }

      // If this is native VARCH, use regular transfer instead of bridge
      if (selectedAsset.isNativeVarch) {
        console.log("Starting native VARCH transfer");
        await executeNativeTransfer();
        return;
      }

      // For other assets, use the appropriate bridge
      console.log("Starting bridge execution with params:", params);
      if (selectedAsset.metadata.source === "polkadot") {
        await polkadotBridge.executeBridge();
      } else {
        await assetHubBridge.executeBridge();
      }
    } catch (err) {
      console.error("Bridge transaction failed:", err);
      showNotification({
        variant: "error",
        message:
          "Failed to submit transaction: " +
          (err instanceof Error ? err.message : "Unknown error"),
      });
      setIsProcessing(false);
    }
  };

  // Update handleNextStep to include validation
  const handleNextStep = () => {
    if (step === "select-asset" && selectedAsset) {
      setStep("enter-amount");
    } else if (step === "enter-amount" && amount && daoAddress) {
      // Check if amount is below existential deposit
      if (isRemainderBelowED && !showEDConfirmation) {
        // Show confirmation dialog instead of proceeding
        setShowEDConfirmation(true);
        return;
      }

      // Validate amount before proceeding
      if (!validateAmount(amount)) {
        return;
      }

      // Reset the confirmation dialog when moving to review step
      setShowEDConfirmation(false);
      setStep("review");
    }
  };

  // Handle going back to the previous step
  const handleBackStep = () => {
    if (step === "enter-amount") {
      // Reset the confirmation dialog, amount, and warning message when going back
      setShowEDConfirmation(false);
      setAmount("");
      setWarningMessage(null);
      setStep("select-asset");
      // Also clear the selected asset when going back to asset selection
      setSelectedAsset(null);
    } else if (step === "review") {
      setStep("enter-amount");
    }
  };

  // Render appropriate content based on the current step
  const renderStepContent = () => {
    // Get the supported assets
    const filteredAssets = getFilteredAssets();

    // Create VARCH asset object
    const varchAsset = {
      id: 0,
      metadata: {
        symbol: "VARCH",
        decimals: 12,
        name: "InvArch",
        existential_deposit: 10_000_000_000n,
        location: undefined,
        additional: 0n,
      },
      isNativeVarch: true,
    };

    console.log("Filtered assets:", filteredAssets);

    switch (step) {
      case "select-asset":
        return (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            })}
          >
            <p className={css({ marginBottom: "1rem", color: "content" })}>
              Select an asset to fund the DAO
            </p>
            <div
              className={css({
                display: "grid",
                gap: "0.5rem",
                maxHeight: "min(400px, 50vh)",
                overflowY: "auto",
                padding: "1rem",
                backgroundColor: "surfaceContainer",
                borderRadius: "xl",
                border: "1px solid token(colors.surfaceContainerHighest)",
                "@media (max-width: 768px)": {
                  maxHeight: "min(300px, 40vh)",
                  padding: "0.75rem",
                },
              })}
            >
              {/* Add VARCH as the first option */}
              <div
                className={css({
                  marginBottom: "1.5rem",
                })}
              >
                <h4
                  className={css({
                    fontSize: "0.9rem",
                    fontWeight: "500",
                    color: "content.muted",
                    marginBottom: "0.75rem",
                    paddingLeft: "0.5rem",
                  })}
                >
                  Native Token
                </h4>
                <button
                  key="varch"
                  onClick={() => setSelectedAsset(varchAsset)}
                  className={css({
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    backgroundColor: selectedAsset?.isNativeVarch
                      ? "primary"
                      : "surfaceContainerHigh",
                    color: selectedAsset?.isNativeVarch
                      ? "onPrimary"
                      : "content",
                    border: "none",
                    borderRadius: "lg",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    width: "100%",
                    "&:hover": {
                      backgroundColor: selectedAsset?.isNativeVarch
                        ? "primary"
                        : "surfaceContainerHighest",
                    },
                  })}
                >
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                    })}
                  >
                    <img
                      src="/invarch-logo.svg"
                      alt="VARCH icon"
                      className={css({
                        width: "1.5rem",
                        height: "1.5rem",
                        objectFit: "contain",
                      })}
                    />
                    <span className={css({ fontWeight: "500" })}>VARCH</span>
                  </div>
                  <span
                    className={css({
                      fontSize: "0.875rem",
                      color: selectedAsset?.isNativeVarch
                        ? "onPrimary"
                        : "content.muted",
                    })}
                  >
                    Native
                  </span>
                </button>
              </div>

              {/* Polkadot tokens section */}
              {filteredAssets.some(
                (asset) => asset.metadata.source === "polkadot",
              ) && (
                <div className={css({ marginBottom: "1.5rem" })}>
                  <h4
                    className={css({
                      fontSize: "0.9rem",
                      fontWeight: "500",
                      color: "content.muted",
                      marginBottom: "0.75rem",
                      paddingLeft: "0.5rem",
                    })}
                  >
                    Polkadot Tokens
                  </h4>
                  <div
                    className={css({
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    })}
                  >
                    {filteredAssets
                      .filter((asset) => asset.metadata.source === "polkadot")
                      .map((asset) => (
                        <button
                          key={`${asset.id}-${asset.metadata.source}`}
                          onClick={() => setSelectedAsset(asset)}
                          className={css({
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                            padding: "0.75rem 1rem",
                            backgroundColor:
                              selectedAsset?.id === asset.id &&
                              selectedAsset?.metadata.source === "polkadot"
                                ? "primary"
                                : "surfaceContainerHigh",
                            color:
                              selectedAsset?.id === asset.id &&
                              selectedAsset?.metadata.source === "polkadot"
                                ? "onPrimary"
                                : "content",
                            border: "none",
                            borderRadius: "lg",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            "&:hover": {
                              backgroundColor:
                                selectedAsset?.id === asset.id &&
                                selectedAsset?.metadata.source === "polkadot"
                                  ? "primary"
                                  : "surfaceContainerHighest",
                            },
                          })}
                        >
                          <div
                            className={css({
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              width: "100%",
                            })}
                          >
                            <div
                              className={css({
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                              })}
                            >
                              <TokenIcon
                                symbol={asset.metadata.symbol}
                                size="md"
                              />
                              <span className={css({ fontWeight: "500" })}>
                                {asset.metadata.symbol}
                              </span>
                            </div>
                            <span
                              className={css({
                                fontSize: "0.875rem",
                                color:
                                  selectedAsset?.id === asset.id &&
                                  selectedAsset?.metadata.source === "polkadot"
                                    ? "onPrimary"
                                    : "content.muted",
                              })}
                            >
                              From Polkadot
                            </span>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Asset Hub tokens section */}
              {filteredAssets.some(
                (asset) => asset.metadata.source !== "polkadot",
              ) && (
                <div>
                  <h4
                    className={css({
                      fontSize: "0.9rem",
                      fontWeight: "500",
                      color: "content.muted",
                      marginBottom: "0.75rem",
                      paddingLeft: "0.5rem",
                    })}
                  >
                    Asset Hub Tokens
                  </h4>
                  <div
                    className={css({
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    })}
                  >
                    {filteredAssets
                      .filter((asset) => asset.metadata.source !== "polkadot")
                      .sort((a, b) =>
                        a.metadata.symbol.localeCompare(b.metadata.symbol),
                      )
                      .map((asset) => {
                        // Only check needsFeePayment for non-native tokens from Asset Hub
                        const requiresFeePayment =
                          asset.metadata.location &&
                          !isNativeToken(asset.metadata.location) &&
                          needsFeePayment(asset.id);

                        return (
                          <button
                            key={`${asset.id}-${asset.metadata.source || "default"}`}
                            onClick={() => setSelectedAsset(asset)}
                            className={css({
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                              padding: "0.75rem 1rem",
                              backgroundColor:
                                selectedAsset?.id === asset.id &&
                                selectedAsset?.metadata.source !== "polkadot"
                                  ? "primary"
                                  : "surfaceContainerHigh",
                              color:
                                selectedAsset?.id === asset.id &&
                                selectedAsset?.metadata.source !== "polkadot"
                                  ? "onPrimary"
                                  : "content",
                              border: "none",
                              borderRadius: "lg",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                              "&:hover": {
                                backgroundColor:
                                  selectedAsset?.id === asset.id &&
                                  selectedAsset?.metadata.source !== "polkadot"
                                    ? "primary"
                                    : "surfaceContainerHighest",
                              },
                            })}
                          >
                            <div
                              className={css({
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                width: "100%",
                              })}
                            >
                              <div
                                className={css({
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.75rem",
                                })}
                              >
                                <TokenIcon
                                  symbol={asset.metadata.symbol}
                                  size="md"
                                />
                                <span className={css({ fontWeight: "500" })}>
                                  {asset.metadata.symbol}
                                </span>
                              </div>
                              <span
                                className={css({
                                  fontSize: "0.875rem",
                                  color:
                                    selectedAsset?.id === asset.id &&
                                    selectedAsset?.metadata.source !==
                                      "polkadot"
                                      ? "onPrimary"
                                      : "content.muted",
                                })}
                              >
                                From Asset Hub
                              </span>
                            </div>
                            {requiresFeePayment && (
                              <div
                                className={css({
                                  fontSize: "0.75rem",
                                  color:
                                    selectedAsset?.id === asset.id &&
                                    selectedAsset?.metadata.source !==
                                      "polkadot"
                                      ? "onPrimary"
                                      : "warning",
                                  textAlign: "left",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                })}
                              >
                                ⚠️ Requires at least 0.1 USDT/USDC for fees to
                                bridge out
                              </div>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {filteredAssets.length === 0 && (
                <p
                  className={css({
                    textAlign: "center",
                    color: "content.muted",
                    padding: "1rem",
                    backgroundColor: "surfaceContainer",
                    borderRadius: "md",
                    fontSize: "0.875rem",
                  })}
                >
                  No assets are available. Make sure your wallet is connected.
                </p>
              )}
            </div>
          </div>
        );

      case "enter-amount":
        return (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            })}
          >
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "1rem",
              })}
            >
              {selectedAsset && (
                <p>
                  Enter the amount of {selectedAsset.metadata.symbol} to bridge
                  to the DAO
                </p>
              )}
            </div>
            <div
              className={css({
                position: "relative",
                width: "100%",
              })}
            >
              <TextInput
                label={`Amount (${selectedAsset?.metadata.symbol})`}
                value={amount}
                onChangeValue={(value) => {
                  // Allow decimal points and numbers
                  const regex = new RegExp(
                    `^\\d*\\.?\\d{0,${selectedAsset?.metadata.decimals || 0}}$`,
                  );
                  if (value === "" || regex.test(value)) {
                    setAmount(value);
                  }
                }}
                placeholder={`Enter amount in ${selectedAsset?.metadata.symbol}`}
                className={css({ width: "100%" })}
              />
              <button
                type="button"
                onClick={() => setAmount(maxAmountValue)}
                className={css({
                  position: "absolute",
                  right: "0.5rem",
                  top: "2.5rem", // Adjusted to account for label
                  background: "none",
                  border: "none",
                  color: "primary",
                  cursor: "pointer",
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.85rem",
                  borderRadius: "md",
                  "&:hover": {
                    backgroundColor: "surfaceContainerHighest",
                  },
                })}
              >
                Max
              </button>
            </div>

            <div
              className={css({
                fontSize: "0.85rem",
                color: "content.muted",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              })}
            >
              <p>Available balance: {getFormattedBalance()}</p>
              {selectedAsset?.metadata.source === "polkadot" && (
                <p className={css({ color: "content.muted" })}>
                  Note: A minimum balance of{" "}
                  {new DenominatedNumber(
                    relayDotExistentialDeposit,
                    selectedAsset.metadata.decimals,
                  ).toLocaleString()}{" "}
                  DOT will be kept in your account
                </p>
              )}
            </div>
          </div>
        );

      case "review":
        return (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            })}
          >
            <h3
              className={css({
                fontSize: "1.1rem",
                fontWeight: "bold",
                marginBottom: "1rem",
              })}
            >
              {selectedAsset?.isNativeVarch
                ? `Review Your Transfer`
                : `Review Your Bridge Transaction`}
            </h3>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                })}
              >
                <span>Asset:</span>
                <span>{selectedAsset?.metadata.symbol}</span>
              </div>
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                })}
              >
                <span>Amount:</span>
                <span>
                  {amount} {selectedAsset?.metadata.symbol}
                </span>
              </div>
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                })}
              >
                <span>From:</span>
                <span>
                  {selectedAsset?.isNativeVarch
                    ? "Your InvArch Account"
                    : "Your Asset Hub Account"}
                </span>
              </div>
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                })}
              >
                <span>To:</span>
                <span>
                  DAO Account:{" "}
                  {daoAddress
                    ? `${daoAddress.toString().substring(0, 6)}...${daoAddress.toString().substring(daoAddress.toString().length - 6)}`
                    : "Loading..."}
                </span>
              </div>
            </div>
            <p
              className={css({
                fontSize: "0.85rem",
                color: "content.muted",
                marginTop: "1rem",
              })}
            >
              {selectedAsset?.isNativeVarch
                ? `After confirming, you will need to sign the transaction to transfer VARCH to the DAO.`
                : `After confirming, you will need to sign the transaction to bridge the assets in to the DAO.`}
            </p>
          </div>
        );
    }
  };

  // Render the navigation and action buttons based on current step
  const renderActionButtons = () => {
    return (
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginTop: "1.5rem",
        })}
      >
        {warningMessage && (
          <div
            className={css({
              color: "error",
              textAlign: "center",
              padding: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: "500",
            })}
          >
            {warningMessage}
          </div>
        )}
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
          })}
        >
          <div>
            {step !== "select-asset" && (
              <Button
                onClick={handleBackStep}
                className={css({
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.2rem",
                  width: "auto",
                })}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.2rem",
                  }}
                >
                  <ArrowLeftIcon size={16} />
                  <span>Back</span>
                </div>
              </Button>
            )}
          </div>
          <div>
            {step !== "review" ? (
              <Button
                onClick={handleNextStep}
                disabled={!canProceed()}
                className={css({
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.2rem",
                  width: "auto",
                })}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.2rem",
                  }}
                >
                  <span>Next</span>
                  <ArrowRightIcon size={16} />
                </div>
              </Button>
            ) : (
              <Button
                onClick={handleBridgeIn}
                pending={isProcessing}
                className={css({
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  width: "auto",
                  "@media (max-width: 768px)": {
                    fontSize: "0.875rem",
                    padding: "0.5rem 0.75rem",
                  },
                })}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  <CheckCircleIcon size={16} />
                  <span>Bridge In</span>
                </div>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Main component render
  return (
    <ModalDialog
      title={
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          })}
        >
          {selectedAsset && (
            <>
              <TokenIcon symbol={selectedAsset.metadata.symbol} size="md" />
              <span>Bridge Your Assets Into DAO</span>
            </>
          )}
          {!selectedAsset && <span>Bridge Your Assets Into DAO</span>}
        </div>
      }
      onClose={onClose}
      className={css({
        containerType: "inline-size",
        width: `min(34rem, 100dvw)`,
      })}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        })}
      >
        {/* Step indicator */}
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            position: "relative",
            marginBottom: "1rem",
          })}
        >
          {["select-asset", "enter-amount", "review"].map((stepName, index) => (
            <div
              key={stepName}
              className={css({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                zIndex: 1,
              })}
            >
              <div
                className={css({
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    step === stepName
                      ? "primary"
                      : ["select-asset", "enter-amount", "review"].indexOf(
                            step,
                          ) > index
                        ? "primary"
                        : "surface",
                  color:
                    step === stepName
                      ? "onPrimary"
                      : ["select-asset", "enter-amount", "review"].indexOf(
                            step,
                          ) > index
                        ? "onPrimary"
                        : "content",
                  marginBottom: "0.5rem",
                })}
              >
                {index + 1}
              </div>
              <span
                className={css({
                  fontSize: "0.8rem",
                  color: step === stepName ? "content" : "content.muted",
                })}
              >
                {stepName === "select-asset"
                  ? "Select Asset"
                  : stepName === "enter-amount"
                    ? "Enter Amount"
                    : "Review"}
              </span>
            </div>
          ))}

          {/* Connecting line between steps */}
          <div
            className={css({
              position: "absolute",
              top: "1rem",
              left: "2.5rem",
              right: "2.5rem",
              height: "2px",
              backgroundColor: "surface",
              zIndex: 0,
            })}
          >
            <div
              className={css({
                height: "100%",
                backgroundColor: "primary",
                width:
                  step === "select-asset"
                    ? "0%"
                    : step === "enter-amount"
                      ? "50%"
                      : "100%",
                transition: "width 0.3s ease-in-out",
              })}
            ></div>
          </div>
        </div>

        {/* Step content */}
        {renderStepContent()}

        {/* Action buttons */}
        {renderActionButtons()}

        {/* Add ED Confirmation Dialog */}
        {showEDConfirmation && (
          <ModalDialog
            title="Confirm Transaction"
            onClose={() => setShowEDConfirmation(false)}
            className={css({
              containerType: "inline-size",
              width: `min(34rem, 100dvw)`,
            })}
          >
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
                alignItems: "center",
                textAlign: "center",
              })}
            >
              <p
                className={css({
                  color: "warning",
                  fontSize: "1rem",
                  lineHeight: "1.5",
                })}
              >
                You are about to leave a balance below the existential deposit (
                {selectedAsset && (
                  <>
                    {new DenominatedNumber(
                      selectedAsset.metadata.existential_deposit,
                      selectedAsset.metadata.decimals,
                    ).toLocaleString()}{" "}
                    {selectedAsset.metadata.symbol}
                  </>
                )}
                ).
                <br />
                <br />
                This may result in the remaining funds being unusable and
                effectively lost.
                <br />
                <br />
                Are you sure you want to proceed?
              </p>
              <div
                className={css({
                  display: "flex",
                  gap: "1rem",
                  width: "100%",
                  justifyContent: "center",
                })}
              >
                <Button
                  onClick={() => {
                    setShowEDConfirmation(false);
                  }}
                  className={css({
                    backgroundColor: "surface",
                    color: "onSurface",
                  })}
                >
                  No, let me adjust
                </Button>
                <Button
                  onClick={() => {
                    setShowEDConfirmation(false);
                    setAmount(maxAmountValue);
                  }}
                  className={css({
                    backgroundColor: "primary",
                    color: "onPrimary",
                  })}
                >
                  Use max amount
                </Button>
                <Button
                  onClick={() => {
                    setShowEDConfirmation(false);
                    setStep("review");
                  }}
                  className={css({
                    backgroundColor: "warning",
                    color: "black",
                    "&:hover": {
                      backgroundColor: "warningHover",
                    },
                  })}
                >
                  Yes, proceed anyway
                </Button>
              </div>
            </div>
          </ModalDialog>
        )}
      </div>
    </ModalDialog>
  );
}
