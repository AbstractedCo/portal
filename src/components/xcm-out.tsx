import { css } from "../../styled-system/css";
import { useNotification } from "../contexts/notification-context";
import { selectedAccountAtom } from "../features/accounts/store";
import {
  useInvArchBridgeOutOperation,
  type BridgeStatusChange,
  isBridgeSupportedOut,
} from "../features/xcm/bridge-utils";
import { Button } from "./button";
import { ModalDialog } from "./modal-dialog";
import { TextInput } from "./text-input";
import { useLazyLoadQuery } from "@reactive-dot/react";
import { DenominatedNumber } from "@reactive-dot/utils";
import { useAtomValue } from "jotai";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from "lucide-react";
import type { Binary, SS58String } from "polkadot-api";
import { useState } from "react";

interface BridgeAssetsOutDialogProps {
  daoId: number;
  onClose: () => void;
}

// Define interfaces for our data structures to properly type them
interface AssetMetadata {
  symbol: Binary;
  name: Binary;
  decimals: number;
}

interface TokenBalance {
  keyArgs: [SS58String, number]; // [accountId, assetId]
  value: {
    free: bigint;
    reserved: bigint;
    frozen: bigint;
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
  };
}

export function BridgeAssetsOutDialog({
  daoId,
  onClose,
}: BridgeAssetsOutDialogProps) {
  const [selectedAsset, setSelectedAsset] = useState<{
    id: number;
    metadata: {
      symbol: string;
      decimals: number;
      name: string;
    };
  } | null>(null);

  const [amount, setAmount] = useState("");
  const [destinationAccount, setDestinationAccount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<"select-asset" | "enter-amount" | "review">(
    "select-asset",
  );
  const { showNotification } = useNotification();

  // Get the DAO's core storage to access its account
  const coreStorage = useLazyLoadQuery((builder) =>
    builder.readStorage("INV4", "CoreStorage", [daoId]),
  );

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

  // Query DAO's token balances with proper typing
  const daoTokens: TokenBalance[] =
    (useLazyLoadQuery((builder) => {
      if (!coreStorage?.account) return null;
      return builder.readStorageEntries("Tokens", "Accounts", [
        coreStorage.account,
      ]);
    }) as unknown as TokenBalance[]) || [];

  // Get asset metadata for the tokens with proper typing
  const assetMetadata: AssetMetadata[] =
    (useLazyLoadQuery((builder) => {
      if (!daoTokens?.length) return null;
      return builder.readStorages(
        "AssetRegistry",
        "Metadata",
        daoTokens.map((token) => [token.keyArgs[1]] as const),
      );
    }) as unknown as AssetMetadata[]) || [];

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

  // Only provide bridge parameters when they're all valid
  const getBridgeParams = () => {
    const rawAmount = getRawAmount();

    // Add debugging information
    console.log("Raw amount:", rawAmount);
    console.log("Selected asset:", selectedAsset);
    console.log("Destination account:", destinationAccount);

    if (!rawAmount || !destinationAccount || !selectedAsset) {
      console.log("Missing required parameters", {
        rawAmount,
        destinationAccount,
        selectedAsset,
      });
      return undefined;
    }

    return {
      destinationAccount,
      assetId: BigInt(selectedAsset.id),
      amount: rawAmount,
      daoId,
      onStatusChange: handleBridgeStatusChange,
      onComplete: () => {
        setIsProcessing(false);
        showNotification({
          variant: "success",
          message: `Bridge out of ${amount} ${selectedAsset.metadata.symbol} initiated successfully!`,
        });
        onClose();
      },
    };
  };

  // Set up the InvArch bridge out operation with the current parameters
  const invArchBridge = useInvArchBridgeOutOperation(getBridgeParams());

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
      console.log(
        "Starting bridge out execution with params:",
        getBridgeParams(),
      );
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

  // Combine tokens with their metadata
  const getAvailableAssets = (): Asset[] => {
    if (!daoTokens || !assetMetadata) return [];

    const assets: Asset[] = [];

    for (let i = 0; i < daoTokens.length; i++) {
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
        metadata.name === undefined
      )
        continue;

      if (!isBridgeSupportedOut(token.keyArgs[1])) continue;

      assets.push({
        id: token.keyArgs[1],
        value: token.value,
        metadata: {
          symbol: metadata.symbol.asText(),
          decimals: metadata.decimals,
          name: metadata.name.asText(),
        },
      });
    }

    return assets;
  };

  // Get formatted balance for display
  const getFormattedBalance = () => {
    if (!selectedAsset || !daoTokens) return "Loading...";

    const token = daoTokens.find((t) => t?.keyArgs?.[1] === selectedAsset.id);
    if (!token || !token.value || !token.value.free) return "Loading...";

    return (
      new DenominatedNumber(
        token.value.free,
        selectedAsset.metadata.decimals,
      ).toLocaleString() +
      " " +
      selectedAsset.metadata.symbol
    );
  };

  // Determine if we can proceed based on current step
  const canProceed = () => {
    if (step === "select-asset") return !!selectedAsset;
    if (step === "enter-amount") {
      return (
        !!amount && parseFloat(amount) > 0 && destinationAccount.length > 0
      );
    }
    return true;
  };

  // Handle moving to the next step
  const handleNextStep = () => {
    if (step === "select-asset" && selectedAsset) {
      setStep("enter-amount");
    } else if (step === "enter-amount" && amount && destinationAccount) {
      setStep("review");
    }
  };

  // Handle going back to the previous step
  const handleBackStep = () => {
    if (step === "enter-amount") {
      setStep("select-asset");
    } else if (step === "review") {
      setStep("enter-amount");
    }
  };

  // Render appropriate content based on the current step
  const renderStepContent = () => {
    // Get the available assets
    const availableAssets = getAvailableAssets();

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
                      <span className={css({ fontWeight: "500" })}>
                        {asset.metadata.symbol}
                      </span>
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
            <p className={css({ marginBottom: "1rem" })}>
              Enter the amount of {selectedAsset?.metadata.symbol} to bridge
              from the DAO to {destinationChain}
            </p>
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
            </div>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "4",
                width: "100%",
              })}
            >
              <TextInput
                label={`Destination Account (${destinationChain})`}
                value={destinationAccount}
                onChangeValue={setDestinationAccount}
                placeholder="Enter destination account address"
              />
              <Button
                onClick={useSelectedAccountAsDestination}
                className={css({ marginTop: "2" })}
              >
                Use My Account Address
              </Button>
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
              Review Your Bridge Out Transaction
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
                  DAO Account:{" "}
                  {coreStorage?.account
                    ? `${coreStorage.account.substring(0, 6)}...${coreStorage.account.substring(coreStorage.account.length - 6)}`
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
      title="Bridge Your Assets Out of DAO"
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
    </ModalDialog>
  );
}
