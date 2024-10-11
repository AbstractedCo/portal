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
  return useNativeTokenAmountFromPlanck(
    useLazyLoadQuery((builder) =>
      builder.readStorage("OcifStaking", "GeneralStakerInfo", [
        coreId,
        account.address,
      ]),
    ).at(-1)?.staked ?? 0n,
  ).toLocaleString(undefined, {
    notation: "compact",
  });
}
