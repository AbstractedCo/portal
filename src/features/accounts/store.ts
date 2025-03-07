import { atomWithLocalStorage } from "../jotai/utils";
import type { WalletAccount } from "@reactive-dot/core/wallets.js";
import { atom, useAtomValue } from "jotai";
import { useLazyLoadQueryWithRefresh } from "@reactive-dot/react";
import { selectedDaoIdAtom } from "../daos/store";
import { useQueryRefresh } from "../../hooks/useQueryRefresh";

export const accountsAtom = atom<WalletAccount[]>([]);

export const selectedAccountIdAtom = atomWithLocalStorage<string | undefined>(
  "@invarch-portal/selected-account",
  undefined,
);

export const selectedAccountAtom = atom(
  (get) => {
    const selectedAccountId = get(selectedAccountIdAtom);

    if (selectedAccountId === undefined) {
      return;
    }

    return get(accountsAtom).find(
      (account) => account.wallet.id + account.address === selectedAccountId,
    );
  },
  (_, set, account: WalletAccount) =>
    set(selectedAccountIdAtom, account.wallet.id + account.address),
);

// Fallback address that's valid SS58 but impossible to have a private key for
const FALLBACK_ADDRESS = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";

const EMPTY_BALANCE = {
  free: 0n,
  reserved: 0n,
  frozen: 0n,
  flags: 0n,
};

// Personal balance hook
export function useAccountBalance() {
  const selectedAccount = useAtomValue(selectedAccountAtom);
  const isFallback = !selectedAccount;
  const queryAddress = selectedAccount?.address ?? FALLBACK_ADDRESS;

  const [result, refresh] = useLazyLoadQueryWithRefresh((builder) =>
    builder.readStorage("System", "Account", [queryAddress])
  );

  useQueryRefresh(async () => {
    await refresh();
  });

  if (isFallback) {
    return EMPTY_BALANCE;
  }

  return result.data ?? EMPTY_BALANCE;
}

// DAO balance hook
export function useDaoBalance() {
  const selectedDaoId = useAtomValue(selectedDaoIdAtom);
  let isFallback = selectedDaoId === undefined;

  // First query in the queue
  const [coreStorage, refreshCoreStorage] = useLazyLoadQueryWithRefresh((builder) =>
    builder.readStorage("INV4", "CoreStorage", [selectedDaoId ?? 0])
  );

  const daoAddress = coreStorage?.account ?? FALLBACK_ADDRESS;

  // Second query in the queue
  const [result, refreshBalance] = useLazyLoadQueryWithRefresh((builder) =>
    builder.readStorage("System", "Account", [daoAddress])
  );

  useQueryRefresh(async () => {
    await Promise.all([refreshCoreStorage(), refreshBalance()]);
  });

  isFallback = isFallback || !coreStorage?.account;

  if (isFallback) {
    return EMPTY_BALANCE;
  }

  return result.data ?? EMPTY_BALANCE;
}
