import { css } from "../../../../styled-system/css";
import { useLazyLoadSelectedDaoId } from "../../../features/daos/store";
import { AccountListItem } from "../../../widgets/account-list-item";
import { useLazyLoadQuery } from "@reactive-dot/react";
import { createFileRoute } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";

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
          <tr key={address}>
            <td>
              <AccountListItem address={address} />
            </td>
            <td className={css({ textAlign: "center" })}>
              <AccountVote daoId={daoId} address={address} />
            </td>
            <td className={css({ textAlign: "center" })}>
              <button
                className={css({
                  color: "content.muted",
                  cursor: "pointer",
                  "&:hover": { color: "error" },
                })}
              >
                <Trash2Icon />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type AccountVoteProps = { daoId: number; address: string };

function AccountVote({ daoId, address }: AccountVoteProps) {
  const balance = useLazyLoadQuery((builder) =>
    builder.readStorage("CoreAssets", "Accounts", [address, daoId]),
  );

  return balance.free.toLocaleString();
}
