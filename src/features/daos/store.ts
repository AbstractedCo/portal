import { selectedAccountAtom } from "../accounts/store";
import { atomWithLocalStorage } from "../jotai/utils";
import { idle } from "@reactive-dot/core";
import { useLazyLoadQueryWithRefresh } from "@reactive-dot/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useQueryRefresh } from "../../hooks/useQueryRefresh";
export const selectedDaoIdAtom = atomWithLocalStorage<number | undefined>(
  "@invarch-portal/selected-dao",
  undefined,
);

export function useLazyLoadSelectedDaoId() {
  const account = useAtomValue(selectedAccountAtom);

  const [accountCoreAssets, refresh] = useLazyLoadQueryWithRefresh((builder) =>
    account === undefined
      ? undefined
      : builder.readStorageEntries("CoreAssets", "Accounts", [account.address]),
  );

  useQueryRefresh(async () => {
    await refresh();
  });

  const selectedDaoId = useAtomValue(selectedDaoIdAtom);

  if (accountCoreAssets === idle) {
    return undefined;
  }

  return (
    accountCoreAssets.find(
      ({ keyArgs: [_, daoId] }) => daoId === selectedDaoId,
    ) ?? accountCoreAssets.at(0)
  )?.keyArgs[1];
}

export function useSetSelectedDaoId() {
  return useSetAtom(selectedDaoIdAtom);
}


