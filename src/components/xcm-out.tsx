import { css } from "../../styled-system/css";
import { useNotification } from "../contexts/notification-context";
import { selectedAccountAtom } from "../features/accounts/store";
import {
  useInvArchBridgeOutOperation,
  type BridgeStatusChange,
  isBridgeSupportedOut,
  canPayFees,
  needsFeePayment,
  calculateFeeAmount,
} from "../features/xcm/bridge-utils";
import { Button } from "./button";
import { ModalDialog } from "./modal-dialog";
import { TextInput } from "./text-input";
import { TokenIcon } from "./token-icon";
import { useLazyLoadQuery } from "@reactive-dot/react";
import { DenominatedNumber } from "@reactive-dot/utils";
import { useAtomValue } from "jotai";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from "lucide-react";
import type { Binary, SS58String } from "polkadot-api";
import { useState, useEffect, useMemo } from "react";

interface BridgeAssetsOutDialogProps {
  daoId: number;
  daoAddress: string;
  onClose: () => void;
}

// Define interfaces for our data structures to properly type them
interface AssetMetadata {
  symbol: Binary;
  name: Binary;
  decimals: number;
  existential_deposit: bigint;
}

interface TokenBalance {
  keyArgs: [SS58String, number]; // [accountId, assetId]
  value: {
    free: bigint;
    reserved: bigint;
    frozen: bigint;
  };
  metadata?: {
    symbol: string;
    decimals: number;
    name: string;
    existential_deposit: bigint;
  };
}

interface Asset {
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
  };
}

export function BridgeAssetsOutDialog({
  daoId,
  daoAddress,
  onClose,
}: BridgeAssetsOutDialogProps) {
  const [selectedAsset, setSelectedAsset] = useState<{
    id: number;
    metadata: {
      symbol: string;
      decimals: number;
      name: string;
      existential_deposit: bigint;
    };
  } | null>(null);

  // Add state for fee asset selection
  const [selectedFeeAsset, setSelectedFeeAsset] = useState<{
    id: number;
    metadata: {
      symbol: string;
      decimals: number;
      name: string;
      existential_deposit: bigint;
    };
  } | null>(null);

  const [amount, setAmount] = useState("");
  const [destinationAccount, setDestinationAccount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<"select-asset" | "enter-amount" | "review">(
    "select-asset",
  );
  const { showNotification } = useNotification();
  // Add destination chain constant - can be made dynamic in the future
  const destinationChain = "Asset Hub";

  // Add selected account import
  const selectedAccount = useAtomValue(selectedAccountAtom);

  // Function to use selected account as destination
  const useSelectedAccountAsDestination = () => {
    if (selectedAccount?.address) {
      setDestinationAccount(selectedAccount.address);
    } else {
      showNotification({
        variant: "error",
        message: "No account selected. Please select an account first.",
      });
    }
  };

  // Get the DAO's token balances with proper typing
  const daoTokensResult = useLazyLoadQuery((builder) => {
    if (!daoAddress) return null;
    return builder.readStorageEntries("Tokens", "Accounts", [daoAddress]);
  }) as unknown as TokenBalance[] | null;

  // Memoize the processed tokens to prevent unnecessary re-renders
  const daoTokens = useMemo(() => daoTokensResult || [], [daoTokensResult]);

  // Get asset metadata for the tokens with proper typing
  const assetMetadataResult = useLazyLoadQuery((builder) => {
    if (!daoTokens?.length) return null;
    return builder.readStorages(
      "AssetRegistry",
      "Metadata",
      daoTokens.map((token) => [token.keyArgs[1]] as const),
    );
  }) as unknown as AssetMetadata[] | null;

  // Memoize the processed metadata to prevent unnecessary re-renders
  const assetMetadata = useMemo(
    () => assetMetadataResult || [],
    [assetMetadataResult],
  );

  // Combine tokens with their metadata
  const getAvailableAssets = (): Asset[] => {
    if (!daoTokens || !assetMetadata) return [];

    const assets: Asset[] = [];

    for (let i = 0; i < daoTokens.length; i++) {
      try {
        if (!daoTokens[i] || !assetMetadata[i]) continue;

        // Explicitly check for token properties to satisfy TypeScript
        const token = daoTokens[i];
        if (!token || !token.keyArgs || !token.value) continue;

        // Explicitly check for metadata properties to satisfy TypeScript
        const metadata = assetMetadata[i];
        if (
          !metadata ||
          metadata.symbol === undefined ||
          metadata.decimals === undefined ||
          metadata.name === undefined ||
          metadata.existential_deposit === undefined
        )
          continue;

        // Only include assets that have bridge support
        try {
          if (!isBridgeSupportedOut(token.keyArgs[1])) continue;
        } catch (error) {
          console.warn(
            "Error checking bridge support for token:",
            token,
            error,
          );
          continue;
        }

        assets.push({
          id: token.keyArgs[1],
          value: token.value,
          metadata: {
            symbol: metadata.symbol.asText(),
            decimals: metadata.decimals,
            name: metadata.name.asText(),
            existential_deposit: metadata.existential_deposit,
          },
        });
      } catch (error) {
        console.warn("Error processing token:", daoTokens[i], error);
        continue;
      }
    }

    return assets;
  };

  // Get available fee assets
  const getAvailableFeeAssets = useMemo(() => {
    if (!daoTokens || !assetMetadata) return [];

    return getAvailableAssets().filter((asset) => canPayFees(asset.id));
  }, [daoTokens, assetMetadata]);

  // Check if selected asset needs fee payment
  const needsFeePaying = useMemo(() => {
    if (!selectedAsset) return false;
    return needsFeePayment(selectedAsset.id);
  }, [selectedAsset]);

  // Calculate max amount considering existential deposit
  const _maxAmount = useMemo(() => {
    if (!selectedAsset || !daoTokens) return "0";

    const token = daoTokens.find((t) => t?.keyArgs?.[1] === selectedAsset.id);
    if (!token?.value?.free) return "0";

    return new DenominatedNumber(
      token.value.free,
      selectedAsset.metadata.decimals,
    ).toString();
  }, [selectedAsset, daoTokens]);

  // Format balance for display separately
  const formattedBalance = useMemo(() => {
    if (!selectedAsset || !daoTokens) return "Loading...";

    const token = daoTokens.find((t) => t?.keyArgs?.[1] === selectedAsset.id);
    if (!token?.value?.free) return "Loading...";

    return new DenominatedNumber(
      token.value.free,
      selectedAsset.metadata.decimals,
    ).toLocaleString();
  }, [selectedAsset, daoTokens]);

  // Convert amount to proper decimals
  const getRawAmount = () => {
    try {
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

  // Set up the InvArch bridge out operation with the current parameters
  const invArchBridge = useInvArchBridgeOutOperation(
    selectedAsset && destinationAccount && getRawAmount()
      ? {
          destinationAccount,
          assetId: BigInt(selectedAsset.id),
          amount: getRawAmount()!,
          daoId,
          ...(needsFeePaying && selectedFeeAsset
            ? { feeAssetId: selectedFeeAsset.id }
            : {}),
          onStatusChange: handleBridgeStatusChange,
          onComplete: () => {
            setIsProcessing(false);
            showNotification({
              variant: "success",
              message: `Bridge out of ${amount} ${selectedAsset.metadata.symbol} initiated successfully!`,
            });
            onClose();
          },
        }
      : undefined,
  );

  // Handle bridge operation
  const handleBridgeOut = async () => {
    if (!selectedAsset || !destinationAccount || !amount) {
      showNotification({
        variant: "error",
        message:
          "Please select an asset, enter an amount, and provide a destination account.",
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
      console.log("Starting bridge out execution with params:", {
        destinationAccount,
        assetId: selectedAsset?.id,
        amount: rawAmount,
        daoId,
        feeAssetId: selectedFeeAsset?.id,
      });
      // Execute the bridge operation
      await invArchBridge.executeBridgeOut();
    } catch (error) {
      console.error("Failed to submit bridge out transaction:", error);
      showNotification({
        variant: "error",
        message:
          "Failed to submit bridge out transaction: " +
          (error instanceof Error ? error.message : "Unknown error"),
      });
      setIsProcessing(false);
    }
  };

  // Determine if we can proceed based on current step
  const canProceed = () => {
    if (step === "select-asset") return !!selectedAsset;
    if (step === "enter-amount") {
      const hasValidAmount = !!amount && parseFloat(amount) > 0;
      const hasDestination = destinationAccount.length > 0;
      const hasFeeAsset =
        !needsFeePaying || (needsFeePaying && selectedFeeAsset);
      return hasValidAmount && hasDestination && hasFeeAsset;
    }
    return true;
  };

  // Handle moving to the next step
  const handleNextStep = () => {
    if (step === "select-asset" && selectedAsset) {
      setStep("enter-amount");
    } else if (step === "enter-amount" && amount && destinationAccount) {
      // Check if remaining balance would be below existential deposit
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

  // State for tracking if the remaining balance would be below existential deposit
  const [isRemainderBelowED, setIsRemainderBelowED] = useState(false);

  // State for showing confirmation dialog
  const [showEDConfirmation, setShowEDConfirmation] = useState(false);

  // Define maxAmountValue at the component level so it's accessible to all functions
  const [maxAmountValue, setMaxAmountValue] = useState("0");

  // Memoize expensive ED calculations
  const edCalculations = useMemo(() => {
    if (!selectedAsset || !daoTokens || step !== "enter-amount") {
      return { isRemainderBelowED: false, maxAmount: "0" };
    }

    const token = daoTokens.find((t) => t?.keyArgs?.[1] === selectedAsset.id);
    if (!token?.value?.free) {
      return { isRemainderBelowED: false, maxAmount: "0" };
    }

    const currentBalance = new DenominatedNumber(
      token.value.free,
      selectedAsset.metadata.decimals,
    );
    const currentBalanceValue = parseFloat(currentBalance.toString());
    const maxAmount = currentBalance.toString();

    if (!amount) {
      return { isRemainderBelowED: false, maxAmount };
    }

    const amountValue = parseFloat(amount);
    const edDenominated = new DenominatedNumber(
      selectedAsset.metadata.existential_deposit,
      selectedAsset.metadata.decimals,
    );
    const existentialDepositValue = parseFloat(edDenominated.toString());
    const remainingBalance = currentBalanceValue - amountValue;

    return {
      isRemainderBelowED:
        remainingBalance > 0 && remainingBalance < existentialDepositValue,
      maxAmount,
    };
  }, [selectedAsset, daoTokens, amount, step]);

  // Update state based on memoized calculations
  useEffect(() => {
    setIsRemainderBelowED(edCalculations.isRemainderBelowED);
    setMaxAmountValue(edCalculations.maxAmount);
  }, [edCalculations]);

  // Render appropriate content based on the current step
  const renderStepContent = () => {
    // Get the available assets
    const availableAssets = getAvailableAssets();

    // Calculate existential deposit and balance information if we're on the enter-amount step
    if (step === "enter-amount" && selectedAsset) {
      // Get current balance - this is only for display in the render function
      const token = daoTokens.find((t) => t?.keyArgs?.[1] === selectedAsset.id);
      if (token && token.value && token.value.free) {
        // Check if remaining balance would be below existential deposit - for logging only
        if (amount) {
          const currentBalance = new DenominatedNumber(
            token.value.free,
            selectedAsset.metadata.decimals,
          );

          const amountValue = parseFloat(amount) || 0;
          const currentBalanceValue = parseFloat(
            currentBalance.toLocaleString(),
          );
          const existentialDepositValue = parseFloat(
            new DenominatedNumber(
              selectedAsset?.metadata.existential_deposit || BigInt(0),

              selectedAsset?.metadata.decimals || 0,
            ).toLocaleString(),
          );

          const remainingBalance = currentBalanceValue - amountValue;

          console.log("Existential deposit check:", {
            amountValue,
            currentBalanceValue,
            existentialDepositValue,
            remainingBalance,
            isRemainderBelowED,
          });
        }
      }
    }

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
              Select an asset to bridge out of the DAO to Asset Hub
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
                  Available Assets
                </h4>
                <div
                  className={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  })}
                >
                  {availableAssets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className={css({
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
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
                          alignItems: "center",
                          gap: "0.75rem",
                        })}
                      >
                        <TokenIcon symbol={asset.metadata.symbol} size="md" />
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
                        {new DenominatedNumber(
                          asset.value.free,
                          asset.metadata.decimals,
                        ).toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {availableAssets.length === 0 && (
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
                No bridgeable assets are available in this DAO. Try adding some
                assets first.
              </p>
            )}
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
                  from the DAO to {destinationChain}
                </p>
              )}
            </div>
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

            {/* Warning for existential deposit */}
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
                  <strong>Warning:</strong> The remaining balance would be less
                  than the existential deposit (
                  {new DenominatedNumber(
                    selectedAsset?.metadata.existential_deposit || BigInt(0),

                    selectedAsset?.metadata.decimals || 0,
                  ).toLocaleString()}
                  &nbsp;
                  {selectedAsset?.metadata.symbol}). Consider transferring your
                  entire balance to avoid losing funds.
                </p>
                <button
                  type="button"
                  onClick={() => setAmount(maxAmountValue)}
                  className={css({
                    background: "none",
                    border: "none",
                    color: "onWarningContainer",
                    fontWeight: "bold",
                    cursor: "pointer",
                    padding: "0.5rem 0 0 0",
                    fontSize: "0.85rem",
                    textDecoration: "underline",
                    "&:hover": {
                      textDecoration: "none",
                    },
                  })}
                >
                  Use max amount
                </button>
              </div>
            )}

            {needsFeePaying && (
              <div
                className={css({
                  marginTop: "1rem",
                  padding: "1rem",
                  backgroundColor: "surfaceContainer",
                  borderRadius: "xl",
                  border: "1px solid token(colors.surfaceContainerHighest)",
                })}
              >
                <h4
                  className={css({
                    fontSize: "0.9rem",
                    fontWeight: "500",
                    color: "content.muted",
                    marginBottom: "0.75rem",
                  })}
                >
                  Select Fee Payment Asset
                </h4>
                <p
                  className={css({
                    fontSize: "0.85rem",
                    color: "content.muted",
                    marginBottom: "1rem",
                  })}
                >
                  This asset requires a fee payment token to bridge. Please
                  select one:
                </p>
                <div
                  className={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  })}
                >
                  {getAvailableFeeAssets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => setSelectedFeeAsset(asset)}
                      className={css({
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem 1rem",
                        backgroundColor:
                          selectedFeeAsset?.id === asset.id
                            ? "primary"
                            : "surfaceContainerHigh",
                        color:
                          selectedFeeAsset?.id === asset.id
                            ? "onPrimary"
                            : "content",
                        border: "none",
                        borderRadius: "lg",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        "&:hover": {
                          backgroundColor:
                            selectedFeeAsset?.id === asset.id
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
                        <TokenIcon symbol={asset.metadata.symbol} size="md" />
                        <span className={css({ fontWeight: "500" })}>
                          {asset.metadata.symbol}
                        </span>
                      </div>
                      <span
                        className={css({
                          fontSize: "0.875rem",
                          color:
                            selectedFeeAsset?.id === asset.id
                              ? "onPrimary"
                              : "content.muted",
                        })}
                      >
                        {new DenominatedNumber(
                          asset.value.free,
                          asset.metadata.decimals,
                        ).toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
                {getAvailableFeeAssets.length === 0 && (
                  <p
                    className={css({
                      textAlign: "center",
                      color: "error",
                      padding: "1rem",
                      backgroundColor: "surfaceContainer",
                      borderRadius: "md",
                      fontSize: "0.875rem",
                    })}
                  >
                    No fee payment assets available. You need either USDC or
                    USDT to bridge this asset.
                  </p>
                )}
              </div>
            )}

            <div
              className={css({
                fontSize: "0.85rem",
                color: "content.muted",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              })}
            >
              <p>Available balance: {formattedBalance}</p>
              {!isRemainderBelowED && (
                <button
                  type="button"
                  onClick={() => setAmount(maxAmountValue)}
                  className={css({
                    background: "none",
                    border: "none",
                    color: "primary",
                    cursor: "pointer",
                    padding: "0",
                    fontSize: "0.85rem",
                    textDecoration: "underline",
                    width: "fit-content",
                    "&:hover": {
                      textDecoration: "none",
                    },
                  })}
                >
                  Use max amount
                </button>
              )}
              {selectedAsset && needsFeePayment(selectedAsset.id) && (
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
                  ⚠️ This asset requires USDT/USDC for bridging fees. Make sure
                  you have enough fee tokens available.
                </div>
              )}
            </div>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "4",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "1.5rem",
                })}
              >
                <label
                  className={css({
                    color: "content.muted",
                    fontSize: "0.875rem",
                    userSelect: "none",
                  })}
                >
                  Destination Account ({destinationChain})
                </label>
                <button
                  onClick={useSelectedAccountAsDestination}
                  className={css({
                    background: "none",
                    border: "none",
                    padding: "0 0.25rem",
                    color: "primary",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    transition: "opacity 0.2s ease",
                    userSelect: "none",
                    "&:hover": {
                      opacity: 0.8,
                    },
                  })}
                >
                  Use my account
                </button>
              </div>
              <TextInput
                value={destinationAccount}
                onChangeValue={setDestinationAccount}
                placeholder="Enter destination account address"
                className={css({
                  width: "100%",
                  marginBottom: "1rem",
                })}
              />
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
              <p>
                Make sure the destination account exists on {destinationChain}{" "}
                and can receive the assets.
              </p>
            </div>
          </div>
        );

      case "review":
        return (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "1.5rem",
              alignItems: "center",
              textAlign: "center",
            })}
          >
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
              })}
            >
              <h3
                className={css({
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  color: "content",
                })}
              >
                Review Bridge Transaction
              </h3>
              <p className={css({ color: "content.muted" })}>
                Please review the details of your bridge transaction
              </p>
            </div>

            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                width: "100%",
                backgroundColor: "surfaceContainer",
                padding: "1.5rem",
                borderRadius: "xl",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                })}
              >
                <span className={css({ color: "content.muted" })}>Asset</span>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  })}
                >
                  {selectedAsset && (
                    <TokenIcon
                      symbol={selectedAsset.metadata.symbol}
                      size="md"
                    />
                  )}
                  <span className={css({ fontWeight: "500" })}>
                    {selectedAsset?.metadata.symbol}
                  </span>
                </div>
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
                  DAO Account:{" "}
                  {daoAddress
                    ? `${daoAddress.substring(0, 6)}...${daoAddress.substring(daoAddress.length - 6)}`
                    : "Loading..."}
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
                  {destinationChain} Account:{" "}
                  {destinationAccount
                    ? `${destinationAccount.substring(0, 6)}...${destinationAccount.substring(destinationAccount.length - 6)}`
                    : "Loading..."}
                </span>
              </div>

              {needsFeePaying && selectedFeeAsset && (
                <div
                  className={css({
                    display: "flex",
                    justifyContent: "space-between",
                  })}
                >
                  <span>Fee Payment Asset:</span>
                  <span>
                    {selectedFeeAsset.metadata.symbol} (estimated fee:{" "}
                    {new DenominatedNumber(
                      calculateFeeAmount(selectedFeeAsset.id),
                      selectedFeeAsset.metadata.decimals,
                    ).toLocaleString()}
                    )
                  </span>
                </div>
              )}
            </div>
            <p
              className={css({
                fontSize: "0.85rem",
                color: "content.muted",
                marginTop: "1rem",
              })}
            >
              After confirming, you will need to sign to create a proposal for
              the transaction to bridge the assets to {destinationChain}.
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
            onClick={handleBridgeOut}
            pending={isProcessing || invArchBridge.isProcessing}
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
              <span>
                <span
                  className={css({
                    "@media (max-width: 768px)": {
                      display: "none",
                    },
                  })}
                >
                  Bridge Out Assets
                </span>
                <span
                  className={css({
                    "@media (min-width: 769px)": {
                      display: "none",
                    },
                  })}
                >
                  Bridge
                </span>
              </span>
              <CheckCircleIcon size={16} />
            </div>
          </Button>
        )}
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
              <span>Bridge Your Assets Out of DAO</span>
            </>
          )}
          {!selectedAsset && <span>Bridge Your Assets Out of DAO</span>}
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
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  marginBottom: "0.5rem",
                  "&:hover": {
                    backgroundColor:
                      step === stepName
                        ? "primary"
                        : ["select-asset", "enter-amount", "review"].indexOf(
                              step,
                            ) > index
                          ? "primary"
                          : "surfaceContainerHighest",
                  },
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
                    ? "Enter Details"
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
      </div>
      {/* Existential Deposit Confirmation Dialog */}
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
            </div>
          </div>
        </ModalDialog>
      )}
    </ModalDialog>
  );
}
