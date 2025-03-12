import { ModalDialog } from "./modal-dialog";
import { Button } from "./button";
import { useState } from "react";
import { TextInput } from "./text-input";
import { useNotification } from "../contexts/notification-context";
import { css } from "../../styled-system/css";
import { useLazyLoadRegisteredAssets } from "../features/assets/store";
import type { XcmVersionedLocation } from "@polkadot-api/descriptors";
import { useLazyLoadQuery } from "@reactive-dot/react";
import { selectedAccountAtom } from "../features/accounts/store";
import { useAtomValue } from "jotai";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from "lucide-react";
import { DenominatedNumber } from "@reactive-dot/utils";
import { getAssetHubId } from "../features/xcm/xcm-utils";
import {
  useAssetHubBridgeOperation,
  type BridgeStatusChange,
  isBridgeSupported,
  isNativeToken
} from "../features/xcm/bridge-utils";

interface BridgeAssetsInDialogProps {
  daoId: number;
  onClose: () => void;
}

export function BridgeAssetsInDialog({ daoId, onClose }: BridgeAssetsInDialogProps) {
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
  } | null>(null);

  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'select-asset' | 'enter-amount' | 'review'>('select-asset');
  const { showNotification } = useNotification();
  const registeredAssets = useLazyLoadRegisteredAssets();
  const selectedAccount = useAtomValue(selectedAccountAtom);

  // Get the asset ID for the selected asset
  const getAssetId = () => {
    if (!selectedAsset) return undefined;

    console.log("Getting asset ID for:", selectedAsset);

    // For native tokens like DOT, use the asset ID directly
    if (selectedAsset.metadata.location && isNativeToken(selectedAsset.metadata.location)) {
      // Ensure the ID is a valid number before converting to BigInt
      if (typeof selectedAsset.id === 'number' && !isNaN(selectedAsset.id)) {
        console.log("Converting native token ID to BigInt:", selectedAsset.id);
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
  };

  // Convert amount to proper decimals
  const getRawAmount = () => {
    if (!amount || !selectedAsset) {
      console.log("Missing amount or asset for conversion:", { amount, asset: selectedAsset?.id });
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
      if (selectedAsset.metadata.location && isNativeToken(selectedAsset.metadata.location)) {
        // Use the special query for native token balance
        return builder.readStorage("System", "Account", [selectedAccount.address]);
      }

      // For other assets from Asset Hub
      if (selectedAsset.metadata.location) {
        const assetHubId = getAssetHubId(selectedAsset.metadata.location);
        if (assetHubId === undefined) return undefined;

        return builder.readStorage("Assets", "Account", [Number(assetHubId), selectedAccount.address]);
      }

      return undefined;
    },
    { chainId: "polkadot_asset_hub" }
  );

  // Get the DAO's core storage to access its account
  const coreStorage = useLazyLoadQuery((builder) =>
    builder.readStorage("INV4", "CoreStorage", [daoId]),
  );

  // Function to handle status changes from the bridge
  const handleBridgeStatusChange = (status: BridgeStatusChange) => {
    // Update processing state
    setIsProcessing(status.status === 'pending');

    // Display appropriate notification
    showNotification({
      variant: status.status === 'error' ? 'error' : 'success',
      message: status.message
    });

    // Close dialog on successful completion
    if (status.status === 'success' && status.message.includes('successful')) {
      onClose();
    }
  };

  // Only provide bridge parameters when they're all valid
  const getBridgeParams = () => {
    const assetId = getAssetId();
    const rawAmount = getRawAmount();
    const beneficiaryAccount = coreStorage?.account;

    // Add debugging information
    console.log("Asset ID:", assetId);
    console.log("Raw amount:", rawAmount);
    console.log("Selected asset:", selectedAsset);

    if (!rawAmount || !beneficiaryAccount || !selectedAsset) {
      console.log("Missing required parameters", { rawAmount, beneficiaryAccount, selectedAsset });
      return undefined;
    }

    // If we have a native token, assetId might be optional in some cases
    // Otherwise, ensure we have a valid assetId
    if (!isNativeToken(selectedAsset.metadata.location) && assetId === undefined) {
      console.log("Asset ID is required for non-native tokens but is undefined");
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
          message: `Bridge of ${amount} ${selectedAsset.metadata.symbol} initiated successfully!`
        });
        onClose();
      }
    };
  };

  // Set up the Asset Hub bridge with the current parameters
  const assetHubBridge = useAssetHubBridgeOperation(getBridgeParams());

  // Handle bridge operation
  const handleBridgeIn = async () => {
    if (!selectedAsset || !coreStorage || !amount || !selectedAccount) {
      showNotification({
        variant: "error",
        message: "Please select an asset, enter an amount, and connect a wallet.",
      });
      return;
    }

    // Validate amount format
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showNotification({
        variant: "error",
        message: "Please enter a valid amount greater than zero."
      });
      return;
    }

    // For assets that need an ID, validate it
    if (!isNativeToken(selectedAsset.metadata.location)) {
      const assetId = getAssetId();
      if (assetId === undefined) {
        showNotification({
          variant: "error",
          message: "Selected asset does not have a valid ID for transfer"
        });
        return;
      }
    }

    // Get raw amount and validate it
    const rawAmount = getRawAmount();
    if (rawAmount === undefined) {
      showNotification({
        variant: "error",
        message: "Could not convert amount to the correct format. Please check your input."
      });
      return;
    }

    try {
      console.log("Starting bridge execution with params:", getBridgeParams());
      // Execute the bridge operation
      await assetHubBridge.executeBridge();
    } catch (error) {
      console.error("Failed to submit bridge transaction:", error);
      showNotification({
        variant: "error",
        message: "Failed to submit bridge transaction: " + (error instanceof Error ? error.message : "Unknown error"),
      });
      setIsProcessing(false);
    }
  };

  // Filter assets to only show those with supported bridges
  const getFilteredAssets = () => {
    return registeredAssets
      .filter(asset => {
        if (!asset.metadata.location) return false;
        // Check if we have a bridge implementation for this asset location
        return isBridgeSupported(asset.metadata.location);
      });
  };

  // Get formatted balance for display
  const getFormattedBalance = () => {
    if (!selectedAsset || !assetHubBalance) return "Loading...";

    // For native tokens (like DOT)
    if (selectedAsset.metadata.location && isNativeToken(selectedAsset.metadata.location)) {
      if (typeof assetHubBalance === 'object' && 'data' in assetHubBalance) {
        const freeBalance = assetHubBalance.data?.free || 0n;
        return new DenominatedNumber(
          freeBalance,
          selectedAsset.metadata.decimals
        ).toLocaleString() + " " + selectedAsset.metadata.symbol;
      }
    }

    // For other assets
    if (typeof assetHubBalance === 'object' && 'balance' in assetHubBalance) {
      return new DenominatedNumber(
        assetHubBalance.balance ?? 0n,
        selectedAsset.metadata.decimals
      ).toLocaleString() + " " + selectedAsset.metadata.symbol;
    }

    return "Loading...";
  };

  // Determine if we can proceed based on current step
  const canProceed = () => {
    if (step === 'select-asset') return !!selectedAsset;
    if (step === 'enter-amount') return !!amount && parseFloat(amount) > 0;
    return true;
  };

  // Handle moving to the next step
  const handleNextStep = () => {
    if (step === 'select-asset' && selectedAsset) {
      setStep('enter-amount');
    } else if (step === 'enter-amount' && amount) {
      setStep('review');
    }
  };

  // Handle going back to the previous step
  const handleBackStep = () => {
    if (step === 'enter-amount') {
      setStep('select-asset');
    } else if (step === 'review') {
      setStep('enter-amount');
    }
  };

  // Render appropriate content based on the current step
  const renderStepContent = () => {
    // Get the supported assets
    const filteredAssets = getFilteredAssets();

    console.log('Filtered assets:', filteredAssets);

    switch (step) {
      case 'select-asset':
        return (
          <div className={css({ display: "flex", flexDirection: "column", gap: "1rem" })}>
            <p className={css({ marginBottom: "1rem", color: "content" })}>
              Select an asset to bridge into the DAO
            </p>
            <div className={css({
              display: "grid",
              gap: "0.5rem",
              maxHeight: "300px",
              overflowY: "auto",
              padding: "0.5rem",
              backgroundColor: "surfaceContainer",
              borderRadius: "md",
              border: "1px solid token(colors.surfaceContainerHighest)"
            })}>
              {filteredAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className={css({
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    backgroundColor: selectedAsset?.id === asset.id ? "primary" : "surfaceContainerHigh",
                    color: selectedAsset?.id === asset.id ? "onPrimary" : "content",
                    border: "none",
                    borderRadius: "md",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      backgroundColor: selectedAsset?.id === asset.id ? "primary" : "surfaceContainerHighest",
                    }
                  })}
                >
                  <span className={css({ fontWeight: "500" })}>{asset.metadata.symbol}</span>
                  <span className={css({
                    fontSize: "0.875rem",
                    color: selectedAsset?.id === asset.id ? "onPrimary" : "content.muted"
                  })}>Asset Hub</span>
                </button>
              ))}
            </div>
            {filteredAssets.length === 0 && (
              <p className={css({
                textAlign: "center",
                color: "content.muted",
                padding: "1rem",
                backgroundColor: "surfaceContainer",
                borderRadius: "md",
                fontSize: "0.875rem"
              })}>
                No bridgeable assets are available. Make sure your assets are registered correctly.
              </p>
            )}
          </div>
        );

      case 'enter-amount':
        return (
          <div className={css({ display: "flex", flexDirection: "column", gap: "1rem" })}>
            <p className={css({ marginBottom: "1rem" })}>
              Enter the amount of {selectedAsset?.metadata.symbol} to bridge from your Asset Hub account to the DAO
            </p>
            <TextInput
              label={`Amount (${selectedAsset?.metadata.symbol})`}
              value={amount}
              onChangeValue={(value) => {
                // Allow decimal points and numbers
                const regex = new RegExp(`^\\d*\\.?\\d{0,${selectedAsset?.metadata.decimals || 0}}$`);
                if (value === "" || regex.test(value)) {
                  setAmount(value);
                }
              }}
              placeholder={`Enter amount in ${selectedAsset?.metadata.symbol}`}
            />
            <div className={css({ fontSize: "0.85rem", color: "content.muted", display: "flex", flexDirection: "column", gap: "0.5rem" })}>
              <p>
                Available balance: {getFormattedBalance()}
              </p>
              <p>
                Make sure you have enough funds in your Asset Hub account to cover the transaction fees.
              </p>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className={css({ display: "flex", flexDirection: "column", gap: "1rem" })}>
            <h3 className={css({ fontSize: "1.1rem", fontWeight: "bold", marginBottom: "1rem" })}>
              Review Your Bridge Transaction
            </h3>
            <div className={css({ display: "flex", flexDirection: "column", gap: "0.5rem" })}>
              <div className={css({ display: "flex", justifyContent: "space-between" })}>
                <span>Asset:</span>
                <span>{selectedAsset?.metadata.symbol}</span>
              </div>
              <div className={css({ display: "flex", justifyContent: "space-between" })}>
                <span>Amount:</span>
                <span>{amount} {selectedAsset?.metadata.symbol}</span>
              </div>
              <div className={css({ display: "flex", justifyContent: "space-between" })}>
                <span>From:</span>
                <span>Your Asset Hub Account</span>
              </div>
              <div className={css({ display: "flex", justifyContent: "space-between" })}>
                <span>To:</span>
                <span>DAO Account: {coreStorage?.account ? `${coreStorage.account.substring(0, 6)}...${coreStorage.account.substring(coreStorage.account.length - 6)}` : "Loading..."}</span>
              </div>
            </div>
            <p className={css({ fontSize: "0.85rem", color: "content.muted", marginTop: "1rem" })}>
              After confirming, you will be guided through the steps to complete the transfer using Polkadot.js or Asset Hub UI.
            </p>
          </div>
        );
    }
  };

  // Render the navigation and action buttons based on current step
  const renderActionButtons = () => {
    return (
      <div className={css({ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" })}>
        {step !== 'select-asset' ? (
          <Button
            onClick={handleBackStep}
            className={css({ display: "flex", alignItems: "center", gap: "0.5rem" })}
          >
            <ArrowLeftIcon size={16} />
            Back
          </Button>
        ) : (
          <div></div> // Empty div to maintain layout
        )}

        {step !== 'review' ? (
          <Button
            onClick={handleNextStep}
            disabled={!canProceed()}
            className={css({ display: "flex", alignItems: "center", gap: "0.5rem" })}
          >
            Next
            <ArrowRightIcon size={16} />
          </Button>
        ) : (
          <Button
            onClick={handleBridgeIn}
            pending={isProcessing || assetHubBridge.isProcessing}
            className={css({ display: "flex", alignItems: "center", gap: "0.5rem" })}
          >
            <CheckCircleIcon size={16} />
            Show Bridge Instructions
          </Button>
        )}
      </div>
    );
  };

  // Main component render
  return (
    <ModalDialog
      title="Bridge Your Assets Into DAO"
      onClose={onClose}
      className={css({
        containerType: "inline-size",
        width: `min(34rem, 100dvw)`,
      })}
    >
      <div className={css({
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      })}>
        {/* Step indicator */}
        <div className={css({
          display: "flex",
          justifyContent: "space-between",
          position: "relative",
          marginBottom: "1rem"
        })}>
          {["select-asset", "enter-amount", "review"].map((stepName, index) => (
            <div
              key={stepName}
              className={css({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                zIndex: 1
              })}
            >
              <div className={css({
                width: "2rem",
                height: "2rem",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: step === stepName ? "primary" :
                  (["select-asset", "enter-amount", "review"].indexOf(step) > index ? "primary" : "surface"),
                color: step === stepName ? "onPrimary" :
                  (["select-asset", "enter-amount", "review"].indexOf(step) > index ? "onPrimary" : "content"),
                marginBottom: "0.5rem"
              })}>
                {index + 1}
              </div>
              <span className={css({
                fontSize: "0.8rem",
                color: step === stepName ? "content" : "content.muted"
              })}>
                {stepName === "select-asset" ? "Select Asset" :
                  stepName === "enter-amount" ? "Enter Amount" : "Review"}
              </span>
            </div>
          ))}

          {/* Connecting line between steps */}
          <div className={css({
            position: "absolute",
            top: "1rem",
            left: "2.5rem",
            right: "2.5rem",
            height: "2px",
            backgroundColor: "surface",
            zIndex: 0
          })}>
            <div className={css({
              height: "100%",
              backgroundColor: "primary",
              width: step === "select-asset" ? "0%" :
                step === "enter-amount" ? "50%" : "100%",
              transition: "width 0.3s ease-in-out"
            })}></div>
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
