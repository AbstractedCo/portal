import { selectedAccountAtom } from "../accounts/store";
import { selectedDaoIdAtom } from "./store";
import { idle } from "@reactive-dot/core";
import { useLazyLoadQueryWithRefresh } from "@reactive-dot/react";
import { useAtomValue } from "jotai";

// interface DaoInfo {
//     metadata: string
//     minimum_support: bigint
//     required_approval: bigint
//     frozen_tokens: boolean
// }

// interface TokenBalance {
//     free: bigint
//     reserved: bigint
//     frozen: bigint
// }

// interface StorageEntry<T> {
//     keyArgs: [number, SS58String]
//     value: T
// }

// interface TokenHolder {
//     account: SS58String
//     balance: bigint
//     percentage: number
// }

export function useLazyLoadDaoInfo() {
  const account = useAtomValue(selectedAccountAtom);
  const selectedDaoId = useAtomValue(selectedDaoIdAtom);

  const [daoInfo] = useLazyLoadQueryWithRefresh((builder) =>
    account === undefined || selectedDaoId === undefined
      ? undefined
      : builder.readStorage("INV4", "CoreStorage", [selectedDaoId]),
  );

  if (!daoInfo || daoInfo === idle) {
    return undefined;
  }

  return daoInfo;
}
