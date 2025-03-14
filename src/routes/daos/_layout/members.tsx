import { css } from "../../../../styled-system/css";
import { Button } from "../../../components/button";
import { CircularProgressIndicator } from "../../../components/circular-progress-indicator";
import { ModalDialog } from "../../../components/modal-dialog";
import { TextInput } from "../../../components/text-input";
import { useNotification } from "../../../contexts/notification-context";
import { AccountVote } from "../../../features/daos/components/account-vote";
import { useLazyLoadSelectedDaoId } from "../../../features/daos/store";
import { AccountListItem } from "../../../widgets/account-list-item";
import { MutationError, pending } from "@reactive-dot/core";
import {
  useLazyLoadQuery,
  useMutation,
  useMutationEffect,
} from "@reactive-dot/react";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2Icon, UserPlusIcon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/daos/_layout/members")({
  component: MembersPage,
  beforeLoad: () => ({ title: "Members" }),
});

function MembersPage() {
  const daoId = useLazyLoadSelectedDaoId();
  // console.log(daoId);

  if (typeof daoId !== "number") {
    return <p>Please select or create a DAO</p>;
  }

  return <SuspendableDaoMembers />;

  function SuspendableDaoMembers() {
    const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);

    const memberAddresses = useLazyLoadQuery((builder) =>
      builder.readStorageEntries("INV4", "CoreMembers", [daoId!]),
    ).map(({ keyArgs: [_, address] }) => address);

    return (
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          width: "100%",
          maxWidth: "100%",
          overflow: "hidden",
        })}
      >
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "0.5rem",
          })}
        >
          <h2
            className={css({
              fontSize: "1.5rem",
              fontWeight: "bold",
              maxWidth: "calc(100% - 150px)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              "@media (max-width: 600px)": {
                maxWidth: "100%",
                fontSize: "1.2rem",
              },
            })}
          >
            DAO Members
          </h2>
          <Button
            onClick={() => setAddMemberDialogOpen(true)}
            className={css({
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgb(241, 143, 123)",
              color: "black",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.75rem",
              fontSize: "0.875rem",
              fontWeight: "500",
              border: "none",
              cursor: "pointer",
              "@media (min-width: 600px)": {
                padding: "1rem",
                fontSize: "1rem",
              },
              "&:hover": {
                backgroundColor: "rgb(241, 143, 123, 0.8)",
              },
            })}
          >
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <UserPlusIcon size={18} />
              <span>Add Member</span>
            </div>
          </Button>
        </div>

        <div
          className={css({
            overflowX: "auto",
            width: "100%",
          })}
        >
          <table
            className={css({
              width: "100%",
              borderCollapse: "collapse",
            })}
          >
            <thead>
              <tr>
                <th
                  className={css({
                    textAlign: "left",
                    padding: "1rem",
                  })}
                >
                  User
                </th>
                <th
                  className={css({
                    textAlign: "right",
                    padding: "1rem",
                  })}
                >
                  Voting Tokens
                </th>
                <th
                  className={css({
                    textAlign: "right",
                    padding: "1rem",
                  })}
                >
                  Vote Strength (%)
                </th>
                <th
                  className={css({
                    textAlign: "center",
                    padding: "1rem",
                    width: "60px",
                  })}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {memberAddresses.map((address) => (
                <Member key={address} daoId={daoId!} address={address} />
              ))}
            </tbody>
          </table>
        </div>

        {addMemberDialogOpen && (
          <AddMemberDialog
            daoId={daoId!}
            onClose={() => setAddMemberDialogOpen(false)}
          />
        )}
      </div>
    );
  }
}

function AddMemberDialog({
  daoId,
  onClose,
}: {
  daoId: number;
  onClose: () => void;
}) {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("1");
  const [isProcessing, setIsProcessing] = useState(false);
  const { showNotification } = useNotification();

  const [mintState, mint] = useMutation((tx) =>
    tx.INV4.operate_multisig({
      dao_id: daoId,
      call: tx.INV4.token_mint({ target: address, amount: BigInt(amount) })
        .decodedCall,
      fee_asset: { type: "Native", value: undefined },
      metadata: undefined,
    }),
  );

  useMutationEffect((event) => {
    setIsProcessing(true);

    if (event.value === pending) {
      showNotification({
        variant: "success",
        message: "Submitting transaction...",
      });
      return;
    }

    if (event.value instanceof MutationError) {
      setIsProcessing(false);
      showNotification({
        variant: "error",
        message: "Failed to submit transaction",
      });
      return;
    }

    switch (event.value.type) {
      case "finalized":
        setIsProcessing(false);
        if (event.value.ok) {
          showNotification({
            variant: "success",
            message: "Member added successfully!",
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
      await mint();
    } catch (error) {
      console.error("Failed to add member:", error);
      showNotification({
        variant: "error",
        message:
          "Failed to add member: " +
          (error instanceof Error ? error.message : "Unknown error"),
      });
    }
  };

  return (
    <ModalDialog
      title="Add Member"
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
          },
        })}
      >
        <TextInput
          label="Member Address"
          value={address}
          onChangeValue={setAddress}
          placeholder="Enter member address"
        />
        <TextInput
          label="Token Amount"
          value={amount}
          onChangeValue={(value) => {
            const num = value.replace(/[^\d]/g, "");
            if (num) setAmount(num);
          }}
          placeholder="Enter token amount"
        />
        <Button
          type="submit"
          disabled={mintState === pending || isProcessing}
          className={css({
            marginTop: "1rem",
            width: "stretch",
          })}
        >
          Add Member
        </Button>
      </form>
    </ModalDialog>
  );
}

type MemberProps = { daoId: number; address: string };

function Member({ daoId, address }: MemberProps) {
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showNotification } = useNotification();
  const [memberBalance, setMemberBalance] = useState<{ free: bigint } | null>(
    null,
  );

  const [removeMemberState, removeMember] = useMutation((tx) =>
    tx.INV4.operate_multisig({
      dao_id: daoId,
      call: tx.INV4.token_burn({
        target: address,
        amount: memberBalance?.free ?? 0n,
      }).decodedCall,
      fee_asset: { type: "Native", value: undefined },
      metadata: undefined,
    }),
  );

  useMutationEffect((event) => {
    setIsProcessing(true);

    if (event.value === pending) {
      showNotification({
        variant: "success",
        message: "Submitting transaction...",
      });
      return;
    }

    if (event.value instanceof MutationError) {
      setIsProcessing(false);
      showNotification({
        variant: "error",
        message: "Failed to submit transaction",
      });
      return;
    }

    switch (event.value.type) {
      case "finalized":
        setIsProcessing(false);
        if (event.value.ok) {
          showNotification({
            variant: "success",
            message: "Member removal initiated successfully!",
          });
          setRemoveDialogOpen(false);
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
    <>
      <tr>
        <td
          className={css({
            maxWidth: "200px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          })}
        >
          <AccountListItem address={address} />
        </td>
        <AccountVote
          daoId={daoId}
          address={address}
          onBalanceLoad={setMemberBalance}
        />
        <td
          className={css({
            textAlign: "center",
            padding: "1rem",
            width: "60px",
          })}
        >
          {removeMemberState === pending ? (
            <CircularProgressIndicator />
          ) : (
            <button
              className={css({
                color: "content.muted",
                cursor: "pointer",
                "&:hover": { color: "error" },
              })}
              onClick={() => setRemoveDialogOpen(true)}
            >
              <Trash2Icon />
            </button>
          )}
        </td>
      </tr>
      {removeDialogOpen && (
        <ModalDialog
          title="Remove Member"
          onClose={() => setRemoveDialogOpen(false)}
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
            <p>
              Are you sure you want to propose removing{" "}
              <span className={css({ fontWeight: "bold" })}>
                {address.slice(0, 4) + "..." + address.slice(-4)}
              </span>{" "}
              from the DAO?
            </p>
            <Button
              onClick={() => removeMember()}
              disabled={removeMemberState === pending || isProcessing}
              className={css({
                width: "stretch",
                backgroundColor: "error",
                color: "on-error",
                "&:hover": {
                  backgroundColor: "errorHover",
                },
              })}
            >
              Remove Member
            </Button>
          </div>
        </ModalDialog>
      )}
    </>
  );
}
