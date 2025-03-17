import { css } from "../../styled-system/css";
import { useNotification } from "../contexts/notification-context";
import { selectedAccountAtom } from "../features/accounts/store";
import { useLazyLoadRegisteredAssets } from "../features/assets/store";
import {
  useAssetHubBridgeInOperation,
  type BridgeStatusChange,
  isBridgeSupportedIn,
  isNativeToken,
  needsFeePayment,
} from "../features/xcm/bridge-utils";
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
import { useState, useEffect, useMemo, useCallback } from "react";

// Add constants for VARCH token
const VARCH_EXISTENTIAL_DEPOSIT = 10_000_000_000n;
const VARCH_BUFFER = VARCH_EXISTENTIAL_DEPOSIT * 2n;

interface BridgeAssetsInDialogProps {
  daoAddress: string;
  onClose: () => void;
}

export function BridgeAssetsInDialog({
  daoAddress,
  onClose,
}: BridgeAssetsInDialogProps) {
  const [selectedAsset, setSelectedAsset] = useState<{
    id: number;
    metadata: {
      symbol: string;
      decimals: number;
      name: string;
      existential_deposit: bigint;
      location: XcmVersionedLocation | undefined;
      additional: bigint;
    };
    isNativeVarch?: boolean; // Flag to indicate if this is the native VARCH token
  } | null>(null);

  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<"select-asset" | "enter-amount" | "review">(
    "select-asset",
  );
  const [showEDConfirmation, setShowEDConfirmation] = useState(false);
  const { showNotification } = useNotification();
  const registeredAssets = useLazyLoadRegisteredAssets();
  const selectedAccount = useAtomValue(selectedAccountAtom);

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

      // For native tokens like DOT
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

  // Only provide bridge parameters when they're all valid
  const getBridgeParams = () => {
    const assetId = getAssetId();
    const rawAmount = getRawAmount();
    const beneficiaryAccount = daoAddress;

    // Add debugging information
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

    // If we have a native token, assetId might be optional in some cases
    // Otherwise, ensure we have a valid assetId
    if (
      !isNativeToken(selectedAsset.metadata.location) &&
      assetId === undefined
    ) {
      console.log(
        "Asset ID is required for non-native tokens but is undefined",
      );
      return undefined;
    }

    // For non-native tokens, we must have verified there's a valid assetId above
    // This ensures assetId is always a bigint for non-native tokens
    // For native tokens, default to 0n if needed
    const finalAssetId = assetId !== undefined ? assetId : 0n;

    return {
      beneficiaryAccount,
      assetLocation: selectedAsset.metadata.location,
      assetId: finalAssetId,
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

  // Handle bridge operation
  const handleBridgeIn = async () => {
    if (!selectedAsset || !daoAddress || !amount || !selectedAccount) {
      showNotification({
        variant: "error",
        message:
          "Please select an asset, enter an amount, and connect a wallet.",
      });
      return;
    }

    // Validate amount format
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showNotification({
        variant: "error",
        message: "Please enter a valid amount greater than zero.",
      });
      return;
    }

    // Get raw amount and validate it
    const rawAmount = getRawAmount();
    if (rawAmount === undefined) {
      showNotification({
        variant: "error",
        message:
          "Could not convert amount to the correct format. Please check your input.",
      });
      return;
    }

    try {
      // If this is native VARCH, use regular transfer instead of bridge
      if (selectedAsset.isNativeVarch) {
        console.log("Starting native VARCH transfer");
        await executeNativeTransfer();
        return;
      }

      // For other assets, use the bridge
      console.log("Starting bridge execution with params:", getBridgeParams());
      // Execute the bridge operation
      await assetHubBridge.executeBridge();
    } catch (error) {
      console.error("Failed to submit transaction:", error);
      showNotification({
        variant: "error",
        message:
          "Failed to submit transaction: " +
          (error instanceof Error ? error.message : "Unknown error"),
      });
      setIsProcessing(false);
    }
  };

  // Filter assets to only show those with supported bridges
  const getFilteredAssets = () => {
    return registeredAssets.filter((asset) => {
      try {
        // Only include assets that have location and supported bridge
        if (!asset.metadata.location) return false;
        return isBridgeSupportedIn(asset.metadata.location);
      } catch (error) {
        // If there's any error in checking bridge support, exclude the asset
        console.warn("Error checking bridge support for asset:", asset, error);
        return false;
      }
    });
  };

  // Get formatted balance for display
  const getFormattedBalance = () => {
    if (!selectedAsset) return "Loading...";

    try {
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

      // For other assets, use the existing code
      if (!assetHubBalance) return "Loading...";

      // For native tokens (like DOT)
      if (
        selectedAsset.metadata.location &&
        isNativeToken(selectedAsset.metadata.location)
      ) {
        if (typeof assetHubBalance === "object" && "data" in assetHubBalance) {
          const freeBalance = assetHubBalance.data?.free || 0n;
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

  // Determine if we can proceed based on current step
  const canProceed = () => {
    if (step === "select-asset") return !!selectedAsset;
    if (step === "enter-amount") return !!amount && parseFloat(amount) > 0;
    return true;
  };

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

  // Modify handleNextStep to include ED check
  const handleNextStep = () => {
    if (step === "select-asset" && selectedAsset) {
      setStep("enter-amount");
    } else if (step === "enter-amount" && amount) {
      // Check if amount is below existential deposit
      if (isRemainderBelowED && !showEDConfirmation) {
        // Show confirmation dialog instead of proceeding
        setShowEDConfirmation(true);
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
      // Reset the confirmation dialog when going back
      setShowEDConfirmation(false);
      setStep("select-asset");
    } else if (step === "review") {
      setStep("enter-amount");
    }
  };

  // Get the free balance based on token type
  const getFreeBalance = useCallback(() => {
    if (!selectedAsset?.isNativeVarch) {
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
  }, [selectedAsset, assetHubBalance, nativeBalance]);

  // Calculate max amount considering existential deposit only for VARCH
  const _maxAmount = useMemo(() => {
    const freeBalance = getFreeBalance();

    // For VARCH, consider existential deposit and buffer
    if (selectedAsset?.isNativeVarch) {
      const minimumRequired = VARCH_EXISTENTIAL_DEPOSIT + VARCH_BUFFER;
      if (freeBalance <= minimumRequired) return "0";
      const safeMaximum = freeBalance - minimumRequired;
      return new DenominatedNumber(
        safeMaximum,
        selectedAsset.metadata.decimals,
      ).toString();
    }

    // For other assets, use full free balance
    if (selectedAsset) {
      return new DenominatedNumber(
        freeBalance,
        selectedAsset.metadata.decimals,
      ).toString();
    }

    return "0";
  }, [selectedAsset, getFreeBalance]);

  // Format balance for display separately
  const _formattedBalance = useMemo(() => {
    const freeBalance = getFreeBalance();
    if (!selectedAsset) return "Loading...";
    return new DenominatedNumber(
      freeBalance,
      selectedAsset.metadata.decimals,
    ).toLocaleString();
  }, [selectedAsset, getFreeBalance]);

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

              {/* Bridged assets section */}
              {filteredAssets.length > 0 && (
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
                    {filteredAssets.map((asset) => {
                      // Only check needsFeePayment for non-native tokens from Asset Hub
                      const requiresFeePayment =
                        asset.metadata.location &&
                        !isNativeToken(asset.metadata.location) &&
                        needsFeePayment(asset.id);

                      return (
                        <button
                          key={asset.id}
                          onClick={() => setSelectedAsset(asset)}
                          className={css({
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                            padding: "0.75rem 1rem",
                            backgroundColor:
                              selectedAsset?.id === asset.id
                                ? "primary"
                                : "surfaceContainerHigh",
                            color:
                              selectedAsset?.id === asset.id
                                ? "onPrimary"
                                : "content",
                            border: "none",
                            borderRadius: "lg",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            "&:hover": {
                              backgroundColor:
                                selectedAsset?.id === asset.id
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
                                  selectedAsset?.id === asset.id
                                    ? "onPrimary"
                                    : "content.muted",
                              })}
                            >
                              {asset.metadata.name}
                            </span>
                          </div>
                          {requiresFeePayment && (
                            <div
                              className={css({
                                fontSize: "0.75rem",
                                color:
                                  selectedAsset?.id === asset.id
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
                <>
                  <TokenIcon symbol={selectedAsset.metadata.symbol} size="md" />
                  <p>
                    Enter the amount of {selectedAsset.metadata.symbol} to
                    bridge to the DAO
                  </p>
                </>
              )}
            </div>

            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
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

              {/* Add ED warning */}
              {isRemainderBelowED && (
                <div
                  className={css({
                    backgroundColor: "warningContainer",
                    color: "onWarningContainer",
                    padding: "0.75rem 1rem",
                    borderRadius: "md",
                    fontSize: "0.875rem",
                  })}
                >
                  <p>
                    <strong>Warning:</strong> The amount you&apos;re trying to
                    bridge is less than the existential deposit (
                    {selectedAsset &&
                      new DenominatedNumber(
                        selectedAsset.metadata.existential_deposit,
                        selectedAsset.metadata.decimals,
                      ).toLocaleString()}
                    &nbsp;{selectedAsset?.metadata.symbol}). The funds may be
                    lost if you proceed.
                  </p>
                </div>
              )}

              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                })}
              >
                <p
                  className={css({
                    color: "content.muted",
                    fontSize: "0.875rem",
                  })}
                >
                  Available balance:{" "}
                  {selectedAsset ? getFormattedBalance() : "Select an asset"} on{" "}
                  {selectedAsset?.isNativeVarch ? "InvArch" : "Asset Hub"}
                </p>
                {selectedAsset && (
                  <>
                    <p
                      className={css({
                        fontSize: "0.85rem",
                        color: "content.muted",
                      })}
                    >
                      {selectedAsset.isNativeVarch
                        ? "Make sure you have enough funds in your account to cover the transaction fees."
                        : "Make sure you have enough funds in your Asset Hub account to cover the transaction fees."}
                    </p>
                    {selectedAsset.metadata.location &&
                      !isNativeToken(selectedAsset.metadata.location) &&
                      needsFeePayment(selectedAsset.id) && (
                        <div
                          className={css({
                            fontSize: "0.85rem",
                            color: "warning",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            marginTop: "0.5rem",
                            backgroundColor: "warningContainer",
                            padding: "0.75rem",
                            borderRadius: "md",
                          })}
                        >
                          ⚠️ This asset will require 0.1 USDT/USDC for fees when
                          bridging out later
                        </div>
                      )}
                  </>
                )}
              </div>
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
          justifyContent: "space-between",
          marginTop: "1.5rem",
        })}
      >
        {step !== "select-asset" ? (
          <Button
            onClick={handleBackStep}
            className={css({
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
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
        ) : (
          <div></div> // Empty div to maintain layout
        )}

        {step !== "review" ? (
          <Button
            onClick={handleNextStep}
            disabled={!canProceed()}
            className={css({
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
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
            pending={isProcessing || assetHubBridge.isProcessing}
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
              <span>
                {selectedAsset?.isNativeVarch ? (
                  "Transfer VARCH"
                ) : (
                  <span
                    className={css({
                      "@media (max-width: 768px)": {
                        display: "none",
                      },
                    })}
                  >
                    Show Bridge Instructions
                  </span>
                )}
                {!selectedAsset?.isNativeVarch && (
                  <span
                    className={css({
                      "@media (min-width: 769px)": {
                        display: "none",
                      },
                    })}
                  >
                    Bridge
                  </span>
                )}
              </span>
            </div>
          </Button>
        )}
      </div>
    );
  };

  // Get dynamic dialog title based on asset and step
  const getDialogTitle = () => {
    if (!selectedAsset) return "Fund Your DAO";

    if (selectedAsset.isNativeVarch) {
      return "Transfer VARCH to DAO";
    } else {
      return "Bridge Assets Into DAO";
    }
  };

  // Main component render
  return (
    <ModalDialog
      title={getDialogTitle()}
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
                You are about to bridge an amount below the existential deposit
                (
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
                This may result in the funds being unusable and effectively
                lost.
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
