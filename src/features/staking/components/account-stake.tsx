import type { WalletAccount } from "@reactive-dot/core/wallets.js";
import {
  useLazyLoadQuery,
  useNativeTokenAmountFromPlanck,
} from "@reactive-dot/react";

type AccountTotalStakeProps = { coreId: number; account: WalletAccount };

export function SuspendableAccountTotalStake({
  coreId,
  account,
}: AccountTotalStakeProps) {
  const stakerInfo = useLazyLoadQuery((builder) =>
    builder.readStorage("OcifStaking", "GeneralStakerInfo", [
      coreId,
      account.address,
    ]),
  );

  return useNativeTokenAmountFromPlanck(
    stakerInfo.reduce((prev, curr) => prev + curr.staked, 0n),
  ).toLocaleString(undefined, {
    notation: "compact",
  });
}
