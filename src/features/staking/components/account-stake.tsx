import type { WalletAccount } from "@reactive-dot/core/wallets.js";
import {
  useLazyLoadQuery,
  useNativeTokenAmountFromPlanck,
} from "@reactive-dot/react";

type AccountTotalStakeProps = { daoId: number; account: WalletAccount };

export function SuspendableAccountTotalStake({
  daoId,
  account,
}: AccountTotalStakeProps) {
  return useNativeTokenAmountFromPlanck(
    useLazyLoadQuery((builder) =>
      builder.readStorage("OcifStaking", "GeneralStakerInfo", [
        daoId,
        account.address,
      ]),
    ).at(-1)?.staked ?? 0n,
  ).toLocaleString(undefined, {
    notation: "compact",
  });
}
