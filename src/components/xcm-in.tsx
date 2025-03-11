import { ModalDialog } from "./modal-dialog";
import { Button } from "./button";
import { useState } from "react";
import { TextInput } from "./text-input";
import { useNotification } from "../contexts/notification-context";
import { css } from "../../styled-system/css";
import { useLazyLoadRegisteredAssets } from "../features/assets/store";
import type { XcmVersionedLocation } from "@polkadot-api/descriptors";
import { useLazyLoadQuery, useMutation, useMutationEffect } from "@reactive-dot/react";
import { selectedAccountAtom } from "../features/accounts/store";
import { useAtomValue } from "jotai";
import { MutationError, pending } from "@reactive-dot/core";
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from "lucide-react";
import { FixedSizeBinary } from "polkadot-api";
import { DenominatedNumber } from "@reactive-dot/utils";

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

  // Extract Asset Hub asset ID from location metadata
  const getAssetHubId = (location: XcmVersionedLocation | undefined): number | undefined => {
    if (!location) return undefined;

    // We're looking for the GeneralIndex in the interior
    const interior = location.value.interior;
    if (interior.type === "X3") {
      // Find the GeneralIndex value
      const generalIndex = interior.value.find(x => x.type === "GeneralIndex");
      if (generalIndex && generalIndex.type === "GeneralIndex") {
        return Number(generalIndex.value);
      }
    }
    return undefined;
  };

  // Query user's balance on Asset Hub for the selected asset
  const assetHubBalance = useLazyLoadQuery(
    (builder) => {
      if (!selectedAsset?.metadata.location || !selectedAccount?.address) return undefined;

      const assetHubId = getAssetHubId(selectedAsset.metadata.location);
      if (assetHubId === undefined) return undefined;

      return builder.readStorage("Assets", "Account", [assetHubId, selectedAccount.address]);
    },
    { chainId: "polkadot_asset_hub" }
  );

  // Log for debugging
  console.log('Selected Asset Location:', selectedAsset?.metadata.location);
  console.log('Asset Hub ID:', selectedAsset && getAssetHubId(selectedAsset.metadata.location));
  console.log('Asset Hub Balance:', assetHubBalance);

  // Get the DAO's core storage to access its account
  const coreStorage = useLazyLoadQuery((builder) =>
    builder.readStorage("INV4", "CoreStorage", [daoId]),
  );

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

  // Determine if an asset is from the Polkadot Asset Hub 
  const isFromAssetHub = (location: XcmVersionedLocation | undefined): boolean => {
    if (!location) return false;

    console.log('Checking location:', location);

    if (location.type === "V4" || location.type === "V3" || location.type === "V2") {
      const parents = location.value.parents;
      const interior = location.value.interior;

      // Check for parent = 1 (indicating Asset Hub)
      if (parents !== 1) return false;

      // Check interior for Parachain(1000)
      const hasParachain1000 = (() => {
        switch (interior.type) {
          case "X1":
            return interior.value.type === "Parachain" && interior.value.value === 1000;
          case "X2":
            return interior.value[0]?.type === "Parachain" && interior.value[0]?.value === 1000;
          case "X3":
            return interior.value[0]?.type === "Parachain" && interior.value[0]?.value === 1000;
          case "X4":
            return interior.value[0]?.type === "Parachain" && interior.value[0]?.value === 1000;
          default:
            return false;
        }
      })();

      return hasParachain1000;
    }

    return false;
  };

  // Handle bridge using user's Asset Hub account to transfer to DAO account on InvArch
  const [_, executeBridge] = useMutation(
    (builder) => {
      if (!selectedAsset || !amount || !selectedAccount || !coreStorage) {
        throw new Error("Missing required data for bridge operation");
      }

      console.log('Selected Account:', coreStorage.account);
      // Convert amount to proper decimals
      const _rawAmount = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, selectedAsset.metadata.decimals)));

      const assetHubId = getAssetHubId(selectedAsset.metadata.location);
      if (assetHubId === undefined) {
        throw new Error("Selected asset does not have a location for XCM transfer");
      }

      // Check if location exists
      if (!selectedAsset.metadata.location) {
        throw new Error("Selected asset does not have a location for XCM transfer");
      }

      // Check if this is an Asset Hub asset
      if (!isFromAssetHub(selectedAsset.metadata.location)) {
        throw new Error("Only Asset Hub assets are supported at this time");
      }

      showNotification({
        variant: "success",
        message: "Preparing XCM bridge transaction...",
      });

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
                  id: FixedSizeBinary.fromAccountId32(coreStorage.account)
                }
              }
            }
          }
        },
        assets: {
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
                      value: 50 // Assets pallet
                    },
                    {
                      type: "GeneralIndex",
                      value: BigInt(assetHubId)
                    }
                  ]
                }
              },
              fun: {
                type: "Fungible",
                value: _rawAmount
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
    },
    { chainId: "polkadot_asset_hub" }
  );

  useMutationEffect((event) => {
    setIsProcessing(true);

    if (event.value === pending) {
      return;
    }

    if (event.value instanceof MutationError) {
      setIsProcessing(false);
      showNotification({
        variant: "error",
        message: "Failed to prepare bridge transaction: " + event.value.message,
      });
      return;
    }

    // For successful transactions, we've already shown instructional notifications
    setTimeout(() => {
      setIsProcessing(false);
      onClose();
    }, 7000);
  });

  const handleBridgeIn = async () => {
    if (!selectedAsset || !coreStorage || !amount || !selectedAccount) {
      showNotification({
        variant: "error",
        message: "Please select an asset, enter an amount, and connect a wallet.",
      });
      return;
    }

    setIsProcessing(true);

    try {
      await executeBridge();
    } catch (error) {
      console.error("Failed to prepare bridge transaction:", error);
      showNotification({
        variant: "error",
        message: "Failed to prepare bridge transaction: " + (error instanceof Error ? error.message : "Unknown error"),
      });
      setIsProcessing(false);
    }
  };

  // Determine if we can proceed based on current step
  const canProceed = () => {
    if (step === 'select-asset') return !!selectedAsset;
    if (step === 'enter-amount') return !!amount && parseFloat(amount) > 0;
    return true;
  };

  // Render appropriate content based on the current step
  const renderStepContent = () => {
    const filteredAssets = registeredAssets
      .filter(asset => asset.metadata.location !== undefined && isFromAssetHub(asset.metadata.location));

    console.log('Filtered assets:', filteredAssets);

    switch (step) {
      case 'select-asset':
        return (
          <div className={css({ display: "flex", flexDirection: "column", gap: "1rem" })}>
            <p className={css({ marginBottom: "1rem", color: "content" })}>
              Select an asset from Asset Hub to bridge into the DAO
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
                No Asset Hub assets are available. Make sure your assets are registered correctly.
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
                Available balance: {assetHubBalance && typeof assetHubBalance === 'object' ?
                  new DenominatedNumber(
                    assetHubBalance.balance ?? 0n,
                    selectedAsset?.metadata.decimals || 0
                  ).toLocaleString() + " " + selectedAsset?.metadata.symbol
                  : "Loading..."}
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
            pending={isProcessing}
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
