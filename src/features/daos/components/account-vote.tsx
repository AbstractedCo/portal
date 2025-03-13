import { css } from "../../../../styled-system/css";
import { useLazyLoadQuery } from "@reactive-dot/react";
import React from "react";

type AccountVoteProps = {
  daoId: number;
  address: string;
  onBalanceLoad?: (balance: { free: bigint }) => void;
};

export function AccountVote({
  daoId,
  address,
  onBalanceLoad,
}: AccountVoteProps) {
  const balance = useLazyLoadQuery((builder) =>
    builder.readStorage("CoreAssets", "Accounts", [address, daoId]),
  );

  React.useEffect(() => {
    onBalanceLoad?.(balance);
  }, [balance, onBalanceLoad]);

  const totalTokens = useLazyLoadQuery((builder) =>
    builder.readStorage("CoreAssets", "TotalIssuance", [daoId]),
  );

  const percentage =
    totalTokens === 0n ? 0 : Number((balance.free * 100n) / totalTokens);

  return (
    <>
      <td
        className={css({
          textAlign: "right",
          padding: "1rem",
          width: "120px",
          maxWidth: "120px",
        })}
      >
        {balance.free.toLocaleString()}
      </td>
      <td
        className={css({
          textAlign: "right",
          padding: "1rem",
          width: "80px",
          maxWidth: "80px",
        })}
      >
        {percentage.toFixed(2)}%
      </td>
    </>
  );
}
