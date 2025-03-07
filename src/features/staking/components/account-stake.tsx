import type { WalletAccount } from "@reactive-dot/core/wallets.js";
import {
  useLazyLoadQueryWithRefresh,
  useNativeTokenAmountFromPlanck,
} from "@reactive-dot/react";
import { useQueryRefresh } from "../../../hooks/useQueryRefresh";

type AccountTotalStakeProps = { daoId: number; account: WalletAccount };

export function SuspendableAccountTotalStake({
  daoId,
  account,
}: AccountTotalStakeProps) {
  const [result, refresh] = useLazyLoadQueryWithRefresh((builder) =>
    builder.readStorage("OcifStaking", "GeneralStakerInfo", [
      daoId,
      account.address,
    ])
  );

  useQueryRefresh(async () => {
    await refresh();
  });

  return useNativeTokenAmountFromPlanck(
    result.at(-1)?.staked ?? 0n,
  ).toLocaleString(undefined, {
    notation: "compact",
  });
}
