import { css } from "../../../../styled-system/css";
import { Button } from "../../../components/button";
import { ModalDialog } from "../../../components/modal-dialog";
import { TextInput } from "../../../components/text-input";
import { TokenIcon } from "../../../components/token-icon";
import { BridgeAssetsInDialog } from "../../../components/xcm-in";
import { BridgeAssetsOutDialog } from "../../../components/xcm-out";
import { useNotification } from "../../../contexts/notification-context";
import { selectedAccountAtom } from "../../../features/accounts/store";
import { useLazyLoadSelectedDaoId } from "../../../features/daos/store";
import { MutationError, pending } from "@reactive-dot/core";
import { useLazyLoadQuery } from "@reactive-dot/react";
import { useMutation, useMutationEffect } from "@reactive-dot/react";
import { BigIntMath, DenominatedNumber } from "@reactive-dot/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { SendIcon, PlusCircleIcon, ArrowLeftRight } from "lucide-react";
import { Binary } from "polkadot-api";
import { QRCodeSVG } from "qrcode.react";
import { useState, useEffect, useMemo } from "react";

export const Route = createFileRoute("/daos/_layout/assets")({
  component: AssetsPage,
  beforeLoad: () => ({ title: "Assets" }),
});

function AssetsPage() {
  const daoId = useLazyLoadSelectedDaoId();

  if (typeof daoId !== "number") {
    return <p>Please select or create a DAO</p>;
  }

  return <SuspendableAssetsPage />;

  function SuspendableAssetsPage() {
    const coreStorage = useLazyLoadQuery((builder) =>
      builder.readStorage("INV4", "CoreStorage", [daoId!]),
    );

    if (coreStorage === undefined) {
      return null;
    }

    return <SuspendableCoreTokens />;

    function SuspendableCoreTokens() {
      const coreTokens = useLazyLoadQuery((builder) =>
        builder.readStorageEntries("Tokens", "Accounts", [
          coreStorage!.account,
        ]),
      );

      const nativeBalance = useLazyLoadQuery((builder) =>
        builder.readStorage("System", "Account", [coreStorage!.account]),
      ).data;

      const assetMetadata = useLazyLoadQuery((builder) =>
        builder.readStorages(
          "AssetRegistry",
          "Metadata",
          coreTokens.map((token) => [token.keyArgs[1]] as const),
        ),
      );

      const tokens = coreTokens
        .filter((token) => token.keyArgs[1] !== 0)
        .map((token, index) => {
          return {
            id: token.keyArgs[1],
            value: token.value,
            metadata: assetMetadata.at(index)!,
          };
        });

      tokens.push({
        id: 0,
        value: nativeBalance,
        metadata: {
          symbol: Binary.fromText("VARCH"),
          name: Binary.fromText("InvArch"),
          decimals: 12,
          existential_deposit: 10_000_000_000n,
          location: undefined,
          additional: 0n,
        },
      });

      const [transferDialogOpen, setTransferDialogOpen] = useState(false);
      const [depositDialogOpen, setDepositDialogOpen] = useState(false);
      const [bridgeInDialogOpen, setBridgeInDialogOpen] = useState(false);
      const [bridgeOutDialogOpen, setBridgeOutDialogOpen] = useState(false);

      // First, add this state at the component level where both dialogs are rendered
      const [transferDialogState, setTransferDialogState] = useState<{
        open: boolean;
        tokenId: number;
        symbol: string;
        decimals: number;
      } | null>(null);

      // Common button style using theme variables
      const buttonStyle = css({
        padding: "0.75rem",
        width: "100%",
        backgroundColor: "primary", // Using the theme's primary color
        border: "none",
        color: "onPrimary", // Using the theme's text color for primary buttons
        "&:disabled": {
          filter: "brightness(0.5)",
          backgroundColor: "primary",
          cursor: "not-allowed",
        },
        "&:not(:disabled):hover": {
          filter: "brightness(0.9)",
        },
      });

      return (
        <>
          <h2
            className={css({
              fontSize: "1.1rem",
              fontWeight: "500",
              color: "content",
              marginBottom: "1rem",
            })}
          >
            Asset Actions
          </h2>
          <div
            className={css({
              display: "grid",
              gap: "1rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              marginBottom: "2rem",
            })}
          >
            <Button
              onClick={() => setTransferDialogOpen(true)}
              disabled={false}
              className={buttonStyle}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <SendIcon size={18} />
                Transfer Assets
              </div>
            </Button>

            <Button
              onClick={() => setDepositDialogOpen(true)}
              className={buttonStyle}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <PlusCircleIcon size={18} />
                Deposit Assets
              </div>
            </Button>

            <Button
              onClick={() => setBridgeInDialogOpen(true)}
              disabled={false}
              className={buttonStyle}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <ArrowLeftRight size={18} />
                Bridge Assets In
              </div>
            </Button>

            <Button
              onClick={() => setBridgeOutDialogOpen(true)}
              disabled={false}
              className={buttonStyle}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <ArrowLeftRight size={18} />
                Bridge Assets Out
              </div>
            </Button>
          </div>

          <table
            className={css({
              width: "stretch",
              borderCollapse: "collapse",
            })}
          >
            <thead>
              <tr>
                <th
                  className={css({
                    textAlign: "left",
                    padding: "1rem",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                  })}
                >
                  Asset
                </th>
                <th
                  className={css({
                    textAlign: "right",
                    padding: "1rem",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                  })}
                >
                  Transferable
                </th>
                <th
                  className={css({
                    textAlign: "right",
                    padding: "1rem",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                  })}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => {
                const symbol = token.metadata.symbol.asText();

                return (
                  <tr key={token.id}>
                    <td
                      className={css({
                        textAlign: "left",
                        padding: "1rem",
                      })}
                    >
                      <div
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        })}
                      >
                        <TokenIcon symbol={symbol} size="md" />
                        <span>{symbol}</span>
                      </div>
                    </td>
                    <td
                      className={css({
                        textAlign: "right",
                        padding: "1rem",
                      })}
                    >
                      {new DenominatedNumber(
                        BigIntMath.max(
                          0n,
                          token.value.free -
                            BigIntMath.max(
                              token.value.frozen - token.value.reserved,
                              0n,
                            ),
                        ),
                        token.metadata.decimals,
                      ).toLocaleString() +
                        " " +
                        symbol}
                    </td>
                    <td
                      className={css({
                        textAlign: "right",
                        padding: "1rem",
                      })}
                    >
                      {new DenominatedNumber(
                        BigIntMath.max(
                          0n,
                          token.value.free + token.value.reserved,
                        ),
                        token.metadata.decimals,
                      ).toLocaleString() +
                        " " +
                        symbol}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {bridgeInDialogOpen && (
            <BridgeAssetsInDialog
              daoId={daoId!}
              onClose={() => setBridgeInDialogOpen(false)}
            />
          )}

          {bridgeOutDialogOpen && (
            <BridgeAssetsOutDialog
              daoId={daoId!}
              onClose={() => setBridgeOutDialogOpen(false)}
            />
          )}

          {depositDialogOpen && (
            <DepositDialog
              daoAddress={coreStorage!.account}
              onClose={() => setDepositDialogOpen(false)}
            />
          )}

          {transferDialogOpen && (
            <TransferAssetsDialog
              daoId={daoId!}
              tokens={tokens}
              onClose={() => setTransferDialogOpen(false)}
              onSelectToken={(token) => {
                setTransferDialogState({
                  open: true,
                  tokenId: token.id,
                  symbol: token.metadata.symbol.asText(),
                  decimals: token.metadata.decimals,
                });
              }}
            />
          )}

          {transferDialogState?.open && (
            <TransferDialog
              daoId={daoId!}
              tokenId={transferDialogState.tokenId}
              symbol={transferDialogState.symbol}
              decimals={transferDialogState.decimals}
              onClose={() => setTransferDialogState(null)}
            />
          )}
        </>
      );
    }
  }
}

export function DepositDialog({
  daoAddress,
  onClose,
}: {
  daoAddress: string;
  onClose: () => void;
}) {
  return (
    <ModalDialog
      title="Deposit Funds"
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
          alignItems: "center",
          gap: "1.5rem",
          padding: "1rem",
        })}
      >
        <div
          className={css({
            backgroundColor: "white",
            padding: "1rem",
            borderRadius: "0.5rem",
          })}
        >
          <QRCodeSVG value={daoAddress} size={200} level="H" />
        </div>

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            width: "100%",
            textAlign: "center",
          })}
        >
          <p
            className={css({
              fontWeight: "500",
              marginBottom: "0.5rem",
            })}
          >
            DAO Address
          </p>
          <div
            className={css({
              backgroundColor: "surfaceContainer",
              padding: "1rem",
              borderRadius: "0.5rem",
              wordBreak: "break-all",
              fontSize: "0.875rem",
            })}
          >
            {daoAddress}
          </div>
          <p
            className={css({
              fontSize: "0.875rem",
              color: "content.muted",
              marginTop: "1rem",
            })}
          >
            Scan this QR code or copy the address above to deposit funds to the
            DAO
          </p>
        </div>
      </div>
    </ModalDialog>
  );
}

function TransferAssetsDialog({
  tokens,
  onClose,
  onSelectToken,
}: {
  daoId: number;
  tokens: {
    id: number;
    value: {
      free: bigint;
      reserved: bigint;
      frozen: bigint;
    };
    metadata: {
      symbol: Binary;
      decimals: number;
    };
  }[];
  onClose: () => void;
  onSelectToken: (token: (typeof tokens)[0]) => void;
}) {
  const [selectedToken, setSelectedToken] = useState<(typeof tokens)[0] | null>(
    null,
  );

  return (
    <ModalDialog
      title="Transfer Assets"
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
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          })}
        >
          <label
            className={css({
              fontSize: "0.875rem",
              color: "content.muted",
            })}
          >
            Select Asset
          </label>
          <div
            className={css({
              display: "grid",
              gap: "0.5rem",
              maxHeight: "200px",
              overflowY: "auto",
              padding: "0.5rem",
              backgroundColor: "container",
              borderRadius: "0.3rem",
            })}
          >
            {tokens.map((token) => {
              const transferable = BigIntMath.max(
                0n,
                token.value.free -
                  BigIntMath.max(token.value.frozen - token.value.reserved, 0n),
              );

              const symbol = token.metadata.symbol.asText();

              return (
                <button
                  key={token.id}
                  onClick={() => setSelectedToken(token)}
                  className={css({
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem",
                    backgroundColor:
                      selectedToken?.id === token.id ? "primary" : "surface",
                    color:
                      selectedToken?.id === token.id ? "onPrimary" : "content",
                    border: "none",
                    borderRadius: "0.3rem",
                    cursor: "pointer",
                    "&:hover": {
                      filter: "brightness(1.1)",
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
                    <TokenIcon symbol={symbol} size="md" />
                    <span>{symbol}</span>
                  </div>
                  <span>
                    {new DenominatedNumber(
                      transferable,
                      token.metadata.decimals,
                    ).toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedToken && (
          <Button
            onClick={() => {
              onClose();
              onSelectToken(selectedToken);
            }}
            className={css({
              marginTop: "1rem",
              width: "stretch",
            })}
          >
            Continue
          </Button>
        )}
      </div>
    </ModalDialog>
  );
}

function TransferDialog({
  daoId,
  tokenId,
  symbol,
  decimals,
  onClose,
}: {
  daoId: number;
  tokenId: number;
  symbol: string;
  decimals: number;
  onClose: () => void;
}): JSX.Element {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEDConfirmation, setShowEDConfirmation] = useState(false);
  const [isRemainderBelowED, setIsRemainderBelowED] = useState(false);
  const { showNotification } = useNotification();
  const selectedAccount = useAtomValue(selectedAccountAtom);

  type SystemAccount = {
    nonce: number;
    consumers: number;
    providers: number;
    sufficients: number;
    data: { free: bigint; reserved: bigint; frozen: bigint; flags: bigint };
  };

  type TokenAccount = {
    free: bigint;
    reserved: bigint;
    frozen: bigint;
  };

  // Get the DAO's token balance
  const coreStorage = useLazyLoadQuery((builder) =>
    builder.readStorage("INV4", "CoreStorage", [daoId]),
  );

  // Update the balance query to handle both native and non-native tokens
  const daoTokenBalance = useLazyLoadQuery((builder) => {
    if (!coreStorage?.account) return null;

    // For native token (VARCH)
    if (tokenId === 0) {
      return builder.readStorage("System", "Account", [coreStorage.account]);
    }

    // For other tokens
    return builder.readStorage("Tokens", "Accounts", [
      coreStorage.account,
      tokenId,
    ]);
  });

  // Constants for VARCH token
  const VARCH_EXISTENTIAL_DEPOSIT = 10_000_000_000n;
  const VARCH_BUFFER = VARCH_EXISTENTIAL_DEPOSIT * 2n; // 2x existential deposit for better safety margin

  // Get the free balance based on token type
  const getFreeBalance = () => {
    if (!daoTokenBalance) return 0n;

    // For native token (VARCH)
    if (tokenId === 0) {
      return (daoTokenBalance as SystemAccount).data.free;
    }

    // For other tokens
    return (daoTokenBalance as TokenAccount).free;
  };

  // Calculate max amount considering existential deposit only for VARCH
  const maxAmount = useMemo(() => {
    const freeBalance = getFreeBalance();

    // For VARCH, consider existential deposit and buffer
    if (tokenId === 0) {
      const minimumRequired = VARCH_EXISTENTIAL_DEPOSIT + VARCH_BUFFER;
      if (freeBalance <= minimumRequired) return "0";
      const safeMaximum = freeBalance - minimumRequired;
      // Return the raw number string without formatting
      return (Number(safeMaximum) / Math.pow(10, decimals)).toString();
    }

    // For other tokens, use full free balance without formatting
    return (Number(freeBalance) / Math.pow(10, decimals)).toString();
  }, [daoTokenBalance, tokenId, decimals]);

  // Format balance for display separately
  const formattedBalance = useMemo(() => {
    const freeBalance = getFreeBalance();
    return new DenominatedNumber(freeBalance, decimals).toLocaleString();
  }, [daoTokenBalance, decimals]);

  // Check for existential deposit issues only for VARCH
  useEffect(() => {
    if (tokenId === 0 && amount) {
      const freeBalance = getFreeBalance();
      const amountBigInt = BigInt(
        Math.floor(parseFloat(amount) * Math.pow(10, decimals)),
      );
      const remainder = freeBalance - amountBigInt;

      if (remainder < VARCH_EXISTENTIAL_DEPOSIT + VARCH_BUFFER) {
        setIsRemainderBelowED(true);
      } else {
        setIsRemainderBelowED(false);
      }
    }
  }, [amount, daoTokenBalance, tokenId, decimals, setIsRemainderBelowED]);

  // Handle form submission with existential deposit check for VARCH
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Check if amount would leave balance below existential deposit - only for VARCH
    if (tokenId === 0 && isRemainderBelowED && !showEDConfirmation) {
      setShowEDConfirmation(true);
      return;
    }

    try {
      await transfer();
    } catch (error) {
      console.error("Failed to transfer:", error);
      showNotification({
        variant: "error",
        message:
          "Failed to transfer: " +
          (error instanceof Error ? error.message : "Unknown error"),
      });
    }
  };

  const [_transferState, transfer] = useMutation((tx) => {
    // Convert amount to proper decimals
    const rawAmount = BigInt(
      Math.floor(parseFloat(amount) * Math.pow(10, decimals)),
    );

    return tx.INV4.operate_multisig({
      dao_id: daoId,
      call: tx.Currencies.transfer({
        dest: {
          type: "Id",
          value: address,
        },
        currency_id: tokenId,
        amount: rawAmount,
      }).decodedCall,
      fee_asset: { type: "Native", value: undefined },
      metadata: undefined,
    });
  });

  useMutationEffect((event) => {
    setIsProcessing(true);

    if (event.value === pending) {
      showNotification({
        variant: "success",
        message: "Submitting transfer...",
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
            message: `Transfer of ${amount} ${symbol} initiated successfully!`,
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
          <TokenIcon symbol={symbol} size="md" />
          <span>Transfer {symbol}</span>
        </div>
      }
      onClose={onClose}
      className={css({
        containerType: "inline-size",
        width: `min(34rem, 100dvw)`,
      })}
    >
      <form
        onSubmit={handleSubmit}
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
          width: "100%",
        })}
      >
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            width: "100%",
          })}
        >
          <span
            className={css({
              fontSize: "1.125rem",
              color: "content",
              fontWeight: "400",
            })}
          >
            Amount ({symbol})
          </span>
          <TextInput
            value={amount}
            onChangeValue={(value) => {
              const regex = new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`);
              if (value === "" || regex.test(value)) {
                setAmount(value);
              }
            }}
            placeholder={`Enter amount in ${symbol}`}
            className={css({
              width: "100%",
              "& input": {
                width: "100%",
                backgroundColor: "surfaceContainerHigh",
                border: "none",
                borderRadius: "md",
                padding: "1rem",
                fontSize: "1rem",
                color: "content",
              },
            })}
          />

          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.875rem",
              color: "content.muted",
              marginTop: "0.25rem",
            })}
          >
            <span>
              Available balance: {formattedBalance} {symbol}
            </span>
            <button
              type="button"
              onClick={() => setAmount(maxAmount)}
              className={css({
                background: "none",
                border: "none",
                color: "primary",
                cursor: "pointer",
                padding: "0",
                fontSize: "0.875rem",
                textDecoration: "underline",
                "&:hover": {
                  textDecoration: "none",
                },
              })}
            >
              Use safe max
            </button>
          </div>

          {/* Only show ED warning for VARCH */}
          {tokenId === 0 && isRemainderBelowED && (
            <div
              className={css({
                backgroundColor: "warningContainer",
                color: "onWarningContainer",
                padding: "0.75rem 1rem",
                borderRadius: "md",
                fontSize: "0.875rem",
                marginTop: "0.5rem",
              })}
            >
              <p>
                <strong>Warning:</strong> The remaining balance would be less
                than the recommended minimum (
                {new DenominatedNumber(VARCH_BUFFER, decimals).toLocaleString()}{" "}
                {symbol}
                ). This includes the existential deposit plus a small buffer for
                fees.
              </p>
              <button
                type="button"
                onClick={() => setAmount(maxAmount)}
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
                Use safe max
              </button>
            </div>
          )}
        </div>

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            width: "100%",
          })}
        >
          <span
            className={css({
              fontSize: "1.125rem",
              color: "content",
              fontWeight: "400",
            })}
          >
            Recipient Address
          </span>
          <TextInput
            value={address}
            onChangeValue={setAddress}
            placeholder="Enter recipient address"
            className={css({
              width: "100%",
              "& input": {
                width: "100%",
                backgroundColor: "surfaceContainerHigh",
                border: "none",
                borderRadius: "md",
                padding: "1rem",
                fontSize: "1rem",
                color: "content",
              },
            })}
          />
          <button
            type="button"
            onClick={() => {
              if (selectedAccount?.address) {
                setAddress(selectedAccount.address);
              } else {
                showNotification({
                  variant: "error",
                  message:
                    "No account selected. Please select an account first.",
                });
              }
            }}
            className={css({
              background: "none",
              border: "none",
              padding: "0",
              color: "primary",
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "opacity 0.2s ease",
              userSelect: "none",
              width: "fit-content",
              "&:hover": {
                opacity: 0.8,
              },
            })}
          >
            Use my account
          </button>
        </div>

        <Button
          type="submit"
          disabled={!address || !amount || isProcessing}
          className={css({
            width: "100%",
            backgroundColor: "primary",
            color: "onPrimary",
            padding: "1rem",
            borderRadius: "md",
            fontSize: "1rem",
            fontWeight: "500",
            marginTop: "1rem",
          })}
        >
          {isProcessing ? "Processing..." : "Transfer"}
        </Button>
      </form>

      {/* Only show ED Confirmation Dialog for VARCH */}
      {tokenId === 0 && showEDConfirmation && (
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
              You are about to leave a balance below the recommended minimum (
              {new DenominatedNumber(VARCH_BUFFER, decimals).toLocaleString()}{" "}
              {symbol}
              ).
              <br />
              <br />
              This includes the existential deposit plus a buffer for
              transaction fees. The remaining funds may be unusable for future
              transactions.
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
                onClick={async () => {
                  setShowEDConfirmation(false);
                  await transfer();
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
                  setAmount(maxAmount);
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
