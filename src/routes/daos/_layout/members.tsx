import { css } from "../../../../styled-system/css";
import { ModalDialog } from "../../../components/modal-dialog";
import { Button } from "../../../components/button";
import { CircularProgressIndicator } from "../../../components/circular-progress-indicator";
import { TextInput } from "../../../components/text-input";
import { useLazyLoadSelectedDaoId } from "../../../features/daos/store";
import { AccountListItem } from "../../../widgets/account-list-item";
import { MutationError, pending } from "@reactive-dot/core";
import { useLazyLoadQuery, useMutation, useMutationEffect } from "@reactive-dot/react";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2Icon, UserPlusIcon } from "lucide-react";
import { useState } from "react";
import { useNotification } from "../../../contexts/notification-context";

export const Route = createFileRoute("/daos/_layout/members")({
  component: MembersPage,
  beforeLoad: () => ({ title: "Members" }),
});

function MembersPage() {
  const daoId = useLazyLoadSelectedDaoId();
  // console.log(daoId);

  if (daoId === undefined) {
    return null;
  }

  return <SuspendableDaoMembers daoId={daoId} />;
}

type SuspendableDaoMembersProps = {
  daoId: number;
};

function AddMemberDialog({ daoId, onClose }: { daoId: number; onClose: () => void }) {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("1");
  const [isProcessing, setIsProcessing] = useState(false);
  const { showNotification } = useNotification();

  const [mintState, mint] = useMutation((tx) =>
    tx.INV4.operate_multisig({
      dao_id: daoId,
      call: tx.INV4.token_mint({ target: address, amount: BigInt(amount) }).decodedCall,
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
        message: "Failed to add member: " + (error instanceof Error ? error.message : "Unknown error"),
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
          }
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
            const num = value.replace(/[^\d]/g, '');
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

function SuspendableDaoMembers({ daoId }: SuspendableDaoMembersProps) {
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);

  const memberAddresses = useLazyLoadQuery((builder) =>
    builder.readStorageEntries("INV4", "CoreMembers", [daoId]),
  ).map(({ keyArgs: [_, address] }) => address);

  return (
    <div className={css({
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
    })}>
      <table className={css({ width: "stretch" })}>
        <thead>
          <tr>
            <th className={css({ textAlign: "start" })}>User</th>
            <th>Votes</th>
            <th className={css({ visibility: "hidden" })}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {memberAddresses.map((address) => (
            <Member key={address} daoId={daoId} address={address} />
          ))}
        </tbody>
      </table>

      <Button
        onClick={() => setAddMemberDialogOpen(true)}
        className={css({
          alignSelf: "flex-end",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgb(241, 143, 123)",
          color: "black",
          padding: "1rem 1rem",
          borderRadius: "0.75rem",
          fontSize: "1rem",
          fontWeight: "500",
          border: "none",
          cursor: "pointer",
          minWidth: "160px",
          "&:hover": {
            backgroundColor: "rgb(241, 143, 123, 0.8)",
          }
        })}
      >
        <div style={{
          position: "relative",
          display: "flex",
          alignItems: "center"
        }}>
          <UserPlusIcon size={20} />
          <span style={{
            display: "block",
            lineHeight: "0px",
            paddingLeft: "7px",
            marginTop: "0px"
          }}>
            Add Member
          </span>
        </div>
      </Button>

      {addMemberDialogOpen && (
        <AddMemberDialog
          daoId={daoId}
          onClose={() => setAddMemberDialogOpen(false)}
        />
      )}
    </div>
  );
}

type MemberProps = { daoId: number; address: string };

function Member({ daoId, address }: MemberProps) {
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { showNotification } = useNotification();

  const [removeMemberState, removeMember] = useMutation((tx) =>
    tx.INV4.operate_multisig({
      dao_id: daoId,
      call: tx.INV4.token_burn({ target: address, amount: 0n }).decodedCall,
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
        <td>
          <AccountListItem address={address} />
        </td>
        <td className={css({ textAlign: "center" })}>
          <AccountVote daoId={daoId} address={address} />
        </td>
        <td className={css({ textAlign: "center" })}>
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
          <div className={css({
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
            alignItems: "center",
            textAlign: "center",
          })}>
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

type AccountVoteProps = { daoId: number; address: string };

function AccountVote({ daoId, address }: AccountVoteProps) {
  const balance = useLazyLoadQuery((builder) =>
    builder.readStorage("CoreAssets", "Accounts", [address, daoId]),
  );

  return balance.free.toLocaleString();
}
