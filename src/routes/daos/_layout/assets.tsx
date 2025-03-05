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
import { SendIcon } from "lucide-react";
import { MutationError, pending } from "@reactive-dot/core";

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

      const tokens = coreTokens.map((token, index) => ({
        id: token.keyArgs[1],
        value: token.value,
        metadata: assetMetadata.at(index)!,
      }));

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

      const [transferDialogState, setTransferDialogState] = useState<{
        open: boolean;
        tokenId: number;
        symbol: string;
        decimals: number;
      } | null>(null);

      return (
        <>
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
                <th className={css({
                  textAlign: "center",
                  padding: "1rem",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.1)"
                })}>Actions</th>
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
                  <td className={css({
                    textAlign: "center",
                    padding: "1rem"
                  })}>
                    <Button
                      onClick={() => setTransferDialogState({
                        open: true,
                        tokenId: token.id,
                        symbol: token.metadata.symbol.asText(),
                        decimals: token.metadata.decimals,
                      })}
                      className={css({
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem",
                        borderRadius: "0.5rem",
                        backgroundColor: "transparent",
                        color: "content.muted",
                        "&:hover": {
                          color: "content.default",
                          backgroundColor: "surface.hover",
                        }
                      })}
                    >
                      <SendIcon size={18} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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
