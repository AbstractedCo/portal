import { selectedAccountAtom } from "../accounts/store";
import { atomWithLocalStorage } from "../jotai/utils";
import { idle } from "@reactive-dot/core";
import { useLazyLoadQuery } from "@reactive-dot/react";
import { useAtomValue, useSetAtom } from "jotai";

const selectedDaoIdAtom = atomWithLocalStorage<number | undefined>(
  "@invarch-portal/selected-dao",
  undefined,
);

export function useLazyLoadSelectedDaoId() {
  const account = useAtomValue(selectedAccountAtom);

  const accountCoreAssets = useLazyLoadQuery((builder) =>
    account === undefined
      ? undefined
      : builder.readStorageEntries("CoreAssets", "Accounts", [account.address]),
  );

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


