import { useLazyLoadQuery } from "@reactive-dot/react";
import { css } from "../../../../styled-system/css";

type AccountVoteProps = { daoId: number; address: string };

export function AccountVote({ daoId, address }: AccountVoteProps) {
  const balance = useLazyLoadQuery((builder) =>
    builder.readStorage("CoreAssets", "Accounts", [address, daoId]),
  );

  const totalTokens = useLazyLoadQuery((builder) =>
    builder.readStorage("CoreAssets", "TotalIssuance", [daoId]),
  );

  const percentage = totalTokens === 0n ? 0 : Number((balance.free * 100n) / totalTokens);

  return (
    <>
      <td className={css({
        textAlign: "right",
        padding: "1rem",
        paddingRight: "2rem"
      })}>
        {balance.free.toLocaleString()}
      </td>
      <td className={css({
        textAlign: "right",
        padding: "1rem",
        paddingRight: "2rem"
      })}>
        {percentage.toFixed(2)}%
      </td>
    </>
  );
} 