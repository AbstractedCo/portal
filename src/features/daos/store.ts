import { selectedAccountAtom } from "../accounts/store";
import { atomWithLocalStorage } from "../jotai/utils";
import { idle } from "@reactive-dot/core";
import { useLazyLoadQueryWithRefresh } from "@reactive-dot/react";
import { useAtomValue, useSetAtom } from "jotai";

export const selectedDaoIdAtom = atomWithLocalStorage<number | undefined>(
  "@invarch-portal/selected-dao",
  undefined,
);

export function useLazyLoadSelectedDaoId() {
  const account = useAtomValue(selectedAccountAtom);

  const accountCoreAssets = useLazyLoadQueryWithRefresh((builder) =>
    account === undefined
      ? undefined
      : builder.readStorageEntries("CoreAssets", "Accounts", [account.address]),
  );

  const selectedDaoId = useAtomValue(selectedDaoIdAtom);

  if (accountCoreAssets[0] === idle) {
    return undefined;
  }

  return (
    accountCoreAssets[0].find(
      ({ keyArgs: [_, daoId] }) => daoId === selectedDaoId,
    ) ?? accountCoreAssets[0].at(0)
  )?.keyArgs[1];
}

export function useSetSelectedDaoId() {
  return useSetAtom(selectedDaoIdAtom);
}

export function useLazyLoadDaoInfo() {
  const daoId = useLazyLoadSelectedDaoId();

  const isFallback = daoId === undefined;

  const daoInfo = useLazyLoadQueryWithRefresh((builder) =>
    builder.readStorage("INV4", "CoreStorage", [daoId ?? 0]),
  );

  if (isFallback) {
    return undefined;
  }

  return daoInfo[0];
}


