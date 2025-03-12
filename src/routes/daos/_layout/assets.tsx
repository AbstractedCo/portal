import { css } from "../../../../styled-system/css";
import { useLazyLoadSelectedDaoId } from "../../../features/daos/store";
import { useLazyLoadQuery } from "@reactive-dot/react";
import { BigIntMath, DenominatedNumber } from "@reactive-dot/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Binary } from "polkadot-api";
import { Button } from "../../../components/button";
import { ModalDialog } from "../../../components/modal-dialog";
import { TextInput } from "../../../components/text-input";
import { useMutation, useMutationEffect } from "@reactive-dot/react";
import { useState } from "react";
import { useNotification } from "../../../contexts/notification-context";
import { SendIcon, PlusCircleIcon, ArrowLeftRight } from "lucide-react";
import { MutationError, pending } from "@reactive-dot/core";
import { QRCodeSVG } from "qrcode.react";
import { BridgeAssetsInDialog } from "../../../components/xcm-in";
import { BridgeAssetsOutDialog } from "../../../components/xcm-out";

export const Route = createFileRoute("/daos/_layout/assets")({
  component: AssetsPage,
  beforeLoad: () => ({ title: "Assets" }),
});

function AssetsPage() {
  const daoId = useLazyLoadSelectedDaoId();

  if (typeof daoId !== 'number') {
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
        builder.readStorage("System", "Account", [
          coreStorage!.account,
        ]),
      ).data;

      const assetMetadata = useLazyLoadQuery((builder) =>
        builder.readStorages(
          "AssetRegistry",
          "Metadata",
          coreTokens.map((token) => [token.keyArgs[1]] as const),
        ),
      );

      const tokens = coreTokens
        .filter(token => token.keyArgs[1] !== 0)
        .map((token, index) => {
          return {
            id: token.keyArgs[1],
            value: token.value,
            metadata: assetMetadata.at(index)!,
          }

        });

      tokens.push({
        id: 0,
        value: nativeBalance,
        metadata: {
          symbol: Binary.fromText("VARCH"),
          name: Binary.fromText("InvArch"),
          decimals: 12,
          existential_deposit: 1000000000000000000000000n,
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
          cursor: "not-allowed"
        },
        "&:not(:disabled):hover": {
          filter: "brightness(0.9)"
        }
      });

      return (
        <>
          <h2 className={css({
            fontSize: "1.1rem",
            fontWeight: "500",
            color: "content",
            marginBottom: "1rem"
          })}>
            Asset Actions
          </h2>
          <div className={css({
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            marginBottom: "2rem"
          })}>
            <Button
              onClick={() => setTransferDialogOpen(true)}
              disabled={false}
              className={buttonStyle}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <SendIcon size={18} />
                Transfer Assets
              </div>
            </Button>

            <Button
              onClick={() => setDepositDialogOpen(true)}
              className={buttonStyle}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <PlusCircleIcon size={18} />
                Deposit Assets
              </div>
            </Button>

            <Button
              onClick={() => setBridgeInDialogOpen(true)}
              disabled={false}
              className={buttonStyle}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <ArrowLeftRight size={18} />
                Bridge Assets In
              </div>
            </Button>

            <Button
              onClick={() => setBridgeOutDialogOpen(true)}
              disabled={false}
              className={buttonStyle}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <ArrowLeftRight size={18} />
                Bridge Assets Out
              </div>
            </Button>
          </div>

          <table className={css({
            width: "stretch",
            borderCollapse: "collapse",
          })}>
            <thead>
              <tr>
                <th className={css({
                  textAlign: "left",
                  padding: "1rem",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
                })}>Asset</th>
                <th className={css({
                  textAlign: "right",
                  padding: "1rem",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
                })}>Transferable</th>
                <th className={css({
                  textAlign: "right",
                  padding: "1rem",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
                })}>Total</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td className={css({
                    textAlign: "left",
                    padding: "1rem"
                  })}>{token.metadata.symbol.asText()}</td>
                  <td className={css({
                    textAlign: "right",
                    padding: "1rem"
                  })}>
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
                    ).toLocaleString() + " " + token.metadata.symbol.asText()}
                  </td>
                  <td className={css({
                    textAlign: "right",
                    padding: "1rem"
                  })}>
                    {new DenominatedNumber(
                      BigIntMath.max(0n, token.value.free + token.value.reserved),
                      token.metadata.decimals,
                    ).toLocaleString() + " " + token.metadata.symbol.asText()}
                  </td>
                </tr>
              ))}
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
                  decimals: token.metadata.decimals
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
  onClose
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
      <div className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
        padding: "1rem",
      })}>
        <div className={css({
          backgroundColor: "white",
          padding: "1rem",
          borderRadius: "0.5rem",
        })}>
          <QRCodeSVG
            value={daoAddress}
            size={200}
            level="H"
          />
        </div>

        <div className={css({
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          width: "100%",
          textAlign: "center",
        })}>
          <p className={css({
            fontWeight: "500",
            marginBottom: "0.5rem",
          })}>DAO Address</p>
          <div className={css({
            backgroundColor: "surfaceContainer",
            padding: "1rem",
            borderRadius: "0.5rem",
            wordBreak: "break-all",
            fontSize: "0.875rem",
          })}>
            {daoAddress}
          </div>
          <p className={css({
            fontSize: "0.875rem",
            color: "content.muted",
            marginTop: "1rem",
          })}>
            Scan this QR code or copy the address above to deposit funds to the DAO
          </p>
        </div>
      </div>
    </ModalDialog>
  );
}


function TransferAssetsDialog({
  tokens,
  onClose,
  onSelectToken
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
  onSelectToken: (token: typeof tokens[0]) => void;
}) {
  const [selectedToken, setSelectedToken] = useState<typeof tokens[0] | null>(null);

  return (
    <ModalDialog
      title="Transfer Assets"
      onClose={onClose}
      className={css({
        containerType: "inline-size",
        width: `min(34rem, 100dvw)`,
      })}
    >
      <div className={css({
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem"
      })}>
        <div className={css({
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem"
        })}>
          <label className={css({
            fontSize: "0.875rem",
            color: "content.muted"
          })}>
            Select Asset
          </label>
          <div className={css({
            display: "grid",
            gap: "0.5rem",
            maxHeight: "200px",
            overflowY: "auto",
            padding: "0.5rem",
            backgroundColor: "container",
            borderRadius: "0.3rem"
          })}>
            {tokens.map((token) => {
              const transferable = BigIntMath.max(
                0n,
                token.value.free -
                BigIntMath.max(
                  token.value.frozen - token.value.reserved,
                  0n,
                ),
              );

              return (
                <button
                  key={token.id}
                  onClick={() => setSelectedToken(token)}
                  className={css({
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem",
                    backgroundColor: selectedToken?.id === token.id ? "primary" : "surface",
                    color: selectedToken?.id === token.id ? "onPrimary" : "content",
                    border: "none",
                    borderRadius: "0.3rem",
                    cursor: "pointer",
                    "&:hover": {
                      filter: "brightness(1.1)"
                    }
                  })}
                >
                  <span>{token.metadata.symbol.asText()}</span>
                  <span>
                    {new DenominatedNumber(
                      transferable,
                      token.metadata.decimals
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
  onClose
}: {
  daoId: number;
  tokenId: number;
  symbol: string;
  decimals: number;
  onClose: () => void;
}) {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { showNotification } = useNotification();

  const [transferState, transfer] = useMutation((tx) => {
    // Convert amount to proper decimals
    const rawAmount = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));

    return tx.INV4.operate_multisig({
      dao_id: daoId,
      call: tx.Currencies.transfer({
        dest: {
          type: "Id",
          value: address
        },
        currency_id: tokenId,
        amount: rawAmount
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await transfer();
    } catch (error) {
      console.error("Failed to transfer:", error);
      showNotification({
        variant: "error",
        message: "Failed to transfer: " + (error instanceof Error ? error.message : "Unknown error"),
      });
    }
  };

  return (
    <ModalDialog
      title={`Transfer ${symbol}`}
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
          gap: "1.5rem",
          alignItems: "center",
          textAlign: "center",
          "& > *": {
            width: "100%",
          }
        })}
      >
        <TextInput
          label="Recipient Address"
          value={address}
          onChangeValue={setAddress}
          placeholder="Enter recipient address"
        />
        <TextInput
          label={`Amount (${symbol})`}
          value={amount}
          onChangeValue={(value) => {
            // Allow decimal points and numbers
            const regex = new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`);
            if (value === "" || regex.test(value)) {
              setAmount(value);
            }
          }}
          placeholder={`Enter amount in ${symbol}`}
        />
        <Button
          type="submit"
          disabled={transferState === pending || isProcessing}
          className={css({
            marginTop: "1rem",
            width: "stretch",
          })}
        >
          Transfer
        </Button>
      </form>
    </ModalDialog>
  );
}
