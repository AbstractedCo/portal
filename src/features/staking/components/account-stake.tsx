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
  return useLazyLoadAccountCoreStake(coreId, account).toLocaleString(
    undefined,
    {
      notation: "compact",
    },
  );
}

export function useLazyLoadAccountCoreStake(
  coreId: number,
  account: WalletAccount,
) {
  return useNativeTokenAmountFromPlanck(
    useLazyLoadQuery((builder) =>
      builder.readStorage("OcifStaking", "GeneralStakerInfo", [
        coreId,
        account.address,
      ]),
    ).reduce((prev, curr) => prev + curr.staked, 0n),
  );
}
