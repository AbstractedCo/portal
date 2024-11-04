import { css } from "../../../../styled-system/css";
import { AlertDialog } from "../../../components/alert-dialog";
import { Button } from "../../../components/button";
import { CircularProgressIndicator } from "../../../components/circular-progress-indicator";
import { useLazyLoadSelectedDaoId } from "../../../features/daos/store";
import { AccountListItem } from "../../../widgets/account-list-item";
import { pending } from "@reactive-dot/core";
import { useLazyLoadQuery, useMutation } from "@reactive-dot/react";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/daos/_layout/members")({
  component: MembersPage,
  beforeLoad: () => ({ title: "Members" }),
});

function MembersPage() {
  const daoId = useLazyLoadSelectedDaoId();

  if (daoId === undefined) {
    return null;
  }

  return <SuspendableDaoMembers daoId={daoId} />;
}

type SuspendableDaoMembersProps = {
  daoId: number;
};

function SuspendableDaoMembers({ daoId }: SuspendableDaoMembersProps) {
  const memberAddresses = useLazyLoadQuery((builder) =>
    builder.readStorageEntries("INV4", "CoreMembers", [daoId]),
  ).map(({ keyArgs: [_, address] }) => address);

  return (
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
  );
}

type MemberProps = { daoId: number; address: string };

function Member({ daoId, address }: MemberProps) {
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  const [removeMemberState, removeMember] = useMutation((tx) =>
    tx.INV4.operate_multisig({
      core_id: daoId,
      call: tx.INV4.token_burn({ target: address, amount: 0n }).decodedCall,
      fee_asset: { type: "Native", value: undefined },
      metadata: undefined,
    }),
  );

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
        <AlertDialog
          title="Remove member"
          onClose={() => setRemoveDialogOpen(false)}
          confirmButton={
            <Button
              pending={removeMemberState === pending}
              onClick={() => {
                removeMember();
                setRemoveDialogOpen(false);
              }}
            >
              Confirm
            </Button>
          }
          dismissButton={
            <Button onClick={() => setRemoveDialogOpen(false)}>Cancel</Button>
          }
        >
          Propose to remove {address.slice(0, 4) + "..." + address.slice(-4)}{" "}
          from the DAO?
        </AlertDialog>
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
