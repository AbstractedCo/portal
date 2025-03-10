import { useLazyLoadQuery } from "@reactive-dot/react";
import { css } from "../../../../styled-system/css";
import React from "react";

type AccountVoteProps = {
  daoId: number;
  address: string;
  onBalanceLoad?: (balance: { free: bigint }) => void;
};

export function AccountVote({ daoId, address, onBalanceLoad }: AccountVoteProps) {
  const balance = useLazyLoadQuery((builder) =>
    builder.readStorage("CoreAssets", "Accounts", [address, daoId]),
  );

  React.useEffect(() => {
    onBalanceLoad?.(balance);
  }, [balance, onBalanceLoad]);

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